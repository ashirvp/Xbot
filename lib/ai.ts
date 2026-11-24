import "server-only";
import { env } from "./env";

/** One call to any OpenAI-compatible chat completions endpoint (Gemini, Groq, OpenRouter...). */
export async function chat(system: string, user: string, temperature = 1): Promise<string> {
  const url = `${env("AI_BASE_URL").replace(/\/$/, "")}/chat/completions`;
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("AI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env("AI_MODEL"),
        temperature,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const out = data.choices?.[0]?.message?.content?.trim();
      if (out) return out;
      lastErr = "AI returned an empty response";
    } else {
      lastErr = `AI error ${res.status}: ${(await res.text()).slice(0, 500)}`;
      // Retry only rate limits and server errors. 401/402/403 mean config or billing problems.
      if (res.status !== 429 && res.status < 500) break;
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(lastErr);
}
