// firebase.js — Andi MVP

import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "local-dummy-key",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localhost",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "andi-mvp-local",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "localhost",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "1:123:web:abc12345",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

if (window.location.hostname === "localhost" && import.meta.env.VITE_USE_EMULATOR === "true") {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  console.info('[Andi] Conectado al emulador local ✓');
}

let _authResolve;
export const authReady = new Promise(resolve => { _authResolve = resolve; });

function trySignIn() {
  signInAnonymously(auth).then(() => {
    console.info('[Andi] Sesión anónima OK ✓');
  }).catch(err => {
    console.error('[Andi] Auth FALLÓ, reintentando en 3s:', err.code);
    setTimeout(trySignIn, 3000);
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.info('[Andi] Auth listo, uid:', user.uid.slice(0, 8));
    _authResolve(user);
  }
});

if (!auth.currentUser) {
  trySignIn();
} else {
  _authResolve(auth.currentUser);
}

export const analytics = null;
export default app;
