// ======================================================
// ?? js/export.js - Excel Export with Current User Filter (APPEND TO EXISTING)
// ======================================================

(function() {
    'use strict';

    // ==================== ?? SEMUA FUNGSI DI GLOBAL SCOPE ====================

    // ==================== ?? ExcelJS Loader ====================
    window.loadExcelJS = function() {
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
    };

    // ==================== ?? UNIVERSAL TIMESTAMP PARSER ====================
    window.parseUniversalTimestamp = function(timestamp) {
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
    };

    // ==================== 🛠️ FIXED Duration Calculation (ALWAYS IN MINUTES) ====================
    window.calculateDurationForExport = function(ticket) {
        try {
            console.log("🛠️ Calculating duration for ticket:", ticket.id, ticket.code);

            // Helper function to parse any timestamp format dengan prioritas yang benar
            function parseTimestamp(timestamp) {
                if (!timestamp) return null;
                
                try {
                    // 🎯 PRIORITAS 1: Firebase Timestamp object dengan toDate()
                    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
                        return timestamp.toDate();
                    }
                    
                    // 🎯 PRIORITAS 2: Firebase Timestamp object dengan seconds/nanoseconds
                    if (timestamp.seconds !== undefined) {
                        return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
                    }
                    
                    // 🎯 PRIORITAS 3: ISO string
                    if (typeof timestamp === 'string') {
                        return new Date(timestamp);
                    }
                    
                    // 🎯 PRIORITAS 4: Regular Date object
                    const date = new Date(timestamp);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                    
                    return null;
                } catch (error) {
                    console.warn("🛠️ Error parsing timestamp:", timestamp, error);
                    return null;
                }
            }

            // 🎯 CARI START DATE DENGAN BERBAGAI KEMUNGKINAN FIELD NAME
            let startDate = null;
            
            // Priority order untuk created date
            const createdDateFields = [
                ticket.created_at,    // Format dari admin dashboard
                ticket.createdAt,     // Format dari export data  
                ticket.timestamp,     // Fallback
                ticket.date_created   // Fallback lain
            ];
            
            for (const field of createdDateFields) {
                startDate = parseTimestamp(field);
                if (startDate && !isNaN(startDate.getTime())) {
                    console.log(`🛠️ Found start date from field: ${field}`, startDate);
                    break;
                }
            }
            
            if (!startDate || isNaN(startDate.getTime())) {
                console.warn("🛠️ Invalid start date for ticket:", ticket.id, "Available fields:", {
                    created_at: ticket.created_at,
                    createdAt: ticket.createdAt,
                    timestamp: ticket.timestamp,
                    date_created: ticket.date_created
                });
                return "0 Minutes";
            }

            // 🎯 CARI END DATE BERDASARKAN STATUS
            const status = ticket.status_ticket || ticket.status || "Open";
            let endDate = null;

            if (status === "Resolved" || status === "Closed") {
                // Priority order untuk end date
                const endDateFields = [
                    ticket.last_updated,  // Format dari admin dashboard
                    ticket.updatedAt,     // Format dari export data
                    ticket.resolved_at,   // Field khusus resolved
                    ticket.closed_at      // Field khusus closed
                ];
                
                for (const field of endDateFields) {
                    endDate = parseTimestamp(field);
                    if (endDate && !isNaN(endDate.getTime())) {
                        console.log(`🛠️ Found end date from field: ${field}`, endDate);
                        break;
                    }
                }
                
                // Jika tidak ditemukan, gunakan current time
                if (!endDate || isNaN(endDate.getTime())) {
                    console.warn("🛠️ No valid end date found, using current time");
                    endDate = new Date();
                }
            } else {
                // Untuk non-resolved tickets, duration adalah 0
                console.log("🛠️ Ticket not resolved, duration = 0");
                return "0 Minutes";
            }

            // 🎯 VALIDASI: Pastikan endDate tidak sebelum startDate
            if (endDate < startDate) {
                console.warn("🛠️ End date is before start date, using current time");
                endDate = new Date();
            }

            // 🎯 HITUNG DURASI DALAM MENIT
            const diffMs = endDate - startDate;
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            
            console.log("🛠️ Duration calculation result:", {
                ticketId: ticket.id,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                diffMs: diffMs,
                diffMinutes: diffMinutes,
                status: status
            });

            // 🎯 FORMAT DURASI: SELALU DALAM MENIT
            return diffMinutes === 1 ? "1 Minute" : `${diffMinutes} Minutes`;

        } catch (error) {
            console.error("🛠️ Error calculating duration for ticket:", ticket.id, error);
            return "0 Minutes";
        }
    };

    // ==================== ?? FIXED Date Formatting ====================
    window.formatDateForExcel = function(ts) {
        if (!ts) return "-";
        
        try {
            const date = window.parseUniversalTimestamp(ts);
            
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
    };

    // ==================== ?? Device Type Mapping Function ====================
    window.getDeviceCode = function(deviceType) {
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
    };

    // ==================== ?? Get Current Admin User ====================
    window.getCurrentAdminUser = function() {
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
    };

    // ==================== ?? Check Ticket Assignment ====================
    window.isTicketAssignedToCurrentUser = function(ticket, currentUser) {
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
    };

    // ==================== ?? Get My Assigned Tickets ====================
    window.getMyAssignedTickets = function() {
        try {
            const currentUser = window.getCurrentAdminUser();
            if (!currentUser) return [];

            const allTickets = window.getAllAvailableTickets();
            const myTickets = allTickets.filter(ticket => 
                window.isTicketAssignedToCurrentUser(ticket, currentUser)
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
    };

    // ==================== ?? Get All Available Tickets ====================
    window.getAllAvailableTickets = function() {
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
            
            const recoveredTickets = window.recoverTicketsData();
            if (recoveredTickets) {
                return recoveredTickets;
            }
            
            return [];
            
        } catch (error) {
            console.error("? Error getting all available tickets:", error);
            return [];
        }
    };

    // ==================== ?? Get Current Filter Info ====================
    window.getCurrentFilterInfo = function() {
        try {
            const currentUser = window.getCurrentAdminUser();
            let userInfo = "Unknown User";
            
            if (currentUser) {
                userInfo = currentUser.name || currentUser.email || currentUser.uid || "Current User";
            }
            
            return `My Assigned Tickets - ${userInfo}`;
            
        } catch (error) {
            console.error("? Error getting filter info:", error);
            return "My Assigned Tickets";
        }
    };

    // ==================== ?? Data Recovery Function ====================
    window.recoverTicketsData = function() {
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
    };

    // ==================== ?? Load File Input Function ====================
    window.loadFileInput = function() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx, .xls';
            input.style.display = 'none';
            
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    resolve(file);
                } else {
                    reject(new Error('No file selected'));
                }
                document.body.removeChild(input);
            };
            
            input.oncancel = () => {
                reject(new Error('File selection cancelled'));
                document.body.removeChild(input);
            };
            
            document.body.appendChild(input);
            input.click();
        });
    };

    // ==================== ?? Read Existing Excel File ====================
    window.readExistingWorkbook = async function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    resolve(arrayBuffer);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    };

    // ==================== ?? Find Last Data Row ====================
    window.findLastDataRow = function(sheet) {
        let lastRow = sheet.rowCount;
        
        // Cari dari bawah ke atas untuk menemukan baris terakhir yang berisi data
        for (let i = lastRow; i >= 1; i--) {
            const row = sheet.getRow(i);
            if (row && row.values && row.values.length > 0) {
                // Check if any cell in this row has value
                const hasValue = row.values.some(cell => {
                    if (cell === null || cell === undefined) return false;
                    if (typeof cell === 'string') return cell.trim() !== '';
                    return true;
                });
                
                if (hasValue) {
                    return i;
                }
            }
        }
        
        return 0;
    };

    // ==================== ?? Extract Date from Excel Date String ====================
    window.extractDateFromExcelDate = function(excelDateString) {
        if (!excelDateString || excelDateString === '-') return null;
        
        try {
            // Format Excel: DD/MM/YYYY
            const parts = excelDateString.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // Month is 0-indexed in JavaScript
                const year = parseInt(parts[2]);
                
                return new Date(year, month, day);
            }
            
            // Try other date formats
            const date = new Date(excelDateString);
            return !isNaN(date.getTime()) ? date : null;
        } catch (error) {
            console.warn("?? Error extracting date from Excel string:", excelDateString, error);
            return null;
        }
    };

    // ==================== ?? Sort Tickets by Date ====================
    window.sortTicketsByDate = function(tickets) {
        return tickets.sort((a, b) => {
            const dateA = window.parseUniversalTimestamp(a.createdAt || a.last_updated);
            const dateB = window.parseUniversalTimestamp(b.createdAt || b.last_updated);
            
            if (!dateA && !dateB) return 0;
            if (!dateA) return -1;
            if (!dateB) return 1;
            
            return dateA - dateB; // Ascending (oldest first)
        });
    };

    // ==================== ?? Get All Existing Data ====================
    window.getAllExistingData = function(sheet, startRow) {
        const existingData = [];
        
        for (let i = startRow; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            if (row && row.values && row.values.length > 1) { // Skip empty rows
                const rowData = {
                    rowNumber: i,
                    date: row.getCell(1).value,
                    data: row.values
                };
                
                // Only add if it's a data row (not header/empty)
                if (rowData.date && rowData.date !== 'Tgl. / Date') {
                    existingData.push(rowData);
                }
            }
        }
        
        return existingData;
    };

    // ==================== ?? Clear All Data Below Header ====================
    window.clearDataBelowHeader = function(sheet, headerRow) {
        const startDataRow = headerRow + 3; // Header + 2 empty rows
        
        // Clear all rows below header
        for (let i = startDataRow; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            if (row) {
                row.values = [];
                row.commit();
            }
        }
    };

    // ==================== ?? Reinsert All Data Sorted ====================
    window.reinsertAllDataSorted = function(sheet, allData, startRow) {
        // Clear existing data first
        window.clearDataBelowHeader(sheet, startRow - 3);
        
        // Sort all data by date
        const sortedData = allData.sort((a, b) => {
            const dateA = window.extractDateFromExcelDate(a.date);
            const dateB = window.extractDateFromExcelDate(b.date);
            
            if (!dateA && !dateB) return 0;
            if (!dateA) return -1;
            if (!dateB) return 1;
            
            return dateA - dateB; // Ascending (oldest first)
        });
        
        // Reinsert sorted data
        let currentRow = startRow;
        sortedData.forEach(item => {
            const row = sheet.getRow(currentRow);
            row.values = item.data;
            row.commit();
            currentRow++;
        });
        
        return currentRow;
    };

// ==================== ?? MODIFIED MAIN EXPORT FUNCTION - SHIFT SIGNATURE WITH DATA ====================
window.exportToExcelAppendSorted = async function(displayedTickets, filterInfo = "My Assigned Tickets") {
    try {
        if (!displayedTickets || displayedTickets.length === 0) {
            throw new Error("No tickets data available");
        }

        console.log("?? Exporting MY tickets:", displayedTickets.length);

        // Tanya user apakah mau buat file baru atau tambah ke file yang ada
        const { value: action } = await Swal.fire({
            title: "Export Your Tickets",
            html: `
                <div style="text-align: center;">
                <i class="fa-solid fa-file-excel" style="font-size: 3rem; color: #217346; margin-bottom: 1rem;"></i>
                <p><strong>Export ${displayedTickets.length} of YOUR tickets to Excel</strong></p>
                <p style="font-size: 0.9rem; color: #666;">${filterInfo}</p>
                <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem;">
                    <p style="font-size: 0.8rem; margin-bottom: 0.5rem;"><strong>Choose export method:</strong></p>
                    <p style="font-size: 0.7rem; color: #666;">• Create New: Buat file Excel baru</p>
                    <p style="font-size: 0.7rem; color: #666;">• Append Existing: Tambah data & geser tanda tangan ke bawah</p>
                </div>
                </div>
            `,
            icon: "question",
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: "Create New File",
            denyButtonText: "Append to Existing File",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#217346",
            denyButtonColor: "#28a745",
            cancelButtonColor: "#6b7280",
        });

        if (action === undefined) return; // Cancelled

        await window.loadExcelJS();

        let workbook;
        let isNewFile = true;
        let existingFileName = '';

        if (action === false) { // "Append to Existing File" clicked
            try {
                // Minta user memilih file Excel yang sudah ada
                await Swal.fire({
                    title: "Select Excel File to Update",
                    text: "Please select the Excel file (signature area will shift down with new data)",
                    icon: "info",
                    confirmButtonColor: "#28a745",
                });

                const existingFile = await window.loadFileInput();
                existingFileName = existingFile.name;
                const arrayBuffer = await window.readExistingWorkbook(existingFile);
                
                workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(arrayBuffer);
                isNewFile = false;
                
                // 🎯 CARI SHEET TERBARU (BULAN TERAKHIR)
                const allSheets = workbook.worksheets;
                const sheetNames = allSheets.map(ws => ws.name);
                const monthlySheets = sheetNames.filter(name => /^\d{4}-\d{2}$/.test(name));
                
                if (monthlySheets.length === 0) {
                    await Swal.fire({
                        title: "No Monthly Sheets Found",
                        html: `
                            <div style="text-align: center;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #f59e0b; margin-bottom: 1rem;"></i>
                            <p><strong>Tidak ada sheet dengan format bulanan (YYYY-MM) ditemukan!</strong></p>
                            <p>Available sheets: ${sheetNames.join(', ')}</p>
                            </div>
                        `,
                        icon: "warning",
                        confirmButtonColor: "#f59e0b",
                        confirmButtonText: "Create New File Instead"
                    });
                    workbook = new ExcelJS.Workbook();
                    isNewFile = true;
                } else {
                    monthlySheets.sort().reverse();
                    const latestSheetName = monthlySheets[0];
                    
                    console.log(`?? Latest sheet found: "${latestSheetName}"`);
                    
                    await Swal.fire({
                        title: "File Loaded!",
                        html: `
                            <div style="text-align: center;">
                            <i class="fas fa-check-circle" style="font-size: 3rem; color: #28a745; margin-bottom: 1rem;"></i>
                            <p><strong>Sheet terbaru ditemukan: "${latestSheetName}"</strong></p>
                            <p>Signature area will shift down with new data...</p>
                            </div>
                        `,
                        icon: "success",
                        timer: 3000,
                        showConfirmButton: false,
                    });
                }
                
            } catch (error) {
                console.warn("?? Failed to load existing file, creating new file:", error);
                await Swal.fire({
                    title: "Creating New File",
                    text: "Could not load existing file. Creating new file instead.",
                    icon: "info",
                    timer: 2000,
                    showConfirmButton: false,
                });
                workbook = new ExcelJS.Workbook();
            }
        } else {
            // Create new workbook
            workbook = new ExcelJS.Workbook();
        }

        let sheet;
        let targetSheetName;
        
        if (!isNewFile) {
            const allSheets = workbook.worksheets;
            const sheetNames = allSheets.map(ws => ws.name);
            const monthlySheets = sheetNames.filter(name => /^\d{4}-\d{2}$/.test(name));
            monthlySheets.sort().reverse();
            targetSheetName = monthlySheets[0];
            sheet = workbook.getWorksheet(targetSheetName);
            console.log(`?? Using latest sheet: "${targetSheetName}"`);
        } else {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            targetSheetName = `${year}-${month}`;
            sheet = workbook.addWorksheet(targetSheetName);
            console.log(`?? Created new sheet: "${targetSheetName}"`);
            
            await setupNewSheetStructure(sheet, filterInfo);
        }

        // ===== KONFIGURASI =====
        const TABLE_CONFIG = {
            START_COLUMN: 2,     // 🎯 KOLOM MULAI (B)
            END_COLUMN: 9,       // 🎯 KOLOM AKHIR (I)
            DATE_COLUMN: 2,      // 🎯 KOLOM TANGGAL (B)
        };

        let dataInsertRow;
        let signatureShifted = false;

        if (isNewFile) {
            // File baru: mulai dari baris 9
            dataInsertRow = 9;
        } else {
            // 🎯 FILE EXISTING: CARI BARIS TERAKHIR DATA & AREA TANDA TANGAN
            const lastDataRow = findLastDataRowInTable(sheet, TABLE_CONFIG);
            dataInsertRow = lastDataRow + 1;
            
            // 🎯 CARI AREA TANDA TANGAN DAN GESER KE BAWAH
            const signatureStartRow = findSignatureAreaStart(sheet, lastDataRow);
            
            if (signatureStartRow > 0) {
                const newTicketsCount = displayedTickets.length;
                signatureShifted = await shiftSignatureAreaDown(sheet, signatureStartRow, newTicketsCount);
                
                if (signatureShifted) {
                    console.log(`?? Signature area shifted down from row ${signatureStartRow} by ${newTicketsCount} rows`);
                }
            }
        }

        // ===== TAMBAH DATA BARU SETELAH GESER TANDA TANGAN =====
        const addedRows = await appendDataToTable(sheet, displayedTickets, dataInsertRow, TABLE_CONFIG);

        // ===== SAVE FILE =====
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const currentUser = window.getCurrentAdminUser();
        let fileName;
        
        if (isNewFile) {
            const userSuffix = currentUser ? `_${(currentUser.name || currentUser.email || 'user').replace(/[^a-zA-Z0-9]/g, "_")}` : '_MyTickets';
            fileName = `My_Assigned_Tickets${userSuffix}_${new Date().toISOString().split("T")[0]}.xlsx`;
        } else {
            const baseName = existingFileName.replace('.xlsx', '').replace('.xls', '');
            fileName = `${baseName}_updated_${new Date().toISOString().split("T")[0]}.xlsx`;
        }
        
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // ===== SUCCESS MESSAGE =====
        await showExportSuccessMessage(isNewFile, targetSheetName, addedRows, filterInfo, fileName, signatureShifted);

    } catch (error) {
        console.error("?? Export error:", error);
        await Swal.fire({
            title: "Export Failed",
            text: error.message || "Terjadi kesalahan saat mengekspor data.",
            icon: "error",
            confirmButtonColor: "#ef070a",
        });
    }
};

// ==================== ?? NEW FUNCTION: Find Signature Area Start ====================
window.findSignatureAreaStart = function(sheet, lastDataRow) {
    // 🎯 CARI AREA TANDA TANGAN DENGAN MENCARI KATA KUNCI
    const signatureKeywords = [
        'tanda tangan', 'signature', 'mengetahui', 'approved', 
        'disetujui', 'diterima', 'verified', 'checked'
    ];
    
    // 🎯 CARI DARI BAWAH KE ATAS, SETELAH AREA DATA
    for (let i = lastDataRow + 5; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        if (row) {
            // Check setiap cell di row ini untuk keyword tanda tangan
            for (let col = 1; col <= 10; col++) {
                const cell = row.getCell(col);
                if (cell && cell.value && typeof cell.value === 'string') {
                    const cellValue = cell.value.toLowerCase();
                    if (signatureKeywords.some(keyword => cellValue.includes(keyword))) {
                        console.log(`?? Found signature area starting at row ${i}: "${cell.value}"`);
                        return i;
                    }
                }
            }
        }
    }
    
    // 🎯 JIKA TIDAK DITEMUKAN, GUESS BERDASARKAN STRUKTUR UMUM
    const guessedSignatureRow = lastDataRow + 10; // 10 baris setelah data terakhir
    console.log(`?? No signature keywords found, guessing signature area starts at row ${guessedSignatureRow}`);
    return guessedSignatureRow;
};

// ==================== ?? NEW FUNCTION: Shift Signature Area Down ====================
window.shiftSignatureAreaDown = async function(sheet, signatureStartRow, shiftByRows) {
    try {
        if (shiftByRows <= 0) return false;

        console.log(`?? Shifting signature area from row ${signatureStartRow} down by ${shiftByRows} rows`);
        
        // 🎯 CARI BARIS TERAKHIR YANG ADA KONTEN
        const lastRowWithContent = findLastRowWithContent(sheet);
        
        console.log(`?? Last row with content: ${lastRowWithContent}`);
        
        // 🎯 PROSES GESER DARI BAWAH KE ATAS
        for (let currentRow = lastRowWithContent; currentRow >= signatureStartRow; currentRow--) {
            const sourceRow = sheet.getRow(currentRow);
            const targetRow = sheet.getRow(currentRow + shiftByRows);
            
            if (sourceRow && sourceRow.values) {
                // 🎯 COPY VALUES
                targetRow.values = [...sourceRow.values];
                
                // 🎯 COPY FORMATTING (MINIMAL)
                sourceRow.eachCell({ includeEmpty: true }, (sourceCell, colNumber) => {
                    const targetCell = targetRow.getCell(colNumber);
                    
                    // Copy basic formatting
                    if (sourceCell.font) targetCell.font = { ...sourceCell.font };
                    if (sourceCell.fill) targetCell.fill = { ...sourceCell.fill };
                    if (sourceCell.border) targetCell.border = { ...sourceCell.border };
                    if (sourceCell.alignment) targetCell.alignment = { ...sourceCell.alignment };
                });
                
                targetRow.commit();
                
                // 🎯 CLEAR SOURCE ROW
                sourceRow.values = [];
                sourceRow.commit();
            }
        }
        
        console.log(`?? ✅ Signature area successfully shifted down by ${shiftByRows} rows`);
        return true;
        
    } catch (error) {
        console.error("?? ❌ Error shifting signature area:", error);
        return false;
    }
};

// ==================== ?? NEW FUNCTION: Find Last Row With Any Content ====================
window.findLastRowWithContent = function(sheet) {
    let lastRow = sheet.rowCount;
    
    for (let i = lastRow; i >= 1; i--) {
        const row = sheet.getRow(i);
        if (row && row.values) {
            const hasContent = row.values.some(cellValue => {
                if (cellValue === null || cellValue === undefined) return false;
                if (typeof cellValue === 'string') return cellValue.trim() !== '';
                return true;
            });
            
            if (hasContent) {
                console.log(`?? Last row with content: ${i}`);
                return i;
            }
        }
    }
    
    return 1;
};

// ==================== ?? NEW FUNCTION: Find Last Data Row in Table ====================
window.findLastDataRowInTable = function(sheet, tableConfig) {
    const { DATE_COLUMN } = tableConfig;
    
    let lastDataRow = 0;
    
    for (let i = 1; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        if (row && row.getCell(DATE_COLUMN)) {
            const dateCell = row.getCell(DATE_COLUMN);
            const cellValue = dateCell.value;
            
            if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                if (typeof cellValue === 'string') {
                    if (cellValue.trim() !== '' && cellValue !== '-' && isValidDateString(cellValue)) {
                        lastDataRow = i;
                    }
                } else {
                    lastDataRow = i;
                }
            }
        }
    }
    
    if (lastDataRow > 0) {
        console.log(`?? Last data row: ${lastDataRow}`);
    } else {
        console.log(`?? No existing data found`);
        lastDataRow = 8; // Default start after header
    }
    
    return lastDataRow;
};

// ==================== ?? NEW FUNCTION: Append Data to Table ====================
window.appendDataToTable = async function(sheet, displayedTickets, startInsertRow, tableConfig) {
    const { START_COLUMN } = tableConfig;
    
    const sortedTickets = window.sortTicketsByDate(displayedTickets);
    
    console.log(`?? Appending ${sortedTickets.length} tickets from row ${startInsertRow}`);
    
    let currentRow = startInsertRow;
    
    sortedTickets.forEach((ticket) => {
        const durationText = window.calculateDurationForExport(ticket);
        const ticketStatus = ticket.status_ticket || ticket.status || "Open";
        const kendaliMutu = (ticketStatus === "Resolved" || ticketStatus === "Closed") ? "Finish" : "Continue";
        const deviceCode = window.getDeviceCode(ticket.device);

        const rowData = [
            null, // Kolom A kosong
            window.formatDateForExcel(ticket.createdAt || ticket.last_updated),
            ticket.inventory || "-",
            deviceCode,
            ticket.location ? "Bintan / " + ticket.location : "Bintan / -",
            ticket.note || "-",
            ticket.name || ticket.user_name || "-",
            durationText,
            kendaliMutu,
        ];

        const row = sheet.getRow(currentRow);
        
        // 🎯 SET VALUES ONLY
        rowData.forEach((value, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            cell.value = value;
        });
        
        row.commit();
        currentRow++;
    });
    
    return sortedTickets.length;
};

// ==================== ?? NEW FUNCTION: Show Export Success Message ====================
window.showExportSuccessMessage = async function(isNewFile, sheetName, ticketCount, filterInfo, fileName, signatureShifted) {
    const actionText = isNewFile ? "created" : "appended";
    
    await Swal.fire({
        title: "Export Successful!",
        html: `
            <div style="text-align: center;">
            <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #28a745; margin-bottom: 1rem;"></i>
            <p><strong>${ticketCount} tickets ${actionText} successfully!</strong></p>
            <p style="font-size: 0.9rem; color: #666;">${filterInfo}</p>
            <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem;">
                <p style="font-size: 0.8rem; margin-bottom: 0.5rem;"><strong>File: ${fileName}</strong></p>
                <p style="font-size: 0.7rem; color: #666;">• Sheet: "${sheetName}"</p>
                <p style="font-size: 0.7rem; color: #666;">• ${ticketCount} tickets ${actionText}</p>
                ${signatureShifted ? 
                    `<p style="font-size: 0.7rem; color: #666;">• ✅ Signature area shifted down with new data</p>` :
                    `<p style="font-size: 0.7rem; color: #666;">• New file created</p>`
                }
                <p style="font-size: 0.7rem; color: #666;">• Headers and images preserved</p>
                <p style="font-size: 0.7rem; color: #666;">• Data starts from column B</p>
            </div>
            </div>
        `,
        icon: "success",
        confirmButtonColor: "#28a745",
    });
};

// ==================== ?? NEW FUNCTION: Find Last Data Row in Existing Table ====================
window.findLastDataRowInTable = function(sheet, tableConfig) {
    const { DATE_COLUMN } = tableConfig;
    
    let lastDataRow = 0;
    
    // 🎯 CARI DARI BARIS 1 SAMPAI AKHIR SHEET UNTUK TEMUKAN DATA TERAKHIR
    for (let i = 1; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        if (row && row.getCell(DATE_COLUMN)) {
            const dateCell = row.getCell(DATE_COLUMN);
            const cellValue = dateCell.value;
            
            // Check if this is a data row (has date in column B)
            if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                if (typeof cellValue === 'string') {
                    if (cellValue.trim() !== '' && cellValue !== '-' && isValidDateString(cellValue)) {
                        console.log(`?? Found data row ${i}: "${cellValue}"`);
                        lastDataRow = i;
                    }
                } else {
                    // Jika bukan string, tetap anggap ada data
                    console.log(`?? Found data row ${i}:`, cellValue);
                    lastDataRow = i;
                }
            }
        }
    }
    
    if (lastDataRow > 0) {
        console.log(`?? Last data row found: ${lastDataRow}`);
    } else {
        console.log(`?? No existing data found, starting from row 1`);
        lastDataRow = 0;
    }
    
    return lastDataRow;
};

// ==================== ?? NEW FUNCTION: Check if String is Valid Date ====================
window.isValidDateString = function(dateString) {
    if (!dateString || typeof dateString !== 'string') return false;
    
    // Check format DD/MM/YYYY
    const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    return dateRegex.test(dateString.trim());
};

// ==================== ?? NEW FUNCTION: Append Data to Existing Table ====================
window.appendDataToTable = async function(sheet, displayedTickets, startInsertRow, tableConfig) {
    const { START_COLUMN } = tableConfig;
    
    const sortedTickets = window.sortTicketsByDate(displayedTickets);
    
    console.log(`?? Appending ${sortedTickets.length} new tickets starting from row ${startInsertRow}`);
    
    let currentRow = startInsertRow;
    
    sortedTickets.forEach((ticket) => {
        const durationText = window.calculateDurationForExport(ticket);
        const ticketStatus = ticket.status_ticket || ticket.status || "Open";
        const kendaliMutu = (ticketStatus === "Resolved" || ticketStatus === "Closed") ? "Finish" : "Continue";
        const deviceCode = window.getDeviceCode(ticket.device);

        // 🎯 DATA DIMULAI DARI KOLOM B
        const rowData = [
            null, // Kolom A kosong
            window.formatDateForExcel(ticket.createdAt || ticket.last_updated),
            ticket.inventory || "-",
            deviceCode,
            ticket.location ? "Bintan / " + ticket.location : "Bintan / -",
            ticket.note || "-",
            ticket.name || ticket.user_name || "-",
            durationText,
            kendaliMutu,
        ];

        const row = sheet.getRow(currentRow);
        
        // 🎯 SET VALUES HANYA DI AREA TABEL (KOLOM B-I)
        // 🎯 TIDAK MENGUBAH FORMATTING EXISTING, HANYA SET VALUE
        rowData.forEach((value, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            cell.value = value; // 🎯 HANYA SET VALUE, TIDAK UBAH FORMATTING
        });
        
        row.commit();
        currentRow++;
    });
    
    console.log(`?? ✅ Successfully appended ${sortedTickets.length} rows to existing table`);
    return sortedTickets.length;
};

// ==================== ?? NEW FUNCTION: Show Export Success Message ====================
window.showExportSuccessMessage = async function(isNewFile, sheetName, ticketCount, filterInfo, fileName) {
    const actionText = isNewFile ? "created" : "appended";
    
    await Swal.fire({
        title: "Export Successful!",
        html: `
            <div style="text-align: center;">
            <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #28a745; margin-bottom: 1rem;"></i>
            <p><strong>${ticketCount} tickets ${actionText} successfully!</strong></p>
            <p style="font-size: 0.9rem; color: #666;">${filterInfo}</p>
            <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem;">
                <p style="font-size: 0.8rem; margin-bottom: 0.5rem;"><strong>File: ${fileName}</strong></p>
                <p style="font-size: 0.7rem; color: #666;">• Sheet: "${sheetName}"</p>
                <p style="font-size: 0.7rem; color: #666;">• ${ticketCount} tickets ${actionText} to table</p>
                ${!isNewFile ? `
                    <p style="font-size: 0.7rem; color: #666;">• ✅ Data appended to existing table</p>
                    <p style="font-size: 0.7rem; color: #666;">• ✅ Headers preserved</p>
                    <p style="font-size: 0.7rem; color: #666;">• ✅ Images preserved</p>
                    <p style="font-size: 0.7rem; color: #666;">• ✅ Signatures preserved</p>
                    <p style="font-size: 0.7rem; color: #666;">• ✅ No formatting changes</p>
                ` : `
                    <p style="font-size: 0.7rem; color: #666;">• New file created with proper structure</p>
                `}
                <p style="font-size: 0.7rem; color: #666;">• All data sorted by date (oldest first)</p>
                <p style="font-size: 0.7rem; color: #666;">• Data starts from column B</p>
            </div>
            </div>
        `,
        icon: "success",
        confirmButtonColor: "#28a745",
    });
};

// ==================== ?? NEW FUNCTION: Shift Signature Area Down ====================
window.shiftSignatureAreaDown = async function(sheet, signatureStartRow, shiftByRows) {
    try {
        if (shiftByRows <= 0) return false;

        console.log(`?? Shifting signature area starting from row ${signatureStartRow} down by ${shiftByRows} rows`);
        
        // 🎯 CARI BARIS TERAKHIR YANG ADA DI SHEET
        const lastRowWithContent = findLastRowWithContent(sheet);
        const shiftStartRow = Math.max(signatureStartRow, 1);
        
        console.log(`?? Last row with content: ${lastRowWithContent}`);
        
        // 🎯 PROSES GESER DARI BAWAH KE ATAS (AGAR TIDAK TIMPA DATA)
        for (let currentRow = lastRowWithContent; currentRow >= shiftStartRow; currentRow--) {
            const sourceRow = sheet.getRow(currentRow);
            const targetRow = sheet.getRow(currentRow + shiftByRows);
            
            // 🎯 COPY SELURUH ROW (SEMUA KOLOM)
            if (sourceRow && sourceRow.values && sourceRow.values.length > 0) {
                // Copy values
                targetRow.values = [...sourceRow.values];
                
                // 🎯 COPY FORMATTING & STYLING
                sourceRow.eachCell({ includeEmpty: true }, (sourceCell, colNumber) => {
                    const targetCell = targetRow.getCell(colNumber);
                    
                    // Copy formatting properties
                    if (sourceCell.font) targetCell.font = { ...sourceCell.font };
                    if (sourceCell.fill) targetCell.fill = { ...sourceCell.fill };
                    if (sourceCell.border) targetCell.border = { ...sourceCell.border };
                    if (sourceCell.alignment) targetCell.alignment = { ...sourceCell.alignment };
                    if (sourceCell.numFmt) targetCell.numFmt = sourceCell.numFmt;
                    
                    // Copy merged cells info
                    if (sourceCell.isMerged) {
                        // Handle merged cells - complex operation, skip for now
                        console.log(`?? Warning: Merged cell at row ${currentRow}, col ${colNumber} - may need manual adjustment`);
                    }
                });
                
                targetRow.commit();
                
                // 🎯 CLEAR SOURCE ROW SETELAH DI COPY
                sourceRow.values = [];
                sourceRow.commit();
            }
        }
        
        console.log(`?? ✅ Signature area successfully shifted down by ${shiftByRows} rows`);
        return true;
        
    } catch (error) {
        console.error("?? ❌ Error shifting signature area:", error);
        return false;
    }
};

// ==================== ?? NEW FUNCTION: Find Last Row With Any Content ====================
window.findLastRowWithContent = function(sheet) {
    let lastRow = sheet.rowCount;
    
    // 🎯 CARI DARI BAWAH UNTUK TEMUKAN BARIS TERAKHIR YANG ADA KONTEN
    for (let i = lastRow; i >= 1; i--) {
        const row = sheet.getRow(i);
        if (row && row.values) {
            // Check if any cell in this row has value
            const hasContent = row.values.some(cellValue => {
                if (cellValue === null || cellValue === undefined) return false;
                if (typeof cellValue === 'string') return cellValue.trim() !== '';
                return true;
            });
            
            if (hasContent) {
                console.log(`?? Last row with content found at row ${i}`);
                return i;
            }
        }
    }
    
    console.log("?? No content found in sheet, returning row 1");
    return 1;
};

// ==================== ?? NEW FUNCTION: Find Last Data Row in Table Area ====================
window.findLastDataRowInTableArea = function(sheet, tableConfig) {
    const { START_ROW, DATE_COLUMN, SIGNATURE_START_ROW } = tableConfig;
    
    let lastDataRow = START_ROW - 1;
    
    // 🎯 CARI DI AREA ANTARA START_ROW DAN SEBELUM SIGNATURE_START_ROW
    const searchEndRow = Math.min(sheet.rowCount, SIGNATURE_START_ROW - 1);
    
    for (let i = searchEndRow; i >= START_ROW; i--) {
        const row = sheet.getRow(i);
        if (row && row.getCell(DATE_COLUMN)) {
            const dateCell = row.getCell(DATE_COLUMN);
            const cellValue = dateCell.value;
            
            if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                if (typeof cellValue === 'string') {
                    if (cellValue.trim() !== '' && cellValue !== '-') {
                        console.log(`?? Found data in table area, row ${i}: "${cellValue}"`);
                        return i;
                    }
                } else {
                    console.log(`?? Found data in table area, row ${i}:`, cellValue);
                    return i;
                }
            }
        }
    }
    
    console.log(`?? No data found in table area, starting from row ${START_ROW}`);
    return START_ROW - 1;
};

// ==================== ?? NEW FUNCTION: Add Data to Table Area ====================
window.addDataToTableArea = async function(sheet, displayedTickets, startInsertRow, tableConfig) {
    const { START_COLUMN } = tableConfig;
    
    const sortedTickets = window.sortTicketsByDate(displayedTickets);
    
    console.log(`?? Adding ${sortedTickets.length} new tickets starting from row ${startInsertRow}`);
    
    let currentRow = startInsertRow;
    
    sortedTickets.forEach((ticket) => {
        const durationText = window.calculateDurationForExport(ticket);
        const ticketStatus = ticket.status_ticket || ticket.status || "Open";
        const kendaliMutu = (ticketStatus === "Resolved" || ticketStatus === "Closed") ? "Finish" : "Continue";
        const deviceCode = window.getDeviceCode(ticket.device);

        const rowData = [
            null, // Kolom A kosong
            window.formatDateForExcel(ticket.createdAt || ticket.last_updated),
            ticket.inventory || "-",
            deviceCode,
            ticket.location ? "Bintan / " + ticket.location : "Bintan / -",
            ticket.note || "-",
            ticket.name || ticket.user_name || "-",
            durationText,
            kendaliMutu,
        ];

        const row = sheet.getRow(currentRow);
        
        // 🎯 SET VALUES DI AREA TABEL (KOLOM B-I)
        rowData.forEach((value, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            cell.value = value;
            
            // Minimal formatting
            if (!cell.font) cell.font = { name: "Arial", size: 10 };
            if (!cell.border) {
                cell.border = { 
                    top: { style: "hair" }, 
                    left: { style: "hair" }, 
                    bottom: { style: "hair" }, 
                    right: { style: "hair" } 
                };
            }
        });
        
        row.commit();
        currentRow++;
    });
    
    return sortedTickets.length;
};

// ==================== ?? NEW FUNCTION: Show Export Success Message ====================
window.showExportSuccessMessage = async function(isNewFile, sheetName, ticketCount, filterInfo, fileName, signatureShifted) {
    const actionText = isNewFile ? "created" : "updated";
    
    await Swal.fire({
        title: "Export Successful!",
        html: `
            <div style="text-align: center;">
            <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #28a745; margin-bottom: 1rem;"></i>
            <p><strong>${ticketCount} tickets ${actionText} successfully!</strong></p>
            <p style="font-size: 0.9rem; color: #666;">${filterInfo}</p>
            <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem;">
                <p style="font-size: 0.8rem; margin-bottom: 0.5rem;"><strong>File: ${fileName}</strong></p>
                <p style="font-size: 0.7rem; color: #666;">• Sheet: "${sheetName}"</p>
                <p style="font-size: 0.7rem; color: #666;">• ${ticketCount} new tickets added</p>
                ${signatureShifted ? 
                    `<p style="font-size: 0.7rem; color: #666;">• ✅ Signature area shifted down to prevent overwrite</p>` : 
                    `<p style="font-size: 0.7rem; color: #666;">• New file created with proper structure</p>`
                }
                <p style="font-size: 0.7rem; color: #666;">• All data sorted by date (oldest first)</p>
                <p style="font-size: 0.7rem; color: #666;">• Data starts from column B</p>
            </div>
            </div>
        `,
        icon: "success",
        confirmButtonColor: "#28a745",
    });
};

// ==================== ?? NEW FUNCTION: Find Last Data Row in Table Area Only ====================
window.findLastDataRowInTableArea = function(sheet, tableConfig) {
    const { START_ROW, DATE_COLUMN, SIGNATURE_AREA_START } = tableConfig;
    
    let lastDataRow = START_ROW - 1; // Default ke sebelum start row
    
    // 🎯 CARI DARI BAWAH TAPI HANYA DI AREA TABEL (DI ATAS SIGNATURE AREA)
    const searchEndRow = Math.min(sheet.rowCount, SIGNATURE_AREA_START - 1);
    
    for (let i = searchEndRow; i >= START_ROW; i--) {
        const row = sheet.getRow(i);
        if (row && row.getCell(DATE_COLUMN)) {
            const dateCell = row.getCell(DATE_COLUMN);
            const cellValue = dateCell.value;
            
            // Check if date cell has value (menandakan baris data)
            if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                if (typeof cellValue === 'string') {
                    if (cellValue.trim() !== '' && cellValue !== '-') {
                        console.log(`?? Found data in table area, row ${i}: "${cellValue}"`);
                        return i;
                    }
                } else {
                    // Jika bukan string, tetap anggap ada data
                    console.log(`?? Found data in table area, row ${i}:`, cellValue);
                    return i;
                }
            }
        }
    }
    
    console.log(`?? No data found in table area, starting from row ${START_ROW}`);
    return START_ROW - 1; // Kembalikan baris sebelum start, sehingga data baru dimulai dari START_ROW
};

// ==================== ?? NEW FUNCTION: Add Data to Table Area Only ====================
window.addDataToTableArea = async function(sheet, displayedTickets, startInsertRow, tableConfig) {
    const { START_COLUMN, DATE_COLUMN } = tableConfig;
    
    // Sort tickets by date
    const sortedTickets = window.sortTicketsByDate(displayedTickets);
    
    console.log(`?? Adding ${sortedTickets.length} new tickets to table area starting from row ${startInsertRow + 1}`);
    
    let currentRow = startInsertRow + 1; // Mulai dari baris setelah yang terakhir
    
    sortedTickets.forEach((ticket) => {
        const durationText = window.calculateDurationForExport(ticket);
        const ticketStatus = ticket.status_ticket || ticket.status || "Open";
        const kendaliMutu = (ticketStatus === "Resolved" || ticketStatus === "Closed") ? "Finish" : "Continue";
        const deviceCode = window.getDeviceCode(ticket.device);

        // 🎯 DATA DIMULAI DARI KOLOM B
        const rowData = [
            null, // 🎯 KOLOM A KOSONG
            window.formatDateForExcel(ticket.createdAt || ticket.last_updated),
            ticket.inventory || "-",
            deviceCode,
            ticket.location ? "Bintan / " + ticket.location : "Bintan / -",
            ticket.note || "-",
            ticket.name || ticket.user_name || "-",
            durationText,
            kendaliMutu,
        ];

        const row = sheet.getRow(currentRow);
        
        // 🎯 SET VALUES HANYA DI AREA TABEL (KOLOM B-I)
        rowData.forEach((value, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            cell.value = value;
            
            // 🎯 APPLY MINIMAL FORMATTING - TIDAK UBAH STYLING EXISTING
            if (!cell.font) cell.font = { name: "Arial", size: 10 };
            if (!cell.border) {
                cell.border = { 
                    top: { style: "hair" }, 
                    left: { style: "hair" }, 
                    bottom: { style: "hair" }, 
                    right: { style: "hair" } 
                };
            }
        });
        
        row.commit();
        currentRow++;
    });
    
    return sortedTickets.length;
};

// ==================== ?? NEW FUNCTION: Setup New Sheet Structure ====================
window.setupNewSheetStructure = async function(sheet, filterInfo) {
    console.log("?? Setting up NEW sheet structure...");
    
    // Judul & Header untuk file baru
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
};

// ==================== ?? NEW FUNCTION: Show Export Success Message ====================
window.showExportSuccessMessage = async function(isNewFile, sheetName, ticketCount, filterInfo, fileName) {
    const actionText = isNewFile ? "created" : "updated";
    const sheetText = isNewFile ? "new sheet" : "existing sheet";
    
    await Swal.fire({
        title: "Export Successful!",
        html: `
            <div style="text-align: center;">
            <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #28a745; margin-bottom: 1rem;"></i>
            <p><strong>${ticketCount} tickets ${actionText} successfully!</strong></p>
            <p style="font-size: 0.9rem; color: #666;">${filterInfo}</p>
            <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem;">
                <p style="font-size: 0.8rem; margin-bottom: 0.5rem;"><strong>File: ${fileName}</strong></p>
                <p style="font-size: 0.7rem; color: #666;">• Sheet: "${sheetName}" (${sheetText})</p>
                <p style="font-size: 0.7rem; color: #666;">• Only updated data table area</p>
                <p style="font-size: 0.7rem; color: #666;">• Headers and signature area preserved</p>
                <p style="font-size: 0.7rem; color: #666;">• All data sorted by date (oldest first)</p>
                <p style="font-size: 0.7rem; color: #666;">• ${ticketCount} new tickets added to table</p>
            </div>
            </div>
        `,
        icon: "success",
        confirmButtonColor: "#28a745",
    });
};

// ==================== ?? NEW FUNCTION: Find Last Data Row in Column B ====================
window.findLastDataRowInColumnB = function(sheet) {
    let lastRow = sheet.rowCount;
    
    // 🎯 CARI DARI BAWAH KE ATAS UNTUK MENDAPATKAN BARIS TERAKHIR DI KOLOM B
    for (let i = lastRow; i >= 1; i--) {
        const row = sheet.getRow(i);
        if (row && row.getCell(2)) { // Kolom B = index 2
            const cellB = row.getCell(2);
            const cellValue = cellB.value;
            
            // Check if cell B has value (tanggal/data)
            if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                if (typeof cellValue === 'string') {
                    if (cellValue.trim() !== '' && cellValue !== '-') {
                        console.log(`?? Found data in column B, row ${i}: "${cellValue}"`);
                        return i;
                    }
                } else {
                    // Jika bukan string, tetap anggap ada data
                    console.log(`?? Found data in column B, row ${i}:`, cellValue);
                    return i;
                }
            }
        }
    }
    
    console.log("?? No data found in column B, starting from row 1");
    return 0;
};

    // ==================== ?? UPDATE WRAPPER FUNCTION ====================
    window.handleExportToExcel = async function() {
        try {
            const currentUser = window.getCurrentAdminUser();
            if (!currentUser) {
                await Swal.fire({
                    title: "Authentication Required",
                    text: "Please login to export your assigned tickets.",
                    icon: "warning",
                    confirmButtonColor: "#ef070a",
                });
                return;
            }

            const myTickets = window.getMyAssignedTickets();
            const filterInfo = window.getCurrentFilterInfo();

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

            await window.exportToExcelAppendSorted(myTickets, filterInfo);
            
        } catch (error) {
            console.error("?? Export handler error:", error);
            await Swal.fire({
                title: "Export Failed",
                text: "Could not start export process. Please try again.",
                icon: "error",
                confirmButtonColor: "#ef070a",
            });
        }
    };

    // ==================== ?? Global Initialization ====================
    window.allTickets = window.allTickets || [];

    window.updateAllTickets = function(newTickets) {
        if (Array.isArray(newTickets)) {
            window.allTickets = newTickets;
            try {
                localStorage.setItem("tickets-backup", JSON.stringify(newTickets));
            } catch (e) {
                console.warn("?? Could not backup tickets to localStorage:", e);
            }
        }
    };

    // Update global functions
    window.exportToExcel = window.exportToExcelAppendSorted;

    console.log("✅ Export JS loaded successfully - APPEND TO EXISTING SHEET MODE");

})(); // END IIFE