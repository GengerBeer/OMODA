# OMODA STUDIO

AI-powered fashion virtual try-on platform. Upload a garment, choose a preset model or your own photos, and generate professional catalog shots with multiple angle views.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Vercel Serverless Function (Node.js)
- **Database & Auth:** Supabase (PostgreSQL + Storage + Google OAuth)
- **AI:** Google Gemini (image generation)
- **Deployment:** Vercel

## Features

- **Preset Studio** — pick a model preset from Supabase for fast catalog imagery (guest-friendly)
- **Custom Model** — describe a model with a text prompt
- **On Yourself** — upload your face + body photos for personalized try-on (requires Google sign-in)
- **Angle Views** — generate front, side, back, and 3/4 variants from the result
- **History** — signed-in users see their past generations

## Project Structure

```
omoda-studio/          ← Main app (deploy this to Vercel)
  api/process.ts       ← Vercel serverless function (AI backend)
  src/
    pages/Index.tsx    ← Main UI
    hooks/useAuth.ts   ← Supabase auth
    lib/supabase.ts    ← Supabase client
    components/        ← UI components
services/              ← Microservices (separate infrastructure)
apps/                  ← Expo mobile preview
infra/                 ← Docker Compose
```

## Local Development

```bash
cd omoda-studio
npm install
cp .env.example .env   # fill in your keys
npm run dev
```

## Environment Variables

See `omoda-studio/.env.example` for all required variables.

Frontend (Vite) needs `VITE_` prefix. Serverless backend needs separate copies without prefix.

## Deployment

Deploy `omoda-studio/` to Vercel. Set Root Directory to `omoda-studio` in Vercel project settings.
