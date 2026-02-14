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

## 11. Session-Update (2026-02-14)
Zielbild UX/UI (festgelegt)
- Stil: `premium-minimal`
- Primär-Conversion: `Route starten`
- Zielgruppe: `breit/allgemein`
- Tonalität: `freundlich-aktivierend`
- Startscreen-Strategie: `Feed-first mit Map-Preview`

Bereits umgesetzt in dieser Session (Phase 1: visuelle Vereinheitlichung)
- Zentrales Theme/Farbkonsistenz aktualisiert:
  - `mobile/theme/colors.js`
  - `mobile/theme/ThemeProvider.tsx`
- Tab-Navigation/Header visuell vereinheitlicht:
  - `mobile/app/(tabs)/_layout.js`
- Auth-Screens auf konsistentes UI-System umgestellt:
  - `mobile/app/(auth)/LoginScreen.js`
  - `mobile/app/(auth)/RegisterScreen.js`
- Onboarding-Screens auf konsistentes UI-System umgestellt:
  - `mobile/app/(onboarding)/WelcomeScreen.js`
  - `mobile/app/(onboarding)/LocationScreen.js`
  - `mobile/app/(onboarding)/InterestsScreen.js`
  - `mobile/app/(onboarding)/DoneScreen.js`
- Profil-Screen visuell vereinheitlicht:
  - `mobile/app/(tabs)/ProfileScreen.js`
- Distance-Badge vereinheitlicht/kompatibel gemacht:
  - `mobile/components/DistanceBadge.tsx`

Lint-/Qualitätsstatus nach Cleanup
- Mobile-Lint wurde komplett bereinigt.
- Ergebnis: `npm run lint` in `mobile/` -> `0 errors`, `0 warnings`.
- Relevante bereinigte Dateien (ohne Funktionsänderung):
  - `mobile/app/(tabs)/index.js`
  - `mobile/app/(tabs)/NavigationMap.jsx`
  - `mobile/app/(tabs)/NavigationScreen.js`
  - `mobile/app/(tabs)/OffersScreen.js`
  - `mobile/app/(tabs)/[id].tsx`
  - `mobile/app/(tabs)/offers/[id].tsx`
  - `mobile/components/NotificationPermissionPrompt.tsx`
  - `mobile/components/BackgroundLocationManager.js`
  - `mobile/components/LocationPermissionPrompt.tsx`
  - `mobile/components/PushInitializer.tsx`
  - `mobile/components/push/push-geofence.ts`
  - `mobile/components/push/push-location.ts`
  - `mobile/components/push/push-notifications.ts`
  - `mobile/components/push/push-state.ts`

Offen fuer naechsten Chat (Phase 2: eigentliche UX/UI-Implementierung)
- Vollstaendige Weltklasse-UX fuer Kern-Flows finalisieren (ohne Funktionseinbussen):
  - Home/Feed (`mobile/app/(tabs)/index.js`)
  - Offer-Detail (`mobile/app/(tabs)/offers/[id].tsx`)
  - Map-Discovery (`mobile/app/(tabs)/NavigationMap.jsx`)
  - Turn-by-turn Navigation (`mobile/app/(tabs)/NavigationScreen.js`)
- Einheitliches Komponenten-Set weiterziehen (Cards, Hero, Bottom-CTA, Status/Badges, Empty/Loading States).
- Service-Control-UX (Aktiv/Pause/Aus) in Home visuell und sprachlich weiter verfeinern.
- DSGVO-Hinweise/Opt-in-Kommunikation als UX-Schicht integrieren.

Hinweis fuer Fortsetzung
- Technische Funktionalitaet (Heartbeat/Geofence/Push/Service-Control) bleibt weiterhin prioritaer unveraendert.
- Naechster Schritt startet direkt mit visueller Endausarbeitung der Kernscreens (Phase 2).

## 12. Session-Update (2026-02-14, Fortsetzung / Übergabe für naechsten Chat)

Wichtige Arbeitsregel in dieser Session
- Vorgabe des Users: Funktionalitaet darf nicht veraendert werden.
- Relevante Erkenntnis: Bei UX-Refactors kann funktionaler Regress entstehen; Navigation/Directions wurde deshalb priorisiert hotfixed.

Phase-2-Endimplementierung (UI/UX) wurde abgeschlossen in:
- `mobile/app/(tabs)/index.js`
- `mobile/app/(tabs)/offers/[id].tsx`
- `mobile/app/(tabs)/NavigationMap.jsx`
- `mobile/app/(tabs)/NavigationScreen.js`
- `mobile/app/(tabs)/ProfileScreen.js`

Zusatz in dieser Session
- DSGVO-/Opt-in-Kommunikation eingebaut (Home, Offer-Detail, Profil).
- Persistenz-Key fuer Einwilligung: `privacy.push.optin.v1` (AsyncStorage).
- Service-Control-Texte und Statusdarstellung in Home verfeinert.

Kritischer Regress, der auftrat
- Symptom: In Navigation wurde nur eine gerade Linie statt Google-Wegroute gezeichnet.
- Sichtbarer Hinweis in UI: `Google Directions: API-Key fehlt`.
- User hat zu Recht eskaliert, da Funktionalitaet nicht veraendert werden durfte.

Root Cause (technisch)
- In `mobile/app/(tabs)/NavigationScreen.js` wurde `directionsFetch` mit falscher Signatur aufgerufen (Objekt statt Funktionssignatur).
- Fallback-Code setzte dann `setRouteCoords([origin, dest])` -> gerade Linie.
- Zusaetzlich wurde Key-Resolution robuster gemacht.

Finaler Fix (umgesetzt)
- `NavigationScreen.js` nutzt wieder den korrekten Call:
  - `directionsFetch(origin, dest, DIRECTIONS_KEY, 'walking')`
- Key-Resolution in `NavigationScreen.js` verbessert:
  - `Constants.expoConfig?.extra`
  - Fallback: `Constants.manifest?.extra`, `Constants.manifest2?.extra`, `process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY`
- Ergebnis: Route kann wieder ueber Google Directions berechnet werden statt Gerade.

Relevante Konfig-Pruefung
- `mobile/app.config.js` traegt `extra.directionsKey` aus `EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY` ein.
- Build-Log zeigte Export der ENV-Variablen waehrend Bundle:
  - `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`
  - `EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY`

Qualitaetsstatus
- Mehrfach geprueft: `npm run lint` in `mobile/` -> `0 errors`, `0 warnings`.
- Release-Build erfolgreich:
  - `cd mobile/android && ./gradlew.bat assembleRelease`

ADB / Installation in dieser Session
- Uninstall + Install erfolgreich:
  - `adb uninstall com.ecily.mobile`
  - `adb install -r "c:\coding\stepsmatch\mobile\android\app\build\outputs\apk\release\app-release.apk"`
- Zwischenzeitlich: `adb.exe: no devices/emulators found` (temporar, danach wieder verbunden).
- Letzter Status: Geraet erkannt und APK erfolgreich installiert (`Success`).

Aktueller Stand fuer naechsten Chat
- User startet nun Feldtest.
- Erwartung fuer naechsten Chat: User berichtet Feldtest-Ergebnisse zuerst.
- Prioritaet im naechsten Chat:
  1. Verifizieren, dass Directions-Route stabil als echte Wegroute gezeichnet wird.
  2. Falls erneut Ausfall: sofort Logs sammeln (NavigationScreen + directions service + runtime `extra.directionsKey`).
  3. Nur minimalinvasive Fixes, keine Funktionseinschraenkung.

Schnellbefehle (Merker)
- Lint: `cd mobile && npm run lint`
- Release-Build (Git Bash): `cd mobile/android && ./gradlew.bat assembleRelease`
- APK installieren: `adb install -r "c:\coding\stepsmatch\mobile\android\app\build\outputs\apk\release\app-release.apk"`
- APK Pfad: `mobile/android/app/build/outputs/apk/release/app-release.apk`

## 13. Session-Update (2026-02-14, Live-Frontend Incident + Hotfix)

Ausgangslage (kritisch)
- Auf `https://www.stepsmatch.com` schlugen Registrierungen/Logins fehl (`ERR_NETWORK`, `ERR_CONNECTION_REFUSED`).
- Browser-Fehler zeigte Requests an `localhost:8080/api/users/register`.
- Impact: Live-User konnten nicht angelegt werden, Login/Admin ebenfalls betroffen.

Root Cause
- Frontend-API-Resolver in `frontend/src/api/axios.js` hatte einen localhost-Fallback.
- Unter bestimmten Build-/Env-Konstellationen (fehlendes/fehlaufgeloestes `VITE_API_BASE_URL`) konnte der gehostete Build auf localhost fallen.

Sofort-Hotfix (umgesetzt)
- Datei angepasst: `frontend/src/api/axios.js`
- Neue Policy:
  - Auf gehosteten Domains (`nicht localhost`) wird localhost niemals als API verwendet.
  - Falls `VITE_API_BASE_URL` fehlt, wird als Live-Fallback verwendet:
    - `https://lobster-app-ie9a5.ondigitalocean.app/api`
  - Falls gehostet und API trotzdem auf localhost aufloest, wird hart auf Live-Fallback ueberschrieben.
  - Lokaler Dev-Fallback auf `http://localhost:8080/api` bleibt fuer localhost erhalten.

Build-/Qualitaetsstatus
- Frontend Build geprueft: `cd frontend && npm run build` -> erfolgreich.
- Mobile Lint/Build-Status aus vorherigen Updates bleibt unveraendert (sauber).

Wichtige Dateien (dieser Chat)
- Geaendert: `frontend/src/api/axios.js`
- Referenz geprueft:
  - `frontend/.env.production`
  - `frontend/.env.live`
  - `frontend/vite.config.js`

Operative Hinweise fuer Deploy (naechster Schritt)
- Frontend neu deployen auf DO App Platform (empfohlen mit Clear Build Cache).
- Sicherstellen:
  - Build Command: `npm run build`
  - Output Dir: `dist`
  - Env: `VITE_API_BASE_URL=https://lobster-app-ie9a5.ondigitalocean.app/api`
- Nach Deploy Browser Hard-Refresh (`Ctrl+F5`) und Register/Login/Admin erneut testen.

Status am Ende dieser Session
- User-Rueckmeldung: "soweit zufrieden".
- Feldtest laeuft parallel weiter.
- Naechster Chat soll auf `CONTEXT.md` referenzieren und direkt mit Testergebnissen fortsetzen.

## 14. Session-Update (2026-02-14, Mobile-Finetuning final + Uebergabe)

Ziel dieser Session
- Letzte UX-/Verhaltens-Feinjustierung vor MVP-Freeze, ohne Aenderung der Kernarchitektur (Heartbeat/Geofence/Service-Control).

Umgesetzte Kernpunkte (Mobile)
1) Foreground-Notifications konsequent unterdrueckt
- Anforderung: Solange App im Vordergrund offen ist, keine System-Pushes/Banner/Sound.
- Umsetzung:
  - `mobile/components/push/push-notifications.ts`:
    - Foreground-Offer-Events werden als In-App-Signal emittiert (`offers:foreground-signal`) statt OS-Notification.
    - Lokale Offer-Notifs im Foreground werden weiterhin deduped/markiert, aber nicht als System-Notification angezeigt.
  - `mobile/components/PushInitializer.tsx`:
    - Zweite globale `Notifications.setNotificationHandler` korrigiert (Root Cause fuer weiter auftretende Initial-Pushes).
    - Bei App offen (`AppState != background`) jetzt: kein Banner, keine Liste, kein Alert, kein Sound.
  - `mobile/app/_layout.js`:
    - Beim Wechsel nach `active`: `dismissAllNotificationsAsync()` + `setBadgeCountAsync(0)` (Cleanup eventuell bereits gezeigter Notifs).

2) In-App-Hinweis statt Push im Foreground
- `mobile/app/(tabs)/index.js`:
  - Lauscht auf `offers:foreground-signal`.
  - Zeigt dezenten Inline-Hinweis fuer neue relevante Offers (statt System-Push).
  - Triggered gleichzeitig einen leichten Feed-Refresh.

3) DSGVO-Card: minimiert + wieder aufklappbar
- `mobile/app/(tabs)/index.js`:
  - DSGVO-Bereich ist jetzt collapsible.
  - Minimierte Zeile ist antippbar und klappt Optionen wieder aus.
  - Status wird in der Header-Zeile angezeigt, Inhalte/Aktionen im Expanded-State.

4) Hintergrunddienst-Card: gleiche Collapse-Logik
- `mobile/app/(tabs)/index.js`:
  - Hintergrunddienst-Bereich ebenfalls aufklappbar/zuklappbar.
  - Im kompakten Zustand nur Status + Hinweis, Optionen im Expanded-State.

5) Logout beendet Hintergrunddienst sicher
- `mobile/app/(tabs)/ProfileScreen.js`:
  - Vor Logout/Clear: `setServiceEnabled(false, 'logout')` + `stopBackgroundServices('logout')`.

6) Karten-/Navigation-Feinschliff aus dieser Session
- `mobile/app/(tabs)/NavigationMap.jsx`:
  - Beim Aufruf initial auf aktuellen User-Standort zentrieren.
- `mobile/app/(tabs)/NavigationScreen.js`:
  - Fit auf Route/Koordinaten statt unnoetig weitem Zoom.
  - Fussgaenger-orientiertes Follow-Verhalten (Kamera/Heading/Pitch-Logik).
  - Positive Arrival-Meldung bei Zielerreichung.

Qualitaetsstatus
- `npm run lint` in `mobile/` mehrfach gruen (0 errors, 0 warnings) nach den finalen Anpassungen.

Wichtige Arbeitspraeferenz des Users (verbindlich)
- Build/Install/Uninstall IMMER manuell durch User.
- Befehle IMMER in Bash-Form bereitstellen.
- Keine automatische Ausfuehrung dieser Schritte durch den Agent ohne explizite neue Aufforderung.

Bash-Merker (manuell)
- Lint:
  - `cd /c/coding/stepsmatch/mobile && npm run lint`
- Release APK:
  - `cd /c/coding/stepsmatch/mobile/android && ./gradlew.bat assembleRelease`
- Uninstall/Install:
  - `adb uninstall com.ecily.mobile`
  - `adb install -r "/c/coding/stepsmatch/mobile/android/app/build/outputs/apk/release/app-release.apk"`

MVP-Status / Uebergabe
- User-Einschaetzung: App ist MVP-bereit.
- Naechster Chat-Fokus (explizit gewuenscht):
  1. Frontend (Web/Admin) UX/UI vollstaendig optimieren.
  2. Mobile-Funktionalitaet stabil lassen, nur falls explizit angefordert anfassen.
  3. CONTEXT.md als alleinige Projektwahrheit weiterverwenden.
