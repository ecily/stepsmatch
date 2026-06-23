# StepsMatch Observability Model

Stand: 2026-06-23

## 1. Zweck

StepsMatch braucht Observability, damit echte Feldtests erklärbar, auswertbar und pitchfähig werden.

Es muss später nachvollziehbar sein:

- wer registriert ist
- wer E-Mail verifiziert hat
- welche Permissions erlaubt oder abgelehnt wurden
- welche Interessen gewählt wurden
- welche Angebote/Hinweise Kandidaten waren
- warum ein Match entstanden ist oder nicht
- ob eine Notification geplant/gepostet/gesendet/geöffnet wurde
- ob ein Angebot/Hinweis geöffnet wurde
- ob Karte/Route genutzt wurde
- ob Arrival am Ort erkannt wurde
- ob Feedback gegeben wurde
- welche Kategorien/Subkategorien funktionieren
- welche Push-Priorität funktioniert oder nervt

## 2. Produktkontext

StepsMatch ist urban/lokal.

Kern:

Nutzer bewegen sich in Graz/Graz-Umgebung, wählen Interessen und erhalten passende Hinweise oder Angebote in geografischer Nähe, wenn Standort, Zeit und Interesse zusammenpassen.

Observability muss deshalb erfassen:

- Consent/Permissions
- Interessen
- urbane Kategorie/Subkategorie
- Content-Typ
- Push-Priorität
- Match-Grund
- Interaktion
- Arrival
- Feedback

## 3. Datenschutz-Grundsätze

- Consent-first gemäß `docs/STEPSMATCH_CONSENT_ONBOARDING.md`
- Standortverarbeitung ist Kernfunktion, aber transparent
- keine versteckte Standortverarbeitung
- keine unnötige dauerhafte Roh-Bewegungshistorie
- keine Standortdaten in E-Mails
- keine vollständigen PushTokens oder vollständigen Device-Daten in Admin-Ansichten
- sensible Werte pseudonymisieren oder kürzen, wo möglich
- Retention/TTL für Roh-/Diagnosedaten
- Aggregationen für Pitch-KPIs bevorzugen
- keine Pitch-Zahlen ohne belastbare Events

Zweckbindung:

- Feldtest
- Produktverbesserung
- Fehleranalyse
- Matching-Qualität
- Notification-Qualität

## 4. Event-Klassen

Folgende Event-Klassen sind fachlich relevant, ohne damit ein finales MongoDB-Schema zu entscheiden:

- `UserEvent`
- `PermissionEvent`
- `InterestEvent`
- `MatchEvent`
- `NotificationEvent`
- `OfferInteractionEvent`
- `ArrivalEvent`
- `FeedbackEvent`
- `SystemHealthEvent`
- `AdminMetricSnapshot`

## 5. User-/Onboarding-Events

Events:

- `user_registered`
- `email_verified`
- `onboarding_started`
- `onboarding_step_seen`
- `onboarding_completed`
- `interests_selected`
- `interests_updated`
- `app_opened`
- `app_backgrounded`
- `app_foregrounded`

Felder fachlich:

- `userId` intern/pseudonymisiert
- `deviceId` intern/pseudonymisiert
- `timestamp`
- `appVersion`
- `platform`
- `onboardingStep`
- `result`
- `source`

Keine vollständigen E-Mails in Analytics-Events speichern.

## 6. Permission-Events

Events:

- `permission_explained`
- `permission_requested`
- `permission_granted`
- `permission_denied`
- `permission_later`
- `permission_revoked_detected`
- `permission_settings_opened`

Permission-Typen:

- `foreground_location`
- `background_location`
- `notifications`

Felder fachlich:

- `userId`/`deviceId` intern
- `permissionType`
- `status`
- `onboardingStep`
- `timestamp`
- `androidState`, falls verfügbar
- `reason`/`context`

Ziel:

Später im Admin sehen:

- Wie viele Tester erlauben Standort?
- Wie viele erlauben Push?
- Wie viele erlauben Hintergrundstandort?
- Wo brechen Nutzer im Onboarding ab?

## 7. Interest-Events

Events:

- `interests_selected`
- `interests_updated`
- `interests_cleared`

Felder:

- `userId`/`deviceId` intern
- `selectedInterests`
- `category`
- `subcategory` optional
- `timestamp`
- `source`: `onboarding` | `settings`

Bezug:

Die Kategorien müssen auf `docs/STEPSMATCH_URBAN_TAXONOMY.md` basieren.

Nicht speichern:

- heimliche Interessenprofile
- sensible Ableitungen ohne klare Zustimmung

## 8. MatchEvent

Zweck:

Erklären, warum ein Angebot/Hinweis gematcht, abgelehnt oder unterdrückt wurde.

Events:

- `match_candidate_evaluated`
- `match_created`
- `match_rejected`
- `match_suppressed`

Felder fachlich:

- `userId` intern/pseudonymisiert
- `deviceId` intern/pseudonymisiert
- `offerId`
- `providerId`
- `zone`
- `category`
- `subcategory`
- `contentType`
- `pushPriority`
- `userInterest`
- `distanceMeters`
- `radiusMeters`
- `locationMatch`: true/false
- `interestMatch`: true/false
- `activeNow`: true/false
- `dateMatch`: true/false
- `timeMatch`: true/false
- `decision`: `matched` | `rejected` | `suppressed`
- `reason`
- `suppressionReason`
- `source`: `heartbeat` | `geofence` | `sync` | `poller` | `manual_test`
- `channelId`
- `createdAt`

Wichtige Gründe:

- `rejected_by_distance`
- `rejected_by_interest`
- `rejected_by_time`
- `rejected_by_date`
- `rejected_inactive`
- `suppressed_duplicate`
- `suppressed_rate_limit`
- `suppressed_low_priority`
- `matched`

## 9. NotificationEvent

Zweck:

Lebenslauf einer Notification nachvollziehen.

Events:

- `notification_scheduled`
- `notification_posted_local`
- `notification_sent_remote`
- `notification_receipt_ok`
- `notification_receipt_error`
- `notification_opened`
- `notification_ignored_after_x`
- `notification_suppressed`

Felder:

- `notificationId`
- `userId`/`deviceId` intern
- `offerId` optional
- `category`
- `subcategory`
- `contentType`
- `pushPriority`
- `notificationType`
- `source`
- `channelId`
- `strongChannel`: true/false
- `scheduledAt`
- `postedAt`
- `sentAt`
- `openedAt`
- `receiptStatus`
- `errorCode`
- `appState`: `foreground` | `background` | `screen_off_unknown`
- `language` optional
- `suppressionReason` optional

Wichtig:

- Test-/Diagnostics-Notifications müssen getrennt von echten Offer-/Nearby-Notifications behandelt werden.
- Keine Placeholder-IDs wie `:id` in navigierbaren Payloads.
- Channel-ID speichern, damit Sound/Vibration/Priorität später bewertbar sind.

## 10. OfferInteractionEvent

Zweck:

Verstehen, was Nutzer nach der Notification oder im Feed tun.

Events:

- `offer_opened`
- `offer_closed`
- `map_opened`
- `directions_started`
- `route_opened_external`
- `provider_opened`
- `feedback_clicked`

Felder:

- `userId`/`deviceId` intern
- `offerId`
- `providerId`
- `category`
- `subcategory`
- `contentType`
- `source`: `notification` | `feed` | `map` | `search` | `manual`
- `timestamp`
- `distanceAtOpenMeters` optional
- `notificationId` optional

## 11. ArrivalEvent

Zweck:

Erkennen, ob Nutzer wirklich in die Nähe des Angebots/Hinweises gekommen ist.

Events:

- `arrival_detected`
- `arrival_not_detected`
- `arrival_confidence_low`

Felder:

- `userId`/`deviceId` intern
- `offerId`
- `providerId`
- `detectedAt`
- `distanceMeters`
- `thresholdMeters`
- `source`: `heartbeat` | `geofence` | `manual_test`
- `confidence`
- `priorDirectionsStarted`: true/false
- `category`
- `subcategory`

Wichtig:

- Keine dauerhafte vollständige Standortspur speichern.
- Arrival ist ein punktuelles Ereignis.
- Rohstandortdaten nur minimal/zweckgebunden/mit Retention.

## 12. FeedbackEvent

Events:

- `feedback_sent`
- `feedback_useful`
- `feedback_irrelevant`
- `feedback_too_quiet`
- `feedback_too_loud`
- `feedback_bug`
- `feedback_wrong_location`
- `feedback_fake_or_unclear`
- `feedback_demo_label_unclear`

Felder:

- `userId`/`deviceId` intern optional
- `offerId` optional
- `category`/`subcategory` optional
- `feedbackType`
- `freeText` optional
- `timestamp`
- `contactAllowed`: true/false
- `email` optional nur wenn aktiv angegeben und zweckgebunden

Keine Standortdaten oder PushTokens in Feedback-E-Mails ausgeben.

## 13. SystemHealthEvent

Zweck:

Admin Panel und Betrieb.

Events:

- `backend_started`
- `db_connected`
- `db_connection_failed`
- `push_error`
- `expo_receipt_error`
- `device_not_registered`
- `invalid_credentials`
- `heartbeat_ok`
- `heartbeat_error`

Felder:

- `timestamp`
- `service`
- `status`
- `errorCode`
- `count`
- `sampleContext` ohne Secrets

## 14. AdminMetricSnapshot

Zweck:

Pitchfähige aggregierte Kennzahlen speichern, ohne Rohdaten ewig aufzubewahren.

Mögliche Zeitfenster:

- `hourly`
- `daily`
- `weekly`
- `test_run`

Metriken:

- `registeredUsers`
- `verifiedUsers`
- `activeUsers24h`
- `activeUsers7d`
- `foregroundLocationGrantedRate`
- `backgroundLocationGrantedRate`
- `notificationsGrantedRate`
- `interestsSelectedRate`
- `activeOffers`
- `activeDemoOffers`
- `candidatesEvaluated`
- `matches`
- `notificationsPosted`
- `notificationsOpened`
- `offerOpenRate`
- `mapOpenRate`
- `directionsStartRate`
- `arrivalRate`
- `feedbackRate`
- `tooQuietCount`
- `tooLoudCount`
- `irrelevantCount`
- `bugCount`

## 15. Admin Panel Scope

Das spätere Admin Panel soll folgende Bereiche haben:

### System Health

- Backend online
- DB connected
- last heartbeat
- push errors
- DeviceNotRegistered rate
- InvalidCredentials rate

### Tester Funnel

- registered users
- email verified
- interests selected
- foreground location granted
- notifications granted
- background location granted
- active last 24h / 7d

### Demo Market Coverage

- active demo providers
- active demo offers
- offers active now
- offers with location
- category coverage
- zone coverage

### Matching Funnel

- candidates evaluated
- matches
- suppressed
- rejected by distance
- rejected by interest
- rejected by time/date

### Notification Funnel

- scheduled
- posted local
- sent remote
- opened
- ignored
- open rate
- channel distribution
- strong channel usage

### Interaction Funnel

- offer opened
- map opened
- directions started
- arrival detected

### Feedback / Quality

- useful
- irrelevant
- too quiet
- too loud
- bug reports
- unclear demo label
- wrong location

### Pitch Metrics

- X testers in real field test
- Y matches detected
- Z notifications delivered/shown
- open rate
- map usage rate
- directions start rate
- arrival rate
- useful feedback rate
- top categories
- top suppression reasons

## 16. Collections

Fachlicher Vorschlag:

- `userEvents`
- `permissionEvents`
- `interestEvents`
- `matchEvents`
- `notificationEvents`
- `offerInteractionEvents`
- `arrivalEvents`
- `feedbackEvents`
- `systemHealthEvents`
- `adminMetricSnapshots`

Hinweis:

Bestehende Collections prüfen und ggf. weiterverwenden:

- `clientdiaglogs`
- `notificationlogs`
- `offervisibility`
- `pushtokens`
- `users`
- `providers`
- `offers`

Nicht blind neue Collections bauen, wenn bestehende Strukturen reichen.

## 17. Retention / TTL

Vorschläge:

- `clientDiagLogs`: 7-14 Tage
- raw location diagnostics: maximal 7 Tage
- `permissionEvents`: 90 Tage im Labor
- `matchEvents`: 30-90 Tage im Labor
- `notificationEvents`: 30-90 Tage
- `offerInteractionEvents`: 30-90 Tage
- `arrivalEvents`: 30-90 Tage
- `feedbackEvents`: länger, aber ohne unnötige Standortdaten
- `adminMetricSnapshots`: länger

Entscheidung:

Rohdaten begrenzen, Aggregationen länger behalten.

## 18. Nicht-Ziele

Nicht bauen/planen:

- invasive Bewegungsprofile
- dauerhafte GPS-Track-Historie
- Heatmap im MVP
- personenbezogene Rohdaten in Pitch-Präsentationen
- offenes Admin Panel
- vollständige PushTokens im Admin
- Standortdaten in Feedback-E-Mails
- Pitch-Zahlen ohne belastbare Events

## 19. Beziehung zu Demo-Markt Zone B

Observability ist Voraussetzung für den Demo-Markt Graz-Nord/Gösting/Andritz.

Erst wenn Eventklassen und KPIs definiert sind, sollen Demo-Angebote systematisch angelegt und getestet werden.

## 20. Beziehung zu Urban Taxonomy

Jedes relevante Event soll später `category`/`subcategory`/`contentType`/`pushPriority` aufnehmen können.

Grundlage:

- `docs/STEPSMATCH_URBAN_TAXONOMY.md`

Ziel:

Später verstehen:

- Welche urbanen Kategorien funktionieren?
- Welche Kategorien nerven?
- Welche Push-Priorität ist zu laut/zu leise?
- Welche Inhalte führen zu Karte/Route/Arrival?

## 21. Beziehung zu Ultreia

Nur als getrenntes Learning:

- Observability für Location/Need/Notification/Arrival ist später für Ultreia relevant.
- Ultreia braucht aber eigene Route-/Pilger-Taxonomie.
- Keine Code-/Daten-/Secret-/Deploy-Vermischung.
- Keine Pilger-Sprache in StepsMatch.
