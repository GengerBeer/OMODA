# OMODA STUDIO

Unified virtual try-on project that merges:

- `omoda-style-studio`: preset-based studio generations plus angle views
- `not-a-joke`: personal selfie try-on, Google auth, credits, and user history

The new project lives in one folder and is ready to move into a fresh Gingerbeer repository.

## What Is Included

- One React/Vite frontend branded as `OMODA STUDIO`
- One Express backend in [`server/server.cjs`](./server/server.cjs)
- One Supabase schema in [`supabase/schema.sql`](./supabase/schema.sql)
- Safe `.env.example` files without embedded keys
- A preset upload helper in [`upload-presets.cjs`](./upload-presets.cjs)

## Main Flows

- `Preset Studio`: guest-friendly flow using `clothing_presets`
- `On Yourself`: Google sign-in, face + full body references, credit-limited generations
- `Angle Views`: front, side, back and 3/4 renders from a finished result
- `History`: signed-in user history sourced from Supabase

## Project Structure

```text
omoda-studio/
  src/                 frontend
  server/              express backend
  supabase/schema.sql  canonical database + storage setup
  new presets/         local preset files for bulk upload
```

## Environment

Frontend: [`.env.example`](./.env.example)

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_BACKEND_URL=http://localhost:3001
```

Backend: [`server/.env.example`](./server/.env.example)

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
GEMINI_API_KEY=...
PORT=3001
```

## Local Run

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd server
npm install
npm run dev
```

## Supabase Setup

1. Create a new Supabase project for `OMODA STUDIO`.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor.
3. Add Google auth provider in Supabase Auth.
4. Upload preset files to the `clothing-presets` bucket.
5. Optionally run `node upload-presets.cjs` with `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in the environment.

## Gingerbeer Repo Checklist

1. Create a new empty Gingerbeer repository for `OMODA STUDIO`.
2. Copy this folder as the new repo root.
3. Add the frontend and backend env vars in Gingerbeer secrets.
4. Point the frontend to the deployed backend with `VITE_BACKEND_URL`.
5. Run the Supabase schema against the new project before the first deploy.

## Important Cleanup Already Done

- Removed hardcoded Supabase and Gemini keys from frontend, backend, and helper scripts.
- Replaced old split SQL scripts with one merged schema.
- Removed old mock/session-based route from the frontend app shell.
