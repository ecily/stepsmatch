# StepsMatch Demo Market Seed Graz-Nord V1

Stand: 2026-06-23

## 1. Zweck

Dieses Dokument definiert einen strategischen Seed fuer einen dichten, real wirkenden StepsMatch-Pre-Alpha-Demo-Markt im Norden von Graz und in 8111 Gratwein-Strassengel.

Es ist eine Planungsgrundlage fuer eine spaetere Demo-Datenbefuellung. In diesem Schritt werden keine Datenbankeintraege angelegt, keine Angebote veroeffentlicht, keine Pushes versendet und keine Partnerclaims erzeugt.

Der Seed ersetzt nicht die rechtliche, fachliche und operative Pruefung vor einer echten oeffentlichen Ausspielung. Er erlaubt aber fuer die Pre-Alpha bewusst reale, oeffentlich auffindbare Orte und Anbieter als Demo-Locations, solange sie neutral, korrekt und ohne Angebots- oder Partnerschaftsbehauptung dargestellt werden.

## 2. Demo-Markt-Strategie

Die bisherige Zone-B-Demo war fuer Pre-Alpha-Feldtests zu klein. Die neue Strategie ist ein dichter Seed mit mindestens 100 realen Demo-Datensaetzen, damit Tester in Graz-Nord, Goesting, Andritz und 8111 Gratwein-Strassengel ein glaubwuerdiges lokales Umfeld erleben.

Ziele:

- reale Ortsdichte statt fiktiver Masse
- neutrale Demo-Hinweise statt Deals
- viele Kategorien fuer Matching- und KPI-Tests
- Push-Prioritaet bewusst differenzieren
- Karte, Route, Arrival und Feedback in mehreren Alltagssituationen pruefen
- keine Vermischung mit Kaufklug, Ultreia oder Pilgerlogik

Geografische Zielgewichtung:

- ca. 60-70 % Graz-Nord / Goesting / Andritz
- ca. 30-40 % 8111 Gratwein-Strassengel und direkt passende Umgebung

## 3. Neue Content-Klasse: `real_demo_location`

`real_demo_location` bedeutet:

Ein realer oeffentlich auffindbarer Ort oder Anbieter, der fuer Pre-Alpha-Demozwecke verwendet werden kann. Es besteht keine behauptete Kooperation, kein Rabatt, kein Angebot, kein Preis, keine Verfuegbarkeit und kein offizieller Partnerstatus.

Erlaubt:

- Name
- Kategorie und Subkategorie
- Gebiet
- Adresse oder grobe Lage, wenn oeffentlich auffindbar
- Quelle
- neutraler Demo-Text
- Radius-Vorschlag
- Push-Prioritaet
- Testnutzen
- Risiko/Hinweis

Nicht erlaubt:

- erfundene Rabatte
- erfundene Preise
- erfundene Oeffnungszeiten
- Angebotsclaims
- medizinische Aussagen
- Verfuegbarkeitsversprechen
- Partnerclaim
- Logos/Bilder uebernehmen
- "offizieller Anbieter", ausser dokumentiert freigegeben

## 4. Quellenregeln

Bevorzugte Quellen:

- offizielle Anbieter-Websites
- offizielle Gemeinde-/Stadtseiten
- Graz Tourismus
- Holding Graz
- Shopping Nord
- offizielle Vereins-/Betriebsseiten
- offizielle Apotheken-/Aerzte-/Service-Seiten

OpenStreetMap darf spaeter fuer Lage/Geometrie ergaenzt werden, aber nicht als Partner- oder Angebotsnachweis.

Nicht als Source of Truth:

- Tripadvisor
- Yelp
- reine SEO-Verzeichnisse
- Social Media als einzige Quelle
- fremde Aggregatoren ohne Primaerquelle

## 5. Seed-Tabelle

Alle Eintraege sind `real_demo_location`, nicht Partner, nicht Angebot und nicht Rabatt. `sourceVerifiedAt` ist fuer diesen Planungsstand `2026-06-23`.

| # | name | gebiet | adresse_or_location | category | subcategory | contentType | sourceUrl | sourceType | sourceVerifiedAt | demoLabel | suggestedRadiusMeters | suggestedPushPriority | publicVisibility | testUseCase | riskNote |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Baeckerei Konditorei Bartl Graz Andritz | Andritz | Andritzer Reichsstrasse 42A, 8045 Graz | Essen & Trinken | Baeckerei / Cafe | `real_demo_location` | https://baeckerei-bartl.at/filialen/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Morgen-/Snack-Match im Andritz-Kern testen. | Keine Angebote, Preise oder Oeffnungszeiten uebernehmen. |
| 2 | Baeckerei Kern Andritz | Andritz | Grazer Strasse 35, 8045 Graz | Essen & Trinken | Baeckerei / Snack | `real_demo_location` | https://baeckerei-kern.at/filialen | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Alltagsnahen Baeckerei-Hinweis bei aktivem Interesse testen. | Keine Produkt- oder Aktionsclaims. |
| 3 | Cafe Restaurant Andritzer Hof | Andritz | Gottlieb-Remschmidt-Gasse 2, 8045 Graz | Essen & Trinken | Restaurant / Cafe | `real_demo_location` | https://andritzerhof.eatbu.com/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Zeitabhaengigen Gastro-Hinweis testen. | Adresse und Darstellung vor Import nochmals pruefen. |
| 4 | Johanneshof Andritz | Andritz | Rotmoosweg 7, 8045 Graz | Essen & Trinken | Regionales Essen | `real_demo_location` | https://www.johanneshof-andritz.at/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 400 | normal | pre_alpha_demo_only | Regional-/Abendkontext nahe Andritz testen. | Keine Tisch-, Speisen- oder Verfuegbarkeitsversprechen. |
| 5 | Hathi Graz | Graz-Nord-Pruefkandidat | Lage vor Import gegen offizielle Quelle pruefen | Essen & Trinken | Restaurant | `real_demo_location` | https://www.hathi-graz.at/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 300 | silent/admin_only | internal_planning_only | Raeumliche Eignung fuer Zone-B-Wege pruefen. | Nur verwenden, wenn Distanz wirklich passt. |
| 6 | Shopping Nord | Graz-Nord / Goesting | Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Center / Nahversorgung | `real_demo_location` | https://www.shoppingnord.at/ | official_center_website | 2026-06-23 | Demo-Location, kein Partner | 500 | normal | pre_alpha_demo_only | Starker Anker fuer Karte, Route und Kategorievielfalt. | Centerinfo ist keine Zustimmung einzelner Shops. |
| 7 | Billa Plus Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Lebensmittel | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Nahversorgungsinteresse im Center testen. | Keine Preis- oder Aktionsdaten. |
| 8 | Billa Marktkueche Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Essen & Trinken | Snack / Mittagessen | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Mittagsnahen Essenshinweis im Center testen. | Keine Tagesmenues oder Verfuegbarkeit nennen. |
| 9 | Martin Auer Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Essen & Trinken | Baeckerei / Cafe | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Kaffee-/Pause-Interesse im Centerumfeld testen. | Keine Produktclaims. |
| 10 | Brezenstand Wagner Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Essen & Trinken | Snack / Imbiss | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 200 | normal | pre_alpha_demo_only | Kurzen Snack-Hinweis nahe Eingang testen. | Keine Angebots- oder Preisformulierung. |
| 11 | Tchibo Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kaffee / Shop | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Kaffee-/Shopping-Interesse kombinieren. | Keine Aktionen oder Produktverfuegbarkeit. |
| 12 | Apotheke Graz Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://www.apotheke-graz-nord.at/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Sachlichen Gesundheits-/Alltagshinweis testen. | Keine medizinischen Aussagen, Notdienst- oder Verfuegbarkeitsclaims. |
| 13 | Apotheke Andritz | Andritz | Weinzoettlstrasse 3, 8045 Graz | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://www.apotheke-andritz.at/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Gesundheitsstandort in Andritz testen. | Keine medizinischen Versprechen. |
| 14 | St. Josef Apotheke Andritz | Andritz | Andritzer Reichsstrasse 52, 8045 Graz | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://josef-apotheke.at/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Zweiten Apothekenanker im Andritz-Kern testen. | Keine Notdienst-, Diagnose- oder Verfuegbarkeitsclaims. |
| 15 | Janus-Apotheke | Goesting | Wienerstrasse 215-217, 8051 Graz | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://janus-apotheke.at/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Gesundheitsanker in Goesting testen. | Keine medizinischen Aussagen. |
| 16 | dm drogerie markt Wiener Strasse | Goesting / Graz-Nord | Wiener Strasse 286, 8051 Graz | Einkaufen & Nahversorgung | Drogerie | `real_demo_location` | https://www.dm.at/store/a09f/graz/wiener-strasse-286 | official_provider_location_page | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Drogerie-/Alltagsbedarf ohne Deal-Sprache testen. | Keine Produkt- oder Aktionspushes. |
| 17 | Gruber-Hofladen | Andritz / nahe Umgebung | Kalkleitenstrasse 22, 8045 Graz-Andritz | Einkaufen & Nahversorgung | Hofladen / Regional | `real_demo_location` | https://www.genussregionen.at/de/betrieb/gruber-hofladen | official_quality_or_business_entry | 2026-06-23 | Demo-Location, kein Partner | 400 | normal | pre_alpha_demo_only | Regionalinteresse am Rand von Andritz testen. | Lage und Anbieterfreigabe vor oeffentlichem Betrieb pruefen. |
| 18 | Stukitzbad / Stukitzsauna | Andritz | Andritzer Reichsstrasse 25, 8045 Graz | Freizeit & Bewegung | Familie / Sport | `real_demo_location` | https://www.holding-graz.at/de/freizeit/stukitzbad/ | official_public_operator_page | 2026-06-23 | Demo-Location, kein Partner | 300 | low_or_in_app | pre_alpha_demo_only | Freizeit-, Karten- und Arrival-Testpunkt in Andritz. | Keine Preise, Oeffnungszeiten oder Saisonversprechen. |
| 19 | Ruine Goesting / Jungfernsprung | Goesting | oeffentlicher Aussichtspunkt / Wanderziel | Freizeit & Bewegung | Aussichtspunkt / Spaziergang | `real_demo_location` | https://www.graz.at/cms/beitrag/10161901/7776290/Ruine_Goesting.html | official_city_page | 2026-06-23 | Redaktionelle Demo-Location | 300 | low_or_in_app | pre_alpha_demo_only | Redaktionshinweis ohne Anbieterclaim testen. | Weg-, Sperr- und Sicherheitskontext vor Feldtest pruefen. |
| 20 | Thalersee | Goesting / Thal | Thalersee, nahe Umgebung von Goesting | Ruhe & Pause | Naturpunkt / Naherholung | `real_demo_location` | https://www.graz.at/cms/beitrag/10161896/7776290/Thalersee.html | official_city_page | 2026-06-23 | Redaktionelle Demo-Location | 600 | low_or_in_app | pre_alpha_demo_only | Naherholungsziel fuer Route und Arrival testen. | Nur bei sinnvoller Naehe zu Testwegen ausspielen. |
| 21 | Reinerkogel-Runde | Andritz-nah / noerdliches Graz | Route, kein Anbieter | Freizeit & Bewegung | Spaziergang / Natur | `real_demo_location` | https://www.graz.at/cms/beitrag/10255533/7776200/Den_Reinerkogel_umrunden.html | official_city_route_page | 2026-06-23 | Redaktionelle Demo-Location | 400 | low_or_in_app | pre_alpha_demo_only | Routenhinweise und leise Discovery testen. | Triggerpunkte muessen vor Ort definiert werden. |
| 22 | Plabutsch / Fuerstenstand-Route | Goesting / Plabutsch | Route / Wandergebiet | Freizeit & Bewegung | Aussichtspunkt / Natur | `real_demo_location` | https://www.graztourismus.at/de/erholung-freizeit-sport/spazieren-wandern/tour-uebersicht/gipfelwanderung-im-grazer-westen_td_6456 | official_tourism_page | 2026-06-23 | Redaktionelle Demo-Location | 600 | low_or_in_app | pre_alpha_demo_only | Aussicht-/Naturinteresse am Zonenrand testen. | Laengere Route, keine laute Notification. |
| 23 | Shopping Nord Rad-Garage | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Fahrrad / Service | `real_demo_location` | https://shoppingnord.at/rad-garage | official_center_service_page | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Unterwegs-Service fuer Radnutzer testen. | Als Center-Service, nicht als eigenstaendiger Partnerclaim. |
| 24 | Shopping Nord Bike-Reparaturstation | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Fahrrad / Reparatur | `real_demo_location` | https://shoppingnord.at/bike-reparaturstation | official_center_service_page | 2026-06-23 | Demo-Location, kein Partner | 200 | low_or_in_app | pre_alpha_demo_only | Akuten Service-Hinweis ohne Alarmismus testen. | Keine Funktions- oder Verfuegbarkeitsgarantie. |
| 25 | KLIPP Frisoer Graz-Andritz | Andritz | Am Arlandgrund 2, 8045 Graz | Services & Lokales | Friseur | `real_demo_location` | https://www.klipp.at/de/salonsuche/saloninfos/standort.graz-am-arlandgrund-2 | official_provider_location_page | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Service-Interesse im Andritz-Kern testen. | Keine Termin- oder Preisclaims. |
| 26 | SCHNITTIG! Graz-Andritz | Andritz | Grazer Strasse 45, 8045 Graz-Andritz | Services & Lokales | Friseur | `real_demo_location` | https://schnittig.at/graz-andritz/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Lokalen Friseurhinweis testen. | Keine Termin- oder Preisclaims. |
| 27 | KFZ Reinprecht | Goesting | Wiener Strasse 208, 8051 Graz-Goesting | Services & Lokales | Werkstatt / Reparatur | `real_demo_location` | https://www.kfz-reinprecht.at/ | official_provider_website | 2026-06-23 | Demo-Location, kein Partner | 400 | normal | pre_alpha_demo_only | Lokale Reparatur-/Servicekategorie testen. | Keine Leistungs- oder Verfuegbarkeitsclaims. |
| 28 | Bipa Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Drogerie | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Drogerie-Interesse im Center testen. | Keine Aktionen oder Produktverfuegbarkeit. |
| 29 | Marionnaud Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Parfuemerie / Beauty | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Beauty-/Shopping-Interesse testen. | Keine Rabatt- oder Produktclaims. |
| 30 | AP Biokosmetik Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Beauty / Kosmetik | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Kleine Spezialshop-Kategorie testen. | Keine Wirkversprechen oder Behandlungsclaims. |
| 31 | Roma Friseurbedarf Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Friseurbedarf | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Beauty-/Servicebedarf testen. | Keine Produkt- oder Aktionsclaims. |
| 32 | New York Nails Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Beauty / Nagelstudio | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 200 | normal | pre_alpha_demo_only | Beauty-Service-Hinweis testen. | Keine Termin-, Preis- oder Ergebnisclaims. |
| 33 | SK Trend Nails Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Beauty / Nagelstudio | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 200 | normal | pre_alpha_demo_only | Zweiten Beauty-Service im Center testen. | Keine Termin-, Preis- oder Ergebnisclaims. |
| 34 | Pearle Optik Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Gesundheit & Alltag | Optiker | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Optiker als neutralen Alltagsstandort testen. | Keine Gesundheits- oder Verfuegbarkeitsaussagen. |
| 35 | sehen!wutscher Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Gesundheit & Alltag | Optiker | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Alternative Optiker-Location testen. | Keine medizinischen Aussagen oder Angebote. |
| 36 | A1 Shop Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Mobile / Telekom | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Telekom-Serviceinteresse testen. | Keine Tarif- oder Verfuegbarkeitsclaims. |
| 37 | Drei Shop Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Mobile / Telekom | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Mobile-Service mit neutraler Sprache testen. | Keine Tarifclaims. |
| 38 | Magenta Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Mobile / Telekom | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Telekom-Kategorie im Center testen. | Keine Tarif-, Speed- oder Angebotsclaims. |
| 39 | Media Markt Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Elektro / Technik | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Technikinteresse und Center-Navigation testen. | Keine Preis- oder Produktverfuegbarkeit. |
| 40 | Gaschler Elektromarkt Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Elektro | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Elektro-/Nahversorgung im FMZ testen. | Keine Produktclaims. |
| 41 | HandyMeister Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Mobile / Reparatur | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 200 | normal | pre_alpha_demo_only | Reparaturinteresse unterwegs testen. | Keine Reparaturdauer oder Preis nennen. |
| 42 | Intersport Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Freizeit & Bewegung | Sport / Outdoor | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Sport-/Outdoorinteresse testen. | Keine Produkt- oder Aktionsclaims. |
| 43 | Injoy Fitnessstudio Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Freizeit & Bewegung | Fitness / Sport | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | low_or_in_app | pre_alpha_demo_only | Fitnessstandort neutral testen. | Keine Mitgliedschafts- oder Gesundheitsclaims. |
| 44 | Cube Store Graz Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Freizeit & Bewegung | Fahrrad / Outdoor | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Fahrradinteresse mit Center-Service kombinieren. | Keine Produktverfuegbarkeit. |
| 45 | Forstinger Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Autozubehoer / Service | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Auto-/Mobilitaetsinteresse testen. | Keine Preis- oder Serviceversprechen. |
| 46 | OBI Baumarkt Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Baumarkt / Werkzeug | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 400 | normal | pre_alpha_demo_only | Baumarktbedarf im Alltag testen. | Keine Produktverfuegbarkeit oder Aktionen. |
| 47 | Dexis Austria Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Werkzeug / Handel | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 350 | normal | pre_alpha_demo_only | Speziellen Werkzeug-/Handelsbedarf testen. | Keine Leistungs- oder Verfuegbarkeitsclaims. |
| 48 | Futterhaus Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Tierbedarf | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Tierbedarf als Alltagsinteresse testen. | Keine Produkt- oder Aktionsclaims. |
| 49 | Trafik Pratter Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Trafik / Nahversorgung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 200 | low_or_in_app | pre_alpha_demo_only | Kleinen Nahversorgungsstandort testen. | Keine Tabak-/Produktwerbung. |
| 50 | MISTER MINIT Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Reparatur / Service | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 200 | normal | pre_alpha_demo_only | Kurzservice-Interesse im Center testen. | Keine Reparaturdauer oder Preisclaims. |
| 51 | Putzerei & Schneiderei Norge Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Reinigung / Schneiderei | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 200 | normal | pre_alpha_demo_only | Reinigungs-/Aenderungsservice testen. | Keine Abhol- oder Bearbeitungsversprechen. |
| 52 | Salon Palmira Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Friseur | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 200 | normal | pre_alpha_demo_only | Friseur-Service im Center testen. | Keine Termin- oder Preisclaims. |
| 53 | Onkel Fade Barber-Shop Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Barber / Friseur | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 200 | normal | pre_alpha_demo_only | Serviceinteresse mit kurzer Distanz testen. | Keine Termin- oder Preisclaims. |
| 54 | LM Autoaufbereitung Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Autoaufbereitung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Auto-Service in FMZ-Lage testen. | Keine Leistungs- oder Verfuegbarkeitsclaims. |
| 55 | Spielefarm Indoor-Spielplatz Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Freizeit & Bewegung | Familie / Kinder | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | low_or_in_app | pre_alpha_demo_only | Familieninteresse im Center testen. | Keine Preise, Oeffnungszeiten oder Betreuungsaussagen. |
| 56 | TUI Das Reisebuero Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Services & Lokales | Reisebuero / Beratung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Beratungs-/Servicekategorie testen. | Keine Reiseangebote oder Preisclaims. |
| 57 | city-living Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Home / Wohnen | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Wohn-/Geschenkeinteresse testen. | Keine Produkt- oder Aktionsclaims. |
| 58 | Geschenkeparadies Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Geschenke | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Geschenkinteresse in Centerlage testen. | Keine Produktverfuegbarkeit. |
| 59 | Nanu-Nana Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Geschenke / Deko | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Deko-/Geschenkinteresse testen. | Keine Aktionsclaims. |
| 60 | Obendrauf Floristik Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Blumen / Geschenke | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Blumen-/Geschenkinteresse testen. | Keine Produkt- oder Verfuegbarkeitsclaims. |
| 61 | Woolworth Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Alltagswaren | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Breites Alltagswareninteresse testen. | Keine Preise oder Aktionen. |
| 62 | C&A Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Kleidungskategorie testen. | Keine Produkt- oder Rabattclaims. |
| 63 | H&M EG Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Modeinteresse mit Stockwerksinfo testen. | Keine Rabatt- oder Produktclaims. |
| 64 | H&M OG Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Center-interne Mehrfachstandorte testen. | Keine Rabatt- oder Produktclaims. |
| 65 | Fussl Modestrasse Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Mode-/Shoppinginteresse testen. | Keine Aktionen. |
| 66 | Bonita Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Modeinteresse fein granulieren. | Keine Rabattclaims. |
| 67 | Ernsting's family Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung / Familie | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Familien-/Kleidungskategorie testen. | Keine Produktverfuegbarkeit. |
| 68 | Takko Fashion Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Kleidung als normales Interesse testen. | Keine Aktionen oder Rabatte. |
| 69 | Tom Tailor Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Modeinteresse mit Distanzlogik testen. | Keine Produktclaims. |
| 70 | s.Oliver Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Modeinteresse testen. | Keine Rabatt- oder Produktclaims. |
| 71 | Segreto Moda Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Lokale Modeauswahl testen. | Keine Aktionsclaims. |
| 72 | Palmers Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Spezialhandel im Center testen. | Keine Produkt- oder Rabattclaims. |
| 73 | city-style Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Kleidung | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Kleineren Modeshop testen. | Keine Aktionsclaims. |
| 74 | Bijou Brigitte Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Schmuck / Geschenke | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Geschenk-/Schmuckinteresse testen. | Keine Produktverfuegbarkeit. |
| 75 | Juwelier Simon Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Schmuck | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Schmuck-/Geschenkinteresse testen. | Keine Preis- oder Produktclaims. |
| 76 | Shoe4You Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Schuhe | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Schuh-/Kleidungsinteresse testen. | Keine Aktionsclaims. |
| 77 | Faustmann Dankuechen Shopping Nord | Graz-Nord / Goesting | Shopping Nord, Wiener Strasse 351, 8051 Graz | Einkaufen & Nahversorgung | Wohnen / Kueche | `real_demo_location` | https://shoppingnord.at/shopfinder | official_center_shopfinder | 2026-06-23 | Demo-Location, kein Partner | 350 | low_or_in_app | pre_alpha_demo_only | Wohnen-/Beratungsinteresse testen. | Keine Beratungstermine oder Preisclaims. |
| 78 | Fischer Apotheke Gratwein | Gratwein-Strassengel | Bahnhofstrasse 3, 8112 Gratwein-Strassengel | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Gesundheitsstandort in Gratwein neutral testen. | Keine Bereitschafts-, Verfuegbarkeits- oder medizinischen Claims. |
| 79 | Flora Apotheke | Gratwein-Strassengel | Gratweiner Strasse 19, 8111 Gratwein-Strassengel | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Apothekenanker in 8111 testen. | Keine medizinischen Aussagen. |
| 80 | Pharmonta Dr. Fischer GmbH | Gratwein-Strassengel | Murfeldstrasse 8, 8112 Gratwein-Strassengel | Gesundheit & Alltag | Gesundheit / Betrieb | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | silent/admin_only | internal_planning_only | Gesundheitsnahen Betriebsstandort nur intern pruefen. | Keine medizinischen oder produktbezogenen Aussagen. |
| 81 | Raiffeisenbank RegionalCenter Gratwein | Gratwein-Strassengel | Bahnhofstrasse 22, 8112 Gratwein-Strassengel | Gesundheit & Alltag | Bankomat / Bank | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 200 | low_or_in_app | pre_alpha_demo_only | Alltags-/Bankstandort in Gratwein testen. | Keine Finanzberatung oder Produktclaims. |
| 82 | Steiermaerkische Sparkasse Judendorf | Gratwein-Strassengel | Hauptplatz 5, 8111 Gratwein-Strassengel | Gesundheit & Alltag | Bankomat / Bank | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 200 | low_or_in_app | pre_alpha_demo_only | Alltagspunkt am Hauptplatz testen. | Keine Finanzproduktclaims. |
| 83 | Tabaktrafik Senekowitsch | Gratwein-Strassengel | Gratweiner Strasse 2, 8111 Gratwein-Strassengel | Einkaufen & Nahversorgung | Trafik | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 200 | low_or_in_app | pre_alpha_demo_only | Kleinen Nahversorgungspunkt testen. | Keine Tabak-/Produktwerbung. |
| 84 | Tabak-Trafik Thalhammer | Gratwein-Strassengel | Bahnhofstrasse 32, 8112 Gratwein-Strassengel | Einkaufen & Nahversorgung | Trafik | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 200 | low_or_in_app | pre_alpha_demo_only | Nahversorgung nahe Bahnhof testen. | Keine Tabak-/Produktwerbung. |
| 85 | Gemeindeamt Gratwein-Strassengel | Gratwein-Strassengel | Hauptplatz 1, 8111 Gratwein-Strassengel | Services & Lokales | Buergerdienst / Gemeinde | `real_demo_location` | https://gratwein-strassengel.gv.at/ | official_municipal_website | 2026-06-23 | Demo-Location, kein Partner | 250 | low_or_in_app | pre_alpha_demo_only | Buergerdienst-Standort und Kartenroute testen. | Keine Amtszeiten oder Verfahrensversprechen uebernehmen. |
| 86 | Community Nurse Gratwein-Strassengel | Gratwein-Strassengel | Rein 5, 8103 Gratwein-Strassengel | Gesundheit & Alltag | Community Service | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | silent/admin_only | internal_planning_only | Gesundheitsnahen Gemeinde-Service nur sehr neutral pruefen. | Sensibler Bereich, keine medizinischen Aussagen. |
| 87 | Baeckerei Cafe Leitner | Gratwein-Strassengel | Gratweiner Strasse 23, 8111 Gratwein-Strassengel | Essen & Trinken | Baeckerei / Cafe | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Kaffee-/Baeckereiinteresse in 8111 testen. | Keine Produkt- oder Oeffnungsclaims. |
| 88 | Baeckerei Konditorei Cafe Julius Kern Gratwein | Gratwein-Strassengel | Murfeldstrasse 6, 8112 Gratwein-Strassengel | Essen & Trinken | Baeckerei / Cafe | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Baeckereiinteresse in Gratwein testen. | Keine Produkt- oder Aktionsclaims. |
| 89 | Baeckerei Franz Pfleger Filiale Gratwein | Gratwein-Strassengel | Bahnhofstrasse 22-24, 8112 Gratwein-Strassengel | Essen & Trinken | Baeckerei | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Bahnhofsnahes Baeckerei-Matching testen. | Keine Oeffnungszeiten oder Produktversprechen. |
| 90 | Cafe Haeferl | Gratwein-Strassengel | Hauptplatz 5, 8112 Gratwein-Strassengel | Essen & Trinken | Cafe | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Cafe-/Pause-Interesse am Hauptplatz testen. | Keine Angebote oder Veranstaltungen erfinden. |
| 91 | Cafe PORTO | Gratwein-Strassengel | Murfeldstrasse 10, 8112 Gratwein-Strassengel | Essen & Trinken | Cafe / Bar | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Cafe-/Bar-Standort neutral testen. | Keine Event- oder Oeffnungsclaims. |
| 92 | CLICK CLACK coffee & kitchen | Gratwein-Strassengel | Bahnhofplatz 5, 8112 Gratwein-Strassengel | Essen & Trinken | Cafe / Restaurant | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Kaffee-/Mittagesseninteresse in Bahnhofslage testen. | Keine Tagesangebote oder Preise. |
| 93 | Gasthaus Absenger | Gratwein-Strassengel | Schirning 65, 8112 Gratwein-Strassengel | Essen & Trinken | Gasthaus / Regionales Essen | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 400 | normal | pre_alpha_demo_only | Regionalgastronomie am Rand testen. | Keine Oeffnungs- oder Tischclaims. |
| 94 | Kirchenwirt Maria Strassengel | Gratwein-Strassengel | Am Kirchberg 18, 8111 Gratwein-Strassengel | Essen & Trinken | Gasthaus / Restaurant | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Gastro-Hinweis nahe Kulturpunkt testen. | Keine Speisen-, Preis- oder Verfuegbarkeitsclaims. |
| 95 | Gasthaus Pleschwirt | Gratwein-Strassengel | Plesch 102, 8103 Gratwein-Strassengel | Essen & Trinken | Gasthaus / Ausflug | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 500 | low_or_in_app | pre_alpha_demo_only | Ausflugs-/Wanderkontext testen. | Nur bei passender Route und Naehe. |
| 96 | Restaurant Fischerwirt | Gratwein-Strassengel | Bahnhofstrasse 40, 8112 Gratwein-Strassengel | Essen & Trinken | Restaurant / Gasthaus | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Bahnhofsnahes Gastronomie-Matching testen. | Keine Angebots- oder Verfuegbarkeitsclaims. |
| 97 | Pizzeria Kunst + Kulturkeller | Gratwein-Strassengel | Schulstrasse 1, 8111 Gratwein-Strassengel | Essen & Trinken | Restaurant / Kulturort | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Gastro- und Kulturinteresse kombinieren. | Keine aktuellen Events erfinden. |
| 98 | Cafe-Restaurant-Pizzeria CUUK | Gratwein-Strassengel | Grazer Strasse 45, 8111 Gratwein-Strassengel | Essen & Trinken | Restaurant / Pizzeria | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 250 | normal | pre_alpha_demo_only | Essen-in-der-Naehe-Matching testen. | Keine Preise oder Speisenclaims. |
| 99 | Stiftstaverne Rein | Gratwein-Strassengel | Rein 4, 8103 Gratwein-Strassengel | Essen & Trinken | Ausflugsgastronomie | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 400 | low_or_in_app | pre_alpha_demo_only | Gastronomie nahe Kultur-/Wanderziel testen. | Keine Oeffnungs- oder Angebotsclaims. |
| 100 | Erlebnisbad Weihermuehle | Gratwein-Strassengel | Tallak 59, 8112 Gratwein-Strassengel | Freizeit & Bewegung | Schwimmbad / Familie | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 400 | low_or_in_app | pre_alpha_demo_only | Familien-/Freizeitort mit Route und Arrival testen. | Keine Saison-, Preis- oder Oeffnungsclaims. |
| 101 | Basketballplatz Schulzentrum Gratwein | Gratwein-Strassengel | Areal der Schulen, OT Gratwein | Freizeit & Bewegung | Sportplatz | `real_demo_location` | https://gratwein-strassengel.gv.at/sport-freizeit | official_municipal_page | 2026-06-23 | Redaktionelle Demo-Location | 250 | low_or_in_app | pre_alpha_demo_only | Niederschwelligen Sportpunkt testen. | Vor Ort Lage und Nutzungsbedingungen pruefen. |
| 102 | Pralatenweg Rein | Gratwein-Strassengel | OT Eisbach-Rein, Route | Freizeit & Bewegung | Spaziergang / Wanderweg | `real_demo_location` | https://gratwein-strassengel.gv.at/informationen/wanderwege | official_municipal_route_page | 2026-06-23 | Redaktionelle Demo-Location | 500 | low_or_in_app | pre_alpha_demo_only | Routen-/Wanderinteresse ohne Anbieter testen. | Triggerpunkte spaeter definieren. |
| 103 | Ulrichsbergrunde | Gratwein-Strassengel | OT Eisbach-Rein, Route | Freizeit & Bewegung | Wanderweg / Natur | `real_demo_location` | https://gratwein-strassengel.gv.at/informationen/wanderwege | official_municipal_route_page | 2026-06-23 | Redaktionelle Demo-Location | 500 | low_or_in_app | pre_alpha_demo_only | Natur- und Bewegungshinweis testen. | Keine Sicherheits- oder Wetterannahmen. |
| 104 | Wallfahrtskirche Maria Strassengel | Gratwein-Strassengel | Kirchberg, 8111 Gratwein-Strassengel | Kultur & Events | Kirche / Kulturort | `real_demo_location` | https://gratwein-strassengel.gv.at/tourismus | official_municipal_tourism_page | 2026-06-23 | Redaktionelle Demo-Location | 300 | low_or_in_app | pre_alpha_demo_only | Kultur-/Landmark-Hinweis in 8111 testen. | Keine Gottesdienst- oder Eventzeiten erfinden. |
| 105 | Stift Rein | Gratwein-Strassengel | Rein, 8103 Gratwein-Strassengel | Kultur & Events | Stift / Kulturort | `real_demo_location` | https://gratwein-strassengel.gv.at/tourismus | official_municipal_tourism_page | 2026-06-23 | Redaktionelle Demo-Location | 500 | low_or_in_app | pre_alpha_demo_only | Kultur- und Ausflugsziel testen. | Keine Fuehrungs-, Preis- oder Oeffnungsclaims. |
| 106 | Kunstzug Gratwein | Gratwein-Strassengel | OT Gratwein, genaue Lage vor Import pruefen | Kultur & Events | Kunst im oeffentlichen Raum | `real_demo_location` | https://gratwein-strassengel.gv.at/tourismus | official_municipal_tourism_page | 2026-06-23 | Redaktionelle Demo-Location | 250 | low_or_in_app | pre_alpha_demo_only | Oeffentlichen Kulturpunkt testen. | Lage vor Ort oder per offizieller Karte nachziehen. |
| 107 | Zweirad Janger | Gratwein-Strassengel | Kirchengasse 4, 8112 Gratwein-Strassengel | Services & Lokales | Fahrradhandel / Werkstaette | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 300 | normal | pre_alpha_demo_only | Fahrradservice in Gratwein testen. | Keine Reparaturdauer oder Preisclaims. |
| 108 | Michis Custom Colour | Gratwein-Strassengel | Gewerbepark 7a, 8111 Gratwein-Strassengel | Services & Lokales | KFZ-Werkstatt / Lackiererei | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 350 | normal | pre_alpha_demo_only | KFZ-Servicekategorie testen. | Keine Leistungs- oder Verfuegbarkeitsclaims. |
| 109 | Karosseriebau Kottnig | Gratwein-Strassengel | Grazer Strasse 87, 8111 Gratwein-Strassengel | Services & Lokales | KFZ-Werkstatt / Spenglerei | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 350 | normal | pre_alpha_demo_only | Werkstattinteresse im 8111-Gebiet testen. | Keine Termin-, Preis- oder Leistungsclaims. |
| 110 | Fahrschule Gratwein | Gratwein-Strassengel | Murfeldstrasse 6, 8112 Gratwein-Strassengel | Services & Lokales | Fahrschule / lokaler Service | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | official_municipal_business_directory | 2026-06-23 | Demo-Location, kein Partner | 300 | low_or_in_app | pre_alpha_demo_only | Lokalen Service ohne Dringlichkeit testen. | Keine Kurs-, Preis- oder Terminclaims. |

## 6. Nicht oeffentlich so formulieren

Verbotene Claim-Beispiele:

- "Offizieller StepsMatch-Partner"
- "Heute 20 % Rabatt"
- "Jetzt geoeffnet"
- "Sofort verfuegbar"
- "Nur heute guenstiger"
- "Diese Apotheke hilft dir bei deinem konkreten Problem"
- "Der Arzt in deiner Naehe behandelt dich sofort"
- "Garantiert freie Termine"
- "Von StepsMatch empfohlen"
- "Exklusives Angebot fuer dich"
- "Bestes Restaurant in deiner Naehe"
- "Hier bekommst du sicher genau dieses Produkt"

## 7. Sichere Demo-Textvorlagen

Diese Vorlagen sind neutral und koennen spaeter als Ausgangspunkt dienen:

```text
Demo-Hinweis: realer Ort in deiner Naehe, kein offizieller StepsMatch-Partner.
```

```text
Dieser Standort ist fuer den Pre-Alpha-Test vorgemerkt. Es wird kein Angebot und keine Kooperation behauptet.
```

```text
Neutraler Hinweis fuer dein ausgewaehltes Interesse in der Umgebung.
```

```text
Redaktioneller Ort fuer Karte, Route und Arrival-Test.
```

```text
Demo-Location fuer die Feldtest-Auswertung. Bitte pruefe vor Ort, ob der Hinweis hilfreich war.
```

## 8. Spaetere Importfaehigkeit

Die Tabelle ist bewusst nah an einer spaeteren Importstruktur gehalten. Vor einer echten Datenbefuellung sollten die Felder in ein Importformat ueberfuehrt werden, ohne in diesem Dokument Code, Scripts oder Datenbankaktionen auszufuehren.

Fachlich zu mappen:

- `name`
- `gebiet`
- `adresse_or_location`
- `category`
- `subcategory`
- `contentType`
- `sourceUrl`
- `sourceType`
- `sourceVerifiedAt`
- `demoLabel`
- `suggestedRadiusMeters`
- `suggestedPushPriority`
- `publicVisibility`
- `testUseCase`
- `riskNote`

Vor Import zusaetzlich noetig:

- eindeutige interne ID
- Geokoordinaten aus sicherer Quelle oder manueller Pruefung
- Consent-/Freigabestatus, falls spaeter oeffentlich oder angebotsnah
- finale Sichtbarkeitslogik
- Push-Frequenzgrenzen
- Kategorie-/Subkategorie-Abgleich mit App und Backend
- Demo-Disclaimer pro Content-Typ

## 9. Risiken vor DB-Befuellung

- Quellen koennen sich aendern; vor Import erneut pruefen.
- Adressen aus Center- oder Gemeindequellen muessen bei kritischen Eintraegen gegen offizielle Betreiberseiten oder Vor-Ort-Pruefung abgeglichen werden.
- Shopping-Nord-Eintraege duerfen nicht als Zustimmung einzelner Shops verstanden werden.
- Gesundheitseintraege bleiben besonders sensibel; keine medizinischen Aussagen und keine high-attention-Pushes im Seed.
- Oeffentliche Orte und Routen brauchen vor Ort definierte Triggerpunkte.
- Saisonale Orte wie Baeder oder Ausflugsziele duerfen nicht mit Oeffnungs- oder Nutzungsversprechen ausgespielt werden.
- Gratwein-Strassengel-Eintraege aus Gemeinde-/Wirtschaftsseiten sind reale Standortkandidaten, aber nicht automatisch fuer aktive App-Ausspielung freigegeben.
- Bei einer spaeteren App-Anzeige muss das Demo-Label klarer sein als normale Angebotskommunikation.
- Zu viele `normal`-Pushes koennen Spam-Wahrnehmung erzeugen; der Import muss Rate Limits und Prioritaeten erzwingen.
- Keine Logos, Bilder oder fremde Texte uebernehmen.

## 10. Umfang und Verteilung

Dieser Seed enthaelt 110 reale Demo-Datensaetze.

Geografische Verteilung:

- 77 Eintraege Graz-Nord / Goesting / Andritz
- 33 Eintraege Gratwein-Strassengel und direkte Umgebung

Kategorieverteilung:

- Essen & Trinken: 21
- Einkaufen & Nahversorgung: 38
- Gesundheit & Alltag: 12
- Freizeit & Bewegung: 12
- Kultur & Events: 3
- Ruhe & Pause: 1
- Services & Lokales: 23

Push-Prioritaet:

- `normal`: fuer neutrale Gastro-, Nahversorgungs- und Servicehinweise
- `low_or_in_app`: fuer Gesundheit, oeffentliche Orte, Kultur, Routen und weniger dringliche Services
- `silent/admin_only`: fuer unsichere oder sensible Pruefkandidaten
- `high_attention`: in diesem Seed bewusst nicht verwendet
