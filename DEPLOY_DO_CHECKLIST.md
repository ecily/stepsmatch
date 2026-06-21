# StepsMatch - DigitalOcean Deploy Checklist

## 1) Backend (App Platform)
1. Build Command: `npm ci`
2. Run Command: `npm start`
3. Working Directory: `backend`
4. Environment Variables:
   - Use `backend/.env.example` as template.
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
   - `VITE_API_BASE_URL` must point to backend `/api`.

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
