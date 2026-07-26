# StepsMatch – Current State Audit

Stand: 2026-07-26
Prüfumfang: lokaler Arbeitsbaum in `C:\coding\stepsmatch`, Branch `main`, read-only Live-Smokes. Keine DB-Schreibaktion, kein Deploy, kein Push.

## Gesamtstatus

**Ampel: GELB.** Der technische MVP-Kern ist lokal belastbar und die automatisierten Checks sind grün. Pitch-/Rollout-Reife wird aber durch den nicht synchronen Live-Stand, die ungeklärte öffentliche API-Domain, fehlende vollständige Observability und offene Mobile-/Credential-Härtung begrenzt.

| Bereich | Status | Befund |
| --- | --- | --- |
| Produktkern | grün/gelb | Nähe + Interesse + aktive Inhalte sind klar umgesetzt; echte Anbieter- und Marktvalidierung fehlt. |
| Backend-Policy/Matching | grün | Radius, Zeit/Datum, Sichtbarkeit, Push-Eligibility und Cooldown sind implementiert und getestet. |
| Frontend | grün lokal / gelb live | Lint und Build grün; Provider-/Admin-Flows vorhanden. Live-API-Basis ist nicht dieselbe Domain wie die SPA. |
| Mobile | gelb | APK-/Gerätetests dokumentieren Login, Feed, Karte, Route, Heartbeat und Geofence; FCM-/OEM-/Release-Härtung bleibt offen. |
| Demo-Daten | grün lokal / gelb live | Seed-Datei enthält 50 Locations und 25 Inhalte; DB-Abgleich lokal blockiert durch Atlas-IP-Whitelist, Live-API zeigt einen älteren/anderen Bestand. |
| Observability | gelb | Diagnostics, NotificationLogs, OfferVisibility und PushToken existieren; Funnel- und Match-Events für belastbare KPIs fehlen weitgehend. |
| Datenschutz/Security | gelb | Consent-first ist fachlich dokumentiert; Key-Restriktionen, Retention, echte Release-Signatur und Live-Domain/CORS müssen vor Rollout final geprüft werden. |

## Was StepsMatch jetzt ist

StepsMatch ist ein urbanes/lokales Match-Produkt für Graz-Nord, Gösting, Andritz und 8111 Gratwein-Straßengel. Nutzer wählen Interessen. Standort, Heartbeat und Geofence liefern Kontext. Das Backend bewertet Interesse, Radius, Laufzeit, Wochentag/Zeitfenster, geografische Gültigkeit, Sichtbarkeit, Push-Eignung und Dedupe/Cooldown. Daraus entstehen erklärbare lokale Hinweise, Orte, Services oder Demo-Angebote.

Es ist keine Pilger-App, kein Branchenverzeichnis und keine reine Angebots-App. Anbietersteuerung über Radius und Laufzeit ist als MVP-Flow angelegt, aber noch kein gehärteter Self-Service für echte Partner.

## Lokal vorhanden und nachgewiesen

- Backend mit Auth, Provider-/Offer-Routen, Feed/Nearby, Match, Push, Location/Heartbeat, Diagnostics und Notifications.
- Policy-Felder in Provider/Offer: `contentType`, `publicVisibility`, `demoLabel`, `pushEligibility`, `suggestedPushPriority`, `matchReason`, `riskNote`, Quellen-/Gültigkeits-/Geo-/Cooldown-Felder.
- Frontend mit Landing/Pre-Alpha-Kommunikation, Auth/Verification, Provider-Dashboard, Add/Edit-Offer, Policy-Feldern und Admin-Offer-Map.
- Mobile mit Consent-/Onboarding-Screens, Interessen, Feed, Karte, Marker-Sheet, Directions, Push-Initializer/Token-Refresh, User-Kontext, Heartbeat, Background Location und Geofence.
- Seed-Script `backend/seeds/pitchDemoGrazNorthV1.mjs`: 50 stabile Location-Keys und 25 Content-Keys, `pitch_demo_graz_north_v1`, keine `high_attention`-Einträge, leere Bilder und Review-/Risiko-Hinweise.
- Checks: Backend 25/25, Frontend Lint/Build, Mobile Lint/TypeScript, `git diff --check` und `git diff --cached --check` grün.

## Nicht nachgewiesen

- Kein aktueller read-only DB-Count: MongoDB Atlas verweigerte die Verbindung wegen fehlender IP-Whitelist. Das Seed-Script wurde nicht mit `--apply` ausgeführt.
- Keine vollständige Feldvalidierung mit mehreren Geräten/OEMs und kein neuer APK-Build in diesem Audit.
- Keine belastbare Notification-Öffnungs-/Arrival-/Feedback-KPI-Kette.
- Keine Bestätigung, dass Live-Frontend, Live-Backend und aktuelle lokale Seed-/Policy-Version denselben Release-Stand sprechen.

## Live-Stand

- `https://stepsmatch.com/`: HTTP 200, StepsMatch-SPA, Titel „StepsMatch | Angebote finden dich“.
- `https://stepsmatch.com/api/health`, `/api/_healthz`, `/api/offers`: ebenfalls SPA-HTML statt Backend-JSON. Die öffentliche Domain routet `/api/*` aktuell nicht zum Backend.
- Direkter DigitalOcean-Backend-Host: `/api/health`, `/_healthz`, `/_readyz` HTTP 200; `/api/offers` HTTP 200 mit 31 anonym öffentlich lesbaren Datensätzen im Smoke-Zeitpunkt.
- Lokaler Client-Fallback zeigt auf den DigitalOcean-Host. Damit ist der Backend-Host erreichbar, aber die kanonische Domain-Konfiguration ist inkonsistent.

## Kritischer Pfad

1. Live-Domain/API-Routing und lokales/live Release-Artefakt abgleichen.
2. Read-only Seed-Präsenz und Pflichtfelder mit freigegebener Atlas-IP prüfen; keine Daten ändern.
3. Feldtest an Judendorf/Murauen, Gratwein Hauptplatz/Bahnhof, Graz-Nord/Gösting/Andritz durchführen.
4. Push-/Heartbeat-/Match-/Open-/Route-/Arrival-Minimum messbar machen.
5. Erst danach finale Pitch-APK, Screenshots und kontrollierten Rollout vorbereiten.
