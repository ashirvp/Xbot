# X bot

Posts 2 short AI-written posts a day to your X account. Next.js on Vercel Hobby, Vercel Cron, Supabase Free.

- **Schedule:** 07:00 and 17:00 UTC = 08:00 and 18:00 Berlin in winter, 09:00 and 19:00 in summer.
  Vercel Hobby fires anywhere within that hour (±59 min), and allows each cron at most once a day, so there are two cron entries.
- **Off by default.** Nothing posts until you switch it on in the control page.
- **Control page** (`/`, password protected): on/off switch, "Generate & post now", reply ideas (drafts only, never posted), last 10 posts.

## Costs (checked 24 Nov 2026, verify on the official pages)

| Service | Cost |
|---|---|
| X API | No free tier for new apps. Pay-per-use prepaid credits, about **$0.015 per post** (text only). 2 posts/day ≈ **$0.90/month**. Posts with a link cost about $0.20, so the bot rejects any text with a link. |
| Vercel Hobby + Cron | Free. |
| Supabase | Free plan. Free projects pause after a week with no activity; the daily cron keeps it active. |
| AI | Free tier possible (e.g. Google Gemini Flash models via AI Studio, or Groq). See note below. |
| Reply ideas | Free: reads posts through X's public oEmbed, not the paid API. |

**Spending guard:** `MAX_POSTS_PER_24H` (default 4) blocks posting beyond that, cron and manual combined. Turn off auto-recharge in the X developer console if you want a hard ceiling.

**AI free tier note:** Gemini's free tier needs no billing account, but Google may use free-tier prompts to improve its products, and Google's terms say the unpaid tier shouldn't be used for products serving users in the EEA. A private bot for your own account is a grey area; if you'd rather avoid it, use Groq's free tier or a paid key. Any OpenAI-compatible endpoint works.

## Setup (about 20 minutes)

1. **X developer account** at developer.x.com. Create a project and app.
   - User authentication settings: App permissions **Read and write** (set this *before* generating tokens).
   - Keys and tokens: copy API Key + Secret, then generate **Access Token + Secret** (for your own account).
   - Buy credits (this is the paid step, $5 or so lasts months).
2. **Supabase**: create a free project, open SQL Editor, run `supabase.sql`. Copy the Project URL and the `service_role` key (Settings > API).
3. **AI key**: e.g. aistudio.google.com > Get API key, or console.groq.com.
4. **Deploy**: push this folder to a GitHub repo, import it in Vercel, add every variable from `.env.example` under Settings > Environment Variables, deploy.
   - `ADMIN_PASSWORD` and `CRON_SECRET`: long random strings (`openssl rand -hex 24`).
5. Open your Vercel URL, enter the password, press **Generate & post now** once to test, then **Turn on**.

## Local dev

```bash
cp .env.example .env.local   # fill in
npm install
npm run dev
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron?slot=morning"
```

## How it avoids duplicates

- Each cron run claims a unique slot (`2026-11-24:morning`) in the database first, so a retried or double-fired cron can't post twice.
- Text is normalized and hashed; the hash is unique in the database.
- New drafts are compared word-by-word with the last 200 posts and rejected if they overlap by 50% or more; the last 30 are shown to the AI as "already posted".

## Failures

- X 429: stops and logs the reset time; that slot is skipped (no retry storm).
- X 401/402/403: logged with the reason (bad keys, wrong permissions, out of credits).
- X 500/503: retried once. 502/504 aren't retried, because the post may have gone through.
- AI 429/5xx: retried twice with backoff.
- Failures show in red on the control page and in Vercel logs.
