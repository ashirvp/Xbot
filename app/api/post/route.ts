import { randomUUID } from "node:crypto";
import { isAdmin, unauthorized } from "@/lib/auth";
import { runPost } from "@/lib/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// "Generate & post now" button. Works even when auto-posting is off.
export async function POST(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const result = await runPost(`manual:${randomUUID()}`);
  return Response.json(result, { status: result.ok || result.skipped ? 200 : 500 });
}
