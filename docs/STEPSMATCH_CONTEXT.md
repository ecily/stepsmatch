# StepsMatch.com - Projektkontext

Stand: 2026-06-17, lokale Bestandsaufnahme in `C:\coding\stepsmatch`.

## 1. Projektgrenzen

- Dieses Projekt ist ausschliesslich StepsMatch.com.
- Keine Vermischung mit Kaufklug oder anderen Projekten.
- Lokaler Pfad: `C:\coding\stepsmatch`
- Repo/Remote: `origin https://github.com/ecily/stepsmatch.git`
- Branch: `main` tracking `origin/main` ohne sichtbaren ahead/behind-Hinweis im Status.
- letzter Commit: `d06065b00f6173cb3dc4228744147aff4ea7e983` (`d06065b`), 2026-04-01 15:25:25 +0200, `fix(frontend): handle email verification flow on provider login/register`
- relevante Tags:
  - `v1.0.0-stable-baseline-2026-02-20`
  - `meilenstein-2025-09-19`
  - `prod-safepoint-2025-09-16`
  - `meilenstein-2025-09-14`
  - `stable-geo-2025-09-07`
  - `stable-20250825-1050`
  - `baseline-push-2025-08-22`
  - `safe-pre-deploy`
  - `push-notifications-ok`
  - `v1.0-stable`
- Git-Arbeitsbaum bei Bestandsaufnahme: deutlich dirty. `git status --porcelain` zeigt 174 Eintraege: 63 tracked modified/deleted und 111 untracked.
- Relevante uncommitted Aenderungen betreffen Backend-Routen/Modelle, Frontend-UX/API-Resolver und viele Mobile-Dateien fuer Push, Location, Navigation, Permissions und Android-Konfiguration.
- Viele untracked Dateien sind Screenshots, UI-Dumps, Retest-Logs und temporäre Skripte (`screen_*.png`, `retest_*.png`, `temp_*.mjs`, `temp_*.ps1`, `uidump*.xml` usw.).
- Stabilisierungsstand nach Cleanup am 2026-06-17: Kontextdatei und `.gitignore` wurden committed; 97 lokale Test-/Screenshot-/Dump-/Temp-Artefakte wurden geloescht. Verbleibend: 62 tracked Produkt-/Config-Aenderungen und 17 untracked Dateien.
- Backend-Stabilisierungsstand am 2026-06-17: `backend/server.js` LAN-Startup-Logging wurde isoliert committed (`3fd8df1`); die CORS-Domains in `backend/server.js` sind wieder StepsMatch-Domains. Verbleibende Backend-Diffs betreffen Auth/User/Tester, Push und Location; Push/Location enthalten auffaellige Encoding-/Mojibake-Diffs und sollten nicht ungeprueft committed werden.
- Im Repo vorhandene Ultreia-/Camino-Texte werden als aktueller repo-interner Stand dokumentiert, nicht als Fremdprojektkontext.

## 2. Aktueller technischer Stack

- Mobile: Expo SDK 53, React Native 0.79.5, React 19, Expo Router, Android native Gradle-Projekt, Kotlin Native-Heartbeat-Service.
- Frontend/Web: React 19, Vite 6, React Router 7, Tailwind CSS, axios, lucide-react, motion, Google Maps API Komponenten.
- Backend: Node.js ESM, Express 4, Mongoose 7, MongoDB, helmet, cors, compression, morgan.
- Datenbank: MongoDB mit Mongoose-Modellen und 2dsphere-Indizes fuer Angebote, Provider und PushToken-Standorte.
- Push/Notifications: Expo Push Service, `expo-notifications`, Android Notification Channels, serverseitige Expo Push Receipts, lokale Geofence-Notifications.
- Auth: Backend nutzt bcrypt und JWT; User-Registrierung hat E-Mail-Verifikation mit optionalem Resend-Provider. Frontend/Mobile speichern Auth-State lokal.
- Hosting/Deployment: Dokumentiert ist DigitalOcean App Platform fuer Backend/Frontend und DigitalOcean Spaces fuer APK-Download via `/apk` Redirect.
- Sonstige Services: Google Maps/Directions, Cloudinary Uploads, Firebase/Google Services fuer Android-Konfiguration, optional Resend fuer E-Mail.

## 3. Projektstruktur

- `.github/workflows/project-analysis.yml`: manueller Analyse-Workflow, nutzt `secrets.CLONE_URL` und erzeugt ein Struktur-Artefakt.
- `backend/`: Express API, MongoDB-Konfiguration, Modelle, Routen, Jobs, Scripts.
- `frontend/`: Vite/React Web-Frontend fuer Landingpages, Anbieter-Login/Register, Provider/Offer-Dashboard und Admin-Ansichten.
- `mobile/`: Expo/React-Native-App mit file-based routing, Android native Projekt, Push-/Location-Komponenten und Assets.
- `docs/`: Architektur- und Release-Dokumentation sowie lokale Release-Smoke-Skripte.
- Root-Dokumente: `README.md` ist minimal, `CONTEXT.md` enthaelt umfangreiche historische Arbeitsnotizen, `DEPLOY_DO_CHECKLIST.md` enthaelt DO-Deploy-Hinweise mit noch sichtbaren Ultreia-Bezeichnungen.
- Build-/Deployment-Dateien: `backend/package.json`, `frontend/package.json`, `frontend/vite.config.js`, `mobile/package.json`, `mobile/app.config.js`, `mobile/app.json`, `mobile/eas.json`, `mobile/android/*`, `.github/workflows/project-analysis.yml`.
- Keine Docker-Dateien wurden gefunden.

## 4. Mobile App

- Pfad: `mobile/`
- Framework/SDK: Expo SDK `~53.0.20`, React Native `0.79.5`, Expo Router `~5.1.4`.
- Paketname: Expo/Gradle `applicationId` aktuell `com.ecily.stepsmatch`; Android `namespace` ist `com.ecily.mobile`. Aeltere Doku nennt noch `com.ecily.mobile`, das ist ein Risiko/Abgleichpunkt.
- App-Version: `1.0.1`, `versionCode` 2.
- Scheme: `stepsmatch`; Android Intent-Filter auch fuer `exp+stepsmatch`.
- Build-Prozess:
  - `npm run start`
  - `npm run android`
  - `npm run ios`
  - `npm run web`
  - `npm run lint`
  - EAS-Profile `development`, `preview`, `production`, jeweils Android APK.
  - Native Release laut Doku: `cd mobile/android && ./gradlew.bat assembleRelease`
- relevante Berechtigungen:
  - `ACCESS_COARSE_LOCATION`
  - `ACCESS_FINE_LOCATION`
  - `ACCESS_BACKGROUND_LOCATION`
  - `FOREGROUND_SERVICE`
  - `FOREGROUND_SERVICE_LOCATION`
  - `POST_NOTIFICATIONS`
  - `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
  - `WAKE_LOCK`
  - `INTERNET`
  - Im generierten AndroidManifest stehen zusaetzlich u. a. `RECEIVE_BOOT_COMPLETED`, `ACCESS_NETWORK_STATE`, `READ/WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`; Notwendigkeit pruefen.
- bekannte funktionierende Features nach Codeanalyse:
  - Auth-Gate mit Login, Registrierung und E-Mail-Verifikation.
  - Onboarding fuer Interessen und Permissions.
  - Home/Feed laedt aktive Angebote ueber `/offers` mit Standort-/Interessenfilterung und lokaler Distanzlogik.
  - Kartenansicht mit Google Maps, aktiven/allgemeinen Angeboten, Markern, Recenter und Route-Start.
  - Angebotsdetail und Navigation mit Google Directions Polyline-Fetch.
  - Push-Initialisierung, Token-Registrierung, Foreground-Unterdrueckung, lokale Benachrichtigungssignale.
  - Background Location, Geofencing, BackgroundFetch Watchdog, Headless Bootstrap und native Android Heartbeat-Service-Komponente.
  - Profil mit Privacy-Opt-in und Hintergrunddienst-Stopp/Logout-Stop.
  - Diagnostics-Screen fuer Permissions, Channels, Background Tasks, Heartbeats, Logs, Roundtrip und lokale Tests.
- bekannte offene Punkte/Risiken:
  - Brand-/Domain-Drift: Mobile und Frontend zeigen aktuell vielerorts `Ultreia.app`/Camino, waehrend Repo/Ziel StepsMatch.com heisst.
  - Paketname-Divergenz zwischen alter Doku (`com.ecily.mobile`) und aktuellem Gradle/Expo (`com.ecily.stepsmatch`).
  - AndroidManifest enthaelt eine konkrete Google Maps API-Key-Metadatenzeile; Wert nicht dokumentieren, aber Secret-/Key-Handling pruefen.
  - Background-Location/Push-Zuverlaessigkeit bleibt geraete- und OEM-abhaengig.
  - `mobile/README.md` ist noch Expo-Standardtext und nicht projektaktuell.
  - Viele Mobile-Dateien sind uncommitted; Status ist nicht als stabile Baseline gesichert.

## 5. Backend

- Pfad: `backend/`
- Stack: Node.js `>=18 <23`, Express, Mongoose, MongoDB, Expo Server SDK, Cloudinary, JWT, bcrypt.
- Start-/Build-Befehle:
  - `npm run start` -> `node server.js`
  - `npm run dev` -> `nodemon server.js`
  - `npm run build-indexes` -> `node ./scripts/create-indexes.js`
  - `npm run seed:graz`
  - `npm run seed:reset`
  - `npm run seed:gratwein`
- Haupt-Entry-Point: `backend/server.js`
- relevante API-Endpunkte:
  - Health: `GET /api/health`, `GET /api/ping`, `GET /api/_healthz`, `GET /api/_readyz`
  - APK: `ALL /apk`, `ALL /api/apk`
  - Users/Auth: `POST /api/users/register`, `POST /api/users/verify-email`, `POST /api/users/resend-verification`, `POST /api/users/login`, `GET /api/users/me`, `POST /api/users/push-token/:userId`, `POST /api/users/test-push/:userId`, `PUT /api/users/preferences/:userId`
  - Providers: `GET/POST /api/providers`, `GET /api/providers/user/:userId`, `GET/PATCH/PUT /api/providers/:id`
  - Offers: `GET /api/offers`, `POST /api/offers`, `POST /api/offers/nearby`, `POST /api/offers/nearby-noauth`, `GET /api/offers/nearby-geofence`, `GET /api/offers/provider/:providerId`, `GET/PUT/DELETE /api/offers/:id`, `POST /api/offers/:id/notify-now`, `POST /api/offers/found/:id`
  - Categories: `GET/POST /api/categories`, `GET /api/categories/subcategories`, `POST /api/categories/:id/subcategories`, `PUT/DELETE /api/categories/:id`
  - Location: `POST /api/location/heartbeat`, `POST /api/location/geofence-enter`, `GET /api/location/ping`
  - Push: `GET/POST /api/push/canary`, `POST /api/push/register`, `POST /api/push/service-state`, `POST /api/push/roundtrip`, `POST /api/push/test`, `POST /api/push/ping`, `POST /api/push/roundtrip-diagnose`
  - Match: `POST /api/match/check`
  - Testers: `POST /api/testers/validate`, `POST /api/testers/accept`
  - Uploads: `GET /api/uploads/_debug`, `POST /api/uploads`, `POST /api/uploads/images`, `DELETE /api/uploads`, `POST /api/uploads/delete`
  - Diagnostics: `POST /api/diag/log`, `GET /api/diag/recent`, `GET /api/diag/heartbeat`, `GET /api/diag/heartbeat-list`
  - Notifications: `POST /api/notifications/action`
- Datenmodelle:
  - `User`: name/firstName/lastName/username/email/password, Email-Verifikationsfelder, preferredRadius, interests, expoPushToken.
  - `Provider`: name/address/categoryId/category/subcategory/description/contact/openingHours/location/user, 2dsphere location index.
  - `Offer`: provider, categoryId/subcategoryId, legacy category/subcategory, name, description, radius, interestsRequired, validDays/weekdays, validTimes, validDates, contact, images, location, languages, foundCounter; 2dsphere und weitere Indizes.
  - `Category`: name, slug, legacy subcategories, isActive, sortOrder.
  - `Subcategory`: name, slug, category ref, isActive, sortOrder, unique category+slug index.
  - `PushToken`: token, platform, userId, deviceId, valid/disabled, lastError/lastTriedAt, lastSeenAt/lastHeartbeatAt, lastLocation/accuracy/speed, interests, projectId; mehrere Aktivitaets-/Geo-Indizes.
  - `OfferVisibility`: deviceToken, offerId, status `seen/notified/dismissed/snoozed`, inside, enter/exit timestamps, notify/remind/suppress fields; Dedupe-Methoden.
  - `Tester`: key, name, email, validatedAt, acceptedAt, ndaVersion, gateModalMessage, status.
  - `ClientDiagLog`: device/platform/appVersion/buildNumber/event/level/data/receivedAt, TTL-Index.
  - `NotificationLog`: userId, offerId, date.
- bekannte funktionierende Features nach Codeanalyse:
  - Express API mit CORS-Whitelist plus ENV-Erweiterung.
  - MongoDB-Verbindung ueber `MONGO_URI`.
  - Offer CRUD, Provider CRUD, Kategorien/Subkategorien und Uploads.
  - Aktive/nearby/geofence-Angebotssuchen inklusive Geo-Fallbacks.
  - Heartbeat-basierter Server-Geofence-Check mit OfferVisibility-Dedupe und Expo Push.
  - PushToken-Registrierung und Service-State-Sync.
  - Offer-Poller-Job beim Start, abschaltbar ueber `OFFER_POLLER_ENABLED=0`.
  - APK Redirect auf `APK_TARGET_URL` oder Default-Spaces-URL.
- bekannte offene Punkte/Risiken:
  - `backend/.env.example` enthaelt noch Ultreia-Domains in `CORS_ORIGINS`.
  - Kein automatischer Test-Runner im Backend-Package definiert.
  - E-Mail-Verifikation haengt von Resend-ENV ab; Laufzeit nicht geprueft.
  - Schema-Migration ist teilweise sichtbar: `categoryId`/`subcategoryId` plus Legacy-Felder existieren parallel.
  - Viele Backend-Dateien sind uncommitted geaendert; `backend/server.js` ist nach Commit `3fd8df1` nicht mehr darunter.

## 6. Infrastruktur und Konfiguration

- Env-Variablen, nur Namen:
  - Backend: `PORT`, `NODE_ENV`, `MONGO_URI`, `MONGODB_URI`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `APK_TARGET_URL`, `OFFER_POLLER_ENABLED`, `DEFAULT_OFFER_RADIUS_M`, `HB_MAX_CHECK_DISTANCE_M`, `GEOFENCE_RENOTIFY_COOLDOWN_MS`, `REENTRY_MIN_GAP_MS`, `SERVER_MIN_ACCURACY_BOOST_M`, `SERVER_TOLERANCE_M`, `EXIT_BUFFER_M`, `PUSH_MAX_DISTANCE_M`, `PUSH_LAST_LOCATION_MAX_AGE_MS`, `PUSH_ACCURACY_BUFFER_MAX`, `PUSH_ACCURACY_TOKEN_CAP`, `OFFER_NOTIFY_RESET_ON_UPDATE`, `FRESH_RETRY_DELAYS_MS`, `DEBUG_OFFER_POLLER`, `GEOPUSH_DEBUG`, `EXPO_ACCESS_TOKEN`, `EXPO_PROJECT_ID`, `EXPO_PROJECT`, `PROJECT_ID`, `PUSH_ENFORCE_PROJECT_SCOPE`, `PUSH_GRACE_MINUTES`, `EXPO_PUSH_CHANNEL_ID`, `PUSH_CHANNEL_ID`, `PUSH_CATEGORY_ID`, `PUSH_PRIORITY`, `PUSH_SOUND`, `CLIENT_DIAG_TTL_SECONDS`, `DIAG_READ_TOKEN`, `NOTIF_SNOOZE_MINUTES`, `NOTIF_MUTE_MINUTES`, `NOTIF_GO_MUTE_MINUTES`, `EMAIL_VERIFICATION_TTL_MINUTES`, `EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS`, `EMAIL_VERIFICATION_DEBUG`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CLOUDINARY_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`, `SEED_TAG`, `SEED_PROVIDERS`, `SEED_UNI_QUERY`, `SEED_PLACE`.
  - Frontend: `VITE_API_BASE_URL`, `VITE_API_FALLBACK_URL`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_MAP_ID`.
  - Mobile/Expo: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`, `EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY`, `EXPO_PROJECT_ID`, `EXPO_PROJECTID`, `EXPO_PROJECT`, `EXPO_PUSH_CHANNEL_ID`, `NODE_ENV`, `EXPO_OS`.
- Datenbank-/Index-Hinweise:
  - `Offer.location`, `Provider.location`, `PushToken.lastLocation` nutzen `2dsphere`.
  - `OfferVisibility` hat unique Index auf `deviceToken + offerId`.
  - `ClientDiagLog` nutzt TTL ueber `createdAt`.
  - `backend/scripts/create-indexes.js` erstellt mindestens Offer-Indizes fuer `location_2dsphere`, `subcategory_1`, `provider_1`.
- Push-/FCM-/Expo-Hinweise:
  - Expo Project ID in App-Config: `08559a29-b307-47e9-a130-d3b31f73b4ed`.
  - Channel IDs: `stepsmatch-bg-location-task`, `offers-v2`, ausserdem `stepsmatch-default-v2`.
  - Task IDs: `stepsmatch-bg-location-task`, `stepsmatch-geofence-task`, `stepsmatch-heartbeat-fetch`.
  - Firebase/Google Services Dateien sind im Mobile/Android-Bereich vorhanden; Inhalte nicht in Markdown aufnehmen.
- Deployment-Hinweise:
  - Backend DO App Platform: Working Directory `backend`, Build `npm ci`, Run `npm start`, Health `/api/health`.
  - Frontend DO Static/App Platform: Working Directory `frontend`, Build `npm ci && npm run build`, Output `dist`.
  - Frontend-API-Fallback zeigt aktuell auf `https://lobster-app-ie9a5.ondigitalocean.app/api` fuer bekannte Ultreia/DO Hosts.
  - APK Download via Backend `/apk` Redirect auf `APK_TARGET_URL`.
  - `.github/workflows/project-analysis.yml` ist manuell und veraendert externe Services nicht, nutzt aber GitHub Secret `CLONE_URL`.

## 7. Aktueller Funktionsstand

Nach Code- und Dateianalyse funktioniert wahrscheinlich:

- Backend startet mit MongoDB-URI, registriert API-Routen, bietet Healthchecks und startet optional den Offer-Poller.
- Anbieter koennen sich registrieren/anmelden, Provider und Angebote im Web verwalten und Bilder ueber Cloudinary hochladen, sofern ENV korrekt gesetzt ist.
- Web-Frontend zeigt Landing-/Info-/Legal-Seiten, Tester-Gate/NDA, Auth, Dashboard, Admin-Kategorien und Angebotskarte.
- Mobile-App kann User registrieren/anmelden, E-Mail-Verifikation abbilden, Interessen speichern, Standort-/Push-Permissions anfordern, Angebote laden, Details anzeigen und Navigation starten.
- Push-Kette ist breit implementiert: Token-Registrierung, Background Location, Heartbeat, Geofencing, OfferVisibility-Dedupe, serverseitige Expo Pushes, lokale Notifications und Diagnostics.
- Angebotsmatching beruecksichtigt Ort, Zeitfenster, Datum/Wochentage, Radius und Interessen zumindest an mehreren Stellen server- und clientseitig.
- Release-Doku vom 2026-04-01 behauptet erfolgreiche Checks fuer Mobile-Lint, Frontend-Lint/Build, `node --check backend/server.js` und Prod-Smoke gegen `/api/health`, `/api/ping`, `/api/_readyz`, `/apk`; in dieser Bestandsaufnahme wurde das nicht erneut ausgefuehrt.

## 8. Bekannte Risiken / Unklarheiten

- Nicht getestet: keine Builds, Tests, API-Calls, DB-Verbindungen oder Deployments wurden in dieser Aufgabe ausgefuehrt.
- Dirty Working Tree: aktueller Stand ist nicht sauber committet. Die Analyse beschreibt den lokalen Arbeitsbaum, nicht nur `HEAD`.
- Viele untracked temporäre Artefakte koennen den Projektzustand vernebeln und sollten gesichtet/ignoriert/entfernt werden.
- Projekt-/Branding-Divergenz: StepsMatch.com als Projektname, aber Code, Domains, Texte und Deploy-Doku enthalten viel `Ultreia.app`/Camino.
- Domains/CORS/Fallbacks nennen `ultreia.app` und DigitalOcean Default-Hosts; Ziel-Domain StepsMatch.com muss konzeptionell abgeglichen werden.
- Android Package-Konflikt zwischen alter Doku und aktueller App-Konfiguration.
- Potenziell sensible Konfigurationsartefakte im Repo: Google/Firebase-Dateien und ein AndroidManifest mit Google Maps Key-Metadaten. Keine Werte dokumentieren; Key-Scope/Restriktionen pruefen.
- Mobile Background-Services koennen auf Android durch OEM-Akku-Management, Doze, fehlende "Immer erlauben"-Location oder deaktivierte Notification Channels ausfallen.
- Native Manifest enthaelt Berechtigungen, deren Bedarf nicht aus der kurzen Analyse belegt ist (`RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, Storage).
- `mobile/README.md` ist generisch und nicht projektspezifisch.
- `.gitignore` ignoriert lokale Logs, Screenshots, UI-Dumps, Temp-Skripte, APK/AAB-Artefakte und Credential-Dateitypen; `.env.example` bleibt ausdruecklich versionierbar.
- Git-Cleanup-Check vom 2026-06-17: lokale `.env*` und Release-Keystore-Dateien sind durch `.gitignore` abgedeckt; tracked bleiben jedoch Google/Firebase-Konfigurationsdateien und `mobile/android/app/debug.keystore`, die vor einem Commit/Release bewusst geprueft werden muessen.
- Backend-Resttreffer-Check vom 2026-06-17: `backend/server.js` enthaelt keine Ultreia-/Camino-Treffer mehr; `backend/scripts/ensure-indexes.mjs` enthaelt weiterhin einen kritischen sensiblen Config-/URI-Treffer und muss ohne Ausgabe von Werten separat bereinigt werden.
- Zeichencodierung in einigen Markdown-/JS-Ausgaben wirkt teilweise mojibake-betroffen; echte UX-Texte in App/Web muessten separat visuell geprueft werden.

## 9. Empfohlene nächste Schritte

1. Git-Arbeitsbaum aufraeumen: untracked Screenshots, UI-Dumps, Logs und Temp-Skripte klassifizieren; benoetigte Artefakte nach `docs/` oder Testordner verschieben, Rest ignorieren/entfernen.
2. Branding-/Domain-Entscheidung festlegen: StepsMatch.com vs. Ultreia.app/Camino. Danach Code, CORS, Fallbacks, Legal-Texte und App-Strings konsistent machen.
3. Package-ID final klaeren: `com.ecily.stepsmatch` als aktuelle App-ID bestaetigen oder bewusst migrieren; alte Doku/ADB-Befehle aktualisieren.
4. Secret-/Key-Audit durchfuehren: Google/Firebase/Cloudinary/Resend/Expo Keys auf Repo-Leaks pruefen, Werte rotieren falls noetig, API-Key-Restriktionen setzen.
5. Lokale risikoarme Checks ausfuehren, sobald Arbeitsbaum verstanden ist: `npm run lint` in `frontend` und `mobile`, `npm run build` in `frontend`, `node --check backend/server.js`.
6. Backend-Health und API-Smoke lokal/gegen Staging nur mit sicheren Read-only Calls pruefen.
7. Datenmodell-Migration Category/Subcategory dokumentieren und mit Backfill-/Rollback-Plan versehen.
8. Mobile Background/Push E2E-Testplan aus `docs/TESTLAUF_E2E_WEB_TO_APP.md` aktualisieren und auf aktuelle Package-ID/Domain anpassen.
9. `README.md`, `mobile/README.md` und `DEPLOY_DO_CHECKLIST.md` an den aktuellen Projektstand angleichen.

## 10. Arbeitsregeln für Codex

- Vor jeder weiteren Arbeit zuerst `docs/STEPSMATCH_CONTEXT.md` lesen.
- Nach relevanten Aenderungen diese Datei schlank aktualisieren.
- Keine Arbeiten ausserhalb von `C:\coding\stepsmatch`.
- Keine Vermischung mit Kaufklug oder anderen Projekten.
- Keine Secrets in Logs, Commits oder Markdown schreiben.
- Vor Codeaenderungen immer zuerst den aktuellen Git-Status pruefen.
- Build/Deploy/ADB/DB-Mutationen nur nach expliziter Freigabe oder wenn eindeutig lokal und risikoarm.
- Bestehende uncommitted Aenderungen als User-Arbeitsstand behandeln und nicht revertieren.
- Am Ende jeder Aufgabe berichten:
  - Ampel: Gruen/Gelb/Rot
  - Kurzfazit
  - geaenderte Dateien
  - Tests/Checks
  - Git-Status
  - offene Punkte
