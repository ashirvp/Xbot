import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { env } from "./env";

const TWEETS_URL = "https://api.x.com/2/tweets";

const pct = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/** OAuth 1.0a user-context header. JSON bodies are not part of the signature. */
function oauthHeader(method: string, url: string): string {
  const params: Record<string, string> = {
    oauth_consumer_key: env("X_API_KEY"),
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: env("X_ACCESS_TOKEN"),
    oauth_version: "1.0",
  };
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${pct(k)}=${pct(params[k])}`)
    .join("&");
  const base = [method.toUpperCase(), pct(url), pct(paramString)].join("&");
  const signingKey = `${pct(env("X_API_SECRET"))}&${pct(env("X_ACCESS_TOKEN_SECRET"))}`;
  params.oauth_signature = createHmac("sha1", signingKey).update(base).digest("base64");
  return (
    "OAuth " +
    Object.keys(params)
      .sort()
      .map((k) => `${pct(k)}="${pct(params[k])}"`)
      .join(", ")
  );
}

export class XError extends Error {}

/** Publishes a post. Never retries on 429 or on errors that might mean the post went through. */
export async function publish(text: string): Promise<string> {
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(TWEETS_URL, {
      method: "POST",
      headers: { Authorization: oauthHeader("POST", TWEETS_URL), "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const body = await res.text();
    if (res.ok) return (JSON.parse(body) as { data: { id: string } }).data.id;

    if (res.status === 429) {
      const reset = Number(res.headers.get("x-rate-limit-reset"));
      const when = reset ? new Date(reset * 1000).toISOString() : "later";
      throw new XError(`X rate limit hit. Resets at ${when}.`);
    }
    if (res.status === 402) throw new XError(`X API credits exhausted or billing required (402): ${body}`);
    if (res.status === 401 || res.status === 403)
      throw new XError(`X rejected the credentials or permissions (${res.status}): ${body}`);
    // Only 500/503 before any processing are retried once. 502/504 may mean it was posted.
    lastErr = `X error ${res.status}: ${body}`;
    if (res.status !== 500 && res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new XError(lastErr);
}
