import { isAdmin, unauthorized } from "@/lib/auth";
import { suggestReplies } from "@/lib/content";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Drafts only. Nothing here ever posts to X.
export async function POST(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const { input } = (await req.json()) as { input?: unknown };
  if (typeof input !== "string" || !input.trim()) {
    return Response.json({ error: "Paste a post URL or its text." }, { status: 400 });
  }
  try {
    return Response.json(await suggestReplies(input));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
