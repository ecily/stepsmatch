# StepsMatch Pitch Demo Curated Match Model V1

Stand: 2026-06-23

## 1. Kurzentscheidung

Die 110 Datensaetze aus `docs/STEPSMATCH_DEMO_MARKET_SEED_GRAZ_NORD_V1.md` sind Rohmaterial. Sie werden nicht blind importiert und nicht automatisch aktiv geschaltet.

Fuer den Pitch wird daraus ein kuratiertes aktives Demo-Set abgeleitet. StepsMatch braucht dafuer zwei Ebenen:

- `DemoLocation`: realer Ort, Anbieter, oeffentlicher Ort oder Servicepunkt.
- `MatchableDemoContent`: matchbarer Inhalt zu einer DemoLocation.

StepsMatch ist kein Branchenverzeichnis. Ein Treffer entsteht nur, wenn Interesse, Radius, Zeitfenster, geografische Gueltigkeit, Sichtbarkeit, Aktivstatus, Push-Regeln und Dedupe/Cooldown zusammenpassen.

## 2. Warum nicht alle 110 sofort aktiv?

Alle 110 Seed-Datensaetze sofort aktiv zu setzen waere fachlich falsch:

- Zu viel Push-Laerm: Viele Standorte sind real, aber nicht jeder rechtfertigt aktive Benachrichtigung.
- Unklare Relevanz: Manche Eintraege sind fuer Marktdichte gut, aber nicht fuer einen konkreten Match.
- Unterschiedliche Quellenqualitaet: Center- und Gemeindequellen sind brauchbar, aber nicht gleich stark wie direkte Anbieterfreigaben.
- Ungleichmaessige Kategorienverteilung: Nahversorgung und Shopping sind stark, Ruhe & Pause sowie Kultur & Events sind schwach.
- Branchenverzeichnis-Risiko: Wenn alles sichtbar ist, wirkt StepsMatch wie eine Liste von Betrieben statt wie ein Matching-Produkt.
- Review-Bedarf: Einige Eintraege gehoeren zunaechst auf `silent_admin_only` oder `needs_review_before_import`.

Der Pitch braucht kontrollierte Relevanz, nicht maximale Masse.

## 3. Zielbild fuer Pitch-Demo v1

Fuer Pitch-Demo v1 gilt:

- 40-60 sichtbare oder kontrolliert sichtbare `DemoLocation`-Eintraege.
- 20-30 `MatchableDemoContent`-Eintraege.
- Schwerpunkt Graz-Nord / Goesting / Andritz.
- Gratwein-Strassengel sichtbar vertreten.
- Keine `high_attention` Pushes.
- Viele Inhalte nur `low_or_in_app`.
- Wenige, gut begruendete Inhalte mit `normal`.
- Keine echten Angebotsclaims, keine Preise, keine Rabatte, keine Oeffnungszeiten, keine Verfuegbarkeit, keine Logos und keine Partnerclaims.

## 4. Datenebene A: DemoLocation

`DemoLocation` beschreibt einen realen Ort oder Servicepunkt. Diese Ebene ist relativ stabil und kann dauerhaft existieren, auch wenn gerade kein Inhalt aktiv matchbar ist.

Felder fuer spaetere Importfaehigkeit:

- `locationKey`: stabiler technischer Schluessel, z. B. `loc_andritz_bartl`.
- `name`: sichtbarer Name des Orts.
- `gebiet`: fachliches Gebiet fuer Demo- und KPI-Auswertung.
- `addressOrLocation`: Adresse oder grobe Lage.
- `coordinatesStatus`: `known`, `needs_lookup`, `approximate`.
- `category`: Hauptkategorie aus der urbanen Taxonomie.
- `subcategory`: fachliche Unterkategorie.
- `contentType`: `real_demo_location`, `editorial_public_place`, `official_test_provider`, `demo_provider`.
- `sourceUrl`: belegende Quelle.
- `sourceType`: z. B. `official_provider_website`, `official_center_shopfinder`, `official_municipal_page`.
- `sourceVerifiedAt`: Datum der Quellenpruefung.
- `demoLabel`: klares Demo-/Nicht-Partner-Label.
- `baseRadiusMeters`: Basisradius des Orts, nicht zwingend Content-Radius.
- `publicVisibility`: `active_public_demo`, `in_app_only_demo`, `silent_admin_only`, `needs_review_before_import`, `do_not_import_v1`.
- `riskNote`: rechtlicher, fachlicher oder operativer Hinweis.

`baseRadiusMeters` ist nur ein Standortwert. Matchbare Inhalte duerfen kleinere oder groessere Radien haben.

## 5. Datenebene B: MatchableDemoContent

`MatchableDemoContent` beschreibt den eigentlichen matchbaren Inhalt. Diese Ebene ist zeitlich und fachlich steuerbar.

Felder fuer spaetere Importfaehigkeit:

- `contentKey`: stabiler technischer Schluessel, z. B. `cnt_bartl_kaffee_pause_v1`.
- `locationKey`: Verweis auf `DemoLocation`.
- `title`: kurzer neutraler Titel.
- `demoCardText`: sichere Pre-Alpha-/Demo-Formulierung.
- `contentKind`: `neutral_hint`, `editorial_hint`, `demo_offer_without_claim`, `service_hint`, `pause_hint`, `event_placeholder_without_date_claim`.
- `interestKeys`: fachliche Interessen, z. B. `coffee_pause`, `nearby_food`, `daily_needs`.
- `category`: Hauptkategorie.
- `subcategory`: Unterkategorie.
- `validFrom`: Beginn der fachlichen Gueltigkeit.
- `validTo`: Ende der fachlichen Gueltigkeit.
- `activeDays`: erlaubte Wochentage oder `all`.
- `activeTimeWindows`: erlaubte Zeitfenster oder `none`.
- `geoValidity`: `point_radius`, `area_candidate`, `route_candidate`.
- `radiusMeters`: Matchradius dieses Inhalts.
- `providerCanEditRadius`: ob Anbieter spaeter den Radius steuern darf.
- `providerCanEditValidity`: ob Anbieter spaeter Laufzeit/Zeitfenster steuern darf.
- `suggestedPushPriority`: `normal`, `low_or_in_app`, `silent/admin_only`.
- `pushEligibility`: `eligible_normal`, `in_app_only`, `suppressed_for_pitch`.
- `cooldownSuggestionHours`: empfohlener Mindestabstand fuer erneute Benachrichtigung.
- `matchReason`: erwartete fachliche Match-Erklaerung.
- `whyGoodForPitch`: Pitch-Nutzen.
- `riskNote`: Grenzen, Pruefbedarf, verbotene Claims.

Provider-editierbare Felder muessen spaeter in der Anbieter-UX klar markiert werden. Radius und Laufzeit duerfen nie bedeuten, dass ein Inhalt ausserhalb Gueltigkeit oder ausserhalb Radius angezeigt oder gepusht wird.

## 6. Curated DemoLocation Set

Dieses Set enthaelt 50 DemoLocations aus dem 110er Seed. Es ist kuratiert fuer Pitch-Demo v1 und nicht identisch mit einem finalen Import.

| locationKey | name | gebiet | category | subcategory | contentType | sourceUrl | publicVisibility | baseRadiusMeters | whyGoodForPitch | riskNote |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| loc_andritz_bartl | Baeckerei Konditorei Bartl Graz Andritz | Andritz | Essen & Trinken | Baeckerei / Cafe | `real_demo_location` | https://baeckerei-bartl.at/filialen/ | active_public_demo | 250 | Klarer Kaffee-/Snack-Anker im Andritz-Kern. | Kein Partnerclaim, keine Produkte/Oeffnungszeiten. |
| loc_andritz_kern | Baeckerei Kern Andritz | Andritz | Essen & Trinken | Baeckerei / Snack | `real_demo_location` | https://baeckerei-kern.at/filialen | active_public_demo | 250 | Zweiter alltagsnaher Morgen-/Pause-Ort. | Keine Aktionen oder Produktclaims. |
| loc_andritz_andritzer_hof | Cafe Restaurant Andritzer Hof | Andritz | Essen & Trinken | Restaurant / Cafe | `real_demo_location` | https://andritzerhof.eatbu.com/ | in_app_only_demo | 300 | Lokaler Gastroanker fuer Mittag/Abend ohne Deal-Logik. | Adresse vor Import nochmals pruefen. |
| loc_andritz_johanneshof | Johanneshof Andritz | Andritz | Essen & Trinken | Regionales Essen | `real_demo_location` | https://www.johanneshof-andritz.at/ | in_app_only_demo | 400 | Regionaler Freizeit-/Abendkontext. | Keine Speisen- oder Verfuegbarkeitsclaims. |
| loc_shopping_nord | Shopping Nord | Graz-Nord / Goesting | Einkaufen & Nahversorgung | Center / Nahversorgung | `real_demo_location` | https://www.shoppingnord.at/ | active_public_demo | 500 | Zentraler Pitch-Anker fuer Dichte, Karte und Wege. | Center ist kein Einzelshop-Partnerclaim. |
| loc_sn_billa_plus | Billa Plus Shopping Nord | Graz-Nord / Goesting | Einkaufen & Nahversorgung | Lebensmittel | `real_demo_location` | https://shoppingnord.at/shopfinder | active_public_demo | 300 | Starker Nahversorgungs-Match. | Keine Preise/Aktionen. |
| loc_sn_billa_marktkueche | Billa Marktkueche Shopping Nord | Graz-Nord / Goesting | Essen & Trinken | Snack / Mittagessen | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 250 | Essensinteresse im Center ohne Restaurantclaim. | Keine Tagesmenues. |
| loc_sn_martin_auer | Martin Auer Shopping Nord | Graz-Nord / Goesting | Essen & Trinken | Baeckerei / Cafe | `real_demo_location` | https://shoppingnord.at/shopfinder | active_public_demo | 250 | Kaffee-/Pause-Anker im Center. | Keine Produktclaims. |
| loc_sn_brezen_wagner | Brezenstand Wagner Shopping Nord | Graz-Nord / Goesting | Essen & Trinken | Snack / Imbiss | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 200 | Kurzer Snack-Hinweis mit kleinem Radius. | Keine Preis- oder Angebotsclaims. |
| loc_sn_apotheke | Apotheke Graz Shopping Nord | Graz-Nord / Goesting | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://www.apotheke-graz-nord.at/ | in_app_only_demo | 250 | Gesundheitsstandort sichtbar, aber leise. | Keine medizinischen Aussagen. |
| loc_goesting_janus | Janus-Apotheke | Goesting | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://janus-apotheke.at/ | in_app_only_demo | 250 | Gesundheitsanker in Goesting. | Keine Notdienst-/Verfuegbarkeitsclaims. |
| loc_andritz_apotheke | Apotheke Andritz | Andritz | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://www.apotheke-andritz.at/ | in_app_only_demo | 250 | Gesundheitsanker im Andritz-Kern. | Maximal sachlich anzeigen. |
| loc_andritz_st_josef | St. Josef Apotheke Andritz | Andritz | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://josef-apotheke.at/ | in_app_only_demo | 250 | Zweiter Andritz-Gesundheitspunkt. | Keine medizinischen Claims. |
| loc_goesting_dm | dm drogerie markt Wiener Strasse | Goesting / Graz-Nord | Einkaufen & Nahversorgung | Drogerie | `real_demo_location` | https://www.dm.at/store/a09f/graz/wiener-strasse-286 | active_public_demo | 300 | Alltagsbedarf ausserhalb Shopping Nord. | Keine Produkt-/Aktionspushes. |
| loc_andritz_gruber_hofladen | Gruber-Hofladen | Andritz / nahe Umgebung | Einkaufen & Nahversorgung | Hofladen / Regional | `real_demo_location` | https://www.genussregionen.at/de/betrieb/gruber-hofladen | in_app_only_demo | 400 | Regionales Interesse und Randlage. | Lage und Quelle vor Import pruefen. |
| loc_stukitzbad | Stukitzbad / Stukitzsauna | Andritz | Freizeit & Bewegung | Familie / Sport | `editorial_public_place` | https://www.holding-graz.at/de/freizeit/stukitzbad/ | in_app_only_demo | 300 | Guter Freizeit- und Arrival-Testpunkt. | Keine Preise, Saison oder Oeffnungszeiten. |
| loc_ruine_goesting | Ruine Goesting / Jungfernsprung | Goesting | Freizeit & Bewegung | Aussichtspunkt / Spaziergang | `editorial_public_place` | https://www.graz.at/cms/beitrag/10161901/7776290/Ruine_Goesting.html | active_public_demo | 300 | Starker redaktioneller Ort fuer Route/Arrival. | Sperren/Sicherheit vor Feldtest pruefen. |
| loc_thalersee | Thalersee | Goesting / Thal | Ruhe & Pause | Naturpunkt / Naherholung | `editorial_public_place` | https://www.graz.at/cms/beitrag/10161896/7776290/Thalersee.html | in_app_only_demo | 600 | Einziger starker Ruhe-/Pause-Anker. | Nur bei passender Naehe. |
| loc_reinerkogel | Reinerkogel-Runde | Andritz-nah | Freizeit & Bewegung | Spaziergang / Natur | `editorial_public_place` | https://www.graz.at/cms/beitrag/10255533/7776200/Den_Reinerkogel_umrunden.html | in_app_only_demo | 400 | Route statt Branche, zeigt Produktkern. | Triggerpunkte fehlen. |
| loc_plabutsch | Plabutsch / Fuerstenstand-Route | Goesting / Plabutsch | Freizeit & Bewegung | Aussichtspunkt / Natur | `editorial_public_place` | https://www.graztourismus.at/de/erholung-freizeit-sport/spazieren-wandern/tour-uebersicht/gipfelwanderung-im-grazer-westen_td_6456 | in_app_only_demo | 600 | Aussicht/Naherholung fuer Spezialwege. | Laengere Route, kein Push-Laerm. |
| loc_sn_radgarage | Shopping Nord Rad-Garage | Graz-Nord / Goesting | Services & Lokales | Fahrrad / Service | `real_demo_location` | https://shoppingnord.at/rad-garage | in_app_only_demo | 250 | Praxistauglicher Unterwegs-Service. | Center-Service neutral formulieren. |
| loc_sn_bike_station | Shopping Nord Bike-Reparaturstation | Graz-Nord / Goesting | Services & Lokales | Fahrrad / Reparatur | `real_demo_location` | https://shoppingnord.at/bike-reparaturstation | in_app_only_demo | 200 | Service-Hilfe ohne Anbieterwerbung. | Keine Funktionsgarantie. |
| loc_andritz_klipp | KLIPP Frisoer Graz-Andritz | Andritz | Services & Lokales | Friseur | `real_demo_location` | https://www.klipp.at/de/salonsuche/saloninfos/standort.graz-am-arlandgrund-2 | in_app_only_demo | 250 | Servicekategorie im Alltag. | Keine Termin-/Preisclaims. |
| loc_andritz_schnittig | SCHNITTIG! Graz-Andritz | Andritz | Services & Lokales | Friseur | `real_demo_location` | https://schnittig.at/graz-andritz/ | in_app_only_demo | 250 | Lokaler Service ausserhalb Center. | Keine Terminclaims. |
| loc_goesting_kfz_reinprecht | KFZ Reinprecht | Goesting | Services & Lokales | Werkstatt / Reparatur | `real_demo_location` | https://www.kfz-reinprecht.at/ | in_app_only_demo | 400 | Werkstattkategorie fuer lokale Services. | Keine Leistungs-/Verfuegbarkeitsclaims. |
| loc_sn_bipa | Bipa Shopping Nord | Graz-Nord / Goesting | Einkaufen & Nahversorgung | Drogerie | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 250 | Zweite Drogerie/Nahversorgung im Center. | Keine Aktionen. |
| loc_sn_pearl | Pearle Optik Shopping Nord | Graz-Nord / Goesting | Gesundheit & Alltag | Optiker | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 250 | Alltag/Gesundheit ohne medizinischen Claim. | Keine Gesundheitsversprechen. |
| loc_sn_intersport | Intersport Shopping Nord | Graz-Nord / Goesting | Freizeit & Bewegung | Sport / Outdoor | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 300 | Sportinteresse im Center. | Keine Produktverfuegbarkeit. |
| loc_sn_injoy | Injoy Fitnessstudio Shopping Nord | Graz-Nord / Goesting | Freizeit & Bewegung | Fitness / Sport | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 300 | Bewegungskategorie ausserhalb oeffentlicher Orte. | Keine Gesundheits- oder Mitgliedschaftsclaims. |
| loc_sn_cube | Cube Store Graz Shopping Nord | Graz-Nord / Goesting | Freizeit & Bewegung | Fahrrad / Outdoor | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 300 | Fahrradinteresse mit Service-Logik. | Keine Produktclaims. |
| loc_sn_futterhaus | Futterhaus Shopping Nord | Graz-Nord / Goesting | Einkaufen & Nahversorgung | Tierbedarf | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 300 | Tierbedarf als alltagsnahes Interesse. | Keine Aktionen. |
| loc_sn_mister_minit | MISTER MINIT Shopping Nord | Graz-Nord / Goesting | Services & Lokales | Reparatur / Service | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 200 | Kurzservice mit kleinem Radius. | Keine Dauer-/Preisclaims. |
| loc_sn_spielefarm | Spielefarm Indoor-Spielplatz Shopping Nord | Graz-Nord / Goesting | Freizeit & Bewegung | Familie / Kinder | `real_demo_location` | https://shoppingnord.at/shopfinder | in_app_only_demo | 300 | Familieninteresse fuer Pitch sichtbar. | Keine Betreuungs-/Oeffnungsclaims. |
| loc_gratwein_fischer_apotheke | Fischer Apotheke Gratwein | Gratwein-Strassengel | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | in_app_only_demo | 250 | Gratwein-Gesundheitsanker. | Keine medizinischen Aussagen. |
| loc_gratwein_flora | Flora Apotheke | Gratwein-Strassengel | Gesundheit & Alltag | Apotheke | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | in_app_only_demo | 250 | 8111 sichtbar vertreten. | Keine Verfuegbarkeitsclaims. |
| loc_gratwein_gemeindeamt | Gemeindeamt Gratwein-Strassengel | Gratwein-Strassengel | Services & Lokales | Buergerdienst / Gemeinde | `real_demo_location` | https://gratwein-strassengel.gv.at/ | in_app_only_demo | 250 | Buergerdienst als lokaler Service. | Keine Amtszeiten/Verfahren versprechen. |
| loc_gratwein_baeckerei_leitner | Baeckerei Cafe Leitner | Gratwein-Strassengel | Essen & Trinken | Baeckerei / Cafe | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | active_public_demo | 250 | Kaffee-/Pause-Ort in 8111. | Keine Produktclaims. |
| loc_gratwein_cafe_haeferl | Cafe Haeferl | Gratwein-Strassengel | Essen & Trinken | Cafe | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | in_app_only_demo | 250 | Hauptplatz-Pause in Gratwein. | Keine Angebote/Events erfinden. |
| loc_gratwein_click_clack | CLICK CLACK coffee & kitchen | Gratwein-Strassengel | Essen & Trinken | Cafe / Restaurant | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | active_public_demo | 250 | Bahnhofsnaher Kaffee-/Food-Anker. | Keine Tagesangebote. |
| loc_gratwein_kirchenwirt | Kirchenwirt Maria Strassengel | Gratwein-Strassengel | Essen & Trinken | Gasthaus / Restaurant | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | in_app_only_demo | 300 | Gastro nahe Kulturort. | Keine Speisen-/Verfuegbarkeitsclaims. |
| loc_gratwein_fischerwirt | Restaurant Fischerwirt | Gratwein-Strassengel | Essen & Trinken | Restaurant / Gasthaus | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | in_app_only_demo | 300 | Bahnhofsnahes Essen-in-der-Naehe. | Keine Angebotsclaims. |
| loc_gratwein_cuuk | Cafe-Restaurant-Pizzeria CUUK | Gratwein-Strassengel | Essen & Trinken | Restaurant / Pizzeria | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | in_app_only_demo | 250 | Essen & Trinken in 8111 sichtbar. | Keine Preise/Speisenclaims. |
| loc_gratwein_erlebnisbad | Erlebnisbad Weihermuehle | Gratwein-Strassengel | Freizeit & Bewegung | Schwimmbad / Familie | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | in_app_only_demo | 400 | Familien-/Freizeitanker in Gratwein. | Keine Saison-/Oeffnungsclaims. |
| loc_gratwein_basketball | Basketballplatz Schulzentrum Gratwein | Gratwein-Strassengel | Freizeit & Bewegung | Sportplatz | `editorial_public_place` | https://gratwein-strassengel.gv.at/sport-freizeit | in_app_only_demo | 250 | Niederschwelliger Bewegungsort. | Vor Ort pruefen. |
| loc_gratwein_pralatenweg | Pralatenweg Rein | Gratwein-Strassengel | Freizeit & Bewegung | Spaziergang / Wanderweg | `editorial_public_place` | https://gratwein-strassengel.gv.at/informationen/wanderwege | in_app_only_demo | 500 | Route statt Branchenlogik. | Triggerpunkte fehlen. |
| loc_gratwein_ulrichsberg | Ulrichsbergrunde | Gratwein-Strassengel | Freizeit & Bewegung | Wanderweg / Natur | `editorial_public_place` | https://gratwein-strassengel.gv.at/informationen/wanderwege | in_app_only_demo | 500 | Bewegung/Natur im erweiterten Gebiet. | Kein Wetter-/Sicherheitsclaim. |
| loc_maria_strassengel | Wallfahrtskirche Maria Strassengel | Gratwein-Strassengel | Kultur & Events | Kirche / Kulturort | `editorial_public_place` | https://gratwein-strassengel.gv.at/tourismus | in_app_only_demo | 300 | Starker Kultur-Landmark. | Keine Event-/Gottesdienstzeiten. |
| loc_stift_rein | Stift Rein | Gratwein-Strassengel | Kultur & Events | Stift / Kulturort | `editorial_public_place` | https://gratwein-strassengel.gv.at/tourismus | in_app_only_demo | 500 | Kultur- und Ausflugsziel. | Keine Fuehrungs-/Oeffnungsclaims. |
| loc_gratwein_zweirad_janger | Zweirad Janger | Gratwein-Strassengel | Services & Lokales | Fahrradhandel / Werkstaette | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | in_app_only_demo | 300 | Fahrradservice fuer Bewegungskontext. | Keine Reparatur-/Preisclaims. |
| loc_gratwein_kottnig | Karosseriebau Kottnig | Gratwein-Strassengel | Services & Lokales | KFZ-Werkstatt / Spenglerei | `real_demo_location` | https://gratwein-strassengel.gv.at/wirtschaft | needs_review_before_import | 350 | Service-Dichte in 8111. | Vor Pitch-Aktivierung pruefen. |

## 7. MatchableDemoContent Set

Dieses Set enthaelt 25 matchbare Inhalte. Jeder Inhalt braucht ein Interesse, eine Laufzeit, einen Radius, eine geografische Gueltigkeit, eine Sichtbarkeits-/Pushentscheidung und eine sichere Demo-Formulierung.

| contentKey | locationKey | title | demoCardText | contentKind | interestKeys | validFrom | validTo | activeDays | activeTimeWindows | radiusMeters | geoValidity | providerCanEditRadius | providerCanEditValidity | suggestedPushPriority | pushEligibility | cooldownSuggestionHours | matchReason | riskNote |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cnt_andritz_bartl_kaffee_pause_v1 | loc_andritz_bartl | Kaffee und kurze Pause in Andritz | Demo-Hinweis: In deiner Naehe gibt es einen passenden Ort fuer Kaffee und kurze Pause. Kein offizieller StepsMatch-Partner. | neutral_hint | coffee_pause, bakery, nearby_food | 2026-07-01 | 2026-09-30 | all | 07:00-14:00 | 220 | point_radius | true | true | normal | eligible_normal | 24 | Interesse Kaffee/Pause plus Naehe im Andritz-Kern. | Keine Produkte, Preise oder Oeffnungszeiten behaupten. |
| cnt_andritz_kern_baeckerei_v1 | loc_andritz_kern | Baeckerei-Hinweis in Andritz | Pre-Alpha-Hinweis: Dieser reale Ort passt zu deinem Interesse Baeckerei oder Snack in der Umgebung. | neutral_hint | bakery, snack, coffee_pause | 2026-07-01 | 2026-09-30 | all | 07:00-13:00 | 220 | point_radius | true | true | normal | eligible_normal | 24 | Baeckereiinteresse, kleiner Radius, Alltagssituation. | Keine Aktionen oder Produktverfuegbarkeit. |
| cnt_sn_nahversorgung_v1 | loc_sn_billa_plus | Nahversorgung im Shopping-Nord-Umfeld | Pre-Alpha-Hinweis: Dieser Ort passt zu deinem Interesse Nahversorgung in der Naehe. | neutral_hint | daily_needs, groceries, shopping | 2026-07-01 | 2026-09-30 | all | none | 300 | point_radius | true | true | normal | eligible_normal | 36 | Nahversorgung plus klare Centerlage. | Keine Preise, Aktionen oder Verfuegbarkeit. |
| cnt_sn_martin_auer_pause_v1 | loc_sn_martin_auer | Kaffee-Pause im Center | Demo-Hinweis: In deiner Naehe gibt es einen passenden Ort fuer Kaffee oder kurze Pause. | pause_hint | coffee_pause, bakery, shopping_break | 2026-07-01 | 2026-09-30 | all | 08:00-15:00 | 220 | point_radius | true | true | normal | eligible_normal | 24 | Kaffeeinteresse im Center, gut fuer Push-Funnel. | Keine Produkt- oder Oeffnungsclaims. |
| cnt_goesting_dm_daily_v1 | loc_goesting_dm | Drogerie-Alltag in der Naehe | Pre-Alpha-Hinweis: Dieser reale Standort passt zu deinem Interesse Alltagsbedarf. | neutral_hint | daily_needs, drugstore, shopping | 2026-07-01 | 2026-09-30 | all | none | 280 | point_radius | true | true | normal | eligible_normal | 48 | Drogerieinteresse ausserhalb Center. | Keine Produkt- oder Aktionspushes. |
| cnt_gruber_regional_v1 | loc_andritz_gruber_hofladen | Regionaler Ort am Andritz-Rand | Demo-Hinweis: Dieser reale Ort passt zu deinem Interesse Regionales und Nahversorgung. | neutral_hint | regional, groceries, local_supply | 2026-07-01 | 2026-09-30 | all | none | 350 | point_radius | true | true | low_or_in_app | in_app_only | 72 | Regionalinteresse mit ruhiger Ausspielung. | Lage/Quelle vor Import pruefen. |
| cnt_apotheke_andritz_leise_v1 | loc_andritz_apotheke | Apothekenstandort in der Naehe | Sachlicher Demo-Hinweis: In deiner Naehe befindet sich ein Apothekenstandort. Kein medizinischer Rat. | neutral_hint | pharmacy, health_daily | 2026-07-01 | 2026-09-30 | all | none | 220 | point_radius | false | true | low_or_in_app | in_app_only | 96 | Gesundheitsinteresse, aber bewusst leise. | Keine medizinische Empfehlung, kein Notdienstclaim. |
| cnt_apotheke_goesting_leise_v1 | loc_goesting_janus | Apothekenstandort in Goesting | Sachlicher Demo-Hinweis: Dieser reale Standort passt zu deinem Interesse Gesundheit & Alltag. | neutral_hint | pharmacy, health_daily | 2026-07-01 | 2026-09-30 | all | none | 220 | point_radius | false | true | low_or_in_app | in_app_only | 96 | Gesundheitsstandort in Goesting ohne Alarmismus. | Keine medizinischen Aussagen. |
| cnt_ruine_goesting_bewegung_v1 | loc_ruine_goesting | Aussicht und Bewegung bei Goesting | Redaktioneller Demo-Hinweis: In der Naehe befindet sich ein oeffentlicher Ort fuer Bewegung oder Aussicht. | editorial_hint | walking, viewpoint, outdoor | 2026-07-01 | 2026-09-30 | all | 09:00-18:00 | 300 | route_candidate | false | true | low_or_in_app | in_app_only | 72 | Oeffentlicher Ort, Route, Arrival-Test. | Sperren/Sicherheit vor Feldtest pruefen. |
| cnt_thalersee_pause_v1 | loc_thalersee | Ruhiger Naturpunkt in der Naehe | Redaktioneller Demo-Hinweis: In der Naehe liegt ein Naturpunkt fuer kurze Erholung. | pause_hint | quiet_place, nature, walking | 2026-07-01 | 2026-09-30 | all | 09:00-19:00 | 500 | area_candidate | false | true | low_or_in_app | in_app_only | 72 | Ruhe/Pause sichtbar machen. | Nur bei sinnvoller Naehe, keine Infrastrukturclaims. |
| cnt_reinerkogel_route_v1 | loc_reinerkogel | Spazierroute im noerdlichen Graz | Redaktioneller Demo-Hinweis: Diese Umgebung passt zu deinem Interesse Spaziergang und Bewegung. | editorial_hint | walking, nature, outdoor | 2026-07-01 | 2026-09-30 | all | 08:00-18:00 | 400 | route_candidate | false | true | low_or_in_app | in_app_only | 72 | Route statt Branchenverzeichnis, guter Pitch-Beleg. | Triggerpunkte spaeter definieren. |
| cnt_stukitzbad_freizeit_v1 | loc_stukitzbad | Freizeitpunkt in Andritz | Redaktioneller Demo-Hinweis: In deiner Naehe gibt es einen realen Freizeitort fuer Karte und Route. | editorial_hint | family, sport, leisure | 2026-07-01 | 2026-09-30 | all | none | 300 | point_radius | false | true | low_or_in_app | in_app_only | 72 | Freizeit/Arrival im Andritz-Kern. | Keine Preise, Saison oder Oeffnungszeiten. |
| cnt_sn_rad_service_v1 | loc_sn_bike_station | Fahrradservice im Centerumfeld | Demo-Hinweis: In deiner Naehe ist ein Servicepunkt rund ums Fahrrad vorgemerkt. | service_hint | bike, repair, local_service | 2026-07-01 | 2026-09-30 | all | none | 180 | point_radius | false | true | low_or_in_app | in_app_only | 48 | Unterwegs-Service mit kleinem Radius. | Keine Funktions- oder Verfuegbarkeitsgarantie. |
| cnt_andritz_friseur_service_v1 | loc_andritz_schnittig | Lokaler Service in Andritz | Pre-Alpha-Hinweis: Dieser reale Ort passt zu deinem Interesse lokaler Service. | service_hint | services, hairdresser, local | 2026-07-01 | 2026-09-30 | all | none | 220 | point_radius | true | true | low_or_in_app | in_app_only | 72 | Servicekategorie ohne Angebotsdruck. | Keine Termin- oder Preisclaims. |
| cnt_goesting_kfz_service_v1 | loc_goesting_kfz_reinprecht | Werkstatt-Service in Goesting | Pre-Alpha-Hinweis: Dieser reale Servicepunkt passt zu deinem Interesse Reparatur oder lokaler Service. | service_hint | repair, car_service, local_service | 2026-07-01 | 2026-09-30 | all | none | 350 | point_radius | true | true | low_or_in_app | in_app_only | 96 | Lokale Servicekategorie testen. | Keine Leistungs- oder Verfuegbarkeitsclaims. |
| cnt_sn_familie_spielefarm_v1 | loc_sn_spielefarm | Familienort im Shopping-Nord-Umfeld | Demo-Hinweis: Dieser reale Ort passt zu deinem Interesse Familie oder Freizeit. | neutral_hint | family, kids, leisure | 2026-07-01 | 2026-09-30 | all | none | 250 | point_radius | true | true | low_or_in_app | in_app_only | 72 | Familieninteresse im Pitch zeigen. | Keine Oeffnungs-/Betreuungsclaims. |
| cnt_sn_sport_outdoor_v1 | loc_sn_intersport | Sportinteresse in der Naehe | Pre-Alpha-Hinweis: Dieser Ort passt zu deinem Interesse Sport oder Outdoor. | neutral_hint | sport, outdoor, shopping | 2026-07-01 | 2026-09-30 | all | none | 280 | point_radius | true | true | low_or_in_app | in_app_only | 72 | Sportkategorie im urbanen Alltag. | Keine Produktverfuegbarkeit. |
| cnt_gratwein_leitner_pause_v1 | loc_gratwein_baeckerei_leitner | Kaffee und Pause in 8111 | Demo-Hinweis: In deiner Naehe gibt es einen passenden Ort fuer Kaffee und kurze Pause. | pause_hint | coffee_pause, bakery, local | 2026-07-01 | 2026-09-30 | all | 07:00-14:00 | 220 | point_radius | true | true | normal | eligible_normal | 24 | Gratwein-Strassengel aktiv sichtbar. | Keine Produkte/Oeffnungszeiten. |
| cnt_gratwein_click_clack_food_v1 | loc_gratwein_click_clack | Kaffee oder Essen nahe Bahnhof | Pre-Alpha-Hinweis: Dieser reale Ort passt zu deinem Interesse Kaffee, Essen oder kurze Pause. | neutral_hint | coffee_pause, nearby_food, transit | 2026-07-01 | 2026-09-30 | all | 08:00-16:00 | 240 | point_radius | true | true | normal | eligible_normal | 24 | Bahnhofsnaher Pitch-Match in Gratwein. | Keine Tagesangebote. |
| cnt_gratwein_gemeinde_service_v1 | loc_gratwein_gemeindeamt | Lokaler Buergerdienst-Ort | Demo-Hinweis: Dieser reale Ort ist als lokaler Servicepunkt im Testgebiet sichtbar. | service_hint | local_service, civic, orientation | 2026-07-01 | 2026-09-30 | weekdays | none | 220 | point_radius | false | true | low_or_in_app | in_app_only | 96 | Zeigt Gemeinde-/Buergerdienste als lokale Kategorie. | Keine Amtszeiten oder Verfahren. |
| cnt_maria_strassengel_kultur_v1 | loc_maria_strassengel | Kulturort am Kirchberg | Redaktioneller Demo-Hinweis: In der Naehe befindet sich ein markanter Kulturort. | editorial_hint | culture, landmark, walking | 2026-07-01 | 2026-09-30 | all | 09:00-18:00 | 280 | point_radius | false | true | low_or_in_app | in_app_only | 96 | Kulturkategorie in 8111 sichtbar. | Keine Event- oder Gottesdienstzeiten. |
| cnt_stift_rein_kultur_v1 | loc_stift_rein | Ausflugs- und Kulturort Rein | Redaktioneller Demo-Hinweis: Dieser reale Ort passt zu deinem Interesse Kultur oder kurzer Ausflug. | editorial_hint | culture, outing, walking | 2026-07-01 | 2026-09-30 | all | 09:00-18:00 | 450 | area_candidate | false | true | low_or_in_app | in_app_only | 96 | Kultur/Ausflug im erweiterten Gebiet. | Keine Fuehrungs-/Oeffnungsclaims. |
| cnt_gratwein_erlebnisbad_familie_v1 | loc_gratwein_erlebnisbad | Freizeitpunkt fuer Familie | Redaktioneller Demo-Hinweis: Dieser reale Ort passt zu deinem Interesse Freizeit oder Familie. | editorial_hint | family, swimming, leisure | 2026-07-01 | 2026-09-30 | all | none | 350 | point_radius | false | true | low_or_in_app | in_app_only | 72 | Familien-/Freizeitanker fuer Gratwein. | Keine Saison-, Preis- oder Oeffnungsclaims. |
| cnt_gratwein_pralatenweg_route_v1 | loc_gratwein_pralatenweg | Spazierroute bei Rein | Redaktioneller Demo-Hinweis: Diese Umgebung passt zu deinem Interesse Bewegung und Natur. | editorial_hint | walking, nature, route | 2026-07-01 | 2026-09-30 | all | 08:00-18:00 | 500 | route_candidate | false | true | low_or_in_app | in_app_only | 96 | Route/GeoValidity im Pitch erklaerbar. | Triggerpunkte vor Import definieren. |
| cnt_gratwein_zweirad_service_v1 | loc_gratwein_zweirad_janger | Fahrradservice in Gratwein | Pre-Alpha-Hinweis: Dieser reale Servicepunkt passt zu deinem Interesse Fahrrad oder lokaler Service. | service_hint | bike, repair, local_service | 2026-07-01 | 2026-09-30 | all | none | 280 | point_radius | true | true | low_or_in_app | in_app_only | 72 | Verbindet Bewegung und Service. | Keine Reparaturdauer oder Preisclaims. |

## 8. Matching-Regeln fuer Pitch-MVP

Ein Match ist nur gueltig, wenn alle folgenden Bedingungen erfuellt sind:

1. User hat ein relevantes Interesse gewaehlt.
2. Die zugehoerige DemoLocation ist `active_public_demo` oder `in_app_only_demo`.
3. Die aktuelle Zeit liegt zwischen `validFrom` und `validTo`.
4. Der aktuelle Wochentag ist in `activeDays`.
5. Die aktuelle Uhrzeit liegt in `activeTimeWindows`, falls gesetzt.
6. Die User-Position liegt innerhalb `radiusMeters` des Contents.
7. `geoValidity` ist fuer diesen Content interpretierbar.
8. `pushEligibility` erlaubt Push oder In-App-Anzeige.
9. Cooldown/Dedupe verhindert wiederholte oder unnnoetige Benachrichtigung.
10. Content ist nicht `silent_admin_only`, `needs_review_before_import` oder `do_not_import_v1`.

Fachlich wichtig:

- `DemoLocation.baseRadiusMeters` beschreibt die Standortnaehe.
- `MatchableDemoContent.radiusMeters` entscheidet den konkreten Match.
- Content kann zeitlich ablaufen, auch wenn die DemoLocation weiter existiert.
- Push ist nur fuer matchbaren Content erlaubt, nicht fuer die blosse Existenz eines Orts.

## 9. Provider-Steuerung

Provider sollen spaeter pro Inhalt steuern koennen:

- Titel/Text
- Kategorie/Subkategorie
- Interessen
- Radius
- Laufzeit
- aktive Wochentage
- aktive Zeitfenster
- Sichtbarkeit
- Push-Stufe innerhalb erlaubter Grenzen

Systemgrenzen:

- `high_attention` darf nicht frei vergeben werden.
- Gesundheit/Apotheke stark begrenzen und standardmaessig leise halten.
- Maximalradius je Kategorie begrenzen.
- Mindest-Cooldowns erzwingen.
- Demo-Label und Nicht-Partner-Hinweis erzwingen, solange keine Freigabe dokumentiert ist.
- Vorschau anzeigen: "Wer kann diesen Hinweis wann und wo sehen?"
- Warnen, wenn Radius, Laufzeit oder Push-Stufe zu breit wirken.

Provider-editierbar ist nicht gleich beliebig. Das System muss falsche Claims, Spam und ueberbreite Radien verhindern.

## 10. Push-Policy

Regeln fuer Pitch-Demo v1:

- `high_attention` nicht verwenden.
- `normal` nur fuer sehr klare Alltagsrelevanz, z. B. Kaffee/Pause, Nahversorgung, eindeutiger Service.
- `low_or_in_app` ist Standard fuer oeffentliche Orte, Freizeit, Ruhe, Kultur und Gesundheit.
- `silent/admin_only` fuer unsichere Quellen, reine Marktdichte und Review-Faelle.
- Gesundheit/Apotheken maximal `normal`, bevorzugt `low_or_in_app`, ohne medizinische Claims.
- Keine Pushes fuer blosse Existenz eines Ortes.
- Push nur fuer `MatchableDemoContent` mit gueltigem Zeit-, Radius- und Interessenfenster.
- Cooldown/Dedupe ist Pflicht.
- Foreground/In-App darf haeufiger getestet werden als laute Benachrichtigung.

## 11. Kategorienluecken

Explizite Luecken aus dem 110er Seed:

- `Ruhe & Pause` mit 1 Seed-Eintrag ist zu schwach.
- `Kultur & Events` mit 3 Seed-Eintraegen ist zu schwach.
- Freizeit/Bewegung sollte fuer StepsMatch stark bleiben, weil Bewegung + Standort der Produktkern ist.
- Nahversorgung darf nicht dominieren, sonst wirkt StepsMatch wie ein Branchenverzeichnis.

Spaeter zu ergaenzen:

- kleine Parks und Gruenflaechen mit offiziellen oder vor Ort verifizierten Triggerpunkten
- Sitzplaetze, Schattenpunkte und kurze Pausenorte
- Spielplaetze und oeffentliche Sportpunkte
- lokale Kulturorte mit stabiler Quelle
- echte, offiziell belegte Veranstaltungsorte ohne konkrete Eventdaten im Demo-Modell
- kurze Spazierpunkte statt nur langer Routen
- sichere Fahrrad-/Servicepunkte ausserhalb Shopping Nord

Keine neuen Eintraege werden in diesem Schritt recherchiert oder importiert.

## 12. Importfaehigkeit ohne Code

Ein spaeterer Import sollte so vorbereitet werden:

1. Import zuerst in Staging/Lab, nicht blind live.
2. Struktur aus kuratierter Markdown-/CSV-/JSON-Basis ableiten.
3. Dubletten pruefen.
4. Quellen erneut pruefen.
5. Koordinaten pruefen und Status setzen.
6. Kategorie-/Subkategorie-Mapping gegen Taxonomie pruefen.
7. Sichtbarkeit pro `DemoLocation` pruefen.
8. `pushEligibility` pro `MatchableDemoContent` pruefen.
9. Laufzeit und Radius pruefen.
10. Demo-Label technisch erzwingen.
11. Kein offizieller Anbieterstatus ohne dokumentierte Freigabe.

Noch keinen Importer schreiben. Noch keine DB-Mutation.

## 13. Risiken vor DB-Befuellung

Harte Risiken:

- falscher Partnerclaim
- Push-Laerm
- falscher Radius
- Inhalte ausserhalb Laufzeit sichtbar
- medizinisch heikle Aussagen
- Dubletten
- unpraezise Koordinaten
- App wirkt wie Branchenverzeichnis
- User versteht Demo-Status nicht
- Provider kann spaeter zu grosse Radien setzen
- fehlender Cooldown erzeugt Spam-Wirkung
- Gesundheitsinhalte werden faelschlich dringlich dargestellt
- route_candidate wird ohne brauchbare Triggerpunkte importiert
- Center-Shop wird faelschlich als freigegebener Partner verstanden

## 14. Naechste Umsetzungsschritte

Empfohlene Reihenfolge:

1. Taxonomie v1 bestaetigen.
2. Curated Match Model pruefen.
3. Importformat definieren.
4. Erst danach Seed-Importer planen.
5. Mobile UX auf Pitch-Flow trimmen.
6. Consent-first Onboarding implementieren.
7. Web Frontend auf Pitch-Kommunikation trimmen.
8. Observability-Minimum einbauen.
9. Kontroll-/Adminsicht fuer Demo-Daten und Pushes bauen.
10. Erst dann DB-Mutation und APK-Build.
