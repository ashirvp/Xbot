import "server-only";
import { createHash } from "node:crypto";
import { chat } from "./ai";

const TOPICS = [
  "artificial intelligence",
  "AI agents",
  "large language models",
  "robotics",
  "automation",
  "technology",
  "startups",
  "entrepreneurship",
  "business and innovation",
];

const ANGLES = [
  "a contrarian take",
  "a sharp observation most people miss",
  "a dry, witty remark",
  "a prediction",
  "a lesson from building things",
  "a question that makes people think",
  "a comparison that reframes the topic",
];

const POST_SYSTEM = `You write posts for a personal X account. Rules:
- 1 or 2 sentences. Under 220 characters.
- Sound like a smart person thinking out loud, not a brand. Conversational, specific, opinionated.
- Occasionally witty, never cringe.
- No hashtags. No links. No @mentions. At most one emoji, usually none.
- No corporate language, no buzzword salad, no motivational quotes, no "In today's world".
- Don't start with "Hot take" or "Unpopular opinion".
- Output only the post text, nothing else. No quotes around it.`;

const REPLY_SYSTEM = `You suggest replies to X posts for a person interested in AI, tech and startups.
- Write exactly 3 different replies, one per line, no numbering, no quotes.
- Each 1 sentence, max 200 characters, natural and human, adds something (insight, question, light wit).
- No hashtags, no links, no flattery like "Great post!", at most one emoji in total.`;

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

export const hashText = (s: string) => createHash("sha256").update(normalize(s)).digest("hex");

function words(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((w) => w.length > 3));
}

/** Jaccard similarity of meaningful words, to catch near-duplicates, not just exact ones. */
function tooSimilar(a: string, previous: string[]): boolean {
  const wa = words(a);
  return previous.some((p) => {
    const wb = words(p);
    const inter = [...wa].filter((w) => wb.has(w)).length;
    const union = new Set([...wa, ...wb]).size;
    return union > 0 && inter / union >= 0.5;
  });
}

function clean(raw: string): string {
  return raw.trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();
}

/** Problems that would break a rule or cost extra (a link makes a post cost ~13x more on X). */
function problem(text: string): string | null {
  if (text.length < 20) return "too short";
  if (text.length > 280) return "too long";
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|io|ai|net|org|co)\b/i.test(text)) return "contains a link";
  if (/#\w/.test(text)) return "contains a hashtag";
  if (/@\w/.test(text)) return "contains a mention";
  if ((text.match(/\p{Extended_Pictographic}/gu) ?? []).length > 1) return "too many emojis";
  return null;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Generates a post that passes the rules and isn't a repeat of anything in `previous`. */
export async function generatePost(previous: string[]): Promise<string> {
  const avoid = previous.slice(0, 30).map((p) => `- ${p}`).join("\n");
  let lastProblem = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const prompt =
      `Topic: ${pick(TOPICS)}. Angle: ${pick(ANGLES)}.\n` +
      (avoid ? `\nThese were already posted. Say something genuinely different:\n${avoid}\n` : "") +
      (lastProblem ? `\nYour last draft was rejected (${lastProblem}). Try again.` : "");
    const text = clean(await chat(POST_SYSTEM, prompt));
    const p = problem(text) ?? (tooSimilar(text, previous) ? "too similar to an earlier post" : null);
    if (!p) return text;
    lastProblem = p;
  }
  throw new Error(`Could not generate a usable post (last issue: ${lastProblem})`);
}

/** Fetches a post's text through X's public oEmbed endpoint (free, no API credits used). */
async function textFromUrl(url: string): Promise<string> {
  const res = await fetch(
    `https://publish.twitter.com/oembed?omit_script=true&url=${encodeURIComponent(url)}`,
  );
  if (!res.ok) throw new Error("Couldn't read that post. Paste its text instead.");
  const { html } = (await res.json()) as { html: string };
  const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";
  return p
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

export async function suggestReplies(input: string): Promise<{ source: string; replies: string[] }> {
  const trimmed = input.trim();
  const isUrl = /^https?:\/\/(www\.)?(x|twitter)\.com\/\w+\/status\/\d+/i.test(trimmed);
  const source = isUrl ? await textFromUrl(trimmed) : trimmed;
  if (!source) throw new Error("No post text found.");
  const out = await chat(REPLY_SYSTEM, `Post:\n"""${source.slice(0, 2000)}"""`, 0.9);
  const replies = out
    .split("\n")
    .map((l) => clean(l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "")))
    .filter((l) => l.length > 0)
    .slice(0, 3);
  return { source, replies };
}
