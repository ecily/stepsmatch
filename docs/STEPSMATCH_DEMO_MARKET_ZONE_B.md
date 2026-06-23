# StepsMatch Demo Market Zone B

Stand: 2026-06-23

## 1. Zweck

StepsMatch braucht einen lokal testbaren Demo-Markt in Graz-Nord/Gösting/Andritz, damit echte Tester erleben können, dass Interessen, Nähe, Zeitfenster, Push, Karte, Route und Arrival zusammen funktionieren.

Ziel ist nicht Masse, sondern beweisbare Qualität.

Zone B ist eine strategische Planungszone für echte Feldtests. Diese Datei legt keine Anbieter an, veröffentlicht keine Angebote und behauptet keine Kooperation.

## 2. Zone-B-Prinzipien

- urban/lokal
- echte Orte
- echte Anbieter nur als Kandidaten, solange keine Zustimmung vorliegt
- keine Fake-Angebote
- keine falschen Partnerclaims
- klare Kennzeichnung
- geringe Dichte
- messbare Testziele
- Kategorien aus `docs/STEPSMATCH_URBAN_TAXONOMY.md`
- Events/KPIs aus `docs/STEPSMATCH_OBSERVABILITY.md`

## 3. Rechtlich saubere Content-Klassen

### real_provider_candidate

Zweck:

Ein echter Anbieter/Ort, der öffentlich existiert, aber noch keine Zustimmung gegeben hat.

Darf öffentlich sichtbar sein:

Nein. Nur intern für Planung, Kontaktvorbereitung und Testdatendesign.

Darf pushen:

Nein, solange keine Zustimmung vorliegt.

Quellenanforderung:

Offizielle Anbieter-Website, offizielle Center-/Stadt-/Tourismus-Seite oder andere belastbare Primärquelle.

Kennzeichnung:

`real_provider_candidate`, `needs_contact`, kein Partnerlabel.

Risiko:

Falscher Partnerclaim, ungefragte Werbung, veraltete Daten, unklare Rechte an Namen/Bildern.

### editorial_public_place

Zweck:

Öffentlicher Ort, Aussichtspunkt, Park, Weg, Naherholungsort oder redaktioneller Hinweis ohne Anbieterbezug.

Darf öffentlich sichtbar sein:

Später ja, wenn Quelle und Formulierung sauber sind.

Darf pushen:

Nur leise oder In-App, wenn der Hinweis zur Situation passt. Kein starker Anbieter-Push.

Quellenanforderung:

Bevorzugt Stadt Graz, Graz Tourismus, Holding Graz oder andere öffentliche/offizielle Quellen.

Kennzeichnung:

`editorial_public_place`, redaktioneller Hinweis, kein Anbieter, keine Partnerschaft.

Risiko:

Unklare Wegführung, Sicherheits-/Wetterrisiko, falsche Erwartung an Infrastruktur, zu laute Push-Ausspielung.

### official_test_provider

Zweck:

Echter Anbieter, der einer StepsMatch-Testdarstellung ausdrücklich zugestimmt hat.

Darf öffentlich sichtbar sein:

Später ja, nach Kontakt und dokumentierter Freigabe.

Darf pushen:

Später ja, nur innerhalb Consent-, Kategorie-, Radius-, Zeitfenster- und Push-Policy.

Quellenanforderung:

Offizielle Anbieterquelle plus dokumentierte Zustimmung.

Kennzeichnung:

`official_test_provider`, nur nach Freigabe.

Risiko:

Unklare Freigabe, falsche Angebotsdaten, falsche Erwartung an Reichweite oder Kundenzahl.

### demo_provider

Zweck:

Fiktiver Testanbieter, falls echte Anbieter noch nicht freigegeben sind.

Darf öffentlich sichtbar sein:

Nur klar als Demo/Test gekennzeichnet.

Darf pushen:

Nur im Testmodus und klar als Demo.

Quellenanforderung:

Keine echte Anbieterquelle, weil fiktiv. Keine echten Namen, Logos, Adressen oder Claims verwenden.

Kennzeichnung:

`demo_provider`, deutliches Demo-Label.

Risiko:

Verwechslung mit echten Anbietern, falsche Nähe-Erwartung, Vertrauensverlust bei unklarer Kennzeichnung.

## 4. Reale Anbieter-Kandidaten

Alle folgenden Anbieter sind nur Kandidaten. Es besteht keine bekannte Kooperation mit StepsMatch.

### Essen & Trinken

#### Bäckerei Konditorei Bartl, Graz Andritz

- Kategorie: Essen & Trinken
- Subkategorie: Bäckerei / Café / Snack
- Stadtteil/Gebiet: Andritz
- Adresse: Andritzer Reichsstraße 42A, 8045 Graz
- Website/offizielle Quelle: [Bäckerei Bartl Filialen](https://baeckerei-bartl.at/filialen/)
- Quelle kurz: offizielle Filialseite
- Warum relevant: zentraler Andritz-Kandidat für Frühstück, Gebäck, Snack und kurze Nahversorgungswege.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Kein Partnerclaim; keine Öffnungszeiten oder Tagesangebote ohne Freigabe übernehmen.

#### Bäckerei Kern, Andritz

- Kategorie: Essen & Trinken
- Subkategorie: Bäckerei / Frühstück / Snack
- Stadtteil/Gebiet: Andritz
- Adresse: Grazer Straße 35, 8045 Graz
- Website/offizielle Quelle: [Bäckerei Kern Filialen](https://baeckerei-kern.at/filialen)
- Quelle kurz: offizielle Filialseite
- Warum relevant: urbaner Alltagskandidat für morgens/mittags, auch als Interesse "Kaffee & Pause" denkbar.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Keine Aktionen oder Produktversprechen ohne Zustimmung.

#### Café Restaurant Andritzer Hof

- Kategorie: Essen & Trinken
- Subkategorie: Restaurant / Mittagessen / Café
- Stadtteil/Gebiet: Andritz
- Adresse: Gottlieb-Remschmidt-Gasse 2, 8045 Graz, laut Website-Postcode/Town und Seitenkontext
- Website/offizielle Quelle: [Café Restaurant Andritzer Hof](https://andritzerhof.eatbu.com/)
- Quelle kurz: Anbieter-Webseite
- Warum relevant: lokaler Gastronomie-Kandidat nahe Andritz für zeitabhängige Essenshinweise.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Die Adresse sollte vor operativer Nutzung nochmals gegen Anbieterfreigabe geprüft werden.

#### Heuriger Johanneshof Andritz

- Kategorie: Essen & Trinken
- Subkategorie: Restaurant / Regionales Essen
- Stadtteil/Gebiet: Andritz
- Adresse: Rotmoosweg 7, 8045 Graz, laut Anbieter-/Tourismuskontext
- Website/offizielle Quelle: [Johanneshof Andritz](https://www.johanneshof-andritz.at/)
- Quelle kurz: Anbieter-Webseite
- Warum relevant: regionaler Gastronomie-Kandidat für Freizeit-/Abend- oder Wochenendkontexte.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Keine Öffnungszeiten, Tischverfügbarkeit oder Speisenversprechen ungeprüft übernehmen.

#### Hathi Graz

- Kategorie: Essen & Trinken
- Subkategorie: Restaurant / Abendessen
- Stadtteil/Gebiet: nördliches Graz, für Zone B nur prüfen, wenn Testwege sinnvoll passen
- Adresse: vor operativer Nutzung aus offizieller Quelle prüfen
- Website/offizielle Quelle: [Hathi Graz](https://www.hathi-graz.at/)
- Quelle kurz: Anbieter-Webseite
- Warum relevant: realer Gastronomie-Kandidat, aber räumliche Eignung für Zone B muss vor Auswahl geprüft werden.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Nur verwenden, wenn Distanz zu Zone-B-Testwegen tatsächlich passt; sonst `unsuitable`.

### Einkaufen & Nahversorgung

#### Shopping Nord

- Kategorie: Einkaufen & Nahversorgung
- Subkategorie: Nahversorger / Markt / lokales Center
- Stadtteil/Gebiet: Graz-Nord/Gösting
- Adresse: Wiener Straße 351, 8051 Graz
- Website/offizielle Quelle: [Shopping Nord](https://www.shoppingnord.at/) und [Graz Tourismus Shopping Nord](https://www.graztourismus.at/de/essen-trinken-shoppen/einkaufen-in-graz/shopping-tipps-graz/shopping-nord-shopping-center_shg_7740)
- Quelle kurz: offizielle Center-Webseite und Graz Tourismus
- Warum relevant: starker Zone-B-Anker für Nahversorgung, Services, Apotheke, Gastronomie und Eventtests.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Centerinformationen sind keine Zustimmung für einzelne Shops; Shop-spezifische Freigabe separat nötig.

#### Billa Plus im Shopping Nord

- Kategorie: Einkaufen & Nahversorgung
- Subkategorie: Lebensmittel / Nahversorger
- Stadtteil/Gebiet: Graz-Nord/Gösting
- Adresse: Wiener Straße 351, 8051 Graz
- Website/offizielle Quelle: [Shopping Nord Shopfinder](https://shoppingnord.at/shopfinder) und [Holding Graz BILLA Shopping Nord](https://www.holding-graz.at/en/partnerbetriebe/billa-shopping-nord/)
- Quelle kurz: offizieller Center-Shopfinder / Holding-Graz-Eintrag
- Warum relevant: Nahversorgungs-Kandidat für klare Alltagsinteressen im Demo-Markt.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Keine Preis-/Aktionsdaten verwenden; Zustimmung von Shop/Betreiber klären.

#### dm drogerie markt, Wiener Straße

- Kategorie: Einkaufen & Nahversorgung
- Subkategorie: Drogerie / Alltagsanbieter
- Stadtteil/Gebiet: Gösting/Graz-Nord
- Adresse: Wiener Straße 286, 8051 Graz
- Website/offizielle Quelle: [dm Markt Graz, Wiener Straße 286](https://www.dm.at/store/a09f/graz/wiener-strasse-286)
- Quelle kurz: offizielle dm-Standortseite
- Warum relevant: Alltagsbedarf und Nahversorgung, gut geeignet für nicht-aggressive Interessenlogik.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Keine Produkt- oder Aktionspushes ohne explizite Freigabe.

#### Gruber-Hofladen, Kalkleitenstraße

- Kategorie: Einkaufen & Nahversorgung
- Subkategorie: Hofladen / Regional
- Stadtteil/Gebiet: Andritz/nahe Umgebung
- Adresse: Kalkleitenstraße 22, 8045 Graz-Andritz
- Website/offizielle Quelle: [AMA Genuss Region: Gruber-Hofladen](https://www.genussregionen.at/de/betrieb/gruber-hofladen)
- Quelle kurz: AMA Genuss Region Eintrag mit Hofladen-Website
- Warum relevant: regionaler Nahversorgungs-Kandidat für "Regional" und kurze Ausflugs-/Alltagswege.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Quelle ist offizieller Qualitäts-/Betriebseintrag, aber Anbieterfreigabe bleibt nötig.

### Gesundheit & Alltag

#### Apotheke Andritz

- Kategorie: Gesundheit & Alltag
- Subkategorie: Apotheke
- Stadtteil/Gebiet: Andritz
- Adresse: Weinzöttlstraße 3, 8045 Graz
- Website/offizielle Quelle: [Apotheke Andritz](https://www.apotheke-andritz.at/)
- Quelle kurz: Anbieter-Webseite
- Warum relevant: hoher Alltagsnutzen bei Gesundheitsinteresse; Push nur sachlich und vorsichtig.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `high_attention` nur sehr sparsam, sonst `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Keine medizinischen Versprechen, Diagnosen oder Verfügbarkeitsgarantien.

#### St. Josef Apotheke Andritz

- Kategorie: Gesundheit & Alltag
- Subkategorie: Apotheke
- Stadtteil/Gebiet: Andritz
- Adresse: Andritzer Reichsstraße 52, 8045 Graz-Andritz
- Website/offizielle Quelle: [St. Josef Apotheke](https://josef-apotheke.at/)
- Quelle kurz: Anbieter-Webseite
- Warum relevant: weiterer Apotheken-Kandidat im Andritz-Kernbereich.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `high_attention` nur sehr sparsam, sonst `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Medizinische Kommunikation besonders zurückhaltend; keine Verfügbarkeitsclaims.

#### Janus-Apotheke

- Kategorie: Gesundheit & Alltag
- Subkategorie: Apotheke
- Stadtteil/Gebiet: Gösting
- Adresse: Wienerstraße 215-217, 8051 Graz-Gösting
- Website/offizielle Quelle: [Janus-Apotheke](https://janus-apotheke.at/)
- Quelle kurz: Anbieter-Webseite
- Warum relevant: Gesundheits-/Alltagsanker in Gösting.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `high_attention` nur sehr sparsam, sonst `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Keine medizinischen Aussagen oder falschen Notdiensthinweise.

#### Apotheke Graz Shopping Nord

- Kategorie: Gesundheit & Alltag
- Subkategorie: Apotheke
- Stadtteil/Gebiet: Graz-Nord/Gösting
- Adresse: Wienerstraße 351, 8051 Graz
- Website/offizielle Quelle: [Apotheke Graz Shopping Nord](https://www.apotheke-graz-nord.at/) und [Shopping Nord Apotheke](https://shoppingnord.at/shop/apotheke)
- Quelle kurz: Anbieter-Webseite und Center-Shopseite
- Warum relevant: Gesundheitsanker direkt im Shopping-Nord-Testgebiet.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `high_attention` nur sehr sparsam, sonst `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Keine medizinischen Versprechen, keine Öffnungs-/Bereitschaftsaussagen ohne aktuelle Prüfung.

### Freizeit & Bewegung

#### Stukitzbad/Stukitzsauna

- Kategorie: Freizeit & Bewegung
- Subkategorie: Familie / Kinder / Sport
- Stadtteil/Gebiet: Andritz
- Adresse: Andritzer Reichsstraße 25, 8045 Graz
- Website/offizielle Quelle: [Holding Graz Stukitzbad](https://www.holding-graz.at/de/freizeit/stukitzbad/) und [Graz Tourismus Stukitzbad](https://www.graztourismus.at/de/sightseeing-kultur/sehenswuerdigkeiten/stu-kitz-bad_shg_2304)
- Quelle kurz: Holding Graz / Graz Tourismus
- Warum relevant: öffentlicher Freizeit-Ort und Testpunkt für Karte/Route/Arrival.
- Möglicher Content-Typ: `editorial_public_place` oder später `real_provider_candidate` für Holding-Graz-Freigabe
- Mögliche Push-Priorität: `low_or_in_app`
- Status: `verified_official_source`
- Risiko/Hinweis: Preise/Öffnungszeiten nicht in Demo-Content übernehmen; saisonale Eignung beachten.

#### Ruine Gösting / Jungfernsprung

- Kategorie: Freizeit & Bewegung
- Subkategorie: Spaziergang / Aussichtspunkt / kurzer Abstecher
- Stadtteil/Gebiet: Gösting
- Adresse: als öffentlicher Ort/Wanderziel, keine Anbieteradresse
- Website/offizielle Quelle: [Stadt Graz Ruine Gösting](https://www.graz.at/cms/beitrag/10161901/7776290/Ruine_Goesting.html) und [Graz Tourismus Burgruine Gösting](https://www.graztourismus.at/de/sightseeing-kultur/sehenswuerdigkeiten/goesting-burgruine_shg_1446)
- Quelle kurz: Stadt Graz / Graz Tourismus
- Warum relevant: starker redaktioneller Testpunkt für Nähe, Aussicht, Route und Arrival ohne Anbieterclaim.
- Möglicher Content-Typ: `editorial_public_place`
- Mögliche Push-Priorität: `low_or_in_app`
- Status: `verified_official_source`
- Risiko/Hinweis: Weg- und Sicherheitskontext beachten; keine aggressiven Pushes.

#### Den Reinerkogel umrunden

- Kategorie: Freizeit & Bewegung
- Subkategorie: Spaziergang / Natur / kurzer Abstecher
- Stadtteil/Gebiet: Andritz-nah / nördliches Graz
- Adresse: Route, kein Anbieter
- Website/offizielle Quelle: [Stadt Graz: Den Reinerkogel umrunden](https://www.graz.at/cms/beitrag/10255533/7776200/Den_Reinerkogel_umrunden.html)
- Quelle kurz: Stadt Graz Spaziergang
- Warum relevant: gute Testlogik für redaktionelle Hinweise entlang von Wegen und ruhige In-App-Discovery.
- Möglicher Content-Typ: `editorial_public_place`
- Mögliche Push-Priorität: `low_or_in_app`
- Status: `verified_official_source`
- Risiko/Hinweis: Route ist länger als ein kurzer POI; Radius/Triggerpunkte später sorgfältig definieren.

#### Thalersee / Gösting-Thalersee-Route

- Kategorie: Freizeit & Bewegung
- Subkategorie: Naturpunkt / Spaziergang / kurzer Abstecher
- Stadtteil/Gebiet: Gösting/nahe Umgebung
- Adresse: Thalersee, mit Stadtbus-Verbindung ab Gösting laut Stadt Graz
- Website/offizielle Quelle: [Stadt Graz Thalersee](https://www.graz.at/cms/beitrag/10161896/7776290/Thalersee.html) und [Stadt Graz: Jungfernsprung, Burgtaverne und Thalersee](https://www.graz.at/cms/beitrag/10255467/7776200/Jungfernsprung_Burgtaverne_und_Thalersee.html)
- Quelle kurz: Stadt Graz
- Warum relevant: Naherholungs-/Routenanker für Feldtests am Rand von Zone B.
- Möglicher Content-Typ: `editorial_public_place`
- Mögliche Push-Priorität: `low_or_in_app`
- Status: `verified_official_source`
- Risiko/Hinweis: Nur für Testwege mit sinnvoller Distanz; nicht als Anbieterhinweis formulieren.

#### Plabutsch / Fürstenstand-Route

- Kategorie: Freizeit & Bewegung
- Subkategorie: Aussichtspunkt / Natur / Spaziergang
- Stadtteil/Gebiet: Gösting/Plabutsch
- Adresse: Route/Wandergebiet, kein Anbieter
- Website/offizielle Quelle: [Graz Tourismus Gipfelwanderung im Grazer Westen](https://www.graztourismus.at/de/erholung-freizeit-sport/spazieren-wandern/tour-uebersicht/gipfelwanderung-im-grazer-westen_td_6456)
- Quelle kurz: Graz Tourismus
- Warum relevant: geeignet als abstrakter Discovery-/Ruhe-/Aussichtstest, wenn Testpersonen nahe am Einstieg sind.
- Möglicher Content-Typ: `editorial_public_place`
- Mögliche Push-Priorität: `low_or_in_app`
- Status: `verified_official_source`
- Risiko/Hinweis: Keine high-attention Notifications; längere Route und Kondition beachten.

### Ruhe & Pause

#### Stukitzbad-Grünbereich / Freizeitpunkt

- Kategorie: Ruhe & Pause
- Subkategorie: Pause / Sitzplatz / Familie
- Stadtteil/Gebiet: Andritz
- Adresse: Andritzer Reichsstraße 25, 8045 Graz
- Website/offizielle Quelle: [Holding Graz Stukitzbad](https://www.holding-graz.at/de/freizeit/stukitzbad/)
- Quelle kurz: Holding Graz
- Warum relevant: ruhiger Testpunkt für Pause/Familie, aber saisonal und eintritts-/betriebsabhängig.
- Möglicher Content-Typ: `editorial_public_place`
- Mögliche Push-Priorität: `low_or_in_app`
- Status: `verified_official_source`
- Risiko/Hinweis: Nicht als frei zugänglicher Park darstellen, wenn Nutzung an Badbetrieb gebunden ist.

#### Reinerkogel-Routenpunkte

- Kategorie: Ruhe & Pause
- Subkategorie: ruhiger Ort / Naturpunkt
- Stadtteil/Gebiet: Andritz-nah / nördliches Graz
- Adresse: Route, kein Anbieter
- Website/offizielle Quelle: [Stadt Graz: Den Reinerkogel umrunden](https://www.graz.at/cms/beitrag/10255533/7776200/Den_Reinerkogel_umrunden.html)
- Quelle kurz: Stadt Graz
- Warum relevant: geeignet für sehr leise redaktionelle Hinweise mit Natur-/Pause-Kontext.
- Möglicher Content-Typ: `editorial_public_place`
- Mögliche Push-Priorität: `low_or_in_app`
- Status: `verified_official_source`
- Risiko/Hinweis: Konkrete Triggerpunkte müssen später vor Ort geprüft werden.

#### Thalersee-Naherholung

- Kategorie: Ruhe & Pause
- Subkategorie: Aussicht / Naturpunkt / Pause
- Stadtteil/Gebiet: Gösting/Thal
- Adresse: Thalersee, keine Anbieteradresse
- Website/offizielle Quelle: [Stadt Graz Thalersee](https://www.graz.at/cms/beitrag/10161896/7776290/Thalersee.html)
- Quelle kurz: Stadt Graz
- Warum relevant: redaktioneller Ruhe-/Naherholungsanker am Rand von Zone B.
- Möglicher Content-Typ: `editorial_public_place`
- Mögliche Push-Priorität: `low_or_in_app`
- Status: `verified_official_source`
- Risiko/Hinweis: Nur bei sinnvoller Nähe; keine Aussagen über Infrastruktur ohne aktuelle Prüfung.

### Services & Lokales

#### Shopping Nord Rad-Garage / Bike-Reparaturstation

- Kategorie: Services & Lokales
- Subkategorie: Reparatur / lokaler Service / Fahrrad
- Stadtteil/Gebiet: Graz-Nord/Gösting
- Adresse: Wiener Straße 351, 8051 Graz
- Website/offizielle Quelle: [Shopping Nord Rad-Garage](https://shoppingnord.at/rad-garage) und [Shopping Nord Bike-Reparaturstation](https://shoppingnord.at/bike-reparaturstation)
- Quelle kurz: offizielle Center-Service-Seiten
- Warum relevant: sehr passend für urbane Testlogik "unterwegs, kurze Hilfe, Nähe".
- Möglicher Content-Typ: `editorial_public_place` oder Center-Service-Kandidat
- Mögliche Push-Priorität: `normal` oder `low_or_in_app`
- Status: `verified_official_source`
- Risiko/Hinweis: Als Center-Service, nicht als unabhängiger Anbieterclaim formulieren.

#### KLIPP Frisör Graz-Andritz

- Kategorie: Services & Lokales
- Subkategorie: Friseur
- Stadtteil/Gebiet: Andritz
- Adresse: Am Arlandgrund 2, 8045 Graz
- Website/offizielle Quelle: [KLIPP Frisör Graz-Andritz](https://www.klipp.at/de/salonsuche/saloninfos/standort.graz-am-arlandgrund-2)
- Quelle kurz: offizielle Standortseite
- Warum relevant: lokaler Service-Kandidat für Interesse "Services".
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Kein Termin-/Verfügbarkeitsversprechen ohne Freigabe.

#### SCHNITTIG! Graz-Andritz

- Kategorie: Services & Lokales
- Subkategorie: Friseur
- Stadtteil/Gebiet: Andritz
- Adresse: Grazer Straße 45, 8045 Graz-Andritz
- Website/offizielle Quelle: [SCHNITTIG! Graz-Andritz](https://schnittig.at/graz-andritz/)
- Quelle kurz: Anbieter-Webseite
- Warum relevant: lokaler Service-Kandidat direkt am Andritz-Hauptbereich.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Kein Partnerclaim und keine Termin-/Preisangaben ohne Zustimmung.

#### KFZ Reinprecht

- Kategorie: Services & Lokales
- Subkategorie: Werkstatt / Reparatur
- Stadtteil/Gebiet: Gösting
- Adresse: Wiener Straße 208, 8051 Graz-Gösting
- Website/offizielle Quelle: [KFZ Reinprecht](https://www.kfz-reinprecht.at/)
- Quelle kurz: Anbieter-Webseite
- Warum relevant: lokaler Reparatur-/Service-Kandidat für Zone B.
- Möglicher Content-Typ: `real_provider_candidate`
- Mögliche Push-Priorität: `normal`
- Status: `verified_official_source`, `needs_contact`
- Risiko/Hinweis: Keine Leistungs-, Preis- oder Verfügbarkeitsaussagen ohne Freigabe.

## 5. Öffentliche Orte / redaktionelle Hinweise

### Ruine Gösting

- Gebiet: Gösting
- Quelle: [Stadt Graz Ruine Gösting](https://www.graz.at/cms/beitrag/10161901/7776290/Ruine_Goesting.html), [Graz Tourismus Burgruine Gösting](https://www.graztourismus.at/de/sightseeing-kultur/sehenswuerdigkeiten/goesting-burgruine_shg_1446)
- Kategorie/Subkategorie: Freizeit & Bewegung / Aussichtspunkt
- Warum relevant: markanter redaktioneller Testpunkt mit klarer Ortsidentität.
- möglicher Radius: 150-300 m an sinnvollen Einstiegspunkten oder am Zielpunkt
- mögliche Push-Priorität: `low_or_in_app`
- geeignet als `editorial_public_place`: ja

### Jungfernsprung

- Gebiet: Gösting
- Quelle: [Stadt Graz Ruine Gösting](https://www.graz.at/cms/beitrag/10161901/7776290/Ruine_Goesting.html), [Stadt Graz Spaziergang Jungfernsprung/Thalersee](https://www.graz.at/cms/beitrag/10255467/7776200/Jungfernsprung_Burgtaverne_und_Thalersee.html)
- Kategorie/Subkategorie: Freizeit & Bewegung / Aussichtspunkt
- Warum relevant: nahe an der Gösting-Route, gut für leise Discovery.
- möglicher Radius: 100-250 m
- mögliche Push-Priorität: `low_or_in_app`
- geeignet als `editorial_public_place`: ja

### Thalersee

- Gebiet: Gösting/nahe Umgebung
- Quelle: [Stadt Graz Thalersee](https://www.graz.at/cms/beitrag/10161896/7776290/Thalersee.html)
- Kategorie/Subkategorie: Ruhe & Pause / Naturpunkt
- Warum relevant: Naherholung und mögliches Testziel für Route/Arrival.
- möglicher Radius: 250-600 m
- mögliche Push-Priorität: `low_or_in_app`
- geeignet als `editorial_public_place`: ja

### Reinerkogel-Runde

- Gebiet: Andritz-nah / nördliches Graz
- Quelle: [Stadt Graz: Den Reinerkogel umrunden](https://www.graz.at/cms/beitrag/10255533/7776200/Den_Reinerkogel_umrunden.html)
- Kategorie/Subkategorie: Freizeit & Bewegung / Spaziergang
- Warum relevant: gut für längere Feldteststrecken und redaktionelle Routenhinweise.
- möglicher Radius: 150-400 m an ausgewählten Punkten
- mögliche Push-Priorität: `low_or_in_app`
- geeignet als `editorial_public_place`: ja

### Stukitzbad

- Gebiet: Andritz
- Quelle: [Holding Graz Stukitzbad](https://www.holding-graz.at/de/freizeit/stukitzbad/)
- Kategorie/Subkategorie: Freizeit & Bewegung / Familie
- Warum relevant: offizieller Freizeitort im Norden mit klarer Adresse.
- möglicher Radius: 150-300 m
- mögliche Push-Priorität: `low_or_in_app`
- geeignet als `editorial_public_place`: ja, mit saisonaler/zugangsbezogener Vorsicht

### Plabutsch / Fürstenstand

- Gebiet: Gösting/Plabutsch
- Quelle: [Graz Tourismus Gipfelwanderung im Grazer Westen](https://www.graztourismus.at/de/erholung-freizeit-sport/spazieren-wandern/tour-uebersicht/gipfelwanderung-im-grazer-westen_td_6456)
- Kategorie/Subkategorie: Freizeit & Bewegung / Aussichtspunkt
- Warum relevant: Aussicht/Naherholung, aber eher für spezielle Testwege.
- möglicher Radius: 300-600 m an Einstieg oder Zielpunkt
- mögliche Push-Priorität: `low_or_in_app`
- geeignet als `editorial_public_place`: ja

## 6. Empfohlene erste Demo-Dichte

Erste Zielgröße:

- 8-12 reale Kandidaten/Orte
- 20-30 spätere Inhalte maximal
- 3-5 Hauptinteressen im ersten Feldtest
- Radius grob 150-600 m
- nicht alle Inhalte pushen
- nicht alles `high_attention`

Empfohlene Verteilung:

- 2-3 Essen & Trinken
- 2 Nahversorgung/Einkaufen
- 1-2 Gesundheit/Alltag
- 2 Freizeit/Spazierhinweise
- 1-2 Ruhe/Pause
- 1 Service/Lokales
- optional 1 Event/Heute-Test

Für Zone B sollte die erste Version eher aus wenigen, gut erklärbaren Testpunkten bestehen:

- Andritz-Kern: Bäckerei/Café, Apotheke, Service, Stukitzbad
- Gösting/Graz-Nord: Shopping Nord, Apotheke, Nahversorgung, Ruine/Jungfernsprung
- Rand/Naherholung: Thalersee oder Reinerkogel nur bei passenden Testwegen

## 7. Push-Priorität für Zone B

Die Push-Priorität folgt `docs/STEPSMATCH_URBAN_TAXONOMY.md`.

- `high_attention`: nur sehr sparsam, z. B. Gesundheit/Apotheke/Hilfe bei echter Nähe und aktivem Interesse.
- `normal`: relevante Anbieterhinweise, Essen/Trinken, Nahversorgung, Services, Events bei passendem Zeitfenster.
- `low_or_in_app`: Spazier-/Aussicht-/Ruheorte, redaktionelle Hinweise, Freizeit ohne Dringlichkeit.
- `silent/admin_only`: reine Tests, Diagnose, technische Kontrollinhalte.

Wichtig:

Der starke Notification-Channel darf nicht für jeden Inhalt verwendet werden.

## 8. Beispielhafte spätere Content-Templates

Keine echten Angebote erfinden. Diese Texte sind nur neutrale Vorlagen.

### real_provider_candidate

```text
Möglicher Anbieter-Kandidat in deiner Nähe.
```

```text
Dieser Ort ist für den StepsMatch-Test vorgemerkt. Noch kein offizieller Partner.
```

### editorial_public_place

```text
Redaktioneller Hinweis in deiner Nähe.
```

```text
Kurzer Abstecher / Aussichtspunkt / Ruheort in deiner Umgebung.
```

### official_test_provider

```text
Offizieller StepsMatch-Testanbieter.
```

Nur nach Freigabe verwenden.

## 9. Kontakt-/Freigabeprozess

1. Kandidat recherchieren.
2. Offizielle Quelle prüfen.
3. Intern als `candidate` speichern.
4. Kontakt aufnehmen.
5. Zustimmung dokumentieren.
6. Erst dann als `official_test_provider` markieren.
7. Erst dann echte Angebote/Claims anzeigen.

## 10. Datenmodell-Auswirkung

Fachlich später nötige Felder:

- `contentType`
- `providerStatus`
- `sourceUrl`
- `sourceType`
- `sourceVerifiedAt`
- `consentStatus`
- `consentGivenAt`
- `contactStatus`
- `category`
- `subcategory`
- `pushPriority`
- `demoZone`
- `radiusMeters`
- `activeFrom`
- `activeTo`
- `label`
- `disclaimer`
- `riskFlag`

Keine Umsetzung in diesem Schritt.

## 11. Observability-Auswirkung

Bezug zu `docs/STEPSMATCH_OBSERVABILITY.md`.

Später messen:

- Matches pro Kategorie
- Opens pro Kategorie
- Push Open Rate pro Push-Priorität
- Map Opens
- Directions Started
- Arrival Detected
- Feedback `useful`/`irrelevant`
- `too_loud`/`too_quiet`
- `demo_label_unclear`
- `wrong_location`

## 12. Nicht-Ziele

Nicht machen:

- keine echten Anbieter ungefragt als Partner darstellen
- keine echten Rabatte erfinden
- keine Preise erfinden
- keine Öffnungszeiten erfinden
- keine medizinischen Aussagen
- keine aggressive Werbung
- keine Massenbefüllung
- keine Vermischung mit Ultreia
- keine DB-Befüllung in diesem Task

## 13. Ergebnisliste

| Name | Gebiet | Kategorie | Subkategorie | Typ | Quelle | Status | Push-Priorität | Eignung | Risiko/Hinweis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bäckerei Konditorei Bartl Graz Andritz | Andritz | Essen & Trinken | Bäckerei / Café | `real_provider_candidate` | [Bartl Filialen](https://baeckerei-bartl.at/filialen/) | `verified_official_source`, `needs_contact` | `normal` | hoch | Kein Partnerclaim, keine Angebote/Öffnungszeiten übernehmen. |
| Bäckerei Kern Andritz | Andritz | Essen & Trinken | Bäckerei / Snack | `real_provider_candidate` | [Kern Filialen](https://baeckerei-kern.at/filialen) | `verified_official_source`, `needs_contact` | `normal` | hoch | Keine Produkt-/Aktionsclaims ohne Zustimmung. |
| Café Restaurant Andritzer Hof | Andritz | Essen & Trinken | Restaurant / Café | `real_provider_candidate` | [Andritzer Hof](https://andritzerhof.eatbu.com/) | `verified_official_source`, `needs_contact` | `normal` | mittel | Adresse vor operativer Nutzung nochmals freigeben lassen. |
| Johanneshof Andritz | Andritz | Essen & Trinken | Regionales Essen | `real_provider_candidate` | [Johanneshof Andritz](https://www.johanneshof-andritz.at/) | `verified_official_source`, `needs_contact` | `normal` | mittel | Keine Öffnungs-/Verfügbarkeitsversprechen. |
| Shopping Nord | Gösting/Graz-Nord | Einkaufen & Nahversorgung | Nahversorger / Center | `real_provider_candidate` | [Shopping Nord](https://www.shoppingnord.at/) | `verified_official_source`, `needs_contact` | `normal` | hoch | Centerfreigabe ersetzt keine Shopfreigabe. |
| Billa Plus Shopping Nord | Gösting/Graz-Nord | Einkaufen & Nahversorgung | Lebensmittel | `real_provider_candidate` | [Shopping Nord Shopfinder](https://shoppingnord.at/shopfinder) | `verified_official_source`, `needs_contact` | `normal` | hoch | Keine Preise/Aktionen; Shopzustimmung nötig. |
| dm drogerie markt Wiener Straße | Gösting/Graz-Nord | Einkaufen & Nahversorgung | Drogerie | `real_provider_candidate` | [dm Standortseite](https://www.dm.at/store/a09f/graz/wiener-strasse-286) | `verified_official_source`, `needs_contact` | `normal` | hoch | Keine Produktpushes ohne Freigabe. |
| Gruber-Hofladen | Andritz/nahe Umgebung | Einkaufen & Nahversorgung | Hofladen / Regional | `real_provider_candidate` | [AMA Genuss Region](https://www.genussregionen.at/de/betrieb/gruber-hofladen) | `verified_official_source`, `needs_contact` | `normal` | mittel | Anbieterfreigabe nötig; Lage für Testwege prüfen. |
| Apotheke Andritz | Andritz | Gesundheit & Alltag | Apotheke | `real_provider_candidate` | [Apotheke Andritz](https://www.apotheke-andritz.at/) | `verified_official_source`, `needs_contact` | `normal`, sehr sparsam `high_attention` | hoch | Keine medizinischen Aussagen oder Verfügbarkeitsclaims. |
| St. Josef Apotheke Andritz | Andritz | Gesundheit & Alltag | Apotheke | `real_provider_candidate` | [St. Josef Apotheke](https://josef-apotheke.at/) | `verified_official_source`, `needs_contact` | `normal`, sehr sparsam `high_attention` | hoch | Keine medizinischen Aussagen; Zustimmung nötig. |
| Janus-Apotheke | Gösting | Gesundheit & Alltag | Apotheke | `real_provider_candidate` | [Janus-Apotheke](https://janus-apotheke.at/) | `verified_official_source`, `needs_contact` | `normal`, sehr sparsam `high_attention` | hoch | Keine Notdienst-/Öffnungsclaims ohne aktuelle Prüfung. |
| Apotheke Graz Shopping Nord | Gösting/Graz-Nord | Gesundheit & Alltag | Apotheke | `real_provider_candidate` | [Apotheke Graz Shopping Nord](https://www.apotheke-graz-nord.at/) | `verified_official_source`, `needs_contact` | `normal`, sehr sparsam `high_attention` | hoch | Keine medizinischen Versprechen. |
| Ruine Gösting / Jungfernsprung | Gösting | Freizeit & Bewegung | Aussichtspunkt / Spaziergang | `editorial_public_place` | [Stadt Graz](https://www.graz.at/cms/beitrag/10161901/7776290/Ruine_Goesting.html) | `verified_official_source` | `low_or_in_app` | hoch | Weg-/Sicherheitskontext vor Feldtest prüfen. |
| Thalersee | Gösting/nahe Umgebung | Ruhe & Pause | Naturpunkt / Naherholung | `editorial_public_place` | [Stadt Graz Thalersee](https://www.graz.at/cms/beitrag/10161896/7776290/Thalersee.html) | `verified_official_source` | `low_or_in_app` | mittel | Nur bei sinnvoller Nähe zu Testwegen. |
| Reinerkogel-Runde | Andritz-nah | Freizeit & Bewegung | Spaziergang / Natur | `editorial_public_place` | [Stadt Graz Reinerkogel](https://www.graz.at/cms/beitrag/10255533/7776200/Den_Reinerkogel_umrunden.html) | `verified_official_source` | `low_or_in_app` | mittel | Längere Route, Triggerpunkte vor Ort prüfen. |
| Stukitzbad/Stukitzsauna | Andritz | Freizeit & Bewegung | Familie / Sport | `editorial_public_place` | [Holding Graz](https://www.holding-graz.at/de/freizeit/stukitzbad/) | `verified_official_source` | `low_or_in_app` | mittel | Saison/Zugang/Preise nicht ungeprüft übernehmen. |
| Shopping Nord Rad-Garage / Bike-Reparaturstation | Gösting/Graz-Nord | Services & Lokales | Fahrrad / Reparatur | `editorial_public_place` | [Shopping Nord Rad-Garage](https://shoppingnord.at/rad-garage) | `verified_official_source` | `normal` oder `low_or_in_app` | hoch | Als Center-Service, nicht als eigenständiger Partnerclaim. |
| KLIPP Frisör Graz-Andritz | Andritz | Services & Lokales | Friseur | `real_provider_candidate` | [KLIPP Standort](https://www.klipp.at/de/salonsuche/saloninfos/standort.graz-am-arlandgrund-2) | `verified_official_source`, `needs_contact` | `normal` | mittel | Keine Termin-/Preisclaims. |
| SCHNITTIG! Graz-Andritz | Andritz | Services & Lokales | Friseur | `real_provider_candidate` | [SCHNITTIG!](https://schnittig.at/graz-andritz/) | `verified_official_source`, `needs_contact` | `normal` | mittel | Keine Termin-/Preisclaims. |
| KFZ Reinprecht | Gösting | Services & Lokales | Werkstatt / Reparatur | `real_provider_candidate` | [KFZ Reinprecht](https://www.kfz-reinprecht.at/) | `verified_official_source`, `needs_contact` | `normal` | mittel | Keine Leistungs-/Verfügbarkeitsclaims. |

## 14. Lücken / Noch Zu Prüfen

- Echte Events/Heute-Test in Andritz/Gösting brauchen aktuelle offizielle Veranstaltungsquellen und sollten nicht aus Aggregatoren übernommen werden.
- Kleine Parks, Sitzplätze und Schattenpunkte brauchen vor Ort verifizierte Triggerpunkte; offizielle Quellen nennen oft Routen, aber nicht einzelne Bänke.
- Einzelne Restaurants in Shopping Nord sind über den Center-Shopfinder sichtbar, brauchen aber bei späterer Anbieterlogik eigene Zustimmung.
- OpenStreetMap kann später für Lage/Geometrie ergänzen, aber nicht als Partner- oder Angebotsnachweis dienen.
