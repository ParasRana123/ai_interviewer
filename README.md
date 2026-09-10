# AI Interviewer 🎙️🤖

An intelligent, real-time AI technical interviewer platform that parses candidate resumes, extracts GitHub/LeetCode/Codeforces competitive programming metrics, conducts interactive spoken interviews using WebRTC, and evaluates candidate performance with detailed scoring and constructive feedback.

---

## 🌟 Key Features

- **Resume Parsing & Profile Enrichment**: Automatically parses candidate PDF resumes and pulls live stats from GitHub, LeetCode, and Codeforces profiles using Gemini 3.6 Flash.
- **Real-Time Voice Technical Interview**: Conducts conversational interviews using OpenAI Realtime Voice via WebRTC.
- **100% Free Speech-to-Text (STT)**: Uses the browser-native **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`) for real-time candidate speech transcription:
  - **Zero Cost**: Completely free with unlimited usage.
  - **No API Key Required**: No Deepgram API key, billing, or external token provisioning needed.
  - **Zero Server Latency**: Continuous streaming speech recognition in the client.
- **Live Audio Visualizer**: Real-time microphone audio frequency visualizer powered by Web Audio API.
- **Automated Performance Evaluation**: Automatically scores the candidate out of 10 and delivers comprehensive feedback based on full interview transcripts.

---

## 🏗️ Architecture & Technology Stack

```
AI Interviewer Monorepo (Bun + Turbo)
├── apps/
│   ├── frontend/        # React 19, TailwindCSS, Web Speech API, WebRTC
│   └── backend/         # Express 5, Prisma ORM, OpenAI Realtime, Google Gemini
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
| `GEMINI_API_KEY` | Used for PDF resume parsing and interview performance evaluation | Yes (Google AI Studio free tier) |
| `OPENAI_API_KEY` | Used for OpenAI Realtime Voice (`gpt-realtime-2`) WebRTC audio session | Requires OpenAI account |
| `DATABASE_URL` | PostgreSQL database connection string for Prisma | Yes (e.g. Supabase / Neon / Local Postgres) |

> [!NOTE]
> **Deepgram API Key is NOT required!**
> The application uses the browser's built-in **Web Speech API**, eliminating any need for Deepgram or other paid speech-to-text API keys.

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
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
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

- **Frontend**: `http://localhost:3000` (or `http://localhost:3001` depending on port config)
- **Backend**: `http://localhost:3001`