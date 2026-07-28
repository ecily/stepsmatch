# StepsMatch Web-Audit

Stand: 2026-07-27
Scope: StepsMatch-Weblösung in `C:\coding\stepsmatch`; read-only Live-/API-Prüfungen, keine DB-Mutation.

## Abschlussaudit 2026-07-28

**Ampel: GELB-GRÜN.** Der produktive Webstand ist auf `main` bei `d5e0326` und mit `origin/main` synchron. Lint/Build/Diff-Checks sind grün. Offen bleiben ausschließlich nicht ausgeführte manuelle Browser-/Viewport-Smokes, Lighthouse sowie bestehende Plattform-, Security- und Rollout-Risiken.

- Hero live: `Nicht suchen. Finden!`, aktuelle StepsMatch-Beschreibung, lokales großes Hero-USP-Motiv, organische Fade-/Maskierungsintegration, kein alter Formeltext und kein Hero-CTA `So funktioniert es`; verbleiben `App testen` und `Anbieter werden`.
- Nutzer-/Anbieter-Flow live im Landing-Bundle: jeweils vier semantische Textschritte vor dem zugehörigen Comic; der frühere Landingpage-Beispielblock bleibt entfernt.
- Navigation live vereinfacht: redundante Header-/Footer-Punkte sind entfernt. Redirect-/Anchor-Ziele bleiben `/app` → `/tester`, `/so-funktionierts` → `/#so-funktionierts`, `/pre-alpha` → `/#pre-alpha`, `/anbieter` → `/#anbieter`.
- Erstbesuchsmodal live: nur Landingpage, 700-ms-Verzögerung, lokaler Key `stepsmatchTesterModalDismissedV1`, temporäres `Später`, dauerhaftes X/Escape/CTA-Dismiss. Die Modalstruktur hat einen nicht scrollenden Header und den separaten Flex-Scrollbereich `sm-support-modal-scroll` mit `overflow-y: auto`, `min-height: 0`, `100vh`/`100dvh` und ohne horizontales Overflow.
- Tester-Key-Flow live im Bundle: vorhandener Request-Endpunkt, sichtbarer Erfolgszustand nach bestätigter Antwort, Fehler-/Validierungslogik erhalten. Keine echte Tester-Anfrage im Audit.
- Live: `/`, `/tester`, `/app`, `/so-funktionierts`, `/pre-alpha` und `/anbieter` HTTP 200 SPA-Shell. API `https://api.stepsmatch.com/api/health`, `/_healthz` und `/_readyz` HTTP 200 JSON; `/api/ready` HTTP 404, kein dokumentierter Endpunkt.
- Live-Shell-Assets antworteten ohne offensichtliche 404; relevante Landing-, Tester-Key- und CSS-Bundles wurden read-only geprüft.

## 1. Kurzfazit / Ampel

**Gelb-grün für Pitch und interne Pre-Alpha-Tests.** Die zentrale Webbotschaft, der Anbieter-/Nutzerfluss, die Tester-Key-Anfrage, die SPA-Routen und die getrennte Production-API sind nachvollziehbar und live erreichbar. Der technische Core-Proof bleibt wie dokumentiert ein lokaler Mobile-/Testgerätebefund und wird durch dieses Web-Audit nicht erweitert.

Gelb bleiben die bewusst nicht umgebauten Themen: `/api/*` auf der kanonischen Web-Domain liefert weiterhin SPA-HTML, die statische Webantwort zeigt in der Prüfung keine HSTS-/X-Frame-/X-Content-Type-Header, Modals haben keine explizite Fokusfalle/Escape-Behandlung, und ein Lighthouse-/echter Browser-Matrix-Test wurde nicht ausgeführt.

## 2. Was live funktioniert

Read-only geprüft:

- `https://www.stepsmatch.com/`, `/tester`, `/login`, `/register`, `/anbieter` und `/admin/offers` liefern HTTP 200 als SPA-Shell.
- `https://api.stepsmatch.com/api/health` liefert HTTP 200 JSON mit `ok: true` und `env: production`.
- `https://api.stepsmatch.com/api/_healthz` und `/_readyz` liefern HTTP 200 JSON.
- `https://api.stepsmatch.com/api/ready` ist nicht vorhanden und liefert 404; der dokumentierte Ready-Endpunkt ist `/_readyz`.
- Das aktuelle Live-Tester-Bundle enthält `← Zur Startseite`; der Link zeigt auf `/`.

## 3. Frontend-/UX-Bewertung

Die Landingpage macht in wenigen Sekunden klar, dass StepsMatch lokale Anbieter und Menschen verbindet, wenn Angebot, Interesse, Ort und Zeit zusammenpassen. Die Kernformel `Angebot + Interesse + Ort + Zeit = relevanter Match` ist sichtbar. Anbieterlogik (Angebot, Radius, Laufzeit/Zeitfenster, passende Menschen) und Nutzerlogik (Interessen, Hintergrund-App, passender Push, Karte/Route) werden in getrennten, verständlichen Abschnitten erklärt.

Branding, Logo, PRE-ALPHA-Kennzeichnung, Demo-Labels und der Verzicht auf Partner-/Rabatt-/Preisversprechen sind konsistent. Navbar, CTA-Hierarchie, Karten und Formulare nutzen ein einheitliches StepsMatch-System. Responsive Utility-Klassen, umbruchfähige CTA-Zeilen und das viewport-begrenzte Tester-Popup sind für Mobile/Tablet plausibel. Ein pixelgenauer Browser-/Gerätetest wurde nicht ausgeführt.

Der `/tester`-Flow ist oben sichtbar mit `← Zur Startseite` nach `/` ausgestattet. Key-Eingabe, Anfrageformular, NDA und Download-Gating wurden dabei nicht verändert.

## 4. Performance-Bewertung

Der Produktionsbuild läuft grün. Vite transformiert 1716 Module. Der größte lokale JS-Chunk liegt bei ca. 242 kB unkomprimiert bzw. 78,5 kB gzip; der Landing-Chunk bei ca. 40 kB, das Hero-Bild bei ca. 182 kB. Routen werden lazy geladen, Icons werden aus separaten Chunks geladen. Das ist für den aktuellen Pre-Alpha-Umfang vertretbar; weitere Bildkompression und ein Lighthouse-Lauf bleiben spätere Optimierungen.

Der Build meldet nur veraltete Browserslist-Daten (`caniuse-lite`), keinen Buildfehler. `npm audit` konnte wegen lokaler TLS-Zertifikatsprüfung gegen `registry.npmjs.org` nicht abgeschlossen werden; es wurde kein Upgrade ausgeführt.

## 5. API-/Routing-Bewertung

Der Frontend-Client nutzt auf den kanonischen Hosts fest `https://api.stepsmatch.com/api`; localhost bleibt auf lokale Entwicklung begrenzt. Die API-Subdomain antwortet korrekt mit JSON. Ein CORS-Preflight von `https://www.stepsmatch.com` für POST mit `content-type` und `x-tester-key` liefert 204, passende Allow-Origin-/Credentials-/Header-Werte sind vorhanden.

`https://www.stepsmatch.com/api/health` liefert weiterhin die SPA-Shell. Das ist gemäß aktueller Zielarchitektur zulässig, darf aber nicht als API-Healthcheck verwendet werden. Monitoring und Deploy-Konfiguration müssen die API-Subdomain verwenden.

## 6. Tester-Key-/Graph-Mail-Bewertung

Das Anfrageformular hat Labels, Pflichtfelder, Consent-Checkboxen, Honeypot-Feld und verständliche Erfolgs-/Fehlertexte. Ein leerer Payload an `POST /api/testers/request-key` wurde read-only mit HTTP 400 abgewiesen; es wurde keine Mail ausgelöst. Die Graph-Konfiguration liegt ausschließlich in Backend-ENV-Namen; der Service hat Timeout-/Konfigurationsfehlerbehandlung und laut Kontext kein DB-Speichern der Anfrage.

Der Tester-Validate-/NDA-Accept-Flow ist fachlich vom Formular getrennt. Diese Audit-Prüfung hat keine validierenden oder akzeptierenden Requests gesendet und keine DB-Mutation ausgeführt.

## 7. Security-/Privacy-Basics

Backend-seitig sind `x-powered-by` deaktiviert, Helmet aktiv, CORS whitelisted, JSON-Limits gesetzt und API-Fehler als JSON vereinheitlicht. Die Tester-Key-Anfrage nutzt Rate-Limit/Honeypot gemäß aktuellem Projektstand. Der Frontend-Download-Key bleibt ausdrücklich nur eine Pre-Alpha-Zugangshürde und keine harte Security-Grenze.

Live zeigt die API erwartbare Security-Header (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`). Die Web-Static-Shell zeigte in der Prüfung keine entsprechenden Header; das sollte auf CDN/Static-Site-Ebene separat gehärtet werden. Keine Secret-Werte wurden gelesen, ausgegeben oder verändert.

## 8. Accessibility-Basics

Formulare besitzen sichtbare Labels und passende `htmlFor`-/`id`-Verknüpfungen. Buttons und Router-Ziele sind semantisch getrennt, Touch-Flächen sind überwiegend ausreichend, Fehler-/Statusbereiche nutzen `role="alert"` bzw. `role="status"`, und Dialoge sind als `role="dialog"`/`aria-modal` markiert.

Offen bleibt eine explizite Fokusinitialisierung, Fokusfalle und Escape-Schließen für das APK-Modal. Das ist ein sinnvoller kleiner Accessibility-Fix für einen separaten Durchlauf, wurde in diesem Audit wegen fehlendem visuellen Browser-Retest nicht spekulativ umgesetzt.

## 9. Umgesetzte Sofortfixes

- Vor diesem Audit: Frontend-API-Basis auf `https://api.stepsmatch.com/api` abgesichert.
- Vor diesem Audit: sichtbare mobile Tester-Navigation `← Zur Startseite` nach `/` ergänzt.
- Vor diesem Audit: Tester-Key-Anfrageformular, responsive Modalstruktur, Graph-Timeout und Konfigurationsfehlerbehandlung geschärft.
- In diesem Audit: keine zusätzliche Code-, Backend-, Mobile-, APK- oder Datenänderung; Audit-Dokumentation ergänzt.

## 10. Offene Punkte vor Pitch

- API-Subdomain als alleinigen Health-/Ready-/Monitoringpfad verwenden und die `/api/*`-HTML-Eigenschaft der Webdomain im Runbook klar halten.
- Static-Site/CDN-Security-Header prüfen und konfigurieren.
- Kurzer echter Browser-Smoke auf Desktop und Mobile inklusive Tester-Popup, Fokus, Scrollen und Startseiten-Link.
- Lighthouse oder vergleichbare Performance-/Accessibility-Messung ausführen, sobald die Umgebung verfügbar ist.
- Live-/lokalen Content- und Release-Stand separat verifizieren; keine nicht belegten Partner-, Markt- oder Push-Claims verwenden.

## 11. Offene Punkte vor Testuser-Rollout

- Fokusmanagement und Escape-Verhalten der Modals verbessern.
- Minimum-Monitoring für Registrierung, Tester-Anfrage, Permissions, Heartbeat, Token, Match und Notification etablieren.
- Google-/Firebase-/Expo-/Release-Signing- und Key-Restriktionen prüfen, ohne Werte zu dokumentieren.
- Rollback-/Release-Hash und Feedbackkanal festlegen.

## 12. Nicht jetzt bauen

- Keine neue Auth- oder Security-Architektur.
- Keine DB-Schemaänderung, Provider-/Offer-/User-/Token-Mutation oder Demo-Datenimporte.
- Keine Mobile-/APK-Änderung.
- Kein umfassendes Redesign und keine umfangreichen Dependency-Upgrades.
- Keine manuelle API-Proxy-/DigitalOcean-Neukonfiguration im Repository ohne Betreiber-/Plattformkontext.
