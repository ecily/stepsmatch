import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import Offer from '../models/Offer.js';
import Provider from '../models/Provider.js';
import User from '../models/User.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });
dotenv.config();

const SEED_TAG = 'pitch_demo_graz_north_v1';
const SOURCE_VERIFIED_AT = '2026-06-23';
const DEMO_OWNER_EMAIL = `seed+${SEED_TAG}@stepsmatch.local`;
const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

const DAY_SETS = {
  all: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  weekend: ['Saturday', 'Sunday'],
  morningWeekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  afternoonWeekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dateOnlyUtc(offsetDays) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays, 0, 0, 0));
}

function makeWindow(value) {
  if (!value || value === 'none') return [];
  const [from, to] = value.split('-');
  return [{ from, to }];
}

function location({
  key,
  name,
  area,
  address,
  category,
  subcategory,
  lng,
  lat,
  radius,
  contentType = 'real_demo_location',
  visibility = 'in_app_only_demo',
  sourceUrl,
  riskNote,
}) {
  return {
    key,
    name,
    area,
    address,
    category,
    subcategory,
    coordinates: [lng, lat],
    radiusMeters: radius,
    contentType,
    publicVisibility: visibility,
    demoLabel: contentType === 'editorial_public_place'
      ? 'Redaktioneller Pre-Alpha-Hinweis, kein Partner'
      : 'Pre-Alpha-Demo-Location, kein offizieller Partner',
    sourceUrl,
    sourceVerifiedAt: SOURCE_VERIFIED_AT,
    riskNote,
  };
}

const municipalSource = 'https://gratwein-strassengel.gv.at/wirtschaft';
const tourismSource = 'https://gratwein-strassengel.gv.at/tourismus';
const sportSource = 'https://gratwein-strassengel.gv.at/sport-freizeit';

const LOCATIONS = [
  location({ key: 'loc_andritz_bartl', name: 'Baeckerei Konditorei Bartl Graz Andritz', area: 'Andritz', address: 'Andritzer Reichsstrasse 42A, 8045 Graz', category: 'Essen & Trinken', subcategory: 'Baeckerei / Cafe', lng: 15.4238, lat: 47.1013, radius: 250, visibility: 'active_public_demo', sourceUrl: 'https://baeckerei-bartl.at/filialen/', riskNote: 'Kein Partnerclaim, keine Produkte, Preise oder Oeffnungszeiten.' }),
  location({ key: 'loc_andritz_kern', name: 'Baeckerei Kern Andritz', area: 'Andritz', address: 'Grazer Strasse 35, 8045 Graz', category: 'Essen & Trinken', subcategory: 'Baeckerei / Snack', lng: 15.4219, lat: 47.101, radius: 250, visibility: 'active_public_demo', sourceUrl: 'https://baeckerei-kern.at/filialen', riskNote: 'Keine Aktionen oder Produktclaims.' }),
  location({ key: 'loc_andritz_andritzer_hof', name: 'Cafe Restaurant Andritzer Hof', area: 'Andritz', address: 'Gottlieb-Remschmidt-Gasse 2, 8045 Graz', category: 'Essen & Trinken', subcategory: 'Restaurant / Cafe', lng: 15.4208, lat: 47.1008, radius: 300, sourceUrl: 'https://andritzerhof.eatbu.com/', riskNote: 'Keine Speisen- oder Verfuegbarkeitsclaims.' }),
  location({ key: 'loc_andritz_johanneshof', name: 'Johanneshof Andritz', area: 'Andritz', address: 'Rotmoosweg 7, 8045 Graz', category: 'Essen & Trinken', subcategory: 'Regionales Essen', lng: 15.4072, lat: 47.111, radius: 400, sourceUrl: 'https://www.johanneshof-andritz.at/', riskNote: 'Keine Speisen- oder Tischclaims.' }),
  location({ key: 'loc_shopping_nord', name: 'Shopping Nord', area: 'Graz-Nord / Goesting', address: 'Wiener Strasse 351, 8051 Graz', category: 'Einkaufen & Nahversorgung', subcategory: 'Center / Nahversorgung', lng: 15.3929, lat: 47.0967, radius: 500, visibility: 'active_public_demo', sourceUrl: 'https://www.shoppingnord.at/', riskNote: 'Centerinfo ist keine Zustimmung einzelner Shops.' }),
  location({ key: 'loc_sn_billa_plus', name: 'Billa Plus Shopping Nord', area: 'Graz-Nord / Goesting', address: 'Shopping Nord, Wiener Strasse 351, 8051 Graz', category: 'Einkaufen & Nahversorgung', subcategory: 'Lebensmittel', lng: 15.3932, lat: 47.0969, radius: 300, visibility: 'active_public_demo', sourceUrl: 'https://shoppingnord.at/shopfinder', riskNote: 'Keine Preise, Aktionen oder Verfuegbarkeit.' }),
  location({ key: 'loc_sn_martin_auer', name: 'Martin Auer Shopping Nord', area: 'Graz-Nord / Goesting', address: 'Shopping Nord, Wiener Strasse 351, 8051 Graz', category: 'Essen & Trinken', subcategory: 'Baeckerei / Cafe', lng: 15.3926, lat: 47.0968, radius: 250, visibility: 'active_public_demo', sourceUrl: 'https://shoppingnord.at/shopfinder', riskNote: 'Keine Produktclaims.' }),
  location({ key: 'loc_sn_bipa', name: 'Bipa Shopping Nord', area: 'Graz-Nord / Goesting', address: 'Shopping Nord, Wiener Strasse 351, 8051 Graz', category: 'Einkaufen & Nahversorgung', subcategory: 'Drogerie', lng: 15.3924, lat: 47.0966, radius: 250, sourceUrl: 'https://shoppingnord.at/shopfinder', riskNote: 'Keine Aktionen oder Produktverfuegbarkeit.' }),
  location({ key: 'loc_sn_apotheke', name: 'Apotheke Graz Shopping Nord', area: 'Graz-Nord / Goesting', address: 'Shopping Nord, Wiener Strasse 351, 8051 Graz', category: 'Gesundheit & Alltag', subcategory: 'Apotheke', lng: 15.3935, lat: 47.0965, radius: 250, sourceUrl: 'https://www.apotheke-graz-nord.at/', riskNote: 'Keine medizinischen Aussagen.' }),
  location({ key: 'loc_goesting_janus', name: 'Janus-Apotheke', area: 'Goesting', address: 'Wiener Strasse 215-217, 8051 Graz', category: 'Gesundheit & Alltag', subcategory: 'Apotheke', lng: 15.3963, lat: 47.0864, radius: 250, sourceUrl: 'https://janus-apotheke.at/', riskNote: 'Keine Notdienst- oder Verfuegbarkeitsclaims.' }),
  location({ key: 'loc_andritz_apotheke', name: 'Apotheke Andritz', area: 'Andritz', address: 'Weinzoettlstrasse 3, 8045 Graz', category: 'Gesundheit & Alltag', subcategory: 'Apotheke', lng: 15.4245, lat: 47.1021, radius: 250, sourceUrl: 'https://www.apotheke-andritz.at/', riskNote: 'Maximal sachlich anzeigen.' }),
  location({ key: 'loc_goesting_dm', name: 'dm drogerie markt Wiener Strasse', area: 'Goesting / Graz-Nord', address: 'Wiener Strasse 286, 8051 Graz', category: 'Einkaufen & Nahversorgung', subcategory: 'Drogerie', lng: 15.3979, lat: 47.0874, radius: 300, visibility: 'active_public_demo', sourceUrl: 'https://www.dm.at/store/a09f/graz/wiener-strasse-286', riskNote: 'Keine Produkt- oder Aktionspushes.' }),
  location({ key: 'loc_stukitzbad', name: 'Stukitzbad / Stukitzsauna', area: 'Andritz', address: 'Andritzer Reichsstrasse 25, 8045 Graz', category: 'Freizeit & Bewegung', subcategory: 'Familie / Sport', lng: 15.4265, lat: 47.0992, radius: 300, contentType: 'editorial_public_place', sourceUrl: 'https://www.holding-graz.at/de/freizeit/stukitzbad/', riskNote: 'Keine Preise, Saison oder Oeffnungszeiten.' }),
  location({ key: 'loc_ruine_goesting', name: 'Ruine Goesting / Jungfernsprung', area: 'Goesting', address: 'Oeffentlicher Aussichtspunkt / Wanderziel', category: 'Freizeit & Bewegung', subcategory: 'Aussichtspunkt / Spaziergang', lng: 15.3703, lat: 47.0972, radius: 300, contentType: 'editorial_public_place', visibility: 'active_public_demo', sourceUrl: 'https://www.graz.at/cms/beitrag/10161901/7776290/Ruine_Goesting.html', riskNote: 'Sperren und Sicherheitskontext vor Feldtest beachten.' }),
  location({ key: 'loc_thalersee', name: 'Thalersee', area: 'Goesting / Thal', address: 'Thalersee, nahe Umgebung von Goesting', category: 'Ruhe & Pause', subcategory: 'Naturpunkt / Naherholung', lng: 15.3379, lat: 47.0748, radius: 600, contentType: 'editorial_public_place', sourceUrl: 'https://www.graz.at/cms/beitrag/10161896/7776290/Thalersee.html', riskNote: 'Nur als leiser In-App-Hinweis bei sinnvoller Naehe.' }),
  location({ key: 'loc_reinerkogel', name: 'Reinerkogel-Runde', area: 'Andritz-nah', address: 'Route im noerdlichen Graz', category: 'Freizeit & Bewegung', subcategory: 'Spaziergang / Natur', lng: 15.421, lat: 47.088, radius: 400, contentType: 'editorial_public_place', sourceUrl: 'https://www.graz.at/cms/beitrag/10255533/7776200/Den_Reinerkogel_umrunden.html', riskNote: 'Route ohne Nutzungs- oder Sicherheitsclaim.' }),
  location({ key: 'loc_plabutsch', name: 'Plabutsch / Fuerstenstand-Route', area: 'Goesting / Plabutsch', address: 'Route / Wandergebiet', category: 'Freizeit & Bewegung', subcategory: 'Aussichtspunkt / Natur', lng: 15.372, lat: 47.083, radius: 600, contentType: 'editorial_public_place', sourceUrl: 'https://www.graztourismus.at/de/erholung-freizeit-sport/spazieren-wandern/tour-uebersicht/gipfelwanderung-im-grazer-westen_td_6456', riskNote: 'Laengere Route, kein Push-Laerm.' }),
  location({ key: 'loc_andritz_schnittig', name: 'SCHNITTIG! Graz-Andritz', area: 'Andritz', address: 'Grazer Strasse 45, 8045 Graz-Andritz', category: 'Services & Lokales', subcategory: 'Friseur', lng: 15.4214, lat: 47.1016, radius: 250, sourceUrl: 'https://schnittig.at/graz-andritz/', riskNote: 'Keine Termin- oder Preisclaims.' }),
  location({ key: 'loc_goesting_kfz_reinprecht', name: 'KFZ Reinprecht', area: 'Goesting', address: 'Wiener Strasse 208, 8051 Graz-Goesting', category: 'Services & Lokales', subcategory: 'Werkstatt / Reparatur', lng: 15.397, lat: 47.0855, radius: 400, sourceUrl: 'https://www.kfz-reinprecht.at/', riskNote: 'Keine Leistungs- oder Verfuegbarkeitsclaims.' }),
  location({ key: 'loc_sn_bike_station', name: 'Shopping Nord Bike-Reparaturstation', area: 'Graz-Nord / Goesting', address: 'Shopping Nord, Wiener Strasse 351, 8051 Graz', category: 'Services & Lokales', subcategory: 'Fahrrad / Reparatur', lng: 15.3937, lat: 47.0964, radius: 200, sourceUrl: 'https://shoppingnord.at/bike-reparaturstation', riskNote: 'Keine Funktions- oder Verfuegbarkeitsgarantie.' }),
  location({ key: 'loc_sn_intersport', name: 'Intersport Shopping Nord', area: 'Graz-Nord / Goesting', address: 'Shopping Nord, Wiener Strasse 351, 8051 Graz', category: 'Freizeit & Bewegung', subcategory: 'Sport / Outdoor', lng: 15.3927, lat: 47.0971, radius: 300, sourceUrl: 'https://shoppingnord.at/shopfinder', riskNote: 'Keine Produktverfuegbarkeit.' }),
  location({ key: 'loc_sn_mister_minit', name: 'MISTER MINIT Shopping Nord', area: 'Graz-Nord / Goesting', address: 'Shopping Nord, Wiener Strasse 351, 8051 Graz', category: 'Services & Lokales', subcategory: 'Reparatur / Service', lng: 15.3931, lat: 47.0962, radius: 200, sourceUrl: 'https://shoppingnord.at/shopfinder', riskNote: 'Keine Dauer- oder Preisclaims.' }),
  location({ key: 'loc_murauen_judendorf', name: 'Murauen Judendorf Spazierpunkt', area: 'Gratwein-Strassengel', address: 'Murauen nahe Judendorf, 8111 Gratwein-Strassengel', category: 'Ruhe & Pause', subcategory: 'Naturpunkt / kurzer Stopp', lng: 15.3314, lat: 47.1262, radius: 900, contentType: 'editorial_public_place', sourceUrl: 'https://gratwein-strassengel.gv.at/sport-freizeit', riskNote: 'Redaktioneller Pausenpunkt ohne Infrastrukturclaim.' }),
  location({ key: 'loc_gratwein_fischer_apotheke', name: 'Fischer Apotheke Gratwein', area: 'Gratwein-Strassengel', address: 'Bahnhofstrasse 3, 8112 Gratwein-Strassengel', category: 'Gesundheit & Alltag', subcategory: 'Apotheke', lng: 15.3205, lat: 47.1337, radius: 250, sourceUrl: municipalSource, riskNote: 'Keine medizinischen Aussagen.' }),
  location({ key: 'loc_gratwein_flora', name: 'Flora Apotheke', area: 'Gratwein-Strassengel', address: 'Gratweiner Strasse 19, 8111 Gratwein-Strassengel', category: 'Gesundheit & Alltag', subcategory: 'Apotheke', lng: 15.3182, lat: 47.1257, radius: 250, sourceUrl: municipalSource, riskNote: 'Keine Verfuegbarkeitsclaims.' }),
  location({ key: 'loc_gratwein_gemeindeamt', name: 'Gemeindeamt Gratwein-Strassengel', area: 'Gratwein-Strassengel', address: 'Hauptplatz 1, 8111 Gratwein-Strassengel', category: 'Services & Lokales', subcategory: 'Buergerdienst / Gemeinde', lng: 15.3186, lat: 47.1251, radius: 250, sourceUrl: 'https://gratwein-strassengel.gv.at/', riskNote: 'Keine Amtszeiten oder Verfahren versprechen.' }),
  location({ key: 'loc_gratwein_baeckerei_leitner', name: 'Baeckerei Cafe Leitner', area: 'Gratwein-Strassengel', address: 'Gratweiner Strasse 23, 8111 Gratwein-Strassengel', category: 'Essen & Trinken', subcategory: 'Baeckerei / Cafe', lng: 15.3183, lat: 47.126, radius: 250, visibility: 'active_public_demo', sourceUrl: municipalSource, riskNote: 'Keine Produkt- oder Oeffnungsclaims.' }),
  location({ key: 'loc_gratwein_kern', name: 'Baeckerei Konditorei Cafe Julius Kern Gratwein', area: 'Gratwein-Strassengel', address: 'Murfeldstrasse 6, 8112 Gratwein-Strassengel', category: 'Essen & Trinken', subcategory: 'Baeckerei / Cafe', lng: 15.3222, lat: 47.1335, radius: 250, visibility: 'active_public_demo', sourceUrl: municipalSource, riskNote: 'Keine Produkt- oder Aktionsclaims.' }),
  location({ key: 'loc_gratwein_pflegers', name: 'Baeckerei Franz Pfleger Filiale Gratwein', area: 'Gratwein-Strassengel', address: 'Bahnhofstrasse 22-24, 8112 Gratwein-Strassengel', category: 'Essen & Trinken', subcategory: 'Baeckerei', lng: 15.3212, lat: 47.1331, radius: 250, visibility: 'active_public_demo', sourceUrl: municipalSource, riskNote: 'Keine Oeffnungszeiten oder Produktversprechen.' }),
  location({ key: 'loc_gratwein_cafe_haeferl', name: 'Cafe Haeferl', area: 'Gratwein-Strassengel', address: 'Hauptplatz 5, 8111 Gratwein-Strassengel', category: 'Essen & Trinken', subcategory: 'Cafe', lng: 15.3188, lat: 47.1252, radius: 250, sourceUrl: municipalSource, riskNote: 'Keine Angebote oder Veranstaltungen erfinden.' }),
  location({ key: 'loc_gratwein_click_clack', name: 'CLICK CLACK coffee & kitchen', area: 'Gratwein-Strassengel', address: 'Bahnhofplatz 5, 8112 Gratwein-Strassengel', category: 'Essen & Trinken', subcategory: 'Cafe / Restaurant', lng: 15.3227, lat: 47.1327, radius: 250, visibility: 'active_public_demo', sourceUrl: municipalSource, riskNote: 'Keine Tagesangebote.' }),
  location({ key: 'loc_gratwein_kirchenwirt', name: 'Kirchenwirt Maria Strassengel', area: 'Gratwein-Strassengel', address: 'Am Kirchberg 18, 8111 Gratwein-Strassengel', category: 'Essen & Trinken', subcategory: 'Gasthaus / Restaurant', lng: 15.3156, lat: 47.1233, radius: 300, sourceUrl: municipalSource, riskNote: 'Keine Speisen-, Preis- oder Verfuegbarkeitsclaims.' }),
  location({ key: 'loc_gratwein_fischerwirt', name: 'Restaurant Fischerwirt', area: 'Gratwein-Strassengel', address: 'Bahnhofstrasse 40, 8112 Gratwein-Strassengel', category: 'Essen & Trinken', subcategory: 'Restaurant / Gasthaus', lng: 15.3199, lat: 47.1321, radius: 300, sourceUrl: municipalSource, riskNote: 'Keine Angebots- oder Verfuegbarkeitsclaims.' }),
  location({ key: 'loc_gratwein_cuuk', name: 'Cafe-Restaurant-Pizzeria CUUK', area: 'Gratwein-Strassengel', address: 'Grazer Strasse 45, 8111 Gratwein-Strassengel', category: 'Essen & Trinken', subcategory: 'Restaurant / Pizzeria', lng: 15.3197, lat: 47.1242, radius: 250, sourceUrl: municipalSource, riskNote: 'Keine Preise oder Speisenclaims.' }),
  location({ key: 'loc_gratwein_erlebnisbad', name: 'Erlebnisbad Weihermuehle', area: 'Gratwein-Strassengel', address: 'Tallak 59, 8112 Gratwein-Strassengel', category: 'Freizeit & Bewegung', subcategory: 'Schwimmbad / Familie', lng: 15.3088, lat: 47.1296, radius: 400, contentType: 'editorial_public_place', sourceUrl: municipalSource, riskNote: 'Keine Saison-, Preis- oder Oeffnungsclaims.' }),
  location({ key: 'loc_gratwein_basketball', name: 'Basketballplatz Schulzentrum Gratwein', area: 'Gratwein-Strassengel', address: 'Areal der Schulen, OT Gratwein', category: 'Freizeit & Bewegung', subcategory: 'Sportplatz', lng: 15.3192, lat: 47.1272, radius: 250, contentType: 'editorial_public_place', sourceUrl: sportSource, riskNote: 'Vor Ort Lage und Nutzungsbedingungen pruefen.' }),
  location({ key: 'loc_gratwein_pralatenweg', name: 'Praelaetenweg Rein', area: 'Gratwein-Strassengel', address: 'OT Eisbach-Rein, Route', category: 'Freizeit & Bewegung', subcategory: 'Spaziergang / Wanderweg', lng: 15.281, lat: 47.1396, radius: 500, contentType: 'editorial_public_place', sourceUrl: 'https://gratwein-strassengel.gv.at/informationen/wanderwege', riskNote: 'Triggerpunkt fuer Pitch-Test grob gesetzt.' }),
  location({ key: 'loc_gratwein_ulrichsberg', name: 'Ulrichsbergrunde', area: 'Gratwein-Strassengel', address: 'OT Eisbach-Rein, Route', category: 'Freizeit & Bewegung', subcategory: 'Wanderweg / Natur', lng: 15.293, lat: 47.147, radius: 500, contentType: 'editorial_public_place', sourceUrl: 'https://gratwein-strassengel.gv.at/informationen/wanderwege', riskNote: 'Keine Sicherheits- oder Wetterannahmen.' }),
  location({ key: 'loc_maria_strassengel', name: 'Wallfahrtskirche Maria Strassengel', area: 'Gratwein-Strassengel', address: 'Kirchberg, 8111 Gratwein-Strassengel', category: 'Kultur & Events', subcategory: 'Kirche / Kulturort', lng: 15.3158, lat: 47.1235, radius: 300, contentType: 'editorial_public_place', sourceUrl: tourismSource, riskNote: 'Keine Event- oder Gottesdienstzeiten.' }),
  location({ key: 'loc_stift_rein', name: 'Stift Rein', area: 'Gratwein-Strassengel', address: 'Rein, 8103 Gratwein-Strassengel', category: 'Kultur & Events', subcategory: 'Stift / Kulturort', lng: 15.2837, lat: 47.1364, radius: 500, contentType: 'editorial_public_place', sourceUrl: tourismSource, riskNote: 'Keine Fuehrungs-, Preis- oder Oeffnungsclaims.' }),
  location({ key: 'loc_kunstzug_gratwein', name: 'Kunstzug Gratwein', area: 'Gratwein-Strassengel', address: 'OT Gratwein, genaue Lage fuer Pitch-Test grob gesetzt', category: 'Kultur & Events', subcategory: 'Kunst im oeffentlichen Raum', lng: 15.3206, lat: 47.1328, radius: 250, contentType: 'editorial_public_place', sourceUrl: tourismSource, riskNote: 'Lage vor oeffentlicher Nutzung erneut pruefen.' }),
  location({ key: 'loc_gratwein_kulturkeller', name: 'Pizzeria Kunst + Kulturkeller', area: 'Gratwein-Strassengel', address: 'Schulstrasse 1, 8111 Gratwein-Strassengel', category: 'Kultur & Events', subcategory: 'Kulturort / Gastronomie', lng: 15.3194, lat: 47.1264, radius: 250, sourceUrl: municipalSource, riskNote: 'Keine aktuellen Events erfinden.' }),
  location({ key: 'loc_gratwein_hauptplatz_pause', name: 'Hauptplatz Gratwein Pausenpunkt', area: 'Gratwein-Strassengel', address: 'Hauptplatz, 8111 Gratwein-Strassengel', category: 'Ruhe & Pause', subcategory: 'Sitzplatz / kurzer Stopp', lng: 15.3187, lat: 47.125, radius: 220, contentType: 'editorial_public_place', sourceUrl: 'https://gratwein-strassengel.gv.at/', riskNote: 'Redaktioneller Pausenpunkt ohne Ausstattungsgarantie.' }),
  location({ key: 'loc_rein_stiftsbereich_pause', name: 'Ruhiger Stiftsbereich Rein', area: 'Gratwein-Strassengel', address: 'Rein, 8103 Gratwein-Strassengel', category: 'Ruhe & Pause', subcategory: 'ruhiger Ort / Kulturumfeld', lng: 15.284, lat: 47.1362, radius: 350, contentType: 'editorial_public_place', sourceUrl: tourismSource, riskNote: 'Leiser Hinweis, keine Zugangs- oder Oeffnungsclaims.' }),
  location({ key: 'loc_gratwein_zweirad_janger', name: 'Zweirad Janger', area: 'Gratwein-Strassengel', address: 'Kirchengasse 4, 8112 Gratwein-Strassengel', category: 'Services & Lokales', subcategory: 'Fahrradhandel / Werkstaette', lng: 15.3218, lat: 47.1336, radius: 300, sourceUrl: municipalSource, riskNote: 'Keine Reparaturdauer oder Preisclaims.' }),
  location({ key: 'loc_gratwein_kottnig', name: 'Karosseriebau Kottnig', area: 'Gratwein-Strassengel', address: 'Grazer Strasse 87, 8111 Gratwein-Strassengel', category: 'Services & Lokales', subcategory: 'KFZ-Werkstatt / Spenglerei', lng: 15.319, lat: 47.1208, radius: 350, sourceUrl: municipalSource, riskNote: 'Keine Termin-, Preis- oder Leistungsclaims.' }),
  location({ key: 'loc_gratwein_fahrschule', name: 'Fahrschule Gratwein', area: 'Gratwein-Strassengel', address: 'Murfeldstrasse 6, 8112 Gratwein-Strassengel', category: 'Services & Lokales', subcategory: 'Fahrschule / lokaler Service', lng: 15.3221, lat: 47.1334, radius: 300, sourceUrl: municipalSource, riskNote: 'Keine Kurs-, Preis- oder Terminclaims.' }),
  location({ key: 'loc_gratwein_bank_hauptplatz', name: 'Steiermaerkische Sparkasse Judendorf', area: 'Gratwein-Strassengel', address: 'Hauptplatz 5, 8111 Gratwein-Strassengel', category: 'Gesundheit & Alltag', subcategory: 'Bankomat / Bank', lng: 15.3189, lat: 47.1253, radius: 200, sourceUrl: municipalSource, riskNote: 'Keine Finanzberatung oder Produktclaims.' }),
  location({ key: 'loc_gratwein_trafik_senekowitsch', name: 'Tabaktrafik Senekowitsch', area: 'Gratwein-Strassengel', address: 'Gratweiner Strasse 2, 8111 Gratwein-Strassengel', category: 'Einkaufen & Nahversorgung', subcategory: 'Trafik', lng: 15.3184, lat: 47.1248, radius: 200, sourceUrl: municipalSource, riskNote: 'Keine Tabak- oder Produktwerbung.' }),
  location({ key: 'loc_gratwein_trafik_thalhammer', name: 'Tabak-Trafik Thalhammer', area: 'Gratwein-Strassengel', address: 'Bahnhofstrasse 32, 8112 Gratwein-Strassengel', category: 'Einkaufen & Nahversorgung', subcategory: 'Trafik', lng: 15.3207, lat: 47.1325, radius: 200, sourceUrl: municipalSource, riskNote: 'Keine Tabak- oder Produktwerbung.' }),
];

function content({
  key,
  locationKey,
  title,
  text,
  kind,
  interests,
  days,
  window = 'none',
  durationDays,
  radius,
  priority = 'low_or_in_app',
  pushEligibility = 'in_app_only',
  visibility = 'in_app_only_demo',
  cooldown = 72,
  matchReason,
}) {
  return {
    key,
    locationKey,
    title,
    text,
    kind,
    interests,
    activeDays: DAY_SETS[days] || DAY_SETS.all,
    activeTimeWindows: makeWindow(window),
    durationDays,
    radiusMeters: radius,
    publicVisibility: visibility,
    pushEligibility,
    suggestedPushPriority: priority,
    cooldownSuggestionHours: cooldown,
    matchReason,
  };
}

const CONTENT = [
  content({ key: 'cnt_andritz_bartl_morning_v1', locationKey: 'loc_andritz_bartl', title: 'Kaffee und kurze Pause in Andritz', text: 'Demo-Hinweis: realer Ort in deiner Naehe fuer Kaffee oder kurze Pause. Kein offizieller StepsMatch-Partner.', kind: 'pause_hint', interests: ['Essen & Trinken', 'Kaffee & Pause', 'coffee_pause', 'bakery'], days: 'morningWeekdays', window: '07:00-13:30', durationDays: 14, radius: 220, priority: 'normal', pushEligibility: 'eligible_normal', visibility: 'active_public_demo', cooldown: 24, matchReason: 'Passt zu Kaffee/Pause, Naehe und Morgenfenster in Andritz.' }),
  content({ key: 'cnt_sn_nahversorgung_v1', locationKey: 'loc_sn_billa_plus', title: 'Nahversorgung im Shopping-Nord-Umfeld', text: 'Pre-Alpha-Hinweis: Dieser reale Standort passt zu deinem Interesse Nahversorgung in der Naehe.', kind: 'neutral_hint', interests: ['Einkaufen & Nahversorgung', 'daily_needs', 'groceries', 'shopping'], days: 'all', durationDays: 30, radius: 300, priority: 'normal', pushEligibility: 'eligible_normal', visibility: 'active_public_demo', cooldown: 36, matchReason: 'Nahversorgung plus klare Naehe im Shopping-Nord-Umfeld.' }),
  content({ key: 'cnt_sn_martin_auer_pause_v1', locationKey: 'loc_sn_martin_auer', title: 'Kaffee-Pause im Center', text: 'Demo-Hinweis: In deiner Naehe gibt es einen passenden Ort fuer Kaffee oder kurze Pause.', kind: 'pause_hint', interests: ['Essen & Trinken', 'Kaffee & Pause', 'shopping_break', 'bakery'], days: 'all', window: '08:00-15:00', durationDays: 7, radius: 220, priority: 'normal', pushEligibility: 'eligible_normal', visibility: 'active_public_demo', cooldown: 24, matchReason: 'Kaffeeinteresse und kurzer Radius im Centerumfeld.' }),
  content({ key: 'cnt_goesting_dm_daily_v1', locationKey: 'loc_goesting_dm', title: 'Drogerie-Alltag in der Naehe', text: 'Pre-Alpha-Hinweis: Dieser reale Standort passt zu deinem Interesse Alltagsbedarf.', kind: 'neutral_hint', interests: ['Einkaufen & Nahversorgung', 'daily_needs', 'drugstore', 'shopping'], days: 'weekdays', durationDays: 30, radius: 280, priority: 'normal', pushEligibility: 'eligible_normal', visibility: 'active_public_demo', cooldown: 48, matchReason: 'Alltagsbedarf ausserhalb Shopping Nord, leise begruendet durch Naehe.' }),
  content({ key: 'cnt_apotheke_andritz_leise_v1', locationKey: 'loc_andritz_apotheke', title: 'Apothekenstandort in der Naehe', text: 'Sachlicher Demo-Hinweis: In deiner Naehe befindet sich ein Apothekenstandort. Kein medizinischer Rat.', kind: 'neutral_hint', interests: ['Gesundheit & Alltag', 'pharmacy', 'health_daily'], days: 'weekdays', durationDays: 14, radius: 220, matchReason: 'Gesundheits-/Alltagsinteresse, bewusst nur In-App.' }),
  content({ key: 'cnt_ruine_goesting_bewegung_v1', locationKey: 'loc_ruine_goesting', title: 'Aussicht und Bewegung bei Goesting', text: 'Redaktioneller Demo-Hinweis: In der Naehe befindet sich ein oeffentlicher Ort fuer Bewegung oder Aussicht.', kind: 'editorial_hint', interests: ['Freizeit & Bewegung', 'walking', 'viewpoint', 'outdoor'], days: 'weekend', window: '09:00-18:00', durationDays: 30, radius: 300, matchReason: 'Bewegungsinteresse und oeffentlicher Ort fuer Karte und Route.' }),
  content({ key: 'cnt_thalersee_pause_v1', locationKey: 'loc_thalersee', title: 'Ruhiger Naturpunkt in der Naehe', text: 'Redaktioneller Demo-Hinweis: In der Naehe liegt ein Naturpunkt fuer kurze Erholung.', kind: 'pause_hint', interests: ['Ruhe & Pause', 'quiet_place', 'nature', 'walking'], days: 'all', window: '09:00-19:00', durationDays: 30, radius: 500, matchReason: 'Ruhe/Pause sichtbar machen, ohne laute Benachrichtigung.' }),
  content({ key: 'cnt_reinerkogel_route_v1', locationKey: 'loc_reinerkogel', title: 'Spazierroute im noerdlichen Graz', text: 'Redaktioneller Demo-Hinweis: Diese Umgebung passt zu deinem Interesse Spaziergang und Bewegung.', kind: 'editorial_hint', interests: ['Freizeit & Bewegung', 'walking', 'nature', 'outdoor'], days: 'all', window: '08:00-18:00', durationDays: 14, radius: 400, matchReason: 'Route statt Branchenverzeichnis, gut fuer Karten- und Arrival-Test.' }),
  content({ key: 'cnt_sn_bike_service_v1', locationKey: 'loc_sn_bike_station', title: 'Fahrradservice im Centerumfeld', text: 'Demo-Hinweis: In deiner Naehe ist ein Servicepunkt rund ums Fahrrad vorgemerkt.', kind: 'service_hint', interests: ['Services & Lokales', 'Freizeit & Bewegung', 'bike', 'repair'], days: 'weekdays', durationDays: 14, radius: 180, matchReason: 'Unterwegs-Service mit kleinem Radius und ohne Dringlichkeit.' }),
  content({ key: 'cnt_andritz_friseur_service_v1', locationKey: 'loc_andritz_schnittig', title: 'Lokaler Service in Andritz', text: 'Pre-Alpha-Hinweis: Dieser reale Ort passt zu deinem Interesse lokaler Service.', kind: 'service_hint', interests: ['Services & Lokales', 'services', 'hairdresser', 'local'], days: 'weekdays', durationDays: 30, radius: 220, matchReason: 'Servicekategorie ohne Angebotsdruck.' }),
  content({ key: 'cnt_gratwein_leitner_pause_v1', locationKey: 'loc_gratwein_baeckerei_leitner', title: 'Kaffee und Pause in 8111', text: 'Demo-Hinweis: In deiner Naehe gibt es einen passenden Ort fuer Kaffee und kurze Pause.', kind: 'pause_hint', interests: ['Essen & Trinken', 'Kaffee & Pause', 'coffee_pause', 'bakery'], days: 'morningWeekdays', window: '07:00-14:00', durationDays: 14, radius: 220, priority: 'normal', pushEligibility: 'eligible_normal', visibility: 'active_public_demo', cooldown: 24, matchReason: 'Gratwein-Strassengel, Kaffee/Pause und aktives Zeitfenster.' }),
  content({ key: 'cnt_gratwein_click_clack_food_v1', locationKey: 'loc_gratwein_click_clack', title: 'Kaffee oder Essen nahe Bahnhof', text: 'Pre-Alpha-Hinweis: Dieser reale Ort passt zu deinem Interesse Kaffee, Essen oder kurze Pause.', kind: 'neutral_hint', interests: ['Essen & Trinken', 'Kaffee & Pause', 'nearby_food', 'transit'], days: 'all', window: '08:00-16:00', durationDays: 7, radius: 240, priority: 'normal', pushEligibility: 'eligible_normal', visibility: 'active_public_demo', cooldown: 24, matchReason: 'Bahnhofsnahe Alltagsnaehe in 8111.' }),
  content({ key: 'cnt_gratwein_gemeinde_service_v1', locationKey: 'loc_gratwein_gemeindeamt', title: 'Lokaler Buergerdienst-Ort', text: 'Demo-Hinweis: Dieser reale Ort ist als lokaler Servicepunkt im Testgebiet sichtbar.', kind: 'service_hint', interests: ['Services & Lokales', 'local_service', 'civic', 'orientation'], days: 'weekdays', durationDays: 30, radius: 220, cooldown: 96, matchReason: 'Lokaler Servicepunkt, nur als ruhiger In-App-Hinweis.' }),
  content({ key: 'cnt_maria_strassengel_kultur_v1', locationKey: 'loc_maria_strassengel', title: 'Kulturort am Kirchberg', text: 'Redaktioneller Demo-Hinweis: In der Naehe befindet sich ein markanter Kulturort.', kind: 'editorial_hint', interests: ['Kultur & Events', 'culture', 'landmark', 'walking'], days: 'all', window: '09:00-18:00', durationDays: 30, radius: 280, cooldown: 96, matchReason: 'Kulturkategorie in 8111 sichtbar, ohne Eventclaim.' }),
  content({ key: 'cnt_stift_rein_kultur_v1', locationKey: 'loc_stift_rein', title: 'Ausflugs- und Kulturort Rein', text: 'Redaktioneller Demo-Hinweis: Dieser reale Ort passt zu deinem Interesse Kultur oder kurzer Ausflug.', kind: 'editorial_hint', interests: ['Kultur & Events', 'culture', 'outing', 'walking'], days: 'weekend', window: '09:00-18:00', durationDays: 14, radius: 450, cooldown: 96, matchReason: 'Kultur/Ausflug im erweiterten 8111-Gebiet, leise ausgespielt.' }),
  content({ key: 'cnt_kunstzug_gratwein_v1', locationKey: 'loc_kunstzug_gratwein', title: 'Oeffentlicher Kulturpunkt in Gratwein', text: 'Redaktioneller Demo-Hinweis: Ein Kulturpunkt im Testgebiet ist fuer Karte und Route vorgemerkt.', kind: 'editorial_hint', interests: ['Kultur & Events', 'culture', 'public_art'], days: 'all', window: '10:00-18:00', durationDays: 7, radius: 230, cooldown: 96, matchReason: 'Staerkt Kultur & Events ohne erfundenes Event.' }),
  content({ key: 'cnt_gratwein_erlebnisbad_familie_v1', locationKey: 'loc_gratwein_erlebnisbad', title: 'Freizeitpunkt fuer Familie', text: 'Redaktioneller Demo-Hinweis: Dieser reale Ort passt zu deinem Interesse Freizeit oder Familie.', kind: 'editorial_hint', interests: ['Freizeit & Bewegung', 'family', 'swimming', 'leisure'], days: 'weekend', durationDays: 30, radius: 350, matchReason: 'Familien-/Freizeitanker fuer Gratwein, ohne Saisonclaim.' }),
  content({ key: 'cnt_gratwein_pralatenweg_route_v1', locationKey: 'loc_gratwein_pralatenweg', title: 'Spazierroute bei Rein', text: 'Redaktioneller Demo-Hinweis: Diese Umgebung passt zu deinem Interesse Bewegung und Natur.', kind: 'editorial_hint', interests: ['Freizeit & Bewegung', 'walking', 'nature', 'route'], days: 'all', window: '08:00-18:00', durationDays: 30, radius: 500, cooldown: 96, matchReason: 'Route/Bewegung im 8111-Umfeld, nur In-App.' }),
  content({ key: 'cnt_gratwein_zweirad_service_v1', locationKey: 'loc_gratwein_zweirad_janger', title: 'Fahrradservice in Gratwein', text: 'Pre-Alpha-Hinweis: Dieser reale Servicepunkt passt zu deinem Interesse Fahrrad oder lokaler Service.', kind: 'service_hint', interests: ['Services & Lokales', 'Freizeit & Bewegung', 'bike', 'repair'], days: 'weekdays', durationDays: 14, radius: 280, matchReason: 'Verbindet Bewegung und Service, ohne Reparaturclaim.' }),
  content({ key: 'cnt_gratwein_hauptplatz_pause_v1', locationKey: 'loc_gratwein_hauptplatz_pause', title: 'Kurzer Pausenpunkt am Hauptplatz', text: 'Redaktioneller Demo-Hinweis: Ein ruhiger kurzer Stopp im Testgebiet ist fuer In-App-Hinweise vorgemerkt.', kind: 'pause_hint', interests: ['Ruhe & Pause', 'quiet_place', 'pause', 'local'], days: 'all', window: '11:00-18:00', durationDays: 7, radius: 200, cooldown: 96, matchReason: 'Staerkt Ruhe & Pause direkt in 8111.' }),
  content({ key: 'cnt_rein_stiftsbereich_pause_v1', locationKey: 'loc_rein_stiftsbereich_pause', title: 'Ruhiger Ort im Kulturumfeld Rein', text: 'Redaktioneller Demo-Hinweis: Diese Umgebung passt zu deinem Interesse Ruhe, Pause oder Kultur.', kind: 'pause_hint', interests: ['Ruhe & Pause', 'Kultur & Events', 'quiet_place', 'culture'], days: 'all', window: '09:00-18:00', durationDays: 14, radius: 320, cooldown: 96, matchReason: 'Ruhe/Pause mit Kulturumfeld, bewusst ohne Push.' }),
  content({ key: 'cnt_gratwein_trafik_daily_v1', locationKey: 'loc_gratwein_trafik_senekowitsch', title: 'Kleiner Nahversorgungspunkt in 8111', text: 'Pre-Alpha-Hinweis: Dieser reale Ort ist als lokaler Alltagspunkt im Testgebiet sichtbar.', kind: 'neutral_hint', interests: ['Einkaufen & Nahversorgung', 'daily_needs', 'local_supply'], days: 'weekdays', durationDays: 30, radius: 190, matchReason: 'Nahversorgung lokal, ohne Produktwerbung.' }),
  content({ key: 'cnt_gratwein_bank_alltag_v1', locationKey: 'loc_gratwein_bank_hauptplatz', title: 'Alltagspunkt am Hauptplatz', text: 'Sachlicher Demo-Hinweis: Dieser reale Standort passt zu deinem Interesse Alltag in der Naehe.', kind: 'neutral_hint', interests: ['Gesundheit & Alltag', 'daily_needs', 'orientation'], days: 'weekdays', durationDays: 14, radius: 190, cooldown: 96, matchReason: 'Alltagsorientierung in 8111, ohne Finanzclaim.' }),
  content({ key: 'cnt_goesting_kfz_service_v1', locationKey: 'loc_goesting_kfz_reinprecht', title: 'Werkstatt-Service in Goesting', text: 'Pre-Alpha-Hinweis: Dieser reale Servicepunkt passt zu deinem Interesse Reparatur oder lokaler Service.', kind: 'service_hint', interests: ['Services & Lokales', 'repair', 'car_service', 'local_service'], days: 'weekdays', durationDays: 30, radius: 350, cooldown: 96, matchReason: 'Lokale Servicekategorie testen, ohne Leistungsversprechen.' }),
  content({ key: 'cnt_murauen_judendorf_pause_v1', locationKey: 'loc_murauen_judendorf', title: 'Ruhiger Spazierpunkt bei Judendorf', text: 'Redaktioneller Demo-Hinweis: Diese Umgebung ist als leiser Pausen- und Bewegungsort vorgemerkt.', kind: 'pause_hint', interests: ['Ruhe & Pause', 'Freizeit & Bewegung', 'nature', 'walking'], days: 'all', window: '09:00-19:00', durationDays: 30, radius: 900, cooldown: 96, matchReason: 'Leiser Ruhe- und Bewegungsanker nahe 8111.' }),
];

const locationByKey = new Map(LOCATIONS.map((entry) => [entry.key, entry]));

function countBy(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function countContentBy(field) {
  return CONTENT.reduce((acc, row) => {
    const key = row[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function contentGeoDistribution() {
  return CONTENT.reduce((acc, row) => {
    const loc = locationByKey.get(row.locationKey);
    const key = loc?.area?.includes('Gratwein') ? 'Gratwein-Strassengel / 8111' : 'Graz-Nord / Goesting / Andritz';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function validateSeedData() {
  const locationKeys = new Set();
  const contentKeys = new Set();
  for (const row of LOCATIONS) {
    if (locationKeys.has(row.key)) throw new Error(`duplicate location key: ${row.key}`);
    locationKeys.add(row.key);
    const [lng, lat] = row.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error(`invalid coordinates for ${row.key}`);
    if (!row.sourceUrl) throw new Error(`missing sourceUrl for ${row.key}`);
  }
  for (const row of CONTENT) {
    if (contentKeys.has(row.key)) throw new Error(`duplicate content key: ${row.key}`);
    contentKeys.add(row.key);
    if (!locationKeys.has(row.locationKey)) throw new Error(`content ${row.key} references missing ${row.locationKey}`);
    if (row.suggestedPushPriority === 'high_attention') throw new Error(`high_attention is forbidden: ${row.key}`);
    if (row.radiusMeters < 150 || row.radiusMeters > 900) throw new Error(`radius out of range for ${row.key}`);
  }
}

async function ensureDemoOwner() {
  let user = await User.findOne({ email: DEMO_OWNER_EMAIL });
  if (user) return user;
  if (DRY_RUN) return null;
  return User.create({
    name: 'StepsMatch Pitch Demo Seed Owner',
    email: DEMO_OWNER_EMAIL,
    password: `seed-${randomUUID()}`,
    interests: [],
    emailVerified: true,
  });
}

function providerPayload(row, userId) {
  return {
    name: row.name,
    address: row.address,
    category: row.category,
    subcategory: row.subcategory,
    description: `SEED:${SEED_TAG}; ${row.demoLabel}`,
    radiusMeters: row.radiusMeters,
    demoKey: row.key,
    demoSeedTag: SEED_TAG,
    gebiet: row.area,
    contentType: row.contentType,
    publicVisibility: row.publicVisibility,
    demoLabel: row.demoLabel,
    sourceUrl: row.sourceUrl,
    sourceVerifiedAt: new Date(row.sourceVerifiedAt),
    riskNote: row.riskNote,
    contact: { website: row.sourceUrl },
    location: { type: 'Point', coordinates: row.coordinates },
    user: userId,
  };
}

function offerPayload(row, provider, locationRow) {
  const validFrom = dateOnlyUtc(-1);
  const validTo = dateOnlyUtc(row.durationDays);
  const interestAliases = legacyInterestAliases(locationRow);
  return {
    provider: provider._id,
    category: locationRow.category,
    subcategory: locationRow.subcategory,
    demoKey: row.key,
    demoSeedTag: SEED_TAG,
    name: row.title,
    description: row.text,
    radius: row.radiusMeters,
    interestsRequired: Array.from(new Set([...row.interests, ...row.interests.map(slugify), ...interestAliases])),
    validDays: row.activeDays,
    activeDays: row.activeDays,
    validTimes: row.activeTimeWindows[0] || { from: null, to: null },
    activeTimeWindows: row.activeTimeWindows,
    validDates: { from: validFrom, to: validTo },
    validFrom,
    validTo,
    contentType: locationRow.contentType,
    contentKind: row.kind,
    publicVisibility: row.publicVisibility,
    demoLabel: 'Pre-Alpha-Demo-Hinweis, kein offizieller Partner',
    pushEligibility: row.pushEligibility,
    suggestedPushPriority: row.suggestedPushPriority,
    matchReason: row.matchReason,
    riskNote: locationRow.riskNote,
    sourceUrl: locationRow.sourceUrl,
    sourceVerifiedAt: new Date(locationRow.sourceVerifiedAt),
    geoValidity: 'point_radius',
    cooldownSuggestionHours: row.cooldownSuggestionHours,
    contact: `SEED:${SEED_TAG}; demoKey=${row.key}`,
    images: [],
    location: { type: 'Point', coordinates: locationRow.coordinates },
    languages: ['de'],
  };
}

function legacyInterestAliases(locationRow) {
  const text = `${locationRow.category || ''} ${locationRow.subcategory || ''}`.toLowerCase();
  const aliases = [];
  if (text.includes('restaurant') || text.includes('gasthaus') || text.includes('pizzeria')) aliases.push('restaurant');
  if (text.includes('cafe')) aliases.push('cafe');
  if (text.includes('baeckerei')) aliases.push('baeckerei');
  if (text.includes('bar')) aliases.push('bar');
  if (text.includes('apotheke')) aliases.push('apotheke');
  if (text.includes('drogerie')) aliases.push('drogerie');
  if (text.includes('lebensmittel') || text.includes('nahversorgung')) aliases.push('supermarkt');
  if (text.includes('trafik')) aliases.push('kiosk');
  if (text.includes('friseur')) aliases.push('friseur');
  if (text.includes('bank')) aliases.push('haushaltswaren');
  return aliases;
}

function printSummary({ existingProviders, existingOffers, nonDemoProviderNameCollisions = 0 }) {
  const gratweinProviders = LOCATIONS.filter((row) => row.area.includes('Gratwein')).length;
  const gratweinOffers = CONTENT.filter((row) => locationByKey.get(row.locationKey)?.area.includes('Gratwein')).length;
  console.log(`[pitch-demo] mode=${DRY_RUN ? 'dry-run' : 'apply'} tag=${SEED_TAG}`);
  console.log(`[pitch-demo] providers total=${LOCATIONS.length} create=${LOCATIONS.length - existingProviders} update=${existingProviders}`);
  console.log(`[pitch-demo] offers total=${CONTENT.length} create=${CONTENT.length - existingOffers} update=${existingOffers}`);
  console.log(`[pitch-demo] provider geo Gratwein=${gratweinProviders} (${Math.round((gratweinProviders / LOCATIONS.length) * 100)}%) Graz-Nord/Andritz/Goesting=${LOCATIONS.length - gratweinProviders}`);
  console.log(`[pitch-demo] offer geo`, contentGeoDistribution());
  console.log(`[pitch-demo] provider categories`, countBy(LOCATIONS, 'category'));
  console.log(`[pitch-demo] offer categories`, CONTENT.reduce((acc, row) => {
    const category = locationByKey.get(row.locationKey)?.category || 'unknown';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {}));
  console.log(`[pitch-demo] visibility`, countContentBy('publicVisibility'));
  console.log(`[pitch-demo] pushEligibility`, countContentBy('pushEligibility'));
  console.log(`[pitch-demo] pushPriority`, countContentBy('suggestedPushPriority'));
  console.log(`[pitch-demo] durations`, countContentBy('durationDays'));
  console.log(`[pitch-demo] non-demo provider name collisions ignored=${nonDemoProviderNameCollisions}`);
  console.log('[pitch-demo] examples', {
    providers: LOCATIONS.slice(0, 3).map((row) => ({ key: row.key, name: row.name, area: row.area, visibility: row.publicVisibility })),
    offers: CONTENT.slice(0, 3).map((row) => ({ key: row.key, title: row.title, push: row.pushEligibility, radius: row.radiusMeters })),
  });
}

async function run() {
  validateSeedData();
  if (!MONGO_URI) throw new Error('Mongo URI missing. Set MONGO_URI, MONGODB_URI, or DATABASE_URL.');

  const connectOptions = {};
  if (process.env.MONGO_TLS_ALLOW_INVALID_CERTIFICATES === '1') {
    connectOptions.tlsAllowInvalidCertificates = true;
  }
  await mongoose.connect(MONGO_URI, connectOptions);

  const locationKeys = LOCATIONS.map((row) => row.key);
  const contentKeys = CONTENT.map((row) => row.key);
  const existingProviders = await Provider.find({ demoSeedTag: SEED_TAG, demoKey: { $in: locationKeys } }).select('demoKey').lean();
  const existingOffers = await Offer.find({ demoSeedTag: SEED_TAG, demoKey: { $in: contentKeys } }).select('demoKey').lean();
  const nonDemoProviderNameCollisions = await Provider.countDocuments({
    demoSeedTag: { $ne: SEED_TAG },
    name: { $in: LOCATIONS.map((row) => row.name) },
  });

  printSummary({
    existingProviders: existingProviders.length,
    existingOffers: existingOffers.length,
    nonDemoProviderNameCollisions,
  });

  if (DRY_RUN) {
    console.log('[pitch-demo] dry-run only: no database writes performed');
    return;
  }

  const owner = await ensureDemoOwner();
  const providerByKey = new Map();
  for (const row of LOCATIONS) {
    const provider = await Provider.findOneAndUpdate(
      { demoSeedTag: SEED_TAG, demoKey: row.key },
      { $set: providerPayload(row, owner._id) },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    providerByKey.set(row.key, provider);
  }

  for (const row of CONTENT) {
    const loc = locationByKey.get(row.locationKey);
    const provider = providerByKey.get(row.locationKey);
    await Offer.findOneAndUpdate(
      { demoSeedTag: SEED_TAG, demoKey: row.key },
      { $set: offerPayload(row, provider, loc) },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  const finalProviders = await Provider.countDocuments({ demoSeedTag: SEED_TAG });
  const finalOffers = await Offer.countDocuments({ demoSeedTag: SEED_TAG });
  console.log(`[pitch-demo] import done providers=${finalProviders} offers=${finalOffers}`);
}

run()
  .catch((err) => {
    console.error('[pitch-demo] failed:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
  });
