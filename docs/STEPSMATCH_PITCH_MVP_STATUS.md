# StepsMatch – Pitch MVP Status

Stand: 2026-07-26

## Pitchfähiger Kern

### Kernbeweis

Der Pitch-MVP kann den echten Kern zeigen: Nutzer wählen Interessen, die App läuft im Hintergrund, Nähe/Zeit/Radius/Gültigkeit erzeugen Relevanz, und Push erreicht den Nutzer auch bei geschlossener App bzw. ausgeschaltetem Bildschirm. Feed, Karte, Route und Match-Grund erklären danach den Match. Der technische Kern ist lokal am getesteten Android-Gerät bewiesen.

Das ist kein Versprechen einer öffentlichen Beta, von Partnerclaims, Play-Store-Reife oder eines allgemeinen Rollouts.

Der Pitch kann den Ablauf zeigen: Interessen wählen → Standortkontext → passender lokaler Demo-Hinweis → Match-Grund/Pre-Alpha-Label → Karte → Route. Ergänzend kann der Anbieter-/Admin-Flow Radius, Laufzeit, Zeitfenster, Sichtbarkeit, Push-Eignung und Risiko-/Quellenfelder zeigen.

Lokal sind die automatisierten Checks grün: 25 Backend-Tests, Frontend Lint/Build, Mobile Lint/TypeScript. Der Seed umfasst 50 Locations und 25 matchbare Inhalte für Andritz, Gösting/Graz-Nord und Gratwein-Strassengel.

## Gerätetest-Befunde

Aus dem Projektkontext dokumentiert und am getesteten Android-Gerät validiert: Login, Interessen, Feed, Demo-/Pre-Alpha-Labels, Match-Gründe, Karte, manuelle Route, PushToken/User-Kontext, Heartbeat, Geofence sowie Background-/Closed-App-/Screen-off-Push. Der technische Kern ist damit lokal auf diesem Gerät bewiesen. Die Basemap- und Directions-Probleme wurden lokal über Konfiguration behoben.

Nicht behauptet werden darf: Feldstabilität auf mehreren OEMs, belastbare Push-Open-Rate, Partnerzustimmung oder Markt-/Umsatznachweis.

## Demo-Daten

**Korrektur:** Laut vorherigem Context wurde der kontrollierte Seed importiert. In diesem Korrekturlauf wurde der Live-Bestand nicht verifiziert; der zuvor dokumentierte aktuelle Standort lag außerhalb der Seed-Radien.

Der Live-Bestand ist damit ausdrücklich nicht verifiziert; die Aussage „keine Importausführung“ in der älteren Audit-Fassung ist durch den vorherigen Importbefund überholt.

`backend/seeds/pitchDemoGrazNorthV1.mjs` ist idempotent über `demoSeedTag=pitch_demo_graz_north_v1` und stabile Keys. Laut vorherigem Context wurde der Seed kontrolliert importiert. Der aktuelle Live-Bestand ist nicht verifiziert; der zuvor dokumentierte aktuelle Standort lag außerhalb der Seed-Radien.

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
