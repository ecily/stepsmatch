# StepsMatch Urban Taxonomy Model

Stand: 2026-06-23

## 1. Zweck

StepsMatch braucht ein eigenes urbanes Interessen-/Kategorie-Modell für Graz und Umgebung.

Dieses Modell ist Grundlage für:

- App-Onboarding
- Interessenwahl
- Anbieter-/Offer-Erstellung
- Demo-Markt Zone B
- Matching
- Push-Priorität
- Observability/Admin-KPIs
- spätere Landingpage-Texte

StepsMatch darf nicht mit Ultreia-/Pilger-Needs modelliert werden.

## 2. Produktkontext

StepsMatch ist urban/lokal.

Kern:

Nutzer bewegen sich in Graz/Graz-Umgebung, wählen Interessen und erhalten passende Hinweise oder Angebote in geografischer Nähe, wenn Standort, Zeit und Interesse zusammenpassen.

Nicht:

- keine Pilger-App
- kein Camino-Produkt
- kein Dealportal
- kein Booking-Ersatz
- kein reines Branchenverzeichnis
- kein Anbieter-Erfolgsversprechen

## 3. Taxonomie-Grundsätze

Das Modell muss:

- für städtische Alltagssituationen passen
- einfach genug fürs Onboarding sein
- fein genug für Anbieter-Angebote sein
- Push-Priorität ermöglichen
- Demo-Inhalte klar kennzeichnen
- spätere Admin-KPIs ermöglichen

Nicht jede Kategorie darf gleich behandelt werden.

Beispiele:

- Gesundheit/Apotheke kann höhere Relevanz haben.
- Café/Essen kann zeitabhängig relevant sein.
- Aussichtspunkt/Spazierhinweis ist eher leise/In-App.
- Shopping/Aktion darf nicht in Dealportal-Spam kippen.

## 4. Primäre urbane Kategorien

Die folgenden Hauptkategorien sind ein fachlicher Vorschlag für StepsMatch.

### Essen & Trinken

Subkategorien:

- Restaurant
- Café
- Bar
- Bäckerei
- Frühstück
- Mittagessen
- Abendessen
- Snack
- Regionales Essen

Typische Push-Logik:

- zeitabhängig
- nicht zu häufig
- passend zu Interesse und Nähe

### Einkaufen & Nahversorgung

Subkategorien:

- Lebensmittel
- Nahversorger
- Hofladen
- Regional
- Drogerie
- Kleidung
- Geschenke
- Markt
- Aktion

Typische Push-Logik:

- vorsichtig
- keine Dealportal-Sprache
- nur bei klarer Relevanz

### Gesundheit & Alltag

Subkategorien:

- Apotheke
- Arzt / Ordination
- Gesundheit
- Bankomat
- Reparatur
- Dienstleistung
- Hilfe in der Nähe

Typische Push-Logik:

- potentiell höher relevant
- aber sauber und nicht alarmistisch
- keine medizinischen Versprechen

### Freizeit & Bewegung

Subkategorien:

- Spaziergang
- Park
- Aussichtspunkt
- Sport
- Familie / Kinder
- Natur
- kurzer Abstecher

Typische Push-Logik:

- eher leise
- In-App oder niedrige Priorität
- nicht wie dringender Push behandeln

### Kultur & Events

Subkategorien:

- Heute
- Wochenende
- Musik
- Ausstellung
- Markt
- Veranstaltung
- Workshop
- Verein

Typische Push-Logik:

- zeitkritisch
- aber Frequenz streng begrenzen

### Ruhe & Pause

Subkategorien:

- ruhiger Ort
- Sitzplatz
- Naturpunkt
- Pause
- Aussicht
- Schatten / kurzer Stopp

Typische Push-Logik:

- optional
- eher nicht aggressiv
- relevant für Demo-Markt und Ultreia-Learning als abstraktes Muster

### Services & Lokales

Subkategorien:

- Friseur
- Werkstatt
- Reinigung
- Beratung
- lokaler Service
- Abholung
- Termin-Hinweis

Typische Push-Logik:

- meist normal/niedrig
- nur bei aktivem Interesse

## 5. Content-Typen

StepsMatch trennt klar:

- `demo_provider`
- `editorial_hint`
- `official_test_provider`
- `real_provider_later`

### demo_provider

- fiktiver Testanbieter
- klar als Demo gekennzeichnet
- keine echten Partnerclaims

### editorial_hint

- neutraler Hinweis auf Ort/Situation
- kein Anbieter
- keine offizielle Partnerschaft

### official_test_provider

- echter Anbieter nur mit Zustimmung
- klar als offizieller Testanbieter erkennbar

### real_provider_later

- späterer echter Anbieterbetrieb
- nicht Teil des ersten Demo-Markts

## 6. Push-Prioritätsklassen

### high_attention

Nur für:

- echte Nähe + starkes Interesse
- Gesundheit/Apotheke/Hilfe
- sehr relevante zeitkritische Hinweise

### normal

Für:

- Essen/Trinken
- Nahversorgung
- Services
- Events bei passendem Zeitfenster

### low_or_in_app

Für:

- Spazierhinweise
- Aussichtspunkte
- ruhige Orte
- allgemeine redaktionelle Hinweise

### silent/admin_only

Für:

- reine Tests
- Diagnose
- Inhalte, die nicht aktiv pushen sollen

Wichtig:

Nicht alles darf starke Notification nutzen.

Der starke Channel aus StepsMatch-Labor ist für echte relevante Nähe-/Match-Hinweise, nicht für alle Inhalte.

## 7. Demo-Markt Zone B Anwendung

Für Zone B Graz-Nord/Gösting/Andritz sollte das erste Content-Set aus diesen Kategorien bestehen:

Empfohlener Start:

- 2-3 Essen & Trinken
- 2 Nahversorgung/Einkaufen
- 1 Gesundheit/Apotheke-Test
- 2 Freizeit/Spazierhinweise
- 1 Ruhepunkt
- 1 Service/Lokales
- optional 1 Event/Heute-Test

Nicht mehr als 20-30 Inhalte in der ersten Zone-B-Version.

Jeder Eintrag muss später enthalten:

- Hauptkategorie
- Subkategorie
- Content-Typ
- Push-Priorität
- Demo-/Hinweis-Kennzeichnung
- Radius
- Zeitfenster
- erwartetes Verhalten
- Risiko

## 8. Anbieter-UX-Auswirkung

Anbieter sollen nicht aus zu vielen Kategorien wählen müssen.

Empfehlung:

- zuerst Hauptkategorie wählen
- dann wenige passende Subkategorien anzeigen
- klare Beispiele geben
- keine Fachbegriffe
- Vorschau zeigen, wie der Hinweis in der App erscheint

## 9. App-Onboarding-Auswirkung

App-Nutzer sollen Interessen einfach wählen können.

Nicht zu granular am Anfang.

Erste Nutzer-Auswahl eher:

- Essen & Trinken
- Kaffee & Pause
- Einkaufen
- Gesundheit & Alltag
- Freizeit & Bewegung
- Events
- Regionale Hinweise
- Services

Subkategorien können später im Hintergrund oder in erweiterten Einstellungen kommen.

## 10. Observability-Auswirkung

Events und Admin-KPIs müssen Kategorien speichern:

- `category`
- `subcategory`
- `contentType`
- `pushPriority`
- `userInterest`
- `matchReason`
- `suppressionReason`

Admin später:

- Matches pro Kategorie
- Notification Open Rate pro Kategorie
- Offer Open Rate pro Kategorie
- Directions Rate pro Kategorie
- Feedback pro Kategorie
- `too_loud`/`too_quiet` pro Push-Priorität
- `irrelevant` reports pro Kategorie

## 11. Datenschutz / Vertrauen

Kategorien dürfen nicht genutzt werden, um Nutzer heimlich zu profilieren.

Regeln:

- Interessen transparent anzeigen
- Nutzer kann Interessen ändern
- keine sensiblen Profile ohne klare Zustimmung
- Gesundheit/Apotheke vorsichtig behandeln
- keine medizinischen Aussagen oder Diagnosen
- keine unnötige dauerhafte Rohprofilierung

## 12. Beziehung zu Ultreia

Nur getrennt als Learning:

StepsMatch testet urbane Interessenlogik.

Ultreia braucht später eigene Pilger-/Route-/Need-Taxonomie.

Übertragbar ist nur das Muster:

- klare Kategorien
- getrennte Push-Prioritäten
- Content-Typen
- Observability nach Kategorie
- keine Vermischung von Produktsprachen oder Daten

Keine Pilger-Begriffe in StepsMatch verwenden.
