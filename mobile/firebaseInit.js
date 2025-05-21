// /firebaseInit.js
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSyB8nxrj1AEWJwtJSCD3aKbVB4_GgopCTOs",
  projectId: "stepsmatch",
  appId: "1:469265595395:android:6d31d44c224cc95d692236",
  messagingSenderId: "469265595395"
};

const firebaseApp = initializeApp(firebaseConfig);

export default firebaseApp;
