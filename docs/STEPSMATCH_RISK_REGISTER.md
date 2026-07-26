# StepsMatch – Risk Register

Stand: 2026-07-26

| Risiko | Schweregrad | Wahrscheinlichkeit | Gegenmaßnahme | Status |
| --- | --- | --- | --- | --- |
| `stepsmatch.com/api/*` liefert SPA statt Backend-JSON | hoch | hoch | Routing/API-Domain vor Pitch eindeutig konfigurieren und read-only verifizieren | offen |
| Live-Stand und lokaler 25er Seed sind nicht nachweislich synchron | hoch | mittel | freigegebene Atlas-IP für read-only Count, Release-Hash und Seed-Tag vergleichen | offen |
| Background Location/Heartbeat fällt bei OEM/Doze aus | hoch | mittel | mehrere Geräte, Akku-Ausnahmen dokumentieren, Diagnostics und Fallback-UX | gelb |
| FCM/EAS-Credentials oder Push-Receipts brechen | hoch | mittel | kontrollierter Push-Smoke, Receipt-Logging, Credentials außerhalb Repo prüfen | gelb |
| Google Maps/Directions-Key falsch restriktiert oder historisch exponiert | hoch | mittel | rotieren, Android-App/API-Restriktionen, keine Werte in Doku/Repo | offen |
| Fehlende Funnel-/Open-/Feedback-Events verhindern belastbare Pitch-KPIs | mittel | hoch | Minimum-Eventmodell und Aggregation vor 5–10 Testusern | offen |
| Demo-Location wird als Partnerclaim verstanden | hoch | niedrig/mittel | Demo-Label, neutraler Text, Risiko-Hinweis, keine Preise/Öffnungszeiten/Logos | aktiv mitigiert |
| Medizinische/Apotheken- oder Verfügbarkeitsclaims | hoch | niedrig | sachliche Hinweise, leise Push-Policy, Review vor Aktivierung | aktiv mitigiert |
| Legacy- und Policy-Felder driften auseinander | mittel | mittel | Alias-Vertrag dokumentieren, später Schema bereinigen/migrieren | gelb |
| Debug-/Diagnoseflächen gelangen in öffentlichen Release | mittel | mittel | Release-Checklist und visueller APK-Smoke | offen |
| Keine echte Release-Signatur/Package-Härtung | hoch | mittel | eigenes Release-Keystore-/Play-Setup vor Beta | offen |
| Rohstandort-/Token-Logs überschreiten Zweck/Retention | hoch | niedrig/mittel | Pseudonymisierung, TTL, keine Volltokens in Admin/Logs | gelb |
