# StepsMatch Consent-First Onboarding

Stand: 2026-06-23

## 1. Produktkontext

StepsMatch ist eine standortbasierte App für Graz und Umgebung.

Kern:

Nutzer wählen Interessen. Die App erkennt passende Angebote oder Hinweise in geografischer Nähe und meldet sich nur dann, wenn Standort, Zeit und Interesse zusammenpassen.

StepsMatch ist ausdrücklich:

- neutral
- lokal
- interessenbasiert
- standortbasiert
- kein Pilgerprodukt
- kein Dealportal mit Garantieversprechen
- kein Anbieter-Erfolgsversprechen

## 2. Grundsatz

StepsMatch lebt davon, dass Nutzer freiwillig zustimmen, dass ihre aktuelle Position verarbeitet wird.

Ohne Standortfreigabe funktioniert der Produktkern nicht:

- keine Nähe-Erkennung
- keine passenden Hinweise im Radius
- keine Background-Matches
- keine zuverlässigen Benachrichtigungen bei passenden Inhalten in der Nähe

Deshalb gilt:

- keine versteckte Standortverarbeitung
- kein stilles Background-Tracking
- kein Android-Systemdialog ohne vorherige Erklärung
- keine beschönigende Sprache
- Nutzer muss vorab verstehen, wofür Standort, Hintergrundstandort und Push gebraucht werden

## 3. Onboarding-Journey

Die App braucht eine mehrstufige Onboarding-Journey.

Empfohlene Reihenfolge:

1. Willkommen / Produktnutzen
2. Interessen wählen
3. Standort im Vordergrund erklären und abfragen
4. Benachrichtigungen erklären und abfragen
5. Hintergrundstandort erklären und abfragen
6. Abschluss-/Statusscreen

Nicht alle Systemdialoge sofort beim ersten Start auslösen.

Erst Nutzen erklären, dann freiwillig fragen, dann Android-Permission auslösen.

## 4. Schritt 1: Willkommen

Ziel:

Nutzer versteht in wenigen Sekunden, was StepsMatch tut.

Textvorschlag:

```text
StepsMatch zeigt dir passende Angebote und Hinweise in deiner Nähe - abgestimmt auf deine Interessen.

Du musst nicht ständig suchen. Wenn etwas Relevantes in deiner Nähe ist, meldet sich die App.
```

CTA:

```text
Loslegen
```

Sekundär:

```text
Später
```

## 5. Schritt 2: Interessen wählen

Ziel:

Nutzer wählt, was für ihn relevant ist.

Textvorschlag:

```text
Wähle aus, was dich interessiert. StepsMatch nutzt diese Auswahl, um passende Inhalte in deiner Nähe zu erkennen.
```

Beispiele:

- Essen & Trinken
- Café
- Einkaufen
- Services
- Freizeit
- Gesundheit / Apotheke
- Regionale Angebote
- Hinweise in der Nähe

Hinweis:

Ohne Interessen kann StepsMatch nur eingeschränkt passende Inhalte erkennen.

## 6. Schritt 3: Standort im Vordergrund

Ziel:

Nutzer versteht, warum die App Standort braucht.

Textvorschlag:

```text
StepsMatch nutzt deinen Standort, um zu erkennen, ob ein passendes Angebot oder ein Hinweis in deiner Nähe ist.

Ohne Standortfreigabe kann StepsMatch keine Inhalte in deiner Nähe erkennen.
```

Button:

```text
Standort für passende Hinweise erlauben
```

Sekundär:

```text
Nicht jetzt
```

Wenn abgelehnt:

- App bleibt nutzbar, aber mit klarer Einschränkung.
- Status anzeigen: "Standort fehlt - Nähe-Hinweise sind eingeschränkt."

## 7. Schritt 4: Benachrichtigungen

Ziel:

Nutzer versteht, warum Push nötig ist.

Textvorschlag:

```text
Damit du passende Hinweise nicht verpasst, braucht StepsMatch Benachrichtigungen.

Die App soll dich nur informieren, wenn etwas zu deinen Interessen und deinem Standort passt.
```

Button:

```text
Benachrichtigungen erlauben
```

Sekundär:

```text
Nicht jetzt
```

Wenn abgelehnt:

- Status anzeigen: "Benachrichtigungen fehlen - du siehst Hinweise nur, wenn du die App öffnest."

## 8. Schritt 5: Hintergrundstandort

Ziel:

Nutzer versteht ehrlich, warum Background Location für den Kern wichtig ist.

Textvorschlag:

```text
Damit StepsMatch auch funktioniert, wenn dein Bildschirm aus ist oder die App im Hintergrund läuft, braucht die App Standortzugriff im Hintergrund.

Ohne Hintergrundstandort kann StepsMatch passende Hinweise oft erst erkennen, wenn du die App wieder öffnest.
```

Button:

```text
Hintergrundstandort erlauben
```

Sekundär:

```text
Später
```

Wichtig:

- Keine Angstmacherei.
- Keine Tricks.
- Klar sagen: Das ist notwendig für die Hintergrundfunktion.
- Nutzer kann ablehnen, aber Funktion ist dann eingeschränkt.

## 9. Schritt 6: Abschluss-/Statusscreen

Ziel:

Nutzer sieht, ob StepsMatch bereit ist.

Status anzeigen:

- Interessen gewählt: ja/nein
- Standort erlaubt: ja/nein
- Benachrichtigungen erlaubt: ja/nein
- Hintergrundstandort erlaubt: ja/nein

Mögliche Zustände:

```text
Bereit
```

Interessen, Standort, Push, Hintergrundstandort aktiv.

```text
Eingeschränkt
```

Einzelne Rechte fehlen. Jeweils erklären, was dadurch nicht funktioniert.

Beispiele:

```text
Standort fehlt: StepsMatch kann keine Nähe erkennen.
```

```text
Benachrichtigungen fehlen: Du wirst nicht aktiv informiert.
```

```text
Hintergrundstandort fehlt: StepsMatch funktioniert nur eingeschränkt, wenn die App geschlossen oder der Bildschirm aus ist.
```

## 10. Datenschutzversprechen

Kurz und klar:

- Standort wird genutzt, um passende Inhalte in der Nähe zu erkennen.
- Keine Standortdaten verkaufen.
- Keine unnötige dauerhafte Roh-Bewegungshistorie für den MVP.
- Roh-/Diagnosedaten brauchen Retention/TTL.
- Nutzer kann Berechtigungen jederzeit entziehen.
- Für Tests müssen Datenverarbeitung und Zweck klar kommuniziert werden.

## 11. Was gespeichert werden darf

Für Test und Produktanalyse grundsätzlich relevant:

- User/Device intern
- aktuelle/letzte Position
- Zeitpunkt
- Interessen
- Match-Entscheidung
- Distanz zum Inhalt
- Notification-Events
- Offer/Hinweis geöffnet
- Karte geöffnet
- Route gestartet
- Arrival erkannt

Aber:

- nur zweckgebunden
- so wenig Rohdaten wie möglich
- keine unnötige dauerhafte Bewegungsprofil-Speicherung
- sensible Standortdaten nicht in E-Mails oder Logs ausgeben
- keine vollständigen Tokens oder privaten Daten in Admin-/Debug-Ausgaben

## 12. UX-Regeln

- einfache Sprache
- keine juristischen Textwände
- keine Tricks
- kein Dark Pattern
- klare Ablehnen-/Später-Option
- jede Permission einzeln erklären
- jede Ablehnung mit konkreter Funktionseinschränkung erklären
- Status jederzeit in der App sichtbar machen
- Nutzer muss Berechtigungen später erneut öffnen können
- Android-Einstellungen bei Bedarf erklären

## 13. Relevanz für Demo-Markt Graz-Nord

Für echte Tester in Graz-Nord/Gösting/Andritz muss vor Testbeginn klar sein:

- sie testen eine Standort-/Push-App
- sie stimmen Standortverarbeitung bewusst zu
- Demo-Inhalte sind klar gekennzeichnet
- ihr Verhalten wird für Produktverbesserung ausgewertet
- keine unnötigen Roh-Bewegungsprofile
- Feedback wird gesammelt

## 14. Relevanz für Ultreia-Learning

Nur als getrenntes Learning markieren:

- Background Location muss in späteren Produkten extrem klar erklärt werden.
- Nutzer muss verstehen: App läuft ruhig im Hintergrund und meldet sich nur bei relevanter Nähe.
- Permission-Onboarding muss schrittweise und vertrauensbildend sein.
- Keine Code-/Daten-/Deploy-Vermischung zwischen StepsMatch und Ultreia.

Keine Pilger-Sprache in StepsMatch verwenden.
