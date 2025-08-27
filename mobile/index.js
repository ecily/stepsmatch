// stepsmatch/mobile/index.js

// WICHTIG: Side-Effect-Import, registriert die BG-Location-Task beim Bundle-Load
import './tasks/bgLocationTask';

// expo-router Entry (muss zuletzt importiert werden)
import 'expo-router/entry';
