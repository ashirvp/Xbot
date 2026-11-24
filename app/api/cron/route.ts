import { isCron, unauthorized } from "@/lib/auth";
import { getEnabled } from "@/lib/db";
import { berlinDate, runPost } from "@/lib/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called by Vercel Cron (see vercel.json). Vercel sends GET with the CRON_SECRET bearer token.
export async function GET(req: Request) {
  if (!isCron(req)) return unauthorized();
  if (!(await getEnabled())) return Response.json({ skipped: true, reason: "Auto-posting is off." });

  const slot = new URL(req.url).searchParams.get("slot");
  if (slot !== "morning" && slot !== "evening") {
    return Response.json({ error: "Unknown slot" }, { status: 400 });
  }
  const result = await runPost(`${berlinDate()}:${slot}`);
  return Response.json(result, { status: result.ok || result.skipped ? 200 : 500 });
}
