# StepsMatch – Risk Register

Stand: 2026-07-28

| Risiko | Schweregrad | Wahrscheinlichkeit | Gegenmaßnahme | Status |
| --- | --- | --- | --- | --- |
| `stepsmatch.com/api/*` liefert SPA statt Backend-JSON | hoch | hoch | Routing/API-Domain vor Pitch eindeutig konfigurieren und read-only verifizieren | offen |
| Live-Stand und lokaler 25er Seed sind nicht nachweislich synchron | hoch | mittel | freigegebene Atlas-IP für read-only Count, Release-Hash und Seed-Tag vergleichen | offen |
| Background-/Closed-App-/Screen-off-Push funktioniert nicht | mittel | niedrig auf Testgerät, offen bei Multi-OEM | am getesteten Android-Gerät validiert; Multi-OEM-/Multi-Device-Tests bleiben offen | validiert am Testgerät |
| OEM-/MIUI-Energiesparen unterbricht Background Location/Heartbeat | hoch | mittel | mehrere Geräte, Akku-Ausnahmen dokumentieren, Diagnostics und Fallback-UX | gelb |
| FCM/EAS-Credentials oder Push-Receipts brechen | hoch | mittel | kontrollierter Push-Smoke, Receipt-Logging, Credentials außerhalb Repo prüfen | gelb |
| Transiente FCM-/Expo-Fehler unterbrechen einzelne Zustellungen | hoch | mittel | Retry-/Receipt-Monitoring und klarer Fehlerstatus | gelb |
| Token-Dubletten oder alte anonyme Tokens verfälschen Push-Zustellung | mittel | mittel | Token-Cleanup, User-Verknüpfung und Gültigkeitsstatus monitoren | offen |
| Google Maps Tile-/Directions-Runtime fällt aus | mittel | mittel | Key-Restriktionen, Runtime-Smoke und Feldtest auf Zielgeräten | gelb |
| Google Maps/Directions-Key falsch restriktiert oder historisch exponiert | hoch | mittel | rotieren, Android-App/API-Restriktionen, keine Werte in Doku/Repo | offen |
| Fehlende Funnel-/Open-/Feedback-Events verhindern belastbare Pitch-KPIs | mittel | hoch | Minimum-Eventmodell und Aggregation vor 5–10 Testusern | offen |
| Demo-Location wird als Partnerclaim verstanden | hoch | niedrig/mittel | Demo-Label, neutraler Text, Risiko-Hinweis, keine Preise/Öffnungszeiten/Logos | aktiv mitigiert |
| Medizinische/Apotheken- oder Verfügbarkeitsclaims | hoch | niedrig | sachliche Hinweise, leise Push-Policy, Review vor Aktivierung | aktiv mitigiert |
| Legacy- und Policy-Felder driften auseinander | mittel | mittel | Alias-Vertrag dokumentieren, später Schema bereinigen/migrieren | gelb |
| Debug-/Diagnoseflächen gelangen in öffentlichen Release | mittel | mittel | Release-Checklist und visueller APK-Smoke | offen |
| Keine echte Release-Signatur/Package-Härtung | hoch | mittel | eigenes Release-Keystore-/Play-Setup vor Beta | offen |
| Rohstandort-/Token-Logs überschreiten Zweck/Retention | hoch | niedrig/mittel | Pseudonymisierung, TTL, keine Volltokens in Admin/Logs | gelb |
| Erstbesuchsmodal bei kleinen Viewporthöhen | mittel | mittel | Strukturell getrennte Header-/Scroll-Flexstruktur ist umgesetzt; manueller Browser-Smoke bleibt offen | gelb |
| Großes Hero-PNG (~2,7 MB) belastet Erstlast | mittel | mittel | vorhandene verlustarme Optimierung prüfen, ohne neue Abhängigkeit einzuführen | offen |
| Browser-/OEM-Matrix und kleine Viewports nicht vollständig manuell geprüft | mittel | mittel | Desktop-/Mobile-Smoke und OEM-Matrix vor breiterem Rollout durchführen | offen |
| Lighthouse-/Performance-/Accessibility-Baseline fehlt | mittel | hoch | Lighthouse oder vergleichbare Messung in verfügbarer Browserumgebung ausführen | offen |
| Dependabot-/Security-Befunde im Repository | mittel | mittel | Befunde separat triagieren und Dependency-Upgrade nur kontrolliert durchführen | offen |
| Lifetime-Pass-Leistungen und Bedingungen noch nicht formal finalisiert | hoch | mittel | Leistungen und Bedingungen vor Vergabe transparent bestätigen und rechtlich prüfen | offen |

## Korrektur des Core-Risikos

Background-/Closed-App-/Screen-off-Push ist am getesteten Android-Gerät validiert. Das Risiko ist daher nicht „der Kern funktioniert nicht“, sondern die Übertragbarkeit: Multi-OEM-/Multi-Device-Tests, OEM-/MIUI-Energiesparen, transiente FCM-/Expo-Fehler, Token-Dubletten/alte anonyme Tokens, Google-Maps-Tile-Runtime und Live/API-Drift bleiben offen.
