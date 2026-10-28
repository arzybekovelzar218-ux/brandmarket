# Deploying to Render

## 1. Backend (Web Service → Runtime: **Docker**)
Render has no native Java runtime, so the backend ships with `backend/Dockerfile`.
- New → Web Service → your repo → Root Directory `backend` → Runtime **Docker** (Render finds the Dockerfile).
- Environment variables:
  - `APP_CORS_ALLOWED_ORIGINS` = `https://<your-frontend>.onrender.com`  ← required, otherwise the browser blocks API calls
  - `SPRING_PROFILES_ACTIVE` = `demo` (already the Dockerfile default): in-memory demo data, no database needed,
    reseeded on every restart — ideal for a pitch. For persistent data use a Render PostgreSQL and set
    `SPRING_PROFILES_ACTIVE` to empty plus `SPRING_DATASOURCE_URL / _USERNAME / _PASSWORD`.
- The port comes from Render's `PORT` automatically.
- Uploaded photos live on the instance disk and are wiped on restart/deploy (fine for a demo).

## 2. Frontend (Static Site)
- Root: `frontend`, build `npm ci && npm run build`, publish directory `dist`
- Environment variable: `VITE_API_URL` = `https://<your-backend>.onrender.com` (no trailing slash)
- Redirects/Rewrites → add rule: source `/*`, destination `/index.html`, action **Rewrite**
  (without it, reloading any page other than `/` gives 404)
- Or deploy with `render.yaml` (Blueprint), which already contains all of this.

## Before the pitch
Free Render services fall asleep after ~15 min idle; the first request then takes ~30–60 s.
Open the site 2–3 minutes before presenting. The frontend waits up to 60 s for the API.
