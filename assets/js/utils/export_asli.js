// ======================================================
// ?? js/export.js - Excel Export with Current User Filter (FIXED DURATION)
// ======================================================

// ==================== ?? ExcelJS Loader ====================
function loadExcelJS() {
  return new Promise((resolve, reject) => {
    if (window.ExcelJS) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ==================== ?? UNIVERSAL TIMESTAMP PARSER ====================
function parseUniversalTimestamp(timestamp) {
  if (!timestamp) return null;
  
  try {
    // Case 1: Firebase Timestamp object with toDate() method
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Case 2: Firebase Timestamp object with seconds/nanoseconds
    if (timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    }
    
    // Case 3: ISO string
    if (typeof timestamp === 'string') {
      // Handle Firebase ISO string format
      if (timestamp.includes('T') && timestamp.includes('Z')) {
        return new Date(timestamp);
      }
      // Handle other string formats
      const date = new Date(timestamp);
      return !isNaN(date.getTime()) ? date : null;
    }
    
    // Case 4: Regular Date object or milliseconds
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) ? date : null;
    
  } catch (error) {
    console.warn("?? Error parsing timestamp:", timestamp, error);
    return null;
  }
}

// ==================== 🛠️ FIXED Duration Calculation (ALWAYS IN MINUTES) ====================
function calculateDurationForExport(ticket) {
  try {
    const status = ticket.status_ticket || ticket.status || "Open";
    if (!(status === "Resolved" || status === "Closed" || status === "Finished" || status === "Completed")) {
      return "0 Minutes";
    }

    let endDate = null;
    const updateEntries = Array.isArray(ticket.updates) ? ticket.updates : [];
    for (let i = updateEntries.length - 1; i >= 0; i--) {
      const u = updateEntries[i];
      const s = (u && u.status) ? String(u.status).trim() : '';
      if (s === 'Resolved' || s === 'Closed' || s === 'Finished' || s === 'Completed') {
        const ts = parseUniversalTimestamp(u.timestamp);
        if (ts && !isNaN(ts.getTime())) { endDate = ts; break; }
      }
    }
    if (!endDate) {
      const endCandidates = [ticket.resolved_at, ticket.closed_at, ticket.last_updated, ticket.updatedAt];
      for (const c of endCandidates) {
        const ts = parseUniversalTimestamp(c);
        if (ts && !isNaN(ts.getTime())) { endDate = ts; break; }
      }
    }
    if (!endDate) endDate = new Date();

    let startDate = null;
    const reopenTs = parseUniversalTimestamp(ticket.reopen_at);
    if (reopenTs && !isNaN(reopenTs.getTime()) && reopenTs <= endDate) {
      startDate = reopenTs;
    } else if (updateEntries.length > 0) {
      for (let i = updateEntries.length - 1; i >= 0; i--) {
        const u = updateEntries[i];
        const s = (u && u.status) ? String(u.status).trim() : '';
        const ts = parseUniversalTimestamp(u.timestamp);
        if ((s === 'Open' || s === 'Reopen') && ts && !isNaN(ts.getTime()) && ts <= endDate) {
          startDate = ts; break;
        }
      }
    }
    if (!startDate) {
      const createdCandidates = [ticket.created_at, ticket.createdAt, ticket.timestamp, ticket.date_created];
      for (const c of createdCandidates) {
        const ts = parseUniversalTimestamp(c);
        if (ts && !isNaN(ts.getTime())) { startDate = ts; break; }
      }
    }
    if (!startDate) return "0 Minutes";
    if (endDate < startDate) endDate = new Date();
    const diffMs = endDate - startDate;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return diffMinutes === 1 ? "1 Minute" : `${diffMinutes} Minutes`;

  } catch (error) {
    console.error("🛠️ Error calculating duration for ticket:", ticket.id, error);
    return "0 Minutes";
  }
}

// ==================== ?? FIXED Date Formatting ====================
function formatDateForExcel(ts) {
  if (!ts) return "-";
  
  try {
    const date = parseUniversalTimestamp(ts);
    
    if (!date || isNaN(date.getTime())) {
      console.warn("?? Invalid date for formatting:", ts);
      return "-";
    }

    // Format: DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
    
  } catch (error) {
    console.warn("?? Date formatting error:", error, "for timestamp:", ts);
    return "-";
  }
}

// ==================== ?? Device Type Mapping Function ====================
function getDeviceCode(deviceType) {
    const deviceMapping = {
        "PC Hardware": "HW",
        "Laptop": "HW", 
        "Printer": "HW",
        "Projector": "HW",
        "PC Software": "SW",
        "Network": "NW",
        "Backup Data": "DR",
        "Drone": "DR",
        "Others": "OT"
    };
    
    const normalizedDevice = (deviceType || "").trim();
    
    if (deviceMapping[normalizedDevice]) {
        return deviceMapping[normalizedDevice];
    }
    
    const lowerDevice = normalizedDevice.toLowerCase();
    if (lowerDevice.includes('hardware') || lowerDevice.includes('pc') || lowerDevice.includes('laptop') || 
        lowerDevice.includes('printer') || lowerDevice.includes('projector')) {
        return "HW";
    }
    if (lowerDevice.includes('software')) {
        return "SW";
    }
    if (lowerDevice.includes('network')) {
        return "NW";
    }
    if (lowerDevice.includes('backup') || lowerDevice.includes('data') || lowerDevice.includes('drone')) {
        return "DR";
    }
    
    return "OT";
}

function toProperCase(s) {
  if (!s) return "-";
  const v = String(s).trim();
  if (!v || v === "-") return "-";
  return v.toLowerCase().split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : "").join(" ");
}

// ==================== ?? Get Current Admin User ====================
function getCurrentAdminUser() {
  try {
    if (window.adminDashboard && window.adminDashboard.adminUser) {
      return window.adminDashboard.adminUser;
    }
    
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) {
      return JSON.parse(adminUser);
    }
    
    if (window.firebaseAuthService && typeof window.firebaseAuthService.getCurrentUser === 'function') {
      const user = window.firebaseAuthService.getCurrentUser();
      if (user) {
        return {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email
        };
      }
    }
    
    if (window.auth && window.auth.currentUser) {
      return {
        uid: window.auth.currentUser.uid,
        email: window.auth.currentUser.email,
        name: window.auth.currentUser.displayName || window.auth.currentUser.email
      };
    }
    
    return null;
    
  } catch (error) {
    console.error("? Error getting current admin user:", error);
    return null;
  }
}

// ==================== ?? Check Ticket Assignment ====================
function isTicketAssignedToCurrentUser(ticket, currentUser) {
  if (!ticket || !currentUser) return false;

  // Check by UID
  if (currentUser.uid) {
    if (ticket.action_by === currentUser.uid || ticket.assigned_to === currentUser.uid) {
      return true;
    }
  }
  
  // Check by name
  if (currentUser.name) {
    if (ticket.action_by === currentUser.name || ticket.assigned_to === currentUser.name) {
      return true;
    }
  }
  
  // Check by email
  if (currentUser.email) {
    if (ticket.action_by === currentUser.email || ticket.assigned_to === currentUser.email) {
      return true;
    }
  }
  
  // Check assigned_name field
  if (ticket.assigned_name && currentUser.name && ticket.assigned_name === currentUser.name) {
    return true;
  }
  
  return false;
}

// ==================== ?? Get My Assigned Tickets ====================
function getMyAssignedTickets() {
  try {
    const currentUser = getCurrentAdminUser();
    if (!currentUser) return [];

    const allTickets = getAllAvailableTickets();
    const myTickets = allTickets.filter(ticket => 
      isTicketAssignedToCurrentUser(ticket, currentUser)
    );

    console.log("?? My assigned tickets:", {
      currentUser: currentUser.name || currentUser.email,
      totalTickets: allTickets.length,
      myTickets: myTickets.length
    });

    return myTickets;
    
  } catch (error) {
    console.error("? Error getting my assigned tickets:", error);
    return [];
  }
}

// ==================== ?? Get All Available Tickets ====================
function getAllAvailableTickets() {
  try {
    if (window.adminDashboard) {
      if (window.adminDashboard.filteredTickets && window.adminDashboard.filteredTickets.length > 0) {
        return window.adminDashboard.filteredTickets;
      }
      if (window.adminDashboard.tickets && window.adminDashboard.tickets.length > 0) {
        return window.adminDashboard.tickets;
      }
    }
    
    if (window.adminData && window.adminData.tickets) {
      return window.adminData.tickets;
    }
    
    if (window.allTickets && Array.isArray(window.allTickets)) {
      return window.allTickets;
    }
    
    const recoveredTickets = recoverTicketsData();
    if (recoveredTickets) {
      return recoveredTickets;
    }
    
    return [];
    
  } catch (error) {
    console.error("? Error getting all available tickets:", error);
    return [];
  }
}

// ==================== ?? Get Current Filter Info ====================
function getCurrentFilterInfo() {
  try {
    const currentUser = getCurrentAdminUser();
    let userInfo = "Unknown User";
    
    if (currentUser) {
      userInfo = currentUser.name || currentUser.email || currentUser.uid || "Current User";
    }
    
    return `My Assigned Tickets - ${userInfo}`;
    
  } catch (error) {
    console.error("? Error getting filter info:", error);
    return "My Assigned Tickets";
  }
}

// ==================== ?? Wrapper Function for HTML Button ====================
async function handleExportToExcel() {
  try {
    const currentUser = getCurrentAdminUser();
    if (!currentUser) {
      await Swal.fire({
        title: "Authentication Required",
        text: "Please login to export your assigned tickets.",
        icon: "warning",
        confirmButtonColor: "#ef070a",
      });
      return;
    }

    const myTickets = getMyAssignedTickets();
    const filterInfo = getCurrentFilterInfo();

    if (!myTickets || myTickets.length === 0) {
      await Swal.fire({
        title: "No Tickets Assigned To You",
        html: `
          <div style="text-align: left;">
            <p><strong>You don't have any tickets assigned to your account.</strong></p>
            <p><strong>Current User:</strong> ${currentUser.name || currentUser.email}</p>
            <p><strong>To get tickets assigned to you:</strong></p>
            <ul>
              <li>Click "Take" button on unassigned tickets</li>
              <li>Ask Super Admin to assign tickets to you</li>
            </ul>
          </div>
        `,
        icon: "info",
        confirmButtonColor: "#ef070a",
      });
      return;
    }

    await exportToExcel(myTickets, filterInfo);
    
  } catch (error) {
    console.error("? Export handler error:", error);
    await Swal.fire({
      title: "Export Failed",
      text: "Could not start export process. Please try again.",
      icon: "error",
      confirmButtonColor: "#ef070a",
    });
  }
}

// ==================== ?? Data Recovery Function ====================
async function recoverTicketsData() {
  try {
    const savedTickets = localStorage.getItem("tickets-backup");
    if (savedTickets) {
      return JSON.parse(savedTickets);
    }

    const possibleSources = [
      window.ticketData,
      window.tickets,
      window.allTicketsArray,
      window.appState?.tickets,
      window.data?.tickets,
      window.adminData?.tickets,
    ];

    for (const source of possibleSources) {
      if (source && Array.isArray(source)) {
        return source;
      }
    }

    return null;
  } catch (error) {
    console.error("? Recovery failed:", error);
    return null;
  }
}

// ==================== ?? Main Export Function ====================
async function exportToExcel(displayedTickets, filterInfo = "My Assigned Tickets") {
  try {
    if (!displayedTickets || displayedTickets.length === 0) {
      throw new Error("No tickets data available");
    }

    console.log("?? Exporting MY tickets:", displayedTickets.length);

    const { value: accept } = await Swal.fire({
      title: "Export Your Tickets",
      html: `
        <div style="text-align: center;">
          <i class="fa-solid fa-file-excel" style="font-size: 3rem; color: #217346; margin-bottom: 1rem;"></i>
          <p><strong>Export ${displayedTickets.length} of YOUR tickets to Excel?</strong></p>
          <p style="font-size: 0.9rem; color: #666;">${filterInfo}</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Export My Tickets",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#217346",
      cancelButtonColor: "#6b7280",
    });

    if (!accept) return;

    await loadExcelJS();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Aktivitas IT");

    // ===== JUDUL & HEADER =====
    sheet.mergeCells("A1:H1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "AKTIVITAS-AKTIVITAS IT / IT ACTIVITIES";
    titleCell.font = { name: "Times New Roman", italic: true, size: 18, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.border = { top: { style: "thick" }, left: { style: "thick" }, bottom: { style: "thick" }, right: { style: "thick" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6E6" } };

    sheet.addRow([]);

    // Period & Filter Info
    const now = new Date();
    const periodText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    sheet.mergeCells("A3:H3");
    const periodCell = sheet.getCell("A3");
    periodCell.value = `Period: ${periodText}`;
    periodCell.font = { name: "Arial", size: 11, bold: true };
    periodCell.alignment = { horizontal: "left", vertical: "middle" };
    periodCell.border = { top: { style: "thick" }, left: { style: "thick" }, bottom: { style: "thick" }, right: { style: "thick" } };

    sheet.mergeCells("A4:H4");
    const filterCell = sheet.getCell("A4");
    filterCell.value = `Filter: ${filterInfo}`;
    filterCell.font = { name: "Arial", size: 10, italic: true };
    filterCell.alignment = { horizontal: "left", vertical: "middle" };
    filterCell.border = { top: { style: "thick" }, left: { style: "thick" }, bottom: { style: "thick" }, right: { style: "thick" } };

    sheet.addRow([]);

    // Headers
    const headers = [
      "Tgl. / Date",
      "Kode Inv. (uraian) / Inv. Code (Description)",
      "Kode / Code",
      "Lokasi / Location¹",
      "Keterangan / Remarks",
      "Pengguna / User",
      "Durasi / Duration",
      "Kendali Mutu / Quality Assurance",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, name: "Arial", size: 10, color: { argb: "FF000000" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    headerRow.height = 69 * 0.75;

    headerRow.eachCell((cell) => {
      cell.border = { top: { style: "thick" }, left: { style: "thick" }, bottom: { style: "thick" }, right: { style: "thick" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    });

    // Empty rows
    [1, 2].forEach(() => {
      const emptyRow = sheet.addRow(Array(8).fill(""));
      emptyRow.eachCell((cell) => {
        cell.border = { top: { style: "hair" }, left: { style: "hair" }, bottom: { style: "hair" }, right: { style: "hair" } };
      });
    });

    // ===== TICKET DATA =====
    displayedTickets.forEach((ticket) => {
      const durationText = calculateDurationForExport(ticket);
      const ticketStatus = ticket.status_ticket || ticket.status || "Open";
      const kendaliMutu = (ticketStatus === "Resolved" || ticketStatus === "Closed") ? "Finish" : "Continue";
      const deviceCode = getDeviceCode(ticket.device);

      const rowData = [
        formatDateForExcel(ticket.createdAt || ticket.last_updated),
        ticket.inventory || "-",
        deviceCode,
        ticket.location ? "Bintan / " + ticket.location : "Bintan / -",
        ticket.note || "-",
        (ticket.full_name || ticket.user_name || ticket.name || "-"),
        durationText,
        kendaliMutu,
      ];

      const row = sheet.addRow(rowData);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Arial", size: 10 };
        cell.border = { top: { style: "hair" }, left: { style: "hair" }, bottom: { style: "hair" }, right: { style: "hair" } };
        
        let alignment = { vertical: "top", horizontal: "left", wrapText: false };
        
        if (colNumber === 1) alignment = { vertical: "middle", horizontal: "right", wrapText: true };
        if (colNumber === 2) alignment = { vertical: "middle", horizontal: "left", wrapText: false };
        if (colNumber === 3) alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        if (colNumber === 8) alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        if (colNumber === 7) alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        
        cell.alignment = alignment;
      });
    });

    // Empty bottom rows
    [1, 2].forEach(() => {
      const emptyRow = sheet.addRow(Array(8).fill(""));
      emptyRow.eachCell((cell) => {
        cell.border = { top: { style: "hair" }, left: { style: "hair" }, bottom: { style: "hair" }, right: { style: "hair" } };
      });
    });

    // Final borders
    const totalRows = headerRow.number + displayedTickets.length + 4;
    for (let i = headerRow.number; i <= totalRows; i++) {
      sheet.getCell(`A${i}`).border = { ...sheet.getCell(`A${i}`).border, left: { style: "thick" } };
      sheet.getCell(`H${i}`).border = { ...sheet.getCell(`H${i}`).border, right: { style: "thick" } };
    }
    
    const lastRow = sheet.getRow(totalRows);
    lastRow.eachCell((cell) => {
      cell.border = { ...cell.border, bottom: { style: "thick" } };
    });

    // Column widths
    const widthsPx = [80, 113, 86, 181, 487, 126, 126, 124];
    widthsPx.forEach((px, i) => {
      sheet.getColumn(i + 1).width = Math.round(px / 7);
    });

    // Save file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const currentUser = getCurrentAdminUser();
    const userSuffix = currentUser ? `_${(currentUser.name || currentUser.email || 'user').replace(/[^a-zA-Z0-9]/g, "_")}` : '_MyTickets';
    
    a.download = `My_Assigned_Tickets${userSuffix}_${new Date().toISOString().split("T")[0]}.xlsx`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await Swal.fire({
      title: "Export Successful!",
      html: `
        <div style="text-align: center;">
          <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #28a745; margin-bottom: 1rem;"></i>
          <p><strong>${displayedTickets.length} of YOUR tickets exported successfully!</strong></p>
          <p style="font-size: 0.9rem; color: #666;">${filterInfo}</p>
        </div>
      `,
      icon: "success",
      timer: 3000,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("? Export error:", error);
    await Swal.fire({
      title: "Export Failed",
      text: error.message || "Terjadi kesalahan saat mengekspor data.",
      icon: "error",
      confirmButtonColor: "#ef070a",
    });
  }
}

// ==================== ?? Global Initialization ====================
window.allTickets = window.allTickets || [];

function updateAllTickets(newTickets) {
  if (Array.isArray(newTickets)) {
    window.allTickets = newTickets;
    try {
      localStorage.setItem("tickets-backup", JSON.stringify(newTickets));
    } catch (e) {
      console.warn("?? Could not backup tickets to localStorage:", e);
    }
  }
}

// Export functions for global usage
window.exportToExcel = exportToExcel;
window.handleExportToExcel = handleExportToExcel;
window.updateAllTickets = updateAllTickets;
window.getCurrentFilterInfo = getCurrentFilterInfo;
window.getDeviceCode = getDeviceCode;
window.getMyAssignedTickets = getMyAssignedTickets;

console.log("? Export JS loaded successfully - DURATION FIXED");