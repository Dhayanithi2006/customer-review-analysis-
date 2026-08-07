# RoadmapAI

> **From Customer Voice to Product Decisions.**

Upload customer reviews → AI pipeline → Priority issues + Roadmap + Sprint plan.

---

## Quick Start

### Prerequisites
- Python 3.13
- Node.js 18+
- Supabase account (free tier works)
- Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))

---

### Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New project
2. In your project: **SQL Editor** → paste the contents of `backend/supabase_migration.sql` → Run
3. Go to **Project Settings → API** → copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` secret key → `SUPABASE_SERVICE_KEY`

---

### Step 2 — Backend Setup

```bash
# Navigate to backend
cd backend

# Activate venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Fill in your keys
# Edit .env with your GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

# Start the API server
uvicorn main:app --reload --port 8000
```

API will be live at: http://localhost:8000
Docs at: http://localhost:8000/docs

---

### Step 3 — Frontend Setup

```bash
# In a new terminal, navigate to frontend
cd frontend

# Start dev server
npm run dev
```

Frontend will be live at: http://localhost:3000

---

## Architecture

```
CSV Upload → Clean → VADER → Gemini (Call 1) → Cluster → Priority Score
→ Executive Summary (Call 2) → Roadmap + Sprint (Call 3) → Dashboard
→ AI Meeting (Call 4, on-demand)
```

## LLM Cost

~$0.015 per 1,000 reviews (Gemini Flash)

## Stack

| Layer    | Tech                |
|----------|---------------------|
| Frontend | Next.js 14, Tailwind v4 |
| Backend  | FastAPI, Python 3.13 |
| Database | Supabase (PostgreSQL) |
| AI       | Gemini Flash         |
| Sentiment| VADER                |
