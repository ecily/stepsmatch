# StepsMatch – Pitch MVP Status

Stand: 2026-07-26

## Pitchfähiger Kern

Der Pitch kann den Ablauf zeigen: Interessen wählen → Standortkontext → passender lokaler Demo-Hinweis → Match-Grund/Pre-Alpha-Label → Karte → Route. Ergänzend kann der Anbieter-/Admin-Flow Radius, Laufzeit, Zeitfenster, Sichtbarkeit, Push-Eignung und Risiko-/Quellenfelder zeigen.

Lokal sind die automatisierten Checks grün: 25 Backend-Tests, Frontend Lint/Build, Mobile Lint/TypeScript. Der Seed umfasst 50 Locations und 25 matchbare Inhalte für Andritz, Gösting/Graz-Nord und Gratwein-Strassengel.

## Gerätetest-Befunde

Aus dem Projektkontext dokumentiert: Login, Interessen, Feed, Demo-/Pre-Alpha-Labels, Match-Gründe, Karte, manuelle Route, PushToken/User-Kontext, Heartbeat und Geofence wurden auf Android getestet. Die Basemap- und Directions-Probleme wurden lokal über Konfiguration behoben. Screen-off-Heartbeat/Foreground-Service ist dokumentiert, der vollständige wiederholbare Remote-Push-E2E bleibt wegen Credential-/Runtime-/OEM-Abhängigkeiten ein gelber Bereich.

Nicht behauptet werden darf: Feldstabilität auf mehreren OEMs, belastbare Push-Open-Rate, Partnerzustimmung oder Markt-/Umsatznachweis.

## Demo-Daten

`backend/seeds/pitchDemoGrazNorthV1.mjs` ist idempotent über `demoSeedTag=pitch_demo_graz_north_v1` und stabile Keys. Es gibt keine Importausführung in diesem Audit. Ein read-only DB-Abgleich scheiterte an der Atlas-IP-Whitelist. Der direkte Live-Offer-Endpoint meldete 31 ältere/andere Inhalte; das ist kein Beleg für den neuen 25er Seed.

## Was im Pitch gezeigt werden kann

- Produktidee und klare Abgrenzung als lokales Match-Produkt;
- Interessen-, Nähe-, Zeit- und Radiuslogik;
- erklärbarer Match-Grund und transparentes Demo-Label;
- Karte, Marker-Sheet, Directions und Arrival-Kontext;
- Anbietersteuerung und Admin-Policy-Sicht;
- technische Laborergebnisse mit klaren Grenzen.

## Vor dem Pitch

1. Live-SPA/API-Routing und Backend-Release eindeutig abgleichen.
2. Einen echten Seed-Feldtest innerhalb der Radien durchführen; sinnvolle Punkte sind Judendorf/Murauen, Gratwein Hauptplatz/Bahnhofsumfeld sowie Graz-Nord/Gösting/Andritz.
3. Eine finale APK aus dem geprüften Commit bauen, installieren und den Pitch-Flow screen-recorden.
4. FCM-/Maps-/Directions-Credentials und Android-Release-Signing prüfen, ohne Werte zu dokumentieren.
5. Nur belastbare lokale Testzahlen verwenden; keine Partner- oder Verfügbarkeitsclaims.

## Feldtestplan

| Phase | Ort | Test | Erfolgskriterium |
| --- | --- | --- | --- |
| A | Gratwein Hauptplatz/Bahnhof | Kaffee/Service, Feed, Karte | Inhalt innerhalb Radius sichtbar, Match-Grund verständlich |
| B | Judendorf/Murauen | Ruhe/Natur, leiser In-App-Hinweis | kein Push-Lärm, Route/Ort plausibel |
| C | Andritz/Gösting | Gastro/Service/Apotheke | Interessen-, Zeit- und Distanzfilter nachvollziehbar |
| D | Screen-off, mehrere Android-OEMs | Heartbeat/Geofence/Push | kein unerklärlicher Spam, Fehler in Diagnostics sichtbar |

## Roadmap

### Sofort vor Pitch

- realer Radius-Feldtest;
- Live-Abgleich und gegebenenfalls separat freigegebener Deploy;
- finale APK, Screenshots, Video und kurzer Demo-Flow.

### Vor 5–10 Testusern

- Minimum-Monitoring für Registrierung, Permissions, Heartbeat, Token, Match und Notification;
- Token-Cleanup, Feedbackkanal, Admin-Kontrollsicht, klarer Testtext und Rollback-Plan.

### Später Beta

- echte Anbieterfreigaben und gehärteter Provider-Self-Service;
- bessere Observability, Retention/DSGVO-Finalisierung;
- Play-Store-Vorbereitung, Release-Signing und Skalierung/Datenqualität.
