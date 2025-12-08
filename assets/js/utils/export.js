// ======================================================
// ✅ FIXED js/export.js - COMPLETE & READY TO USE
// ======================================================

(function () {
  "use strict";

  // console.log("✅ Loading Complete Export Script...");

  // ==================== ✅ INITIALIZATION ====================
  window.isExporting = false;
  window.allTickets = window.allTickets || [];
  window.exportDebounce = false;

  // ==================== ✅ EXCELJS LOADER ====================
  window.loadExcelJS = function () {
    return new Promise((resolve, reject) => {
      if (window.ExcelJS) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
      script.onload = () => {
        resolve();
      };
      script.onerror = (error) => {
        console.error("❌ Failed to load ExcelJS:", error);
        reject(error);
      };
      document.head.appendChild(script);
    });
  };

  // ==================== ✅ FIXED MAIN EXPORT FUNCTION ====================
  window.exportToExcelAppendSorted = async function (
    displayedTickets,
    filterInfo = "My Assigned Tickets"
  ) {
    try {
      if (!displayedTickets || displayedTickets.length === 0) {
        throw new Error("No tickets data available");
      }

      // ✅ FIXED SWAL CONFIGURATION
      const result = await Swal.fire({
        title: "Export Your Tickets",
        html: `
                    <div style="text-align: center;">
                    <p><strong>Export ${displayedTickets.length} tickets</strong></p>
                    <p style="font-size: 0.9rem; color: #666;">${filterInfo}</p>
                    </div>
                `,
        icon: "question",
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "📄 Create New",
        denyButtonText: "📥 Append Existing",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#217346",
        denyButtonColor: "#28a745",
        cancelButtonColor: "#6b7280",
        allowOutsideClick: true,
        allowEscapeKey: true,
        focusConfirm: false,
      });

      // ✅ FIXED ACTION DETECTION
      if (result.isConfirmed) {
        await window.createNewFileWithTemplate(displayedTickets, filterInfo);
      } else if (result.isDenied) {
        await window.appendToExistingExcel(displayedTickets, filterInfo);
      } else {
        return;
      }
    } catch (error) {
      console.error("❌ Export error:", error);
      await Swal.fire({
        title: "Export Failed",
        text: error.message || "Terjadi kesalahan saat mengekspor data.",
        icon: "error",
        confirmButtonColor: "#dc3545",
      });
    }
  };

  // ==================== ✅ FIXED EVENT HANDLER ====================
  window.handleExportToExcel = async function () {
    if (window.isExporting) {
      return;
    }

    try {
      window.isExporting = true;

      const tickets = window.getMyAssignedTickets();
      const filterInfo = window.getCurrentFilterInfo();

      if (!tickets || tickets.length === 0) {
        await Swal.fire({
          title: "No Tickets",
          text: "No tickets available for export.",
          icon: "warning",
        });
        return;
      }

      await window.exportToExcelAppendSorted(tickets, filterInfo);
    } catch (error) {
      console.error("❌ Handler error:", error);
    } finally {
      window.isExporting = false;
    }
  };

  // ==================== ✅ HEADER STYLING FUNCTION - FIXED ====================
  window.setHeaderStyling = function (sheet) {
    try {
      // Header biasanya ada di row 7 (sesuaikan dengan template Anda)
      const headerRow = sheet.getRow(7);

      if (!headerRow) {
        console.warn("⚠️ Header row not found at row 7");
        return;
      }

      // Set alignment untuk setiap kolom header
      for (let col = 1; col <= 9; col++) {
        const cell = headerRow.getCell(col);

        // ✅ SET HEADER ALIGNMENT BERDASARKAN KOLOM
        if (col === 2) {
          // Kolom B - Date
          cell.alignment = {
            horizontal: "right",
            vertical: "middle",
          };
        } else if (col === 4 || col === 9) {
          // Kolom D & I - Code, QA
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        } else if (col === 8) {
          // ✅ KOLOM H - Duration - HEADER RATA KIRI
          cell.alignment = {
            horizontal: "left",
            vertical: "middle",
          };
        } else if (col === 5) {
          // ✅ KOLOM E - Location - HEADER
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
        } else {
          // Default alignment untuk kolom lainnya
          cell.alignment = {
            vertical: "middle",
          };
        }

        // ✅ PERBAIKAN: HAPUS cell.commit() - tidak diperlukan di ExcelJS
      }

      // ✅ PERBAIKAN: HAPUS headerRow.commit() - tidak diperlukan di ExcelJS
    } catch (error) {
      console.error("❌ Error setting header styling:", error);
    }
  };

  // ==================== ✅ CREATE NEW FILE WITH TEMPLATE ====================
  window.createNewFileWithTemplate = async function (
    displayedTickets,
    filterInfo = "My Assigned Tickets"
  ) {
    try {
      if (!displayedTickets || displayedTickets.length === 0) {
        throw new Error("No tickets data available");
      }

      await window.loadExcelJS();

      const templateFile = await window.loadFileInput();
      const templateFileName = templateFile.name;

      // Read the template file
      const arrayBuffer = await window.readExistingWorkbook(templateFile);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      // Find the target sheet (latest monthly sheet)
      const allSheets = workbook.worksheets;
      const sheetNames = allSheets.map((ws) => ws.name);
      const monthlySheets = sheetNames.filter((name) =>
        /^\d{4}-\d{2}$/.test(name)
      );

      if (monthlySheets.length === 0) {
        throw new Error(
          "No monthly sheets (YYYY-MM format) found in the template file"
        );
      }

      monthlySheets.sort().reverse();
      const targetSheetName = monthlySheets[0];
      const sheet = workbook.getWorksheet(targetSheetName);

      // ✅ APPLY HEADER STYLING SEBELUM MEMASUKKAN DATA
      window.setHeaderStyling(sheet);

      // Step 1: Find the last data row in template
      const lastDataRow = window.findLastDataRowSimple(sheet);

      // Step 2: Find signature area in template
      const signatureRow = window.findSignatureRowSimple(sheet, lastDataRow);

      // Step 3: Clear existing data (keep only headers and structure)
      const startDataRow = 8; // Assuming data starts at row 8
      if (lastDataRow >= startDataRow) {
        // Clear data but keep formatting
        for (let row = startDataRow; row <= lastDataRow; row++) {
          try {
            const currentRow = sheet.getRow(row);
            if (currentRow) {
              // Clear cell values but keep formatting
              for (let col = 1; col <= 9; col++) {
                const cell = currentRow.getCell(col);
                cell.value = null;
              }
            }
          } catch (e) {}
        }
      }

      // Step 4: Insert tickets data starting from data start row
      const startInsertRow = startDataRow;
      const addedCount = window.insertTicketsDataWithFormatting(
        sheet,
        displayedTickets,
        startInsertRow,
        startDataRow - 1
      );

      // Step 5: Generate new filename
      const timestamp = new Date().toISOString().split("T")[0];
      const baseName = templateFileName.replace(/\.(xlsx|xls)$/, "");
      const newFileName = `${baseName}_new_${timestamp}.xlsx`;

      // Step 6: Save the new file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = newFileName;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Success message
      await Swal.fire({
        title: "✅ New File Created!",
        html: `
                    <div style="text-align: center;">
                    <p><strong>${addedCount} tickets exported successfully!</strong></p>
                    <p style="font-size: 0.9rem; color: #666;">File: ${newFileName}</p>
                    <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem;">
                        <p style="font-size: 0.8rem; margin: 0.2rem 0;">• Template: "${templateFileName}"</p>
                        <p style="font-size: 0.8rem; margin: 0.2rem 0;">• Sheet: "${targetSheetName}"</p>
                        <p style="font-size: 0.8rem; margin: 0.2rem 0;">• Header styling applied to column E</p>
                    </div>
                    </div>
                `,
        icon: "success",
        confirmButtonColor: "#217346",
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (error) {
      console.error("❌ Create new file error:", error);
      await Swal.fire({
        title: "Create New File Failed",
        text: error.message || "Terjadi kesalahan saat membuat file baru",
        icon: "error",
        confirmButtonColor: "#dc3545",
      });
    }
  };

  // ==================== ✅ APPEND TO EXISTING FILE ====================
  window.appendToExistingExcel = async function (
    displayedTickets,
    filterInfo = "My Assigned Tickets"
  ) {
    try {
      if (!displayedTickets || displayedTickets.length === 0) {
        throw new Error("No tickets data available");
      }

      await window.loadExcelJS();

      const existingFile = await window.loadFileInput();
      const existingFileName = existingFile.name;

      // Read the existing file
      const arrayBuffer = await window.readExistingWorkbook(existingFile);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      // Find the target sheet (latest monthly sheet)
      const allSheets = workbook.worksheets;
      const sheetNames = allSheets.map((ws) => ws.name);
      const monthlySheets = sheetNames.filter((name) =>
        /^\d{4}-\d{2}$/.test(name)
      );

      if (monthlySheets.length === 0) {
        throw new Error("No monthly sheets (YYYY-MM format) found in the file");
      }

      monthlySheets.sort().reverse();
      const targetSheetName = monthlySheets[0];
      const sheet = workbook.getWorksheet(targetSheetName);

      // ✅ APPLY HEADER STYLING
      window.setHeaderStyling(sheet);

      // Step 1: Find the last data row
      const lastDataRow = window.findLastDataRowSimple(sheet);

      // Step 2: Find signature area
      const signatureRow = window.findSignatureRowSimple(sheet, lastDataRow);

      // Step 3: Calculate how many rows to insert
      const rowsToInsert = displayedTickets.length;

      // Step 4: INSERT NEW ROWS (like Ctrl+Shift "+") and determine write start row
      let startInsertRow;
      if (signatureRow > 0) {
        // Insert rows at the position before signature area
        sheet.spliceRows(signatureRow, 0, ...Array(rowsToInsert).fill([]));
        startInsertRow = signatureRow;
      } else {
        // If no signature found, insert after last data row
        const insertPosition = lastDataRow + 1;
        sheet.spliceRows(insertPosition, 0, ...Array(rowsToInsert).fill([]));
        startInsertRow = insertPosition;
      }

      // Step 5: Insert tickets data in the newly created rows
      const addedCount = window.insertTicketsDataWithFormatting(
        sheet,
        displayedTickets,
        startInsertRow,
        lastDataRow
      );

      // Step 6: Save the updated file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Generate filename
      a.download = existingFileName;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Info message bahwa file akan disimpan di folder Downloads
      await Swal.fire({
        title: "✅ File Ready for Download",
        html: `
                    <div style="text-align: center;">
                    <p><strong>File akan disimpan di folder Downloads Anda</strong></p>
                    <p style="font-size: 0.9rem; color: #666;">Nama file: <strong>${existingFileName}</strong></p>
                    <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem;">
                        <p style="font-size: 0.8rem; margin: 0.2rem 0;">• Browser akan menyimpan file di folder Downloads</p>
                        <p style="font-size: 0.8rem; margin: 0.2rem 0;">• Anda bisa pindahkan file ke folder lain setelah download</p>
                    </div>
                    </div>
                `,
        icon: "info",
        confirmButtonColor: "#28a745",
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (error) {
      console.error("❌ Append error:", error);
      await Swal.fire({
        title: "Update Failed",
        text:
          error.message ||
          "Terjadi kesalahan saat menambahkan data ke file yang sudah ada",
        icon: "error",
        confirmButtonColor: "#dc3545",
      });
    }
  };

  // ==================== ✅ IMPROVED HELPER FUNCTIONS ====================

  // Simple function to find last data row
  window.findLastDataRowSimple = function (sheet) {
    // Look for the last row with date in column B
    for (let row = sheet.rowCount; row >= 1; row--) {
      try {
        const dateCell = sheet.getCell(`B${row}`);
        if (dateCell.value && window.isValidExcelDate(dateCell.value)) {
          return row;
        }
      } catch (e) {
        // Continue if cell doesn't exist
      }
    }
    // If no data found, assume data starts at row 8 (after headers)
    return 7;
  };

  // Check if cell contains valid Excel date
  window.isValidExcelDate = function (value) {
    if (!value) return false;

    // Native Date object
    if (value instanceof Date && !isNaN(value.getTime())) {
      return true;
    }

    // String DD/MM/YYYY (trim spaces)
    if (typeof value === "string") {
      const v = value.trim();
      return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v);
    }

    // ExcelJS rich value with 'text'
    if (typeof value === "object" && value && typeof value.text === "string") {
      const v = value.text.trim();
      return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v);
    }

    // Excel serial date number
    if (typeof value === "number") {
      return value > 40000;
    }

    return false;
  };

  // Find signature row by looking for common keywords
  window.findSignatureRowSimple = function (sheet, lastDataRow) {
    const keywords = [
      "tanda tangan",
      "signature",
      "mengetahui",
      "approved",
      "disetujui",
      "verifikasi",
    ];

    // Start searching from 5 rows after last data
    for (
      let row = lastDataRow + 5;
      row <= Math.min(lastDataRow + 30, sheet.rowCount);
      row++
    ) {
      for (let col = 1; col <= 9; col++) {
        try {
          const cell = sheet.getCell(row, col);
          if (cell.value && typeof cell.value === "string") {
            const cellValue = cell.value.toLowerCase();
            if (keywords.some((keyword) => cellValue.includes(keyword))) {
              return row;
            }
          }
        } catch (e) {
          // Continue if cell doesn't exist
        }
      }
    }

    return 0; // No signature found
  };

  // Improved function to insert tickets data with proper formatting
  window.insertTicketsDataWithFormatting = function (
    sheet,
    tickets,
    startRow,
    lastDataRow
  ) {
    const sortedTickets = window.sortTicketsByDate(tickets);
    let currentRow = startRow;

    // ✅ DAPATKAN REFERENCE STYLING SEBELUM LOOP
    let referenceHeight = 18.75; // default fallback
    let referenceBorders = {}; // untuk menyimpan border style per kolom

    try {
      if (lastDataRow && lastDataRow > 0) {
        const referenceRow = sheet.getRow(lastDataRow);
        if (referenceRow) {
          // Ambil height
          if (referenceRow.height) {
            referenceHeight = referenceRow.height;
          }

          // Ambil border styling untuk setiap kolom
          for (let col = 1; col <= 9; col++) {
            try {
              const referenceCell = referenceRow.getCell(col);
              if (referenceCell.border) {
                referenceBorders[col] = { ...referenceCell.border };
              }
            } catch (e) {
              // Skip jika kolom tidak ada
            }
          }
        } else {
        }
      } else {
      }
    } catch (error) {
      console.warn(`📏 Error getting reference styling, using default`, error);
    }

    sortedTickets.forEach((ticket, index) => {
      const durationText = window.calculateDurationForExport(ticket);
      const ticketStatus = ticket.status_ticket || ticket.status || "Open";
      const kendaliMutu =
        ticketStatus === "Resolved" || ticketStatus === "Closed"
          ? "Finish"
          : "Continue";
      const activityCode = window.getActivityCode(ticket.activity);

      const rowData = [
        null,
        window.formatDateForExcel(window.getTicketDate(ticket)),
        ticket.inventory || "-",
        activityCode,
        ticket.location ? "Bintan / " + ticket.location : "Bintan / -",
        ticket.note || "-",
        (ticket.user_id &&
          window.userCache &&
          window.userCache[ticket.user_id] &&
          window.userCache[ticket.user_id].full_name) ||
          ticket.full_name ||
          ticket.user_name ||
          ticket.name ||
          "-",
        durationText,
        kendaliMutu,
      ];

      // Get the row (should already exist due to insertion)
      let row = sheet.getRow(currentRow);

      if (!row) {
        console.warn(`⚠️ Row ${currentRow} doesn't exist, creating new row`);
        sheet.addRow([]);
        row = sheet.getRow(currentRow);
      }

      // Apply data to cells with proper formatting
      rowData.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;

        // Apply consistent formatting
        cell.font = {
          name: "Arial",
          size: 10,
        };

        // Set alignment based on column
        if (colIndex + 1 === 2) {
          // Date column
          cell.alignment = {
            horizontal: "right",
            vertical: "top",
          };
        } else if (colIndex + 1 === 4 || colIndex + 1 === 9) {
          // Code, Duration, QA
          cell.alignment = {
            horizontal: "center",
            vertical: "top",
          };
        } else if (colIndex + 1 === 8) {
          // Code, Duration, QA
          cell.alignment = {
            horizontal: "left",
            vertical: "center",
          };
        } else if (colIndex + 1 === 5) {
          // ✅ KOLOM 5 - Location - RATA KIRI
          cell.alignment = {
            horizontal: "left",
            vertical: "top",
            wrapText: true,
          };
        } else {
          cell.alignment = {
            vertical: "top",
          };
        }

        // ✅ APPLY BORDER STYLING DARI REFERENCE
        if (referenceBorders[colIndex + 1]) {
          // Gunakan border dari reference
          cell.border = { ...referenceBorders[colIndex + 1] };
        } else {
          // Fallback border styling
          cell.border = {
            top: { style: "hair" },
            left: { style: "hair" },
            bottom: { style: "hair" },
            right: { style: "hair" },
          };

          // Left and right thick borders for first and last columns
          if (colIndex + 1 === 1) {
            cell.border.left = { style: "thick" };
          }
          if (colIndex + 1 === 9) {
            cell.border.right = { style: "thick" };
          }
        }
      });

      // ✅ GUNAKAN REFERENCE HEIGHT
      row.height = referenceHeight;

      currentRow++;
    });

    return sortedTickets.length;
  };

  // ==================== ✅ CORE FUNCTIONS ====================

  window.parseUniversalTimestamp = function (timestamp) {
    if (!timestamp) return null;
    try {
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        return timestamp.toDate();
      }
      if (timestamp.seconds !== undefined) {
        return new Date(
          timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000
        );
      }
      if (typeof timestamp === "string") {
        return new Date(timestamp);
      }
      const date = new Date(timestamp);
      return !isNaN(date.getTime()) ? date : null;
    } catch (error) {
      console.warn("?? Error parsing timestamp:", timestamp, error);
      return null;
    }
  };

  window.calculateDurationForExport = function (ticket) {
    try {
      const rawStatus = ticket.status_ticket || ticket.status || "";
      const status = String(rawStatus).trim().toLowerCase();
      const finals = ["resolved", "closed", "finished", "completed"];
      if (!finals.includes(status)) {
        return "0 Minutes";
      }

      const endDate = window.parseUniversalTimestamp(ticket.resolved_at);
      if (!endDate || isNaN(endDate.getTime())) {
        return "0 Minutes";
      }

      const startCandidates = [ticket.created_at, ticket.createdAt];
      let startDate = null;
      for (const c of startCandidates) {
        const ts = window.parseUniversalTimestamp(c);
        if (ts && !isNaN(ts.getTime())) {
          startDate = ts;
          break;
        }
      }
      if (!startDate) return "0 Minutes";

      if (endDate < startDate) return "0 Minutes";

      const diffMs = endDate - startDate;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes === 1 ? "1 Minute" : `${diffMinutes} Minutes`;
    } catch (error) {
      console.error(
        "🛠️ Error calculating duration for ticket:",
        ticket.id,
        error
      );
      return "0 Minutes";
    }
  };

  window.formatDateForExcel = function (ts) {
    if (!ts) return "-";
    try {
      const date = window.parseUniversalTimestamp(ts);
      if (!date || isNaN(date.getTime())) return "-";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return "-";
    }
  };

  window.getDeviceCode = function (deviceType) {
    const deviceMapping = {
      "PC Hardware": "HW",
      Laptop: "SW",
      Printer: "HW",
      Projector: "HW",
      "PC Software": "SW",
      Network: "NW",
      "Backup Data": "DR",
      Drone: "DR",
      Others: "OT",
      Other: "OT",
    };

    const normalizedDevice = (deviceType || "").trim();
    if (deviceMapping[normalizedDevice]) return deviceMapping[normalizedDevice];

    const lowerDevice = normalizedDevice.toLowerCase();
    if (
      lowerDevice.includes("hardware") ||
      lowerDevice.includes("pc") ||
      lowerDevice.includes("printer") ||
      lowerDevice.includes("projector")
    )
      return "HW";
    if (lowerDevice.includes("laptop")) return "SW";
    if (lowerDevice.includes("software")) return "SW";
    if (lowerDevice.includes("network")) return "NW";
    if (
      lowerDevice.includes("backup") ||
      lowerDevice.includes("data") ||
      lowerDevice.includes("drone")
    )
      return "DR";

    return "OT";
  };

  window.getActivityCode = function (activity) {
    const a = (activity || "").trim().toLowerCase();
    if (!a) return "OT";
    if (a === "deliver") return "MV";
    if (a === "software install") return "SW";
    if (a === "software config") return "SW";
    if (a === "install it standard apps") return "SW";
    if (a === "reinstall windows") return "SW";
    if (a === "pc hardware") return "HW";
    if (a === "setup meeting") return "HW";
    if (a === "network") return "NW";
    if (a === "connect share folder") return "NW";
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
    return "OT";
  };

  window.toProperCase = function (s) {
    if (!s) return "-";
    const v = String(s).trim();
    if (!v || v === "-") return "-";
    return v
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
      .join(" ");
  };

  // ==================== ✅ FILE HANDLING FUNCTIONS ====================

  window.loadFileInput = function () {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx, .xls";
      input.style.display = "none";

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) resolve(file);
        else reject(new Error("No file selected"));
        document.body.removeChild(input);
      };

      input.oncancel = () => {
        reject(new Error("File selection cancelled"));
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();
    });
  };

  window.readExistingWorkbook = async function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(e.target.result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  window.getTicketDate = function (ticket) {
    return (
      ticket.created_at ||
      ticket.createdAt ||
      ticket.updated_at ||
      ticket.last_updated ||
      null
    );
  };

  window.sortTicketsByDate = function (tickets) {
    return tickets.sort((a, b) => {
      const dateA = window.parseUniversalTimestamp(window.getTicketDate(a));
      const dateB = window.parseUniversalTimestamp(window.getTicketDate(b));
      if (!dateA && !dateB) return 0;
      if (!dateA) return -1;
      if (!dateB) return 1;
      return dateA - dateB;
    });
  };

  // ==================== ✅ TICKET DATA FUNCTIONS ====================

  window.getCurrentAdminUser = function () {
    try {
      if (window.adminDashboard && window.adminDashboard.adminUser) {
        return window.adminDashboard.adminUser;
      }

      // Tidak menggunakan localStorage untuk mendapatkan admin user

      if (
        window.firebaseAuthService &&
        typeof window.firebaseAuthService.getCurrentUser === "function"
      ) {
        const user = window.firebaseAuthService.getCurrentUser();
        if (user) {
          return {
            uid: user.uid,
            email: user.email,
            name: user.displayName || user.email,
          };
        }
      }

      if (window.auth && window.auth.currentUser) {
        return {
          uid: window.auth.currentUser.uid,
          email: window.auth.currentUser.email,
          name:
            window.auth.currentUser.displayName ||
            window.auth.currentUser.email,
        };
      }

      return null;
    } catch (error) {
      console.error("? Error getting current admin user:", error);
      return null;
    }
  };

  window.isTicketAssignedToCurrentUser = function (ticket, currentUser) {
    if (!ticket || !currentUser) return false;

    // Check by UID
    if (currentUser.uid) {
      if (
        ticket.action_by === currentUser.uid ||
        ticket.assigned_to === currentUser.uid
      ) {
        return true;
      }
    }

    // Check by name
    if (currentUser.name) {
      if (
        ticket.action_by === currentUser.name ||
        ticket.assigned_to === currentUser.name
      ) {
        return true;
      }
    }

    // Check by email
    if (currentUser.email) {
      if (
        ticket.action_by === currentUser.email ||
        ticket.assigned_to === currentUser.email
      ) {
        return true;
      }
    }

    // Check assigned_name field
    if (
      ticket.assigned_name &&
      currentUser.name &&
      ticket.assigned_name === currentUser.name
    ) {
      return true;
    }

    return false;
  };

  window.getExportSourceTickets = function () {
    const dash = window.adminDashboard;
    if (
      dash &&
      Array.isArray(dash.filteredTickets) &&
      dash.filteredTickets.length > 0
    ) {
      return dash.filteredTickets;
    }
    if (dash && Array.isArray(dash.tickets) && dash.tickets.length > 0) {
      return dash.tickets;
    }
    return window.getAllAvailableTickets();
  };

  window.filterTicketsByCurrentDateRange = function (tickets) {
    try {
      const dash = window.adminDashboard;
      const dateFilter =
        dash && dash.currentFilters ? dash.currentFilters.date : null;
      if (!dateFilter || !dateFilter.isActive) return tickets;

      const startDate = dateFilter.startDate
        ? new Date(dateFilter.startDate)
        : null;
      const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;

      return tickets.filter((ticket) => {
        const d = window.parseUniversalTimestamp(window.getTicketDate(ticket));
        if (!d) return false;
        if (startDate && endDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          return d >= s && d <= e;
        }
        if (startDate && !endDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          return d >= s;
        }
        if (!startDate && endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          return d <= e;
        }
        return true;
      });
    } catch (error) {
      return tickets;
    }
  };

  window.getMyAssignedTickets = function () {
    try {
      const currentUser = window.getCurrentAdminUser();
      if (!currentUser) return [];

      const sourceTickets = window.getExportSourceTickets();
      let myTickets = sourceTickets.filter((ticket) =>
        window.isTicketAssignedToCurrentUser(ticket, currentUser)
      );

      myTickets = window.filterTicketsByCurrentDateRange(myTickets);

      return myTickets;
    } catch (error) {
      console.error("? Error getting my assigned tickets:", error);
      return [];
    }
  };

  window.getAllAvailableTickets = function () {
    try {
      // Coba berbagai sumber data
      const possibleSources = [
        window.adminDashboard?.filteredTickets,
        window.adminDashboard?.tickets,
        window.adminData?.tickets,
        window.allTickets,
        window.ticketData,
        window.tickets,
      ];

      for (const source of possibleSources) {
        if (source && Array.isArray(source) && source.length > 0) {
          return source;
        }
      }

      // No localStorage fallback; rely on in-memory sources only

      console.warn("❌ No tickets found in any source");
      return [];
    } catch (error) {
      console.error("❌ Error getting tickets:", error);
      return [];
    }
  };

  window.getCurrentFilterInfo = function () {
    try {
      const currentUser = window.getCurrentAdminUser();
      let userInfo = "Unknown User";

      if (currentUser) {
        userInfo =
          currentUser.name ||
          currentUser.email ||
          currentUser.uid ||
          "Current User";
      }

      return `My Assigned Tickets - ${userInfo}`;
    } catch (error) {
      console.error("? Error getting filter info:", error);
      return "My Assigned Tickets";
    }
  };

  window.recoverTicketsData = function () {
    try {
      // No localStorage recovery; rely on in-memory sources only

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
  };

  // ==================== ✅ EVENT HANDLER SETUP ====================

  function initializeExportHandler() {
    document.removeEventListener("click", window.exportButtonHandler);

    window.exportButtonHandler = function (e) {
      const exportBtn = e.target.closest(
        '#exportToExcelBtn, .export-excel-btn, [onclick*="export"], button[onclick*="handleExportToExcel"]'
      );
      if (exportBtn) {
        e.preventDefault();
        e.stopImmediatePropagation();

        window.handleExportToExcel();
      }
    };

    document.addEventListener("click", window.exportButtonHandler, true);
  }

  // ==================== ✅ GLOBAL INITIALIZATION ====================

  window.updateAllTickets = function (newTickets) {
    if (Array.isArray(newTickets)) {
      window.allTickets = newTickets;
    }
  };

  // Update global export function
  window.exportToExcel = window.exportToExcelAppendSorted;

  // Override any existing problematic functions
  if (typeof window.exportToExcel === "function") {
    window.originalExportToExcel = window.exportToExcel;
    window.exportToExcel = window.exportToExcelAppendSorted;
  }

  // Cleanup function
  window.cleanupExportHandlers = function () {
    document.removeEventListener("click", window.exportButtonHandler);
  };

  // Initialize everything
  initializeExportHandler();
  // console.log("✅ Complete Export Script Loaded Successfully - HEADER STYLING READY");
})();
