# StepsMatch

## 1. Ziel & Vision
Standortbasierte Angebots-Plattform: Anbieter erstellen lokale Angebote, Nutzer erhalten passende Push-Notifications und sehen gueltige Angebote in der App - zuverlaessig auch im Hintergrund.

## 2. Aktuelle Architektur
Frontend:
- React + Vite Admin UI fuer Anbieter (CRUD fuer Provider/Offers, Login, Tester-Gate).

Backend:
- Node.js/Express API auf `/api/*`, MongoDB (Mongoose).
- Matching, Push-Dispatch, Heartbeat-Verarbeitung, Dedupe/Visibility.

Mobile:
- Expo (RN 0.79) mit Expo Router.
- Hintergrund-Location (Foreground Service), Geofencing, BackgroundFetch, Push-Handling.
- Lokale Dedupe-Logik + Hintergrunddienst-Schalter in der Home-UI.

Infrastruktur:
- DigitalOcean App Platform (API + Frontend), MongoDB (extern), DigitalOcean Spaces fuer APK-Download.

Externe Services:
- Expo Push Service
- Google Maps/Directions API
- Cloudinary (Uploads)

## 3. Wichtige technische Entscheidungen
Architekturentscheidungen
- Heartbeat-basierte Matching-Logik im Backend (`/api/location/heartbeat`) + lokale Geofence-Notifications als Backup.
- Foreground Service + BackgroundFetch zur Stabilisierung von Background-Location (Android).
- Dedupe ueber `OfferVisibility` (server) und lokale Push-State (client).
- Service-Control-State auf dem Geraet (AsyncStorage) steuert, ob Background-Tasks laufen.

Libraries
- Backend: express, mongoose, expo-server-sdk, helmet, cors, morgan.
- Mobile: expo-location, expo-notifications, expo-background-fetch, expo-task-manager, expo-dev-client.
- Frontend: React 19, Vite, axios, react-router-dom, motion.

Services
- Expo Push (Tokens in `PushToken`).
- DO Spaces fuer APK (Server-Redirect `/apk` -> Spaces URL).

Besonderheiten
- Push-Routing: Push oeffnet Angebots-Detail (`/(tabs)/offers/[id]`).
- Foreground-Push-Unterdrueckung: im aktiven Screen keine System-Banner.
- Hintergrunddienst-Schalter (Aktiv/Pause/Aus) auf Home.

Trade-offs
- Hohe Push-Zuverlaessigkeit durch parallele Kanaele (Heartbeat + Geofence) auf Kosten von Komplexitaet.
- Foreground-Suppression reduziert Stoerungen, erfordert UI-Refresh-Mechanismen.

## 4. Environment & Konfiguration
Lokale Pfade
- Repo: `C:\\coding\\stepsmatch`
- Mobile: `C:\\coding\\stepsmatch\\mobile`
- Android Build: `C:\\coding\\stepsmatch\\mobile\\android`

Ports
- Backend: `8080`
- Frontend Dev (Vite): `5173`

ENV Variablen (ohne Secrets!)
Backend
- `MONGO_URI`
- `PORT` (Default 8080)
- `CORS_ORIGINS`
- `APK_TARGET_URL` (Default DO Spaces APK)
- Push/Matching: `PUSH_CHANNEL_ID`, `PUSH_CATEGORY_ID`, `PUSH_PRIORITY`, `PUSH_SOUND`, `GEOFENCE_RENOTIFY_COOLDOWN_MS`, `REENTRY_MIN_GAP_MS`, `HB_MAX_CHECK_DISTANCE_M`, `DEFAULT_OFFER_RADIUS_M`
- `EXPO_PROJECT_ID` (optional)

Frontend
- `VITE_API_BASE_URL`

Mobile (Expo Config / Build)
- `EXPO_PUBLIC_API_BASE_URL` (Default: `https://lobster-app-ie9a5.ondigitalocean.app/api`)
- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`
- `EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY`

Deployment Setup
- Backend + Frontend via DigitalOcean App Platform.
- APK-Download via `/apk` Redirect (Server) auf DO Spaces URL.

Git Branch
- `main`

Build-Befehle
Backend
- `npm run dev` (nodemon)
- `npm run start`

Frontend
- `npm run dev`
- `npm run live` (prod-like)
- `npm run build`

Mobile
- `npm run android` (dev client)
- Release APK: `cd mobile\\android && .\\gradlew assembleRelease`
- APK Output: `mobile\\android\\app\\build\\outputs\\apk\\release\\app-release.apk`

## 5. Datenmodell
Offers (`offers`)
- provider (ObjectId), name, category, subcategory, description
- radius (m), interestsRequired [String]
- validDays [Mixed], validTimes {from,to}, validDates {from,to}
- contact, images [String]
- location (GeoJSON Point [lng,lat])
- languages [String], foundCounter

Providers (`providers`)
- name, address, category, subcategory, description
- contact {phone,email,website}
- location (GeoJSON Point)
- user (ObjectId)

PushTokens (`pushtokens`)
- token, platform, userId, deviceId
- valid, disabled, lastError, lastTriedAt
- lastSeenAt, lastHeartbeatAt
- lastLocation (GeoJSON), accuracy, speed, lastLocationAt
- interests [String], projectId

OfferVisibility (`offervisibility`)
- deviceToken (PushToken), offerId
- status: seen/notified/dismissed/snoozed
- inside, lastEnterAt, lastExitAt, lastDistanceM, lastReason
- firstSeenAt, lastNotifiedAt, remindAt, suppressUntil

Users (`users`)
- name, email, password (hashed), preferredRadius, interests, expoPushToken

Testers (`testers`)
- key, name, email, validatedAt, acceptedAt, ndaVersion, status

NotificationLog
- userId, offerId, date

ClientDiagLog
- deviceId, platform, appVersion, buildNumber, event, level, data, receivedAt (TTL)

Category
- name, subcategories [String]

## 6. Kernlogik
- Heartbeat: App sendet Standort an `/api/location/heartbeat`, Server matched Angebote nach Distanz/Zeit/Interessen und pusht via Expo.
- Geofencing: Client laedt aktive Angebote, setzt Geofence-Regionen, sendet lokale Notifications bei Enter.
- Dedupe:
  - Server: `OfferVisibility` mit Cooldown und Re-Entry-Logik.
  - Client: lokale Push-State-Keys + Foreground-Unterdrueckung.
- Hintergrund-Stabilitaet:
  - Android Foreground Service + BackgroundFetch Watchdog.
- Service-Control:
  - Persistenter State (`bg.service.state.v1`) erlaubt Pause/Aus/Aktivieren.
  - Wenn inaktiv: Tasks/Geofence/BackgroundFetch werden gestoppt und Push-Gate blockiert.

## 7. Offene Aufgaben
- Service-Control-UX weiter verfeinern (z. B. ?bis morgen? TZ-Checks, UX-Texte).
- DSGVO: Transparenter Hinweis + Opt-In/Opt-Out Erklaerung in UI.
- Analytics/Monitoring fuer Push-Zustellung (Receipts) und Offer-Engagement.

## 8. Bekannte Probleme / Risiken
- Android OEMs koennen FGS/BG aggressiv beenden; Watchdogs mindern, aber nicht eliminieren.
- Push-Deliverability abhaengig von Expo/Token-Health.
- Geofence-Fetch kann bei API-Blockern (AV) scheitern.

## 9. Teststrategie
- Backend Healthcheck: `GET /api/health`.
- Mobile:
  - Onboarding durchlaufen, Permissions pruefen.
  - Home zeigt ?Hintergrunddienst: Aktiv?.
  - Device sperren + App wischen -> Push muss weiterhin kommen.
  - Push-Tap oeffnet Angebots-Detail.
- Dedupe: Mehrfach-Enter darf keine Push-Spam ausloesen.

## 10. Relevante Konstanten / IDs
- Android Package: `com.ecily.mobile`
- Expo Project ID: `08559a29-b307-47e9-a130-d3b31f73b4ed`
- Notification Channels:
  - `stepsmatch-bg-location-task` (FGS)
  - `offers-v2` (Offers)
- Task IDs:
  - `stepsmatch-bg-location-task`
  - `stepsmatch-geofence-task`
  - `stepsmatch-heartbeat-fetch`
- API Base Default (Mobile): `https://lobster-app-ie9a5.ondigitalocean.app/api`
- APK Redirect Default: `https://stepsmatch.fra1.digitaloceanspaces.com/Stepsmatch_Alpha_V1_1.apk`

---

Startzusammenfassung (5 Zeilen)
1. StepsMatch = standortbasierte Angebots-Plattform mit Admin-Frontend, Backend-API und Expo-Mobile-App.
2. Heartbeat + Geofence liefern Pushes; Dedupe serverseitig (OfferVisibility) und clientseitig.
3. Android BG-Stabilitaet via Foreground Service + BackgroundFetch + Watchdogs.
4. Service-Control (Pause/Aus/Aktiv) ist in der Home-UI implementiert und steuert Background-Tasks.
5. Wichtige IDs: package `com.ecily.mobile`, projectId `08559a29-b307-47e9-a130-d3b31f73b4ed`, channels `stepsmatch-bg-location-task`/`offers-v2`.
