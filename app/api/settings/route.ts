import { isAdmin, unauthorized } from "@/lib/auth";
import { getEnabled, recentPosts, setEnabled } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const [enabled, posts] = await Promise.all([getEnabled(), recentPosts(10)]);
  return Response.json({ enabled, posts });
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const { enabled } = (await req.json()) as { enabled?: unknown };
  if (typeof enabled !== "boolean") return Response.json({ error: "enabled must be boolean" }, { status: 400 });
  await setEnabled(enabled);
  return Response.json({ enabled });
}
