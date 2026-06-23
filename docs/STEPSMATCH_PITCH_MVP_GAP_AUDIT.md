# StepsMatch Pitch MVP Gap Audit

Stand: 2026-06-23

## 1. Kurzentscheidung

Ampel: `gelb`

StepsMatch ist technisch naeher am pitchbaren MVP als das Datenmodell vermuten laesst. Der Kern aus Interessen, Standort, Radius, Zeitfenster, Background-Heartbeat, Push-Dedupe, Karte, Route und Arrival ist bereits in Code vorhanden oder teilweise vorhanden.

Der schnellste Pitch-MVP ist kein grosser Neubau. Er ist ein kontrollierter Umbau des bestehenden Offer-Stacks in ein sauberes Demo-/Content-Modell mit klarer Sichtbarkeit, Push-Berechtigung, Demo-Labels und importierbaren Graz-Nord/Goesting/Andritz/8111-Gratwein-Strassengel-Inhalten.

Kritischer Pfad:

1. Bestehendes `Offer`-Modell um Pitch-Felder erweitern oder als `MatchableDemoContent` klar kapseln.
2. `Provider`/Location-Ebene fuer DemoLocations und Anbieter-Stammdaten sauber trennen.
3. Matching/Heartbeat auf Sichtbarkeit, Push-Eligibility, Geo-Validity und Cooldown-Felder konsolidieren.
4. Mobile Consent-/Demo-Kennzeichnung und Live-Feed so schaerfen, dass Tester verstehen: echter Test, keine Partnerclaims.
5. Frontend Provider-/Admin-Flow um Demo-Status, Visibility und Push-Risiko ergaenzen.

## 2. Backend Gap Audit

| Pruefpunkt | Status | Relevante Dateien | Risiko | Schnellster Fix |
| --- | --- | --- | --- | --- |
| Interessenbasierte Matches | `teilweise` | `backend/models/Offer.js`, `backend/routes/location.js`, `backend/routes/offers.js`, `backend/utils/geoPush.js`, `backend/controllers/matchController.js` | Moderne Heartbeat-Route nutzt `interestsRequired`/Kategorie-Fallback; alte `matchController`-Logik nutzt `subcategory` und `User.interests`. Zwei Matching-Pfade koennen unterschiedlich reagieren. | Einen kanonischen Match-Helper fuer Offer/Content einfuehren und alte Controller-Logik entweder entfernen, umleiten oder als legacy markieren. |
| Aktueller Standort / Heartbeat | `vorhanden` | `backend/routes/location.js`, `backend/models/PushToken.js`, `backend/jobs/offerPoller.js` | Funktional vorhanden, aber an Expo PushToken als Runtime-Identitaet gekoppelt. Fuer Pitch reicht das, fuer spaetere Accounts braucht es klarere User/Device-Kopplung. | Fuer MVP beibehalten; Audit-Log und Match-Reasons pro Heartbeat ergaenzen. |
| Radius pro Inhalt | `vorhanden` | `backend/models/Offer.js`, `backend/routes/offers.js`, `backend/routes/location.js` | `Offer.radius` existiert und wird fuer Geo-Matches genutzt. Das Pitch-Modell nennt `radiusMeters`; Backend hat nur Virtuals, API-Felder sind gemischt. | Feldnamen fuer API normalisieren: intern `radius`, extern `radiusMeters` akzeptieren und ausgeben. |
| Provider-Radius | `teilweise` | `backend/routes/providers.js`, `backend/models/Provider.js`, `frontend/src/components/AddProviderForm.jsx`, `frontend/src/components/EditProviderForm.jsx` | Frontend und Route senden/akzeptieren `radiusMeters`, aber `Provider`-Schema definiert das Feld nicht. Wegen Mongoose strict mode wird es sehr wahrscheinlich nicht persistiert. | `Provider.radiusMeters` mit Validierung und Default ins Schema aufnehmen oder Provider-Radius bewusst aus MVP entfernen. |
| Gueltigkeitsdaten | `vorhanden` | `backend/models/Offer.js`, `backend/routes/offers.js`, `backend/utils/isOfferActiveNow.js`, `backend/utils/activeDatesPrefilter.js` | `validDates.from/to` existiert und wurde fuer date-only-Enddaten bereits gehaertet. Pitch-Felder `validFrom`/`validTo` sind nur semantisch anders benannt. | Mapper im Import/API: `validFrom` -> `validDates.from`, `validTo` -> `validDates.to`. |
| Aktive Tage | `vorhanden` | `backend/models/Offer.js`, `backend/utils/isOfferActiveNow.js`, `frontend/src/components/AddOfferForm.jsx` | Feld `validDays` existiert; mobile/frontend nutzen englische Tageswerte. Pitch-Modell nennt `activeDays`. | Import-Mapping `activeDays` -> `validDays`; erlaubte Werte dokumentieren/testen. |
| Aktive Zeitfenster | `teilweise` | `backend/models/Offer.js`, `backend/routes/offers.js`, `backend/utils/isOfferActiveNow.js` | Backend unterstuetzt ein Zeitfenster `{from,to}` und akzeptiert `start/end`. Pitch-Modell erlaubt `activeTimeWindows`, potenziell mehrere Fenster. | MVP: genau ein Zeitfenster erlauben. Spaeter Array-Unterstuetzung als V2. |
| Geo-Validity | `teilweise` | `backend/models/Offer.js`, `backend/routes/location.js`, `backend/routes/offers.js` | Aktuell nur Point+Radius. Pitch-Modell nennt `point_radius`, `area_candidate`, `route_candidate`. Area/Route koennen nicht interpretiert werden. | MVP nur `point_radius` aktivieren; andere Werte speichern, aber nicht matchen/pushen. |
| Sichtbarkeit / publicVisibility | `fehlt` | `backend/models/Offer.js`, `backend/routes/offers.js`, `backend/routes/location.js` | Es gibt keinen Content-Status fuer `active_public_demo`, `in_app_only_demo`, `needs_review_before_import`, `do_not_import_v1`. Risiko: ungepruefte reale Orte koennten oeffentlich oder per Push erscheinen. | Felder `contentType`, `publicVisibility`, `demoLabel`, `riskFlag` ins Offer-/Content-Modell; Match/Feed filtert review/do_not_import hart aus. |
| Push Eligibility | `teilweise` | `backend/routes/location.js`, `backend/utils/geoPush.js`, `backend/utils/notificationChannels.js` | Push-Logik ist implizit. Es fehlt ein Datenfeld `pushEligibility`, das `in_app_only`, `push_allowed`, `silent` erzwungen filtert. | `pushEligibility` einfuehren und in Heartbeat/geoPush vor Push pruefen. |
| Cooldown / Dedupe | `vorhanden` | `backend/models/OfferVisibility.js`, `backend/routes/location.js`, `backend/routes/notifications.js`, `backend/utils/geoPush.js` | Starke Grundlage: `seen`, `notified`, `dismissed`, `snoozed`, `suppressUntil`, `lastEnterAt`, `lastExitAt`. Pitch-spezifische `cooldownSuggestionHours` fehlt. | `cooldownSuggestionHours` pro Content als Override auf bestehende Suppression-Millis mappen. |
| Notification Actions | `vorhanden` | `backend/routes/notifications.js`, `mobile/app/_layout.js` | `go`, `later`, `no` existieren, aber noch nicht als Observability-KPI nach Pitch-Modell ausgewertet. | Events loggen: action, offerId/contentKey, pushPriority, distance bucket. |
| Match-Reasons | `teilweise` | `backend/routes/location.js`, `backend/utils/geoPush.js`, `backend/models/ClientDiagLog.js` | Logs enthalten Diagnosephasen, aber kein einheitliches persistiertes Match-/Nicht-Match-Reason-Objekt. | Lightweight `MatchDecisionLog` oder `ClientDiagLog`-Event fuer Pitch-Feldtest einfuehren. |
| Observability/KPIs | `teilweise` | `backend/routes/diag.js`, `backend/models/ClientDiagLog.js`, `backend/models/OfferVisibility.js` | Rohdaten fuer Heartbeat/Push existieren, aber KPIs aus `docs/STEPSMATCH_OBSERVABILITY.md` sind nicht als Admin-Auswertung modelliert. | MVP-KPI-Endpunkt fuer Matches, Opens, Map, Directions, Arrival, too_loud/too_quiet. |
| DemoLocation / MatchableDemoContent | `fehlt` | `backend/models/Provider.js`, `backend/models/Offer.js` | Bestehende Provider/Offer-Struktur vermischt Anbieter, echte Orte, Demo-Hinweise und Angebote. Pitch-Modell braucht bewusst getrennte Ebenen. | Schnell: `Offer` um DemoContent-Felder erweitern und `Provider` fuer reale Anbieter behalten. Sauberer: neue `DemoLocation` + `MatchableDemoContent` Modelle. |

## 3. Mobile Gap Audit

| Pruefpunkt | Status | Relevante Dateien | Risiko | Schnellster Fix |
| --- | --- | --- | --- | --- |
| Interessen-Auswahl | `vorhanden` | `mobile/app/(onboarding)/InterestsScreen.js`, `mobile/utils/authSession.js`, `mobile/utils/interests.ts` | Interessen werden lokal gespeichert und an Heartbeats/Feed uebergeben. Serverseitig landen sie aktuell vor allem am PushToken, nicht zwingend am User. | Fuer MVP akzeptieren; spaeter User/Device-Sync haerten. |
| Consent-first Onboarding | `teilweise` | `mobile/app/index.js`, `mobile/app/(onboarding)/WelcomeScreen.js`, `mobile/app/(onboarding)/LocationScreen.js`, `mobile/components/PermissionGate.tsx` | `app/index.js` fragt Foreground Location und Push sehr frueh ab; das dokumentierte Consent-first Modell ist nicht vollstaendig umgesetzt. | Einstieg umsortieren: erst Welcome/Erklaerung/Interessen, dann Standort/Push/BG mit klaren Screens. |
| Background Heartbeat | `vorhanden` | `mobile/components/PushInitializer.tsx`, `mobile/components/push/push-location.ts`, `mobile/android/app/src/main/java/com/ecily/mobile/heartbeat/HeartbeatService.kt` | Sehr robuste, aber komplexe Doppelstruktur aus JS und nativer Android-Heartbeat-Logik. Risiko fuer schwer erklaerbare Bugs. | Fuer Pitch nicht umbauen; nur Diagnose-/Status-UI vereinfachen und harte API-URLs konsolidieren. |
| Push Token / Device ID | `vorhanden` | `mobile/components/PushInitializer.tsx`, `mobile/components/push/push-state.ts`, `mobile/components/push/expo-token.ts` | Device-ID und Expo-Token existieren. Risiken bleiben Expo/FCM/OEM und Tokenwechsel. | Bestehenden Self-Heal beibehalten; Pitch-Testcheckliste fuer Token/Channel/Permission. |
| Lokale Geofences | `vorhanden` | `mobile/components/PushInitializer.tsx`, `mobile/components/push/push-geofence.ts`, `mobile/background/geofencingTask.ts` | Lokale Geofence-Notifications koennen Server-Push ergaenzen, aber erzeugen komplexe Dedupe-Pfade. | Nur einen offiziellen MVP-Pfad beschreiben: Server-Heartbeat entscheidet, lokale Geofence-Notifications sind Fallback. |
| Feed / Trefferliste | `vorhanden` | `mobile/app/(tabs)/index.js`, `mobile/app/(tabs)/OffersScreen.js` | Feed zeigt Offers, aber noch keine Demo-Kennzeichnung, keine `publicVisibility`, keine `matchReason`. | Cards um Demo-Label, redaktionellen Hinweis und Match-Grund erweitern. |
| Karte | `vorhanden` | `mobile/app/(tabs)/NavigationMap.jsx` | Karte zeigt aktive Offers im sichtbaren Radius. Sie kennt keine area/route candidates und kein Demo-Visibility-Modell. | Nur point_radius Inhalte anzeigen; review/silent ausblenden. |
| Route | `vorhanden` | `mobile/app/(tabs)/NavigationScreen.js`, `mobile/services/directions.ts` | Google Directions funktioniert, braucht saubere Env/Key-Konfiguration. | Keine Logik-Aenderung; Pitch-Testcheck: Directions-Key, ZERO_RESULTS-Fallback, Route sichtbar. |
| Arrival | `vorhanden` | `mobile/app/(tabs)/NavigationScreen.js` | Arrival ist lokal und nicht als Backend-KPI persistiert. | Arrival-Event ans Backend senden, ohne DB-heavy Umbau. |
| Push-Wahrnehmbarkeit | `teilweise` | `mobile/components/push/push-notifications.ts`, `mobile/components/push/push-constants.ts`, `mobile/app/(tabs)/ProfileScreen.js` | Starker Nearby-Channel existiert, Wahrnehmbarkeit war zuletzt noch nicht voll manuell bestaetigt. | APK-Test mit manuellem Tap, Screen-off, Sound/Vibration und Logcat-Marker abschliessen. |
| Diagnose-Screens | `teilweise` | `mobile/app/(tabs)/diagnostics.jsx`, `mobile/app/(tabs)/ProfileScreen.js` | Fuer Pitch-Tester zu technisch und teils Routen-/Deep-Link-Risiko. | Diagnostics fuer interne Builds belassen, in Pitch-Demo verstecken oder klar als intern markieren. |
| Harte API-URLs | `teilweise` | `mobile/app/(tabs)/index.js`, `mobile/app/(onboarding)/InterestsScreen.js`, `mobile/components/push/push-location.ts`, `mobile/app/(tabs)/NavigationScreen.js` | Mehrere Dateien nutzen direkte Produktions-API-URLs statt zentraler Runtime-Config. | Auf `mobile/lib/runtimeConfig.js` bzw. Expo extra konsolidieren. |

## 4. Frontend Gap Audit

| Pruefpunkt | Status | Relevante Dateien | Risiko | Schnellster Fix |
| --- | --- | --- | --- | --- |
| Pitch-/Landing-Erklaerung | `vorhanden` | `frontend/src/pages/LandingPage.jsx`, `frontend/src/pages/Pitch.jsx` | Website erklaert Naehe+Interesse+Zeit bereits, aber noch nicht konkret genug mit Graz-Nord Demo-Markt und 50 kuratierten Inhalten. | Pitch-Seite um Demo-Markt-Abschnitt, MVP-Status und Testfunnel ergaenzen. |
| Anbieter-Flow | `vorhanden` | `frontend/src/App.jsx`, `frontend/src/pages/Register.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/components/ProviderDashboard.jsx` | Anbieter koennen registrieren, einloggen, Dashboard nutzen. Kein Freigabe-/Consent-Status. | Provider-Dashboard um "Testanbieter / noch nicht oeffentlich" Status erweitern. |
| Angebot anlegen | `vorhanden` | `frontend/src/components/AddOfferForm.jsx`, `frontend/src/components/EditOfferForm.jsx` | Radius, Datum, Zeit, Tage, Kategorie, Beschreibung und Bilder sind vorhanden. Kein Demo-/Risk-/Visibility-Status. | Felder `publicVisibility`, `pushEligibility`, `demoLabel`, `riskFlag` als Admin-/Provider-intern. |
| Radius-Steuerung | `teilweise` | `frontend/src/components/AddOfferForm.jsx`, `frontend/src/components/EditOfferForm.jsx`, `frontend/src/components/AddProviderForm.jsx`, `frontend/src/components/EditProviderForm.jsx`, `backend/models/Provider.js` | Offer-Radius funktioniert. Provider-Radius wirkt im UI vorhanden, aber Backend-Schema persistiert ihn nicht. | Provider-Radius fixen oder aus UI entfernen; Offer-Radius bleibt MVP-relevant. |
| Laufzeit-/Zeitfenster-Steuerung | `vorhanden` | `frontend/src/components/AddOfferForm.jsx`, `frontend/src/components/EditOfferForm.jsx`, `frontend/src/components/ProviderDashboard.jsx` | Ein Zeitfenster und Tagesauswahl vorhanden. Mehrere Zeitfenster fehlen. | Fuer MVP kein Mehrfach-Zeitfenster; UI-Hinweis "ein aktives Zeitfenster". |
| Admin-Karte | `teilweise` | `frontend/src/pages/AdminOffersMap.jsx` | Map zeigt Offers, Radius, Status und Laufzeiten. Keine Demo-/Visibility-/Push-Risiko-Filter. | Filter fuer `publicVisibility`, `contentType`, `pushEligibility`, `riskFlag`. |
| Kategorie-Admin | `vorhanden` | `frontend/src/pages/AdminCategoryPage.jsx` | Kategorien/Subkategorien verwaltbar. Taxonomie ist fachlich dokumentiert, aber nicht zwingend validiert. | Seed/Sync-Check gegen `STEPSMATCH_URBAN_TAXONOMY.md`. |
| Demo-Import/Review | `fehlt` | keine direkte Umsetzung gefunden | Die 50 kuratierten Inhalte koennen noch nicht reviewbar/importierbar gemacht werden. | Admin-only JSON Import Preview fuer `DemoLocation`/`MatchableDemoContent`, ohne sofortige Aktivierung. |
| Push-Policy-Steuerung | `fehlt` | `frontend/src/components/AddOfferForm.jsx`, `frontend/src/pages/AdminOffersMap.jsx` | Anbieter/Admin koennen nicht explizit festlegen: In-App-only, push erlaubt, silent. | MVP-Feld `pushEligibility` im Admin/Provider-Formular mit konservativem Default. |
| Observability-UI | `teilweise` | `frontend/src/pages/AdminOffersMap.jsx`, `docs/STEPSMATCH_OBSERVABILITY.md` | KPI-Idee dokumentiert, Admin UI zeigt nur einfache Offer-Kennzahlen. | Kleines Pitch-KPI-Panel: Heartbeats, Matches, Pushes, Opens, Directions, Arrivals. |

## 5. Datenmodell-Gap vs Curated Match Model V1

### DemoLocation Mapping

| Pitch-Feld | Bestehendes Feld / Status | MVP-Entscheidung |
| --- | --- | --- |
| `locationKey` | `fehlt` | MVP: neu als stabiler Slug/Key. |
| `name` | `Provider.name` oder `Offer.name` | MVP: fuer Orte/Anbieter auf Location-Ebene fuehren. |
| `gebiet` | `fehlt` | MVP: neues Feld, wichtig fuer Graz-Nord/Goesting/Andritz/8111. |
| `addressOrLocation` | `Provider.address`, Offer hat nur Geo | MVP: neues Textfeld oder Provider.address mappen. |
| `coordinatesStatus` | `fehlt` | MVP: neu, Import-Review-Guard. |
| `category` / `subcategory` | vorhanden auf Provider/Offer | MVP: beibehalten, gegen Urban Taxonomy pruefen. |
| `contentType` | `fehlt` | MVP: neu, kritisch gegen falsche Partnerclaims. |
| `sourceUrl` / `sourceType` / `sourceVerifiedAt` | `fehlt` | MVP: neu fuer Demo-Import und Audit. |
| `demoLabel` | `fehlt` | MVP: neu, Mobile/Frontend sichtbar. |
| `baseRadiusMeters` | Provider-Radius UI teilweise, Schema fehlt | MVP: entweder als Location-Feld neu oder Offer-Radius verwenden. |
| `publicVisibility` | `fehlt` | MVP: neu, harter Feed-/Push-Filter. |
| `riskNote` | `fehlt` | MVP: neu, Admin sichtbar. |

### MatchableDemoContent Mapping

| Pitch-Feld | Bestehendes Feld / Status | MVP-Entscheidung |
| --- | --- | --- |
| `contentKey` | `fehlt` | MVP: neu als stabiler Content-Key. |
| `locationKey` | `Offer.provider` referenziert Provider | MVP: bei neuem Modell referenziert DemoLocation; bei schnellem Modell Provider/Location-Ref mappen. |
| `title` | `Offer.name` | MVP: mappen. |
| `demoCardText` | `Offer.description` | MVP: mappen, Laenge/Claims restriktiv halten. |
| `contentKind` | `fehlt` | MVP: neu, Default `neutral_hint`. |
| `interestKeys` | `Offer.interestsRequired` teilweise | MVP: `interestsRequired` als technische Quelle nutzen, Name spaeter angleichen. |
| `validFrom` / `validTo` | `validDates.from/to` | MVP: mappen. |
| `activeDays` | `validDays` | MVP: mappen. |
| `activeTimeWindows` | `validTimes` ein Fenster | MVP: nur erstes Fenster. |
| `geoValidity` | implizit Point+Radius | MVP: `point_radius` aktiv; andere Werte nicht matchen. |
| `radiusMeters` | `Offer.radius` | MVP: mappen. |
| `providerCanEditRadius` | `fehlt` | MVP: neu, aber erstmal Admin-gesteuert moeglich. |
| `providerCanEditValidity` | `fehlt` | MVP: neu, aber erstmal Admin-gesteuert moeglich. |
| `suggestedPushPriority` | implizit Channel/Policy | MVP: neu, Default aus Taxonomie. |
| `pushEligibility` | `fehlt` | MVP: neu, entscheidender Filter. |
| `cooldownSuggestionHours` | global/env + OfferVisibility | MVP: neu optional, fallback global. |
| `matchReason` | `fehlt` | MVP: berechnen/anzeigen, nicht zwingend persistieren. |
| `whyGoodForPitch` | `fehlt` | MVP: Admin-/Doku-Feld, nicht Mobile. |
| `riskNote` | `fehlt` | MVP: Admin-Feld. |

## 6. Kritischer Pfad in Implementation Packages

### Paket 1: Pitch-Felder im Backend-Datenmodell

- Ziel: Bestehende Offers sicher als MatchableDemoContent nutzbar machen.
- Dateien/Bereiche: `backend/models/Offer.js`, optional neues `backend/models/DemoLocation.js`, `backend/routes/offers.js`.
- Risiko: Migration kann Live-Offers beeinflussen.
- Test/Check: `node --check`, Model-Validation-Tests, API-Smoke fuer bestehende Offers.
- DB-Migration noetig? Ja, mindestens additive Felder/Defaults.
- Deploy noetig? Ja.
- APK-Build noetig? Nein.

### Paket 2: Match-/Push-Policy Filter

- Ziel: Heartbeat/geoPush prueft `publicVisibility`, `pushEligibility`, `geoValidity`, aktive Zeit und Cooldown in einer zentralen Funktion.
- Dateien/Bereiche: `backend/routes/location.js`, `backend/utils/geoPush.js`, `backend/utils/isOfferActiveNow.js`, neuer `backend/utils/matchDecision.js`.
- Risiko: Push kann zu leise werden, wenn Filter zu streng ist.
- Test/Check: Unit-Tests fuer match/no-match Gruende; Live-DB nicht mutieren.
- DB-Migration noetig? Nein, wenn Paket 1 vorher deployed ist.
- Deploy noetig? Ja.
- APK-Build noetig? Nein.

### Paket 3: Demo-Import Preview

- Ziel: 50 kuratierte Inhalte aus `STEPSMATCH_PITCH_DEMO_CURATED_MATCH_MODEL_V1.md` in reviewbares JSON/Seed-Format bringen, ohne Auto-Publish.
- Dateien/Bereiche: `docs/`, optional `backend/scripts/seed-*` nur als dry-run/import-preview.
- Risiko: Echte Anbieter duerfen nicht als Partner/Angebot erscheinen.
- Test/Check: Dry-run zaehlt Sichtbarkeiten, Risiken, Push-Eligibility, Kategorien.
- DB-Migration noetig? Nein fuer Preview; Ja bei echtem Import.
- Deploy noetig? Nein fuer Preview.
- APK-Build noetig? Nein.

### Paket 4: Mobile Demo-/Match-UX

- Ziel: Mobile Cards zeigen Demo-Label, redaktionellen Hinweis, Match-Grund, keine falschen Partnerclaims.
- Dateien/Bereiche: `mobile/app/(tabs)/index.js`, `mobile/app/(tabs)/offers/[id].tsx`, `mobile/app/(tabs)/NavigationMap.jsx`.
- Risiko: Zu viel Text in Cards; UI darf nicht ueberladen wirken.
- Test/Check: Expo/Android smoke, Feed mit Demo-Feldern, Screenshot-Pruefung.
- DB-Migration noetig? Nein.
- Deploy noetig? Nein.
- APK-Build noetig? Ja fuer Geraetetest.

### Paket 5: Consent-first Mobile Gate

- Ziel: Onboarding folgt dokumentierter Reihenfolge: Erklaerung, Interessen, Standort, Push, Background, Status.
- Dateien/Bereiche: `mobile/app/index.js`, `mobile/app/(onboarding)/*`, `mobile/components/PermissionGate.tsx`, `docs/STEPSMATCH_CONSENT_ONBOARDING.md`.
- Risiko: Permission-Flow kann funktionierenden Heartbeat verschlechtern.
- Test/Check: Neuinstallation, Permission-Gate, Background-Heartbeat, PushToken-Registrierung.
- DB-Migration noetig? Nein.
- Deploy noetig? Nein.
- APK-Build noetig? Ja.

### Paket 6: Frontend Provider/Admin Policy UI

- Ziel: Anbieter/Admin sehen Radius, Laufzeit, Sichtbarkeit, Push-Eligibility, Demo-/Risk-Status.
- Dateien/Bereiche: `frontend/src/components/AddOfferForm.jsx`, `frontend/src/components/EditOfferForm.jsx`, `frontend/src/components/ProviderDashboard.jsx`, `frontend/src/pages/AdminOffersMap.jsx`.
- Risiko: Anbieter koennen sonst versehentlich reale Kandidaten wie Partnerangebote aussehen lassen.
- Test/Check: `npm run lint`, `npm run build`, Formular-Smoke ohne Submit oder mit lokaler Test-DB.
- DB-Migration noetig? Nur falls neue Felder fehlen.
- Deploy noetig? Ja.
- APK-Build noetig? Nein.

### Paket 7: Pitch KPI Surface

- Ziel: Minimaler Admin-/Pitch-Readout fuer Heartbeats, Matches, Pushes, Opens, Directions und Arrivals.
- Dateien/Bereiche: `backend/routes/diag.js`, `backend/models/ClientDiagLog.js`, `frontend/src/pages/AdminOffersMap.jsx` oder neue Admin-Seite.
- Risiko: Ohne saubere Pseudonymisierung koennen Logs zu detailreich wirken.
- Test/Check: statische API-Smokes, keine Secret-/Token-Ausgabe.
- DB-Migration noetig? Optional, wenn neue Event-Collection.
- Deploy noetig? Ja.
- APK-Build noetig? Nur wenn Mobile neue Events sendet.

## 7. Nicht jetzt bauen

- Kein vollstaendiges Marketplace-/Partner-Portal.
- Keine echten Rabatte, Preise, Lagerbestaende oder Speisekarten.
- Keine automatische Live-DB-Befuellung aus der 110er Seed-Liste.
- Keine Area-/Route-Geometrie fuer `area_candidate`/`route_candidate`; fuer MVP reicht Point+Radius.
- Keine mehrstufige Provider-Freigabe mit Signaturen/Vertraegen.
- Keine Recommendation-KI.
- Keine Ultreia-/Camino-Funktionen, Kategorien oder Sprache.
- Keine laute Push-Policy fuer alle Inhalte.
- Keine Key-/Deploy-/DB-Arbeiten in diesem Audit-Task.

## 8. Empfohlene naechste Codex-Tasks

1. Safest first code task: Additive Backend-Felder fuer `Offer` einfuehren (`contentType`, `publicVisibility`, `demoLabel`, `pushEligibility`, `geoValidity`, `sourceUrl`, `sourceType`, `sourceVerifiedAt`, `riskFlag`, `cooldownSuggestionHours`) plus zentrale Filterfunktion, aber noch kein Import und keine DB-Mutation.
2. Wichtigste Mobile UX task: Demo-/redaktionelle Kennzeichnung und Match-Grund in Feed und Detailansicht anzeigen; keine Heartbeat-/Push-Mechanik anfassen.
3. Wichtigste Frontend/Pitch task: `/pitch` und Admin-Map um Demo-Markt-Status, kuratierte 50er Modelllogik und "was ist schon technisch gruen" erweitern.

## 9. Kontext-Update

Dieses Audit dokumentiert: Pitch-MVP ist `gelb`. Gruen sind technischer Heartbeat, Radius-/Zeitfenster-Matching, Push-Dedupe, Mobile Feed/Karte/Route/Arrival und Anbieter-Offer-Formulare. Rot/Gelb sind DemoLocation/MatchableDemoContent, Sichtbarkeit, Push-Eligibility, Demo-Labels, Provider-Radius-Persistenz, Match-Reasons und KPI-Oberflaeche. Naechster sicherer Schritt ist ein additiver Backend-Policy-/Datenmodell-Schnitt ohne Import, ohne DB-Mutation und ohne Mobile-Heartbeat-Risiko.
