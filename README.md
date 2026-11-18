# My Personal English Tutor 🎙️

A private AI English teacher for daily speaking practice: voice conversations, gentle corrections, long-term memory of your mistakes, daily reports, progress charts and a vocabulary notebook. It's installable on Android as an app (PWA).

Built with **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4**. **Claude** (Anthropic API) is the tutor, voice uses the **browser's speech engine** or **OpenAI speech** (optional), and data lives in **Supabase** or a local JSON file.

---

## Features

| Area | What it does |
|---|---|
| **Daily conversation** | A new topic every day from 12 real-life categories (daily life, family, travel, shopping, work, pharmacy & healthcare, supply chain, news, technology & AI, education, opinions, role-plays). Recent topics aren't repeated, and roughly every 6th lesson goes back to an older, lower-scoring topic so you can see your progress. There's also **Surprise me** and **Choose my own topic**. |
| **Lesson structure** | Title, a short introduction, 6–8 useful expressions, then a conversation where the tutor asks one question at a time, with follow-ups and a review at the end. Claude writes every lesson from your history. Nothing is scripted. |
| **3 modes** | **Free conversation**, **Role play** (the tutor plays the other character: waiter, hotel receptionist, interviewer, manager, pharmacist, doctor…), and **Intensive learning** (more corrections, repetition drills, harder sentences). |
| **Error correction** | At most one correction per turn, shown as a card: the wrong words, the natural version, and a one-line reason. Categories are grammar / vocabulary / sentence structure / naturalness / pronunciation (a guess from the transcript). The tutor fixes recurring and important mistakes first, may invite you to **say it again**, then carries on with the conversation. |
| **Voice** | Tap the mic, speak, and the tutor answers aloud. Every reply has a **Replay** button, and you can see the full transcript. **Hands-free mode** listens again automatically after the tutor speaks. You can type instead at any time. |
| **Learning memory** | Stores completed sessions and topics, recurring mistake patterns (with examples, frequency and an "improving" counter), new vocabulary, words you struggle with, scores, strengths, weaknesses, and personal facts the tutor learned (you can view and delete these in Settings). Every new session starts from this memory. |
| **Continue where we stopped** | Every message is saved as it happens. If you open an unfinished conversation after a break (minutes or days later), the tutor welcomes you back, reminds you of the topic, its last question and your last answer, and goes on without repeating the introduction. Starting a new topic keeps the old one in **Lessons**. |
| **Daily report** | Scores from 1 to 10 for grammar, vocabulary, sentence construction, fluency and comprehension. Pronunciation shows *Not assessed* because speech-recognition transcripts can't measure it reliably. The report also gives your 3 most important mistakes with corrections, 5 new expressions (saved to your notebook automatically), 3 personalised practice sentences you can listen to, and a recommendation for tomorrow. |
| **Adaptive level** | The levels are B1, B1+, B2, B2+ and C1. You move up only when your **last 5 sessions at your current level** average ≥ 7.5 with none below 6.5. You move down a step if those 5 average < 4.5. One good conversation never changes your level. |
| **Dashboard** | Level, streak, total conversations, minutes, vocabulary count, today's goal bar, 7-day chart, areas to improve, the tutor's recommendation, expressions due for review, recent lessons and an AI weekly summary. |
| **Vocabulary notebook** | Save, review and practise expressions. Flashcards use spaced repetition (1 → 2 → 4 → 7 → 14 → 30 → 60 days). In **Use it**, you say or type your own sentence and the tutor checks it. Filters: All / Due / Struggling / Mastered. |
| **Progress** | Charts of your overall score and each skill over time, a table view, level history and your most frequent mistakes. |
| **UX** | Mobile-first design, light/dark/system theme, English and Arabic interface (RTL), and an installable PWA with icon, standalone mode, offline page and service worker. |

---

## 1. Quick start (local)

Requirements: **Node.js 20+** and an **Anthropic API key**.

```bash
npm install
cp .env.example .env.local     # then edit it (see below)
npm run dev                    # http://localhost:3000
```

The minimum `.env.local`:

```ini
ANTHROPIC_API_KEY=sk-ant-...
APP_PASSWORD=choose-a-password
AUTH_SECRET=<output of: openssl rand -base64 48>
```

Open the app, type your password, and press **Start today's conversation**. With no database configured, data is saved in `data/tutor-db.json`.

> On your phone (same Wi-Fi), you can open `http://<your-computer-ip>:3000`, but **the microphone needs HTTPS** on phones. For real phone use, deploy it (section 4), or use a tunnel such as `npx localtunnel --port 3000` or Cloudflare Tunnel.

### Commands

```bash
npm run dev      # development server
npm run build    # production build
npm start        # run the production build
npm test         # unit tests (levels, streaks, memory merging, topic rotation, spaced repetition)
npm run lint     # TypeScript type-check
npm run icons    # regenerate PNG icons from public/icons/icon.svg
```

---

## 2. Configuration (environment variables)

Every key stays **on the server**. The browser never sees an API key: all AI and voice calls go through the app's own `/api/*` routes.

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Create one at <https://console.anthropic.com> → *API Keys* (prepaid credit needed). |
| `APP_PASSWORD` | ✅ | The password you log in with. |
| `AUTH_SECRET` | ✅ | A random string of 16+ characters that signs the login cookie (`openssl rand -base64 48`). |
| `CLAUDE_MODEL` | – | Default `claude-opus-5-5`. |
| `CLAUDE_CHAT_EFFORT` | – | `low` (default; fastest replies) / `medium` / `high`. |
| `CLAUDE_ANALYSIS_EFFORT` | – | Effort for lesson planning and reports. Default `medium`. |
| `CLAUDE_FALLBACKS` | – | Server-side refusal fallback is on for supported models. Set `off` to disable it. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | for cloud hosting | Persistent Postgres database (section 3). |
| `DATA_DIR` | – | Folder for the JSON file store when Supabase isn't used (default `./data`). |
| `OPENAI_API_KEY` | – | Turns on **Cloud voice** (natural TTS, plus speech recognition that works in every browser). |
| `OPENAI_STT_MODEL` / `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` | – | Defaults: `gpt-4o-mini-transcribe`, `gpt-4o-mini-tts`, `coral`. |

The **Settings → System status** card shows which features are configured.

---

## 3. Database: Supabase (recommended for cloud hosting)

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. Go to **Project Settings → API** and copy the **Project URL** into `SUPABASE_URL` and the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY`. Keep the service_role key secret and only on the server.

Row Level Security is enabled with no public policies, so the public "anon" key can't read anything. Only the server, which holds the service-role key, can.

Without Supabase, the app uses a JSON file. It writes atomically (temp file, then rename), so a crash can't corrupt it. This is fine on your own computer, a VPS or Docker with a volume. **It does not work on Vercel/Netlify**, because their file systems are temporary.

---

## 4. Deployment (HTTPS, installable on Android)

### Option A: Vercel + Supabase (easiest)
1. Push this repository to GitHub.
2. At <https://vercel.com/new>, import the repo. The framework preset is Next.js and needs no changes.
3. Add the environment variables `ANTHROPIC_API_KEY`, `APP_PASSWORD`, `AUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and, optionally, `OPENAI_API_KEY`.
4. Deploy. You get an HTTPS URL such as `https://my-tutor.vercel.app`.

> Report generation can take 20–60 s. API routes set `maxDuration` up to 180 s, which Vercel's current plans allow with Fluid compute (on by default). If you see timeouts, check *Project → Settings → Functions*.

### Option B: Docker / VPS (file store or Supabase)
```bash
docker build -t english-tutor .
docker run -d -p 3000:3000 --env-file .env.local -v tutor-data:/app/data --name tutor english-tutor
```
Put it behind HTTPS (for example Caddy: `caddy reverse-proxy --from tutor.example.com --to localhost:3000`).

### Install on your Android phone
1. Open your HTTPS URL in **Chrome** and log in. You stay logged in for 180 days.
2. Tap **⋮ → Add to Home screen / Install app**, or use the **Install app** button in Settings.
3. Open it from the home screen. It runs full-screen with its own icon and splash screen.
4. The first time you tap the mic, allow microphone access.

---

## 5. Voice: how it works and which option to choose

| | Browser voice (free, default) | Cloud voice (`OPENAI_API_KEY`) |
|---|---|---|
| Speech-to-text | Web Speech API (`SpeechRecognition`), shows live words as you speak | You record, then the server sends the audio to OpenAI `gpt-4o-mini-transcribe` |
| Text-to-speech | `speechSynthesis` (voices from your device) | OpenAI `gpt-4o-mini-tts`, a natural teacher voice with replay caching |
| Works in | Chrome/Edge on Android & desktop (Safari partly; **not Firefox**) | Any modern browser |
| Cost | Free | About $0.003/min to transcribe plus about $0.015/min of speech (third-party estimates, checked Nov 2026; confirm at <https://openai.com/api/pricing>) |

With **Automatic** (Settings → Voice) the app uses Cloud voice when the key is set and the browser voice otherwise. If Cloud TTS fails, it falls back to the browser voice. You can always type instead.

*Why not a real-time speech-to-speech API?* Real-time voice models answer by themselves and can't use Claude as the teacher. This app keeps Claude as the one consistent tutor and uses fast speech-to-text and text-to-speech around it. Hands-free mode gives you a natural back-and-forth without tapping.

*Pronunciation:* transcripts can't measure pronunciation reliably, so the report doesn't give it a score. The tutor only flags a *likely* mispronounced word when the transcript clearly shows one (for example a similar-sounding word that makes no sense).

---

## 6. Costs (Claude)

Model `claude-opus-5-5`: **$4 / million input tokens, $20 / million output tokens** (Anthropic pricing, Nov 2026). The persona, the session context and the growing conversation use **prompt caching**, so each turn mostly pays for the newest messages. A 25-minute daily session usually costs a few cents. To save money, you can set `CLAUDE_MODEL=claude-sonnet-5-5` ($2/$10) or `claude-haiku-5-5` (cheapest; it has no refusal fallback, and the app handles that automatically).

---

## 7. Architecture

```
app/
  page.tsx               Dashboard (today's topic, continue card, stats, charts, focus areas, weekly summary)
  session/[id]/page.tsx  Conversation screen (mic, transcript, corrections, replay, lesson panel) + report
  history | vocabulary | progress | settings | login
  api/
    sessions/            POST start (daily | surprise | custom | revisit), GET list
    sessions/[id]/       GET, message, retry, resume, end (assessment + memory update)
    dashboard, profile, vocab, vocab/[id]/practice, weekly
    voice/stt, voice/tts Cloud voice proxy (keys stay server-side)
    auth/login|logout, health
lib/
  tutor/prompts.ts       Persistent tutor persona ("Emma") + learner context built from memory
  tutor/engine.ts        Claude calls with structured outputs (Zod): lesson plan, turn, assessment, surprise, practice, weekly
  tutor/claude.ts        Anthropic SDK client, effort, prompt caching, refusal fallback, typed error mapping
  service.ts             Session lifecycle, resume logic, memory updates, dashboard aggregation
  learning.ts            Pure logic: adaptive level, streaks, active time, mistake merging, spaced repetition
  topics.ts              Topic catalog + daily rotation / revisit scheduling
  store/                 Supabase store | atomic JSON-file store
components/useVoice.ts   Voice engine (Web Speech API or MediaRecorder + cloud, silence detection, TTS queue)
proxy.ts                 Auth gate for every page and API route (signed HttpOnly cookie)
public/sw.js, manifest   PWA
```

**How a turn works:** your words (voice or text) are saved immediately, then the full session transcript is sent to Claude with the cached persona and the session's frozen learner context. Claude returns structured JSON (`reply`, `correction`, `repeatPrompt`, `praise`, the expressions you used, new facts), which is saved and then spoken aloud.

**Error handling:** the SDK retries rate limits, 5xx errors and network errors. Clear messages explain an invalid key, missing credit, a refusal, being offline and so on. If an AI call fails, your message is already saved, and **Retry** asks only for the tutor's reply.

**Security:** the login is a password compared in constant time, with an HMAC-signed HttpOnly cookie and basic brute-force throttling. Every page and API route sits behind the proxy, all API keys stay server-side, and Supabase RLS denies all public access.

---

## 8. Troubleshooting

- **"The tutor is not configured yet"**: set `ANTHROPIC_API_KEY` and restart or redeploy.
- **"Your Anthropic account has no credit left"**: add credit in the Anthropic Console (*Billing*).
- **The mic button is disabled or shows "not available"**: use Chrome, or set `OPENAI_API_KEY` for Cloud voice. Phones need HTTPS.
- **"Microphone access was blocked"**: tap the lock icon in the address bar, then *Permissions → Microphone → Allow*.
- **Data disappears on Vercel**: configure Supabase (section 3).
- **The tutor's voice sounds robotic**: choose another voice in Settings (on Android, "Google US English" works well) or turn on Cloud voice.
