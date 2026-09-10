# AI Technical Interviewer 🎙️🤖

An intelligent, real-time AI technical interviewer platform that parses candidate resumes, extracts GitHub/LeetCode/Codeforces competitive programming metrics, conducts interactive spoken interviews using **Google Gemini 3.6 Flash** + **Browser Web Speech APIs**, and evaluates candidate performance with detailed scoring and constructive feedback.

---

## 🌟 Key Features

- **100% Free & Zero-Cost Architecture**: Built completely without paid OpenAI API keys or paid speech services. Only requires a free Google Gemini API key!
- **Resume Parsing & Profile Enrichment**: Automatically parses candidate PDF resumes and pulls live stats from GitHub, LeetCode, and Codeforces profiles using Gemini 3.6 Flash.
- **Dynamic Gemini & Adaptive NLU Conversational Engine**:
  - Conducts personalized multi-turn technical interviews probing resume projects, system design, and algorithmic problem-solving.
  - **Intent & Correction Understanding**: Automatically distinguishes between microphone/audio checks (*"can you hear me"*), question repeat requests, technical answers, and candidate corrections (*"no actually, there was no data validation, it was a collaborative music room"*).
  - **Semantic Concept Extraction**: Dynamically identifies key technical domains in candidate speech (real-time sync, WebSockets, music rooms, database design, caching, search debouncing, API scaling) and asks deeply relevant technical questions.
  - **100% Anti-Repetition Guarantee**: Tracks conversational history across the entire session to ensure no question, phrasing, or topic is ever repeated.
  - **Quota Resilience & Graceful Fallback**: Gracefully transitions to the local Adaptive NLU Dialogue Engine if external Gemini API limits are reached, ensuring zero downtime and instant speech response times.
- **Realistic 2-Tile Voice Call UI (AI & Candidate Avatars)**:
  - **AI Senior Interviewer Tile**: Realistic avatar with futuristic glowing orb, concentric animated sound ripples (`animate-ping`), dynamic frequency wave bars, and real-time state pills (`Speaking`, `Analyzing`, `Listening`).
  - **Candidate Avatar Tile**: Dynamic initials avatar, real-time Web Audio API frequency equalizer responding live to candidate speech, and turn metrics.
  - **Live Closed Captions Strip**: Real-time meeting subtitle bar (like Google Meet / Zoom CC) showing spoken dialogue synchronously.
  - **In-Call Controls Floating Toolbar**: Sleek bottom dock with live call timer (`03:45`), Mic Mute/Unmute, AI Speaker Mute/Unmute, Replay Last Question, Fallback Chat Drawer, and prominent Red End-Call Hangup button (`End Call & View Report`).
- **Free Spoken Interactivity (STT & TTS)**:
  - **Speech-to-Text (STT)**: Browser-native **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`) for real-time speech transcription with zero latency.
  - **Text-to-Speech (TTS)**: Browser-native **Speech Synthesis API** (`speechSynthesis`) with automatic natural voice selection and continuous speech queue management.
- **Intelligent Turn-Taking State Machine**: Automatically pauses microphone listening while the AI speaks to prevent audio feedback/echo loops and resumes listening seamlessly.
- **Automated Performance Evaluation & Comprehensive Report**:
  - Automatically evaluates candidate answers out of 10 with constructive feedback.
  - **Where You Were Exceptional**: 2–3 structured bullet points highlighting strong architectural and problem-solving skills.
  - **Areas for Improvement**: 2–3 actionable growth recommendations for subsequent rounds.
  - **Complete Transcript Log**: Displayed cleanly at the end of the interview in the evaluation dashboard.
  - Export complete interview reports as **Markdown (`.md`)** or **JSON (`.json`)**, or copy to clipboard with one click.

---

## 🏗️ Architecture & Technology Stack

```
AI Interviewer Monorepo (Bun + Turbo)
├── apps/
│   ├── frontend/        # React 19, TailwindCSS, Web Speech STT & TTS, Web Audio API
│   └── backend/         # Express 5, Prisma ORM, Google Gemini 3.6 Flash, PostgreSQL
└── packages/
    ├── ui/              # Shared UI components
    ├── typescript-config# Shared TypeScript configurations
    └── eslint-config    # Linting rules
```

---

## 🔑 Environment Variables & API Keys

### Required Backend API Keys (`apps/backend/.env`)

| Variable | Description | Free Tier Available? |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Powers resume extraction, conversational interview turn generation, and final candidate evaluation | **Yes** (100% Free via [Google AI Studio](https://aistudio.google.com/)) |
| `DATABASE_URL` | PostgreSQL database connection string for Prisma ORM | **Yes** (e.g. Supabase / Neon / Local Postgres) |

> [!NOTE]
> **No OpenAI or Deepgram API Keys Required!**
> This project operates 100% on Google's free Gemini API combined with browser-native Web Speech APIs.

---

## 🚀 Getting Started

### 1. Install Dependencies
Ensure you have [Bun](https://bun.com) (>= 1.2) installed:
```bash
bun install
```

### 2. Configure Backend Environment
Create `apps/backend/.env`:
```env
GEMINI_API_KEY="your_google_gemini_api_key_here"
DATABASE_URL="postgresql://user:password@localhost:5432/interview_db?schema=public"
```

Generate Prisma client & run database migrations:
```bash
cd apps/backend
bun prisma generate
bun prisma db push
cd ../..
```

### 3. Run Development Servers
Start both backend and frontend concurrently:
```bash
bun dev
```

- **Frontend**: `http://localhost:3000` (or Vite assigned port)
- **Backend API**: `http://localhost:3001`