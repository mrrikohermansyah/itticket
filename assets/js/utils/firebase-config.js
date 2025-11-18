// Firebase configuration dari CONFIG
const firebaseConfig = window.CONFIG?.FIREBASE_CONFIG || {
    apiKey: "AIzaSyCQR--hn0RDvDduCjA2Opa9HLzyYn_GFIs",
    authDomain: "itticketing-f926e.firebaseapp.com",
    projectId: "itticketing-f926e",
    storageBucket: "itticketing-f926e.firebasestorage.app",
    messagingSenderId: "10687213121",
    appId: "1:10687213121:web:af3b530a7c45d3ca2d8a7e",
    measurementId: "G-8H0EP72PC2"
};

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const siteKey = window.CONFIG?.RECAPTCHA_V3_SITE_KEY;
const enableAppCheck = !!window.CONFIG?.APPCHECK_ENABLED;
const debugAppCheck = !!window.CONFIG?.APPCHECK_DEBUG;
const debugToken = window.CONFIG?.APPCHECK_DEBUG_TOKEN;

if (enableAppCheck && siteKey && !window.__APP_CHECK_INIT__) {
    window.__APP_CHECK_INIT__ = true;
    if (debugAppCheck) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true;
    }
    try {
        initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(siteKey),
            isTokenAutoRefreshEnabled: true
        });
        console.log('✅ App Check initialized');
    } catch (e) {
        console.warn('⚠️ App Check init failed:', e && e.message ? e.message : e);
    }
} else if (!enableAppCheck || !siteKey) {
    console.log('ℹ️ App Check disabled');
}

export { auth, db };