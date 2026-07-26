# StepsMatch – Technical Architecture Audit

Stand: 2026-07-26. Nur statische Prüfung und sichere GET-Smokes.

## Architektur

Das Repository ist in drei Laufzeitbereiche geteilt:

- `backend/`: Express/Mongoose/Node-Backend mit Models, Routes, Controller, Utils, Jobs und Seeds.
- `frontend/`: React/Vite-SPA mit AuthContext, React Router, Landing, Provider- und Admin-Oberflächen.
- `mobile/`: Expo/React-Native-App mit Expo Router, nativen Android-Kotlin-Komponenten für Heartbeat sowie Location/Push/Maps.

Der lokale Frontend-API-Client nutzt Env-first, dann `window.__SM_API__`, lokal `localhost:8080/api` und hosted den DigitalOcean-Fallback. `frontend/.env.example` nennt dagegen `https://stepsmatch.com/api`. Diese zwei Produktionspfade erklären den Live-Routing-Risikobefund.

## Backend

Vorhanden sind Auth/Login/Register/Verify, Provider, Offers/Feed/Nearby, Categories, Match, Push, Location, Uploads, Testers, Diagnostics und Notifications. Health-Routen sind `/api/health`, `/api/ping`, `/api/_healthz` und `/api/_readyz`. Der Offer-Poller und GeoPush nutzen dieselbe Policy-Schicht wie Feed/Heartbeat; das reduziert divergierende Matchregeln.

Wichtige Modelle:

- `User`: Auth, Verifikation und Interessen.
- `Provider`: Ort, Kategorie, Radius, Quellen-/Demo-/Visibility-Felder und Besitzerbezug.
- `Offer`: Inhalt, Ort, Interessen, Zeit/Datum, Policy, Push, Match-Grund, Quelle, GeoValidity und Cooldown.
- `PushToken`: Device-/Expo-Token-Kontext, Interessen, Standort-/Heartbeat-Status und Gültigkeit.
- `OfferVisibility`: Sichtbarkeits-, Inside-, Match-/Notification-Zustand pro Nutzer/Token.
- `ClientDiagLog` und `NotificationLog`: technische bzw. Notification-nahe Diagnosen.

Die Policy ist additive und legacy-kompatibel: `radiusMeters` wird auf `Offer.radius` abgebildet; `validFrom`/`validTo`, `activeDays`/`activeTimeWindows` werden neben älteren Feldern unterstützt. Das ist pragmatisch für den MVP, erhöht aber die langfristige Schema-Komplexität.

## Matching, Push, Heartbeat, Geofence

Heartbeat und Geofence liefern Standortkontext. Feed und Poller prüfen aktive Zeit/Datum, Distanz, Interessen, Sichtbarkeit, PushEligibility sowie Cooldown/Dedupe. `in_app_only` und Review-/unsichere Inhalte werden nicht pushfähig. Route-/Area-Kandidaten bleiben in v1 bewusst nicht punkt-radius-matchbar; das ist durch Tests abgesichert.

## Core Technical Proof: Background Push + Location

Der zentrale technische Proof ist am getesteten Android-Gerät validiert: Background-/Closed-App-/Screen-off-Push funktioniert im aktuellen lokalen Teststand. StepsMatch steht und fällt mit Nähe + Interesse + Zeit + Push. Der Proof verbindet Standortkontext, Match-Policy und Push, ohne dass die App geöffnet sein muss.

Beteiligte Komponenten:

- Mobile `PushInitializer` und Expo/Firebase PushToken;
- PushToken/User-Kontext;
- nativer/JS-Heartbeat und Foreground Service;
- Geofence;
- Backend `/api/push/register` und `/api/location/heartbeat`;
- GeoPush und `OfferVisibility`.

Damit ist StepsMatch mehr als eine offene Karten-App: Relevante Inhalte werden im Hintergrund anhand von Nähe, Interesse, Zeit und Radius erkannt und gezielt zugestellt. Die Validierung gilt für das getestete Android-Gerät, nicht als Gerätegarantie.

Offen bleiben Multi-OEM-/Multi-Device-Tests, transiente FCM-/Expo-Fehler, Google-Maps-Runtime-Caveats und ein Monitoring-/KPI-Minimum.

Der Kern ist technisch nachvollziehbar, aber die Ereigniskette ist noch nicht als vollständiges, aggregierbares Eventmodell persistiert. `OfferVisibility` ist eher Zustand als vollständige Entscheidungshistorie.

## Mobile

Die App enthält Consent-/Onboarding-Routen, Auth/Verify, Interessen, Tabs für Offers/Map/Profile/Diagnostics, Offer-Screen, Marker-Sheet und Directions. `PushInitializer`, Token-Refresh, User-Kontext-Sync, `BackgroundLocationManager`, Geofence-Task und nativer `HeartbeatService` bilden die Kernkette.

Dokumentierte Gerätetests bestätigen Android-Release-APK, Login, Interessen, Feed, Google-Basemap, Directions, Screen-off-Heartbeat/Foreground-Service, Geofence sowie Background-/Closed-App-/Screen-off-Push am getesteten Android-Gerät. Nicht vollständig abgesichert sind OEM-Doze/MIUI, Multi-Device-Stabilität, transiente FCM-/Expo-Fehlerfälle und Release-Signing.

Offene technische Punkte: temporäre Diagnoseflächen/Logs, Google-Key-Rotation und Restriktionen, echte Release-Signatur, Package-/Native-Namespace-Konsistenz, FCM/EAS-Credentials und Notification-Kanalverhalten im Alltag.

## Frontend

Landing und Pitch erklären Nähe + Interesse + aktives Angebot und markieren PRE ALPHA. Provider können Radius, Laufzeit, Wochentage, Zeitfenster, Visibility, Push-Eignung, Demo-Label, Risiko- und Quellfelder pflegen. Admin Offers Map visualisiert Policy, Radius und aktive Zustände.

Lokal sind Lint und Produktionsbuild grün. Eine echte Live-Route `/api/*` auf `stepsmatch.com` ist jedoch nicht als Backend-Endpunkt funktionsfähig; der direkte Backend-Host ist erreichbar.

## Seeds und Datenmodell

Der Pitch-Seed trennt 50 `real_demo_location`/`editorial_public_place`-Locations von 25 `MatchableDemoContent`-Inhalten. Stabile `demoKey`s und `demoSeedTag` unterstützen idempotente Upserts. Quellen, `sourceVerifiedAt`, Risiko-Hinweise, Radius, Laufzeit, aktive Tage/Zeitfenster, Visibility und Push-Policy werden gesetzt. Bilder bleiben leer; Partnerclaims, Preise, Rabatte, Öffnungszeiten und `high_attention` sind im Seed ausdrücklich ausgeschlossen.

Die Implementierung bildet das kuratierte Modell gut ab, aber `DemoLocation` und `MatchableDemoContent` sind keine eigenen Mongo-Collections, sondern Provider/Offer mit Seed-/Policy-Feldern. Das ist für den Pitch schnell, bleibt aber eine Architekturentscheidung vor Beta.

## Technische Schulden

- doppelte Legacy-/Policy-Felder und uneinheitliche Alias-Namen;
- kein vollständiges Match-/Notification-Funnel-Eventmodell;
- mögliche öffentliche API-/CORS-/SPA-Routing-Divergenz;
- fehlende DB-Read-only-Prüfung im Audit wegen Atlas-Netzwerkfreigabe;
- Android/OEM/FCM/Signing-Härtung und Key-Restriktionen;
- kein zentraler Admin-KPI-Snapshot/Feedbackkanal;
- lokale Artefakte und ältere Dokumentationsstände können den Release-Stand verschleiern.
