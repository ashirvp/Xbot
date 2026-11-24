import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isAdmin(req: Request): boolean {
  return safeEqual(req.headers.get("x-admin-password") ?? "", env("ADMIN_PASSWORD"));
}

export function isCron(req: Request): boolean {
  return safeEqual(req.headers.get("authorization") ?? "", `Bearer ${env("CRON_SECRET")}`);
}

export const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });
