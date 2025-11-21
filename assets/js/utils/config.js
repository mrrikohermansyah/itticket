// ======================================================
// 🔹 js/config.js - Shared Configuration
// ======================================================

// ==================== 🔹 FIREBASE CONFIGURATION ====================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCQR--hn0RDvDduCjA2Opa9HLzyYn_GFIs",
    authDomain: "itticketing-f926e.firebaseapp.com",
    projectId: "itticketing-f926e",
    storageBucket: "itticketing-f926e.firebasestorage.app",
    messagingSenderId: "10687213121",
    appId: "1:10687213121:web:af3b530a7c45d3ca2d8a7e",
    measurementId: "G-8H0EP72PC2"
};

// ==================== 🔹 Ticket ID Generator ====================
window.generateTicketId = function (department, deviceType, location = "", firestoreId = "", overrideDate) {
  const timestamp = overrideDate instanceof Date ? overrideDate : new Date();
  const dateStr = timestamp.toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
  
  // ✅ AMBIL 3 KARAKTER TERAKHIR DARI FIRESTORE ID
  const randomStr = firestoreId 
    ? firestoreId.slice(-3).toUpperCase()  // 3 karakter terakhir dari ID
    : Math.random().toString(36).substring(2, 5).toUpperCase(); // Fallback random

  // Department codes
  const deptCodes = {
    IT: "IT",
    HR: "HR",
    Finance: "FIN",
    Maintenance: "MNT",
    HSE: "HSE",
    Warehouse: "WH",
    Management: "MGT",
    QC: "QC",
    Procurement: "PRO",
    Engineer: "ENG",
    Completion: "COMP",
    "Document Control": "DOC",
    Clinic: "CLN",
    Planner: "PLN",
    Vendor: "VDR",
    Lainlain: "GEN",
  };

  // Device type codes
  const deviceCodes = {
    "PC Hardware": "HW",
    "PC Software": "SW",
    Laptop: "LP",
    Printer: "PR",
    Network: "NET",
    Projector: "PJ",
    "Backup Data": "BK",
    Others: "OT",
  };

  // Location codes
  const locationCodes = {
    "Blue Office": "BLU",
    "White Office": "WHT",
    "Green Office": "GRN",
    "Red Office": "RED",
    "White Office 2nd Fl": "W2F",
    "White Office 3rd Fl": "W3F",
    Warehouse: "WH",
    Workshop9: "WS9",
    Workshop10: "WS10",
    Workshop11: "WS11",
    Workshop12: "WS12",
      Yard: "YRD",
      Security: "SEC",
      Clinic: "CLN",
    "Control Room": "CTL",
    "Dark Room": "DRK",
    HRD: "HRD",
    "IT Store": "ITS",
    "HSE Yard": "HSY",
    Maintenance: "MNT",
    "Multi Purposes Building": "MPB",
    "Welding School": "WLD",
    Lainlain: "GEN",
  };

  const deptCode = deptCodes[department] || "GEN";
  const deviceCode = deviceCodes[deviceType] || "OT";
  const locCode = locationCodes[location] || "GEN";

  return `${deptCode}-${locCode}-${deviceCode}-${dateStr}-${randomStr}`;
};

// ==================== 🔹 Device Type Mapping ====================
const DEVICE_TYPE_MAPPING = {
  "PC Hardware": "HW",
  Laptop: "HW",
  Printer: "HW",
  Projector: "HW",
  "PC Software": "SW",
  Network: "NW",
  "Backup Data": "DR",
  Others: "OT",
};

// ==================== 🔹 IT Staff List ====================
const IT_STAFF = [
  "Riko Hermansyah",
  "Devi Armanda",
  "Wahyu Nugroho",
  "Abdurahman Hakim",
];

// ==================== 🔹 Admin Emails Whitelist ====================
const ADMIN_EMAILS = [
  "mr.rikohermansyah@gmail.com",
  "riko.hermansyah@meitech-ekabintan.com",
  "devi.armanda@meitech-ekabintan.com",
  "wahyu.nugroho@meitech-ekabintan.com",
  "abdurahman.hakim@meitech-ekabintan.com",
  "ade.reinalwi@meitech-ekabintan.com",
  "admin@meitech-ekabintan.com",
  "nimda@meitech-ekabintan.com",
];

// ==================== 🔹 Admin Name Mapping ====================
const ADMIN_NAME_MAPPING = {
  "mr.rikohermansyah@gmail.com": "Riko Hermansyah",
  "riko.hermansyah@meitech-ekabintan.com": "Riko Hermansyah",
  "devi.armanda@meitech-ekabintan.com": "Devi Armanda",
  "wahyu.nugroho@meitech-ekabintan.com": "Wahyu Nugroho",
  "abdurahman.hakim@meitech-ekabintan.com": "Abdurahman Hakim",
  "ade.reinalwi@meitech-ekabintan.com": "Ade Reinalwi",
  "admin@meitech-ekabintan.com": "System Admin",
  "nimda@meitech-ekabintan.com": "System Admin",
};

// Export untuk modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DEVICE_TYPE_MAPPING,
    IT_STAFF,
    ADMIN_EMAILS,
    ADMIN_NAME_MAPPING,
  };
} else {
  window.CONFIG = {
    FIREBASE_CONFIG: FIREBASE_CONFIG,
    RECAPTCHA_V3_SITE_KEY: '6LcwPxAsAAAAAPguM-TsDsmczv1p3CZKGh4qAR-M',
    DEVICE_TYPE_MAPPING: DEVICE_TYPE_MAPPING,
    IT_STAFF: IT_STAFF,
    ADMIN_EMAILS: ADMIN_EMAILS,
    ADMIN_NAME_MAPPING: ADMIN_NAME_MAPPING
  };

  (function() {
    var stored = localStorage.getItem('theme');
    var prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var current = stored || prefers;
    function applyTheme(t) {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('theme', t);
      var btn = document.getElementById('themeToggleBtn');
      if (btn) {
        btn.innerHTML = t === 'dark' ? '<i class="fas fa-sun"></i> LIGHT MODE' : '<i class="fas fa-moon"></i> DARK MODE';
        if (t === 'dark') {
          btn.classList.add('is-dark');
        } else {
          btn.classList.remove('is-dark');
        }
      }
    }
    applyTheme(current);
    document.addEventListener('DOMContentLoaded', function() {
      var btn = document.getElementById('themeToggleBtn');
      if (btn) {
        btn.addEventListener('click', function() {
          var next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
          applyTheme(next);
        });
      }
    });
  })();
}
