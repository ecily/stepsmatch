# StepsMatch - DigitalOcean Deploy Checklist

## 1) Backend (App Platform)
1. Build Command: `npm ci`
2. Run Command: `npm start`
3. Working Directory: `backend`
4. Environment Variables:
   - Use `backend/.env.example` as template.
   - Tester-Key-Anfragen benötigen `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` und `GRAPH_SENDER_USER`; optional `GRAPH_RECIPIENT_EMAIL` (Default: `andreas.franz@ecily.com`). Keine Werte in Git oder Logs dokumentieren.
   - Set all secrets in DO (never in git).
5. Health check path: `/api/health`

## 2) Frontend (Static Site / App Platform)
1. Build Command: `npm ci && npm run build`
2. Output Directory: `dist`
3. Working Directory: `frontend`
4. Static Site Custom Pages:
   - Set `Catchall` to `index.html` so React Router deep links such as `/anbieter`, `/register`, and `/login` return HTTP 200.
   - App Spec equivalent: `static_sites[].catchall_document: index.html`.
   - Do not rely on `frontend/public/_redirects`; DigitalOcean App Platform does not use it as a Netlify-style rewrite rule.
5. Environment Variables:
   - Use `frontend/.env.example` as template.
   - `VITE_API_BASE_URL` must point to `https://api.stepsmatch.com/api` in production.

## 2a) Canonical Domain API Routing

The repository contains separate frontend and backend services, but no DigitalOcean App Spec or reverse-proxy configuration. The frontend Static Site catchall must remain limited to frontend routes; it must not receive `/api/*` requests. Configure the canonical `stepsmatch.com` domain in DigitalOcean so `/api/*` is routed to the backend service, if the App Platform setup supports path routing. Otherwise use a dedicated API hostname and set `VITE_API_BASE_URL` to that backend `/api` URL. Do not try to solve this with `frontend/public/_redirects`; DigitalOcean App Platform does not use it as a Netlify-style API proxy.

Read-only status checked 2026-07-27: `https://stepsmatch.com/api/health` returned SPA HTML, while the direct backend health endpoint returned JSON 200. This remains a DigitalOcean routing configuration task, not a frontend or backend feature change.

## 3) Post-Deploy Smoke
1. `GET /api/health` -> 200
2. `GET /api/categories` -> 200 + non-empty
3. `GET /api/offers?activeNow=1&lat=...&lng=...` -> 200
4. Frontend loads and performs login/register without CORS errors.

## 4) APK Download Link
1. Upload release APK to DO Spaces.
2. Set backend env `APK_TARGET_URL` to public APK URL.
3. Verify:
   - `https://<frontend-domain>/apk`
   - `https://<backend-domain>/apk`
   both redirect to the APK file.
