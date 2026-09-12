# 🚀 Full Deployment Guide: AI Technical Interviewer

This guide provides step-by-step instructions to deploy the **AI Technical Interviewer** platform into production:
- **Backend**: Deployed as a Web Service on [Render](https://render.com) (or Docker).
- **Frontend**: Deployed as a Single Page Application (SPA) on [Vercel](https://vercel.com).
- **Database**: Free cloud PostgreSQL on [Neon](https://neon.tech) or [Supabase](https://supabase.com).

---

## 📋 Prerequisites & API Keys

| Service | Purpose | Cost | Sign-up Link |
| :--- | :--- | :--- | :--- |
| **Google Gemini API** | LLM Engine for parsing resumes, real-time interview turns, and evaluation reports | **100% Free** | [Google AI Studio](https://aistudio.google.com/) |
| **PostgreSQL Database** | Stores candidate profiles, messages, and interview evaluation records | **Free Tier** | [Neon](https://neon.tech) or [Supabase](https://supabase.com) |
| **Render** | Hosts the Express / Bun backend service | **Free Tier** | [Render](https://render.com) |
| **Vercel** | Hosts the React / Bun frontend application | **Free Tier** | [Vercel](https://vercel.com) |

---

## 🗄️ Step 1: Set Up Cloud PostgreSQL Database

1. Sign up / log in to [Neon Console](https://console.neon.tech/) or [Supabase](https://supabase.com/).
2. Create a new project named `ai-interviewer-db`.
3. Copy your connection string (`DATABASE_URL`). It will look like:
   ```env
   postgresql://neondb_owner:password@ep-cool-project-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Run Prisma database migrations locally to create the database tables:
   ```bash
   cd apps/backend
   DATABASE_URL="your-neon-connection-string" bun x prisma db push
   ```
   *(Or `bun run prisma migrate deploy`)*

---

## ⚙️ Step 2: Deploy Backend to Render

### Option A: 1-Click Render Blueprint (Recommended)
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub repository: `https://github.com/ParasRana123/ai_interviewer`.
4. Render will automatically read the root [render.yaml](render.yaml) file.
5. In the environment variables prompt, provide:
   - `GEMINI_API_KEY`: *(Your Google AI Studio key)*
   - `DATABASE_URL`: *(Your PostgreSQL database connection string)*
6. Click **Apply**. Render will build and launch your backend service.

---

### Option B: Manual Web Service Setup on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
2. Connect your GitHub repository (`ParasRana123/ai_interviewer`).
3. Fill in the following configuration details:
   - **Name**: `ai-interviewer-backend`
   - **Region**: `Oregon (US West)` (or closest to your DB)
   - **Branch**: `main`
   - **Root Directory**: *(Leave empty or set to root `.`)*
   - **Runtime**: `Node` (or `Docker`)
   - **Build Command**:
     ```bash
     bun install && cd apps/backend && bun x prisma generate
     ```
   - **Start Command**:
     ```bash
     cd apps/backend && bun run index.ts
     ```
   - **Instance Type**: `Free`
4. Expand **Advanced** > **Environment Variables** and add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Production mode |
   | `GEMINI_API_KEY` | `AIzaSy...` | Your Google Gemini API Key |
   | `DATABASE_URL` | `postgresql://...` | Your PostgreSQL Connection String |
   | `PORT` | `10000` | Port for Render routing |
   | `CORS_ORIGIN` | `*` | Allowed origins (or your Vercel URL) |
5. Click **Create Web Service**.
6. Once deployed, note down your backend URL (e.g., `https://ai-interviewer-backend.onrender.com`).
7. Test the health check endpoint in your browser:
   ```
   https://ai-interviewer-backend.onrender.com/health
   ```
   Should return: `{"status":"healthy","uptime":...}`

---

## 💻 Step 3: Deploy Frontend to Vercel

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** > **Project**.
3. Import your GitHub repository: `ParasRana123/ai_interviewer`.
4. In the **Configure Project** screen:
   - **Project Name**: `ai-interviewer-frontend`
   - **Framework Preset**: Select **Other**
   - **Root Directory**: Click **Edit** and select `apps/frontend`
5. Expand **Build and Output Settings**:
   - **Build Command**: `bun run build.ts`
   - **Output Directory**: `dist`
   - **Install Command**: `bun install`
6. Expand **Environment Variables** and add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `VITE_BACKEND_URL` | `https://ai-interviewer-backend.onrender.com` | Your Render Backend URL from Step 2 |
7. Click **Deploy**.
8. Vercel will build the frontend bundle with `vercel.json` SPA routing support.
9. Your application will be live at: `https://ai-interviewer-frontend.vercel.app`!

---

## 🔗 Step 4: Final Connection & CORS Verification

1. Go back to your [Render Dashboard](https://dashboard.render.com/) for `ai-interviewer-backend`.
2. Update the `FRONTEND_URL` environment variable to your exact Vercel URL:
   ```env
   FRONTEND_URL=https://ai-interviewer-frontend.vercel.app
   CORS_ORIGIN=https://ai-interviewer-frontend.vercel.app
   ```
3. Render will automatically redeploy the backend with CORS access granted.

---

## 🧪 Step 5: Test the Live Application

1. Open your Vercel URL (`https://ai-interviewer-frontend.vercel.app`).
2. Upload a sample candidate resume (PDF).
3. The platform parses skills and GitHub/LeetCode stats.
4. Click **Start Interview** to join the 2-tile voice call room.
5. Allow microphone permissions in your browser.
6. Speak with the AI Interviewer and test live voice replies and closed captions.
7. Click **End Call & View Report** to review your evaluation score, exceptional highlights, growth areas, and export the transcript.

---

## 🛠️ Troubleshooting & FAQs

### 1. Browser Microphone Not Working on Production
- Web Speech API requires **HTTPS** to access the microphone. Vercel automatically provisions free SSL/HTTPS certificates. Always access the site via `https://` (not `http://`).

### 2. Render Free Tier Sleep & Cold Starts
- Render free tier instances enter sleep mode after 15 minutes of inactivity. The first request after sleep may take ~30–45 seconds to wake up. The frontend automatically performs background wake-up pings and exponential backoff retries.

### 3. Vercel 404 on Direct Page Refresh
- This is resolved automatically by the included `vercel.json` SPA rewrite rule:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

### 4. `AxiosError: Network Error` or `net::ERR_CONNECTION_REFUSED`
- **Cause**: The frontend was attempting to connect to `http://localhost:3001` instead of your deployed Render backend because the environment variable was omitted or build-time default was missing.
- **Resolution**:
  1. The platform automatically detects production hostnames and falls back to `https://ai-interviewer-backend.onrender.com`.
  2. `vercel.json` includes a reverse proxy route (`/api/v1/:match*`) directing API calls seamlessly to the Render backend.
  3. Ensure `VITE_BACKEND_URL` is set in Vercel project settings:
     ```env
     VITE_BACKEND_URL=https://ai-interviewer-backend.onrender.com
     ```
  4. If your Render backend is sleeping on the free tier, the frontend automatically dispatches background wake-up pings and retries failed requests with exponential backoff.

### 5. `Missing parameter name at index 1: *` (`pathToRegexpError`) on Express 5
- **Cause**: Express 5 uses `path-to-regexp` v8, which disallows unparameterized `"*"` route patterns (like `app.options("*")`).
- **Resolution**: Global CORS middleware `app.use(cors(corsOptions))` already handles all preflight `OPTIONS` requests across every path without requiring `app.options("*")`. The route handlers and 404 middleware are fully aligned with Express 5 standards.

