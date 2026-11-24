import "server-only";
import { env } from "./env";

// Minimal Supabase REST (PostgREST) client. Server-side only, service role key.
async function sb(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Database error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type PostRow = {
  id: number;
  slot: string;
  text: string | null;
  status: "pending" | "posted" | "failed";
  tweet_id: string | null;
  error: string | null;
  created_at: string;
};

export async function getEnabled(): Promise<boolean> {
  const rows = await json<{ enabled: boolean }[]>(await sb("settings?id=eq.1&select=enabled"));
  return rows[0]?.enabled ?? false;
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await json(await sb("settings?id=eq.1", { method: "PATCH", body: JSON.stringify({ enabled }) }));
}

/** Claims a slot. Returns null if the slot was already claimed (prevents double posting). */
export async function claimSlot(slot: string): Promise<PostRow | null> {
  const res = await sb("posts", { method: "POST", body: JSON.stringify({ slot }) });
  if (res.status === 409) return null;
  return (await json<PostRow[]>(res))[0];
}

/** Sets the text. Returns false if the same text (normalized) was used before. */
export async function setText(id: number, text: string, textHash: string): Promise<boolean> {
  const res = await sb(`posts?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ text, text_hash: textHash }),
  });
  if (res.status === 409) return false;
  await json(res);
  return true;
}

export async function finish(
  id: number,
  patch: { status: "posted" | "failed"; tweet_id?: string; error?: string },
): Promise<void> {
  await json(await sb(`posts?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }));
}

export async function recentPosts(limit: number): Promise<PostRow[]> {
  return json<PostRow[]>(await sb(`posts?select=*&order=created_at.desc&limit=${limit}`));
}

export async function postedTexts(limit: number): Promise<string[]> {
  const rows = await json<{ text: string }[]>(
    await sb(`posts?select=text&text=not.is.null&order=created_at.desc&limit=${limit}`),
  );
  return rows.map((r) => r.text);
}

export async function countPostedSince(iso: string): Promise<number> {
  const rows = await json<{ id: number }[]>(
    await sb(`posts?select=id&status=eq.posted&created_at=gte.${encodeURIComponent(iso)}`),
  );
  return rows.length;
}
