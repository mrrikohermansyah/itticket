// ======================================================
// 🔹 js/config.js - Shared Configuration
// ======================================================

// ==================== 🔹 Ticket ID Generator ====================
window.generateTicketId = function (department, deviceType, location = "") {
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
  const timeStr = timestamp.toISOString().slice(11, 17).replace(/:/g, ""); // HHMMSS
  const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 char random

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
  // Untuk browser
  window.CONFIG = {
    DEVICE_TYPE_MAPPING,
    IT_STAFF,
    ADMIN_EMAILS,
    ADMIN_NAME_MAPPING,
  };
}
