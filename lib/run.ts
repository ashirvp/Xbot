import "server-only";
import { claimSlot, countPostedSince, finish, postedTexts, setText } from "./db";
import { generatePost, hashText } from "./content";
import { publish } from "./x";

export type RunResult =
  | { ok: true; text: string; tweetId: string }
  | { ok: false; skipped?: boolean; reason: string };

/** Claim slot -> check cap -> generate unique text -> publish -> record. */
export async function runPost(slot: string): Promise<RunResult> {
  const cap = Number(process.env.MAX_POSTS_PER_24H ?? 4);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  if ((await countPostedSince(since)) >= cap) {
    return { ok: false, skipped: true, reason: `Safety cap reached (${cap} posts in 24h).` };
  }

  const row = await claimSlot(slot);
  if (!row) return { ok: false, skipped: true, reason: `Slot ${slot} already handled.` };

  try {
    const previous = await postedTexts(200);
    let text = "";
    for (let i = 0; i < 3 && !text; i++) {
      const candidate = await generatePost(previous);
      if (await setText(row.id, candidate, hashText(candidate))) text = candidate;
      else previous.unshift(candidate);
    }
    if (!text) throw new Error("Generated text kept duplicating earlier posts.");

    const tweetId = await publish(text);
    await finish(row.id, { status: "posted", tweet_id: tweetId });
    return { ok: true, text, tweetId };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`[x-bot] ${slot} failed:`, reason);
    await finish(row.id, { status: "failed", error: reason.slice(0, 1000) }).catch(() => {});
    return { ok: false, reason };
  }
}

/** YYYY-MM-DD in Europe/Berlin. */
export function berlinDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(d);
}
