// Firebase configuration dari CONFIG
const firebaseConfig = window.CONFIG?.FIREBASE_CONFIG || {
  apiKey: "AIzaSyCQR--hn0RDvDduCjA2Opa9HLzyYn_GFIs",
  authDomain: "itticketing-f926e.firebaseapp.com",
  projectId: "itticketing-f926e",
  storageBucket: "itticketing-f926e.firebasestorage.app",
  messagingSenderId: "896370077103",
  appId: "1:896370077103:web:1d692e88b611bff838935a",
  measurementId: "G-TJCHPXG7D5",
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
try {
  console.info("Firebase initialized", { projectId: firebaseConfig.projectId });
} catch (e) {}
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
});
try {
  console.info("Firestore configured", {
    longPolling: true,
    ignoreUndefinedProperties: true,
  });
} catch (e) {}

try {
  setPersistence(auth, browserSessionPersistence).catch(() => {});
} catch (e) {}
try {
  console.info("Auth persistence", { mode: "session" });
} catch (e) {}

// Expose for legacy/global consumers
try {
  window.auth = auth;
} catch (e) {}
try {
  window.db = db;
} catch (e) {}

export { auth, db };

// Ticket code generation with optional activity mapping
try {
  const deptMap = {
    Clinic: "CLN",
    Client: "CLI",
    Completion: "COM",
    DC: "DC",
    "Document Control": "DOC",
    Engineer: "ENG",
    Finance: "FIN",
    HR: "HR",
    HSE: "HSE",
    IT: "IT",
    Planner: "PLN",
    Maintenance: "MNT",
    Management: "MGT",
    Procurement: "PRO",
    QC: "QC",
    Vendor: "VEN",
    Warehouse: "WH",
    Lainlain: "OTH",
  };
  const locMap = {
    "Blue Office": "BLU",
    Clinic: "CLN",
    "Control Room": "CTL",
    "Dark Room": "DRK",
    "Green Office": "GRN",
    HRD: "HRD",
    "HSE Yard": "HSY",
    "IT Server": "ITV",
    "IT Store": "ITS",
    "Multi Purposes Building": "MPB",
    "Red Office": "RED",
    Security: "SEC",
    "White Office": "WHT",
    "White Office 2nd Fl": "W2F",
    "White Office 3rd Fl": "W3F",
    "Welding School": "WLD",
    Workshop9: "WS9",
    Workshop10: "WS10",
    Workshop11: "WS11",
    Workshop12: "WS12",
    Yard: "YRD",
    Lainlain: "OTH",
  };
  const devMap = {
    "Backup Data": "DR",
    Drone: "DR",
    Laptop: "LP",
    Network: "NET",
    "PC Hardware": "HW",
    "PC Software": "SW",
    Printer: "PR",
    Projector: "PJ",
    Others: "OT",
  };
  const activityCode = function (activity) {
    const a = (activity || "").trim().toLowerCase();
    if (!a) return "";
    if (a === "deliver") return "MV";
    if (a === "software install") return "SW";
    if (a === "software config") return "SW";
    if (a === "install it standard apps") return "SW";
    if (a === "reinstall windows") return "SW";
    if (a === "pc hardware") return "HW";
    if (a === "setup meeting") return "HW";
    if (a === "network") return "NET";
    if (a === "connect share folder") return "NET";
    if (a === "drone update area" || a === "drone lifting") return "DR";
    if (a === "back up data") return "DR";
    if (
      a === "weekly safety talk" ||
      a === "ceremony sail away" ||
      a === "stand by meeting" ||
      a === "stand by sunday" ||
      a === "other"
    )
      return "OT";
    return "";
  };
  const getCode = function (value, map) {
    const v = (value || "").toString();
    if (!v) return "";
    const direct = map[v];
    if (direct) return direct;
    const keys = Object.keys(map);
    const found = keys.find(
      (k) =>
        v.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(v.toLowerCase())
    );
    return found ? map[found] : v.substring(0, 3).toUpperCase();
  };
  window.generateTicketId = function (
    department,
    device,
    location,
    firestoreId,
    activity
  ) {
    const dept = getCode(department, deptMap) || "GEN";
    const loc = getCode(location, locMap) || "GEN";
    const dev = getCode(device, devMap) || "OT";
    const act = activityCode(activity);
    const seg = act || dev;
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const dateSeg = yy + mm;
    const idSeg =
      typeof firestoreId === "string" && firestoreId.length >= 3
        ? firestoreId.slice(-3).toUpperCase()
        : "XXX";
    return `${dept}-${loc}-${seg}-${dateSeg}-${idSeg}`;
  };
} catch (e) {}
