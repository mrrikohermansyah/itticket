// Import Firebase modules dengan LENGKAP
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc,
    deleteDoc,
    query, 
    where, 
    orderBy, 
    limit,
    serverTimestamp,
    onSnapshot,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// Import auth service
import firebaseAuthService from '../../../../assets/js/services/firebase-auth-service.js';

// Firebase configuration dari CONFIG dengan FALLBACK
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Admin Dashboard dengan Permission System
class AdminDashboard {
    constructor() {
    this.adminUser = null;
    this.tickets = [];
    this.filteredTickets = [];
    this.currentFilter = 'all';
    this.userUnsubscribe = null;
    this.unsubscribe = null;
    this.db = db;
    this.auth = auth;
    this.currentUpdatingTicketId = null;
    this.ticketModalUnsubscribe = null;
    this.currentModalTicketId = null;

    // ✅ TAMBAHKAN INI: Date filter properties
    this.dateFilter = {
        startDate: null,
        endDate: null,
        isActive: false
    };
    
    this.init();
}



async init() {
    try {
        // console.log('🚀 Admin Dashboard initializing...');
        
        // ✅ BIND METHODS DI SINI SETELAH SEMUA METHOD SUDAH DIDEKLARASIKAN
        this.handleTableClick = this.handleTableClick.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        this.handleDateChange = this.handleDateChange.bind(this);
        this.handleTodayClick = this.handleTodayClick.bind(this);
        this.handleClearDateClick = this.handleClearDateClick.bind(this);
        this.applyAllFilters = this.applyAllFilters.bind(this);
        this.filterTickets = this.filterTickets.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleManageTeam = this.handleManageTeam.bind(this);
        this.showNotification = this.showNotification.bind(this);
        
        // ✅ CHECK DOM ELEMENTS FIRST
        this.checkDOMElements();
        
        // Cek auth status
        await this.checkAuth();
        
        // Load admin info
        this.loadAdminInfo();

        this.showNotification(
                'Login berhasil!', 
                'success', 
                `Selamat datang, ${this.adminUser?.name || 'Admin'}!`
            );

        
        // Setup event listeners
        this.initializeEventListeners();
        
        // Initialize update form
        this.initializeUpdateForm();
        
        // Load tickets
        await this.loadTickets();
        
        // ✅ SETUP BOTH REAL-TIME LISTENERS
        this.setupRealTimeListener();       // Untuk tickets
        this.setupUserDataListener();       // Untuk user data
        
        // console.log('✅ Admin Dashboard ready');
        
    } catch (error) {
        console.error('❌ Admin Dashboard init error:', error);
    }
}

showNotification(title, type = 'info', message = '', duration = 5000) {
        try {
            // Hapus notifikasi sebelumnya jika ada
            const existingNotification = document.querySelector('.admin-notification');
            if (existingNotification) {
                existingNotification.remove();
            }

            const notification = document.createElement('div');
            notification.className = `admin-notification ${type}`;
            
            notification.innerHTML = `
                <div class="notification-content">
                    <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                    <div class="notification-text">
                        <strong>${title}</strong>
                        ${message ? `<br><span style="font-size: 0.9rem; opacity: 0.9;">${message}</span>` : ''}
                    </div>
                    <button class="notification-close" title="Close notification">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            document.body.appendChild(notification);

            // Auto remove setelah duration
            let timeoutId;
            if (duration > 0) {
                timeoutId = setTimeout(() => {
                    this.hideNotification(notification);
                }, duration);
            }

            // Close button handler
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => {
                if (timeoutId) clearTimeout(timeoutId);
                this.hideNotification(notification);
            });

            // Optional: Auto hide ketika klik di mana saja (kecuali di notifikasi sendiri)
            notification.addEventListener('click', (e) => {
                if (e.target === notification) {
                    if (timeoutId) clearTimeout(timeoutId);
                    this.hideNotification(notification);
                }
            });

            // console.log(`🔔 Notification shown: ${title}`);

        } catch (error) {
            console.error('❌ Error showing notification:', error);
        }
    }

    // ✅ METHOD UNTUK HIDE NOTIFICATION DENGAN ANIMASI
    hideNotification(notification) {
        if (!notification || !notification.parentNode) return;
        
        notification.classList.add('notification-hiding');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300); // Match dengan duration animation
    }

    // ✅ HELPER METHOD UNTUK NOTIFICATION ICON
    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // ✅ METHOD UNTUK SHOW TOAST (BACKWARD COMPATIBILITY)
    showToastNotification(message, type = 'info') {
        this.showNotification(
            type === 'info' ? 'Information' : 
            type === 'error' ? 'Error' : 
            type === 'success' ? 'Success' : 'Notification',
            type,
            message,
            3000
        );
    }

// ✅ PASTIKAN METHOD handleManageTeam SUDAH DIDEKLARASIKAN
async handleManageTeam(e) {
    e.preventDefault();
    window.location.href = 'manage-team.html';
}

// ✅ PASTIKAN METHOD handleExport SUDAH DIDEKLARASIKAN
async handleExport() {
    try {
        // console.log('📤 Export button clicked');
        await this.handleExportWithCustomDialog();
    } catch (error) {
        console.error('❌ Export error:', error);
        await Swal.fire({
            title: 'Export Failed',
            text: 'Failed to export tickets: ' + error.message,
            icon: 'error'
        });
    }
}

// ✅ ALTERNATIF: Custom Export Dialog dengan Pilihan Eksplisit
async handleExportWithCustomDialog() {
    try {
        const exportBtn = document.getElementById('exportTickets');
        const originalText = exportBtn?.innerHTML || '';
        
        if (exportBtn) {
            exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
            exportBtn.disabled = true;
        }

        const exportData = this.getDisplayedTicketsForExport();
        
        if (exportData.length === 0) {
            await Swal.fire({
                title: 'No Data',
                text: 'No tickets available for export.',
                icon: 'warning',
                confirmButtonColor: '#ef070a'
            });
            return;
        }

        // console.log(`📊 Preparing to export ${exportData.length} tickets`);
        
        // Update global data
        if (typeof window.updateAllTickets === 'function') {
            window.updateAllTickets(exportData);
        }

        // Set filter info
        if (typeof window.setExportFilterInfo === 'function') {
            const filterInfo = this.getCurrentFilterInfo();
            window.setExportFilterInfo(filterInfo);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        await this.fixExportCompatibility();

        // ✅ CUSTOM DIALOG UNTUK PILIHAN EXPORT
        const { value: exportAction } = await Swal.fire({
            title: 'Export Tickets',
            html: `
                <div style="text-align: center;">
                    <i class="fas fa-file-excel" style="font-size: 3rem; color: #217346; margin-bottom: 1rem;"></i>
                    <p><strong>Export ${exportData.length} tickets</strong></p>
                    <p style="font-size: 0.9rem; color: #666;">${this.getCurrentFilterInfo()}</p>
                    <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 0.5rem;">
                        <p style="font-size: 0.8rem; margin-bottom: 0.5rem;"><strong>Choose export method:</strong></p>
                        <p style="font-size: 0.7rem; color: #666;">• <strong>Create New:</strong> Buat file Excel baru</p>
                        <p style="font-size: 0.7rem; color: #666;">• <strong>Append Existing:</strong> Tambah baris baru & data ke file yang sudah ada</p>
                    </div>
                </div>
            `,
            icon: 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Create New File',
            denyButtonText: 'Append to Existing File',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#217346',
            denyButtonColor: '#28a745',
            cancelButtonColor: '#6b7280',
        });

        if (exportAction === undefined) {
            // console.log('❌ Export cancelled by user');
            return; // Cancelled
        }

        let exportSuccess = false;

        if (exportAction === false) {
            // Append to Existing File
            // console.log('📥 User chose: Append to Existing File');
            if (typeof window.appendToExistingExcel === 'function') {
                try {
                    await window.appendToExistingExcel(exportData, this.getCurrentFilterInfo());
                    exportSuccess = true;
                } catch (error) {
                    console.error('❌ Append export failed:', error);
                    await Swal.fire({
                        title: 'Append Failed',
                        text: 'Failed to append to existing file: ' + error.message,
                        icon: 'error'
                    });
                }
            } else {
                console.error('❌ appendToExistingExcel function not found');
            }
        } else {
            // Create New File
            // console.log('🆕 User chose: Create New File');
            if (typeof window.originalExportToExcelAppendSorted === 'function') {
                try {
                    await window.originalExportToExcelAppendSorted(exportData, this.getCurrentFilterInfo());
                    exportSuccess = true;
                } catch (error) {
                    console.error('❌ New file export failed:', error);
                    await Swal.fire({
                        title: 'Export Failed',
                        text: 'Failed to create new file: ' + error.message,
                        icon: 'error'
                    });
                }
            } else if (typeof window.exportToExcelAppendSorted === 'function') {
                try {
                    await window.exportToExcelAppendSorted(exportData, this.getCurrentFilterInfo());
                    exportSuccess = true;
                } catch (error) {
                    console.error('❌ Export failed:', error);
                }
            }
        }

        if (!exportSuccess) {
            // Fallback to CSV
            // console.log('🔄 Using fallback CSV export...');
            await this.fallbackExport(exportData);
        }
        
    } catch (error) {
        console.error('❌ Export error:', error);
        await Swal.fire({
            title: 'Export Failed',
            text: 'Could not export data: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#ef070a'
        });
    } finally {
        const exportBtn = document.getElementById('exportTickets');
        if (exportBtn) {
            exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Export Excel';
            exportBtn.disabled = false;
        }
    }
}

// ✅ DEBUG: Check export functionality
debugExportFunctionality() {
    // console.log('🔍 Checking export functionality...');
    
    // Check if export button exists
    const exportBtn = document.getElementById('exportTickets');
    // console.log('📤 Export button:', exportBtn);
    
    // Check if event listener is attached
    if (exportBtn) {
        const clickEvents = exportBtn.onclick;
        // console.log('🎯 Export button click events:', clickEvents);
    }
    
    // Check if method exists
    // console.log('🔧 handleExport method exists:', typeof this.handleExport === 'function');
    // console.log('🔧 handleExportWithCustomDialog method exists:', typeof this.handleExportWithCustomDialog === 'function');
}

async init() {
    try {
        // console.log('🚀 Admin Dashboard initializing...');
        
        // ✅ BIND METHODS DI SINI SETELAH SEMUA METHOD SUDAH DIDEKLARASIKAN
        this.handleTableClick = this.handleTableClick.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        this.handleDateChange = this.handleDateChange.bind(this);
        this.handleTodayClick = this.handleTodayClick.bind(this);
        this.handleClearDateClick = this.handleClearDateClick.bind(this);
        this.applyAllFilters = this.applyAllFilters.bind(this);
        this.filterTickets = this.filterTickets.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleManageTeam = this.handleManageTeam.bind(this);
        
        // ✅ CHECK DOM ELEMENTS FIRST
        this.checkDOMElements();
        
        // ✅ DEBUG EXPORT FUNCTIONALITY
        this.debugExportFunctionality();
        
        // ... rest of init code
    } catch (error) {
        console.error('❌ Admin Dashboard init error:', error);
    }
}

applyAllFilters() {
    // console.log('🔍 Applying all filters...');
    
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');

    const statusValue = statusFilter ? statusFilter.value : 'all';
    const priorityValue = priorityFilter ? priorityFilter.value : 'all';

    // console.log('🎯 Filter values:', {
    //     status: statusValue,
    //     priority: priorityValue,
    //     dateFilter: this.dateFilter
    // });

    // Apply status dan priority filter terlebih dahulu
    let filtered = this.tickets.filter(ticket => {
        const statusMatch = statusValue === 'all' || ticket.status === statusValue;
        const priorityMatch = priorityValue === 'all' || ticket.priority === priorityValue;
        return statusMatch && priorityMatch;
    });

    // console.log(`📊 After status/priority filter: ${filtered.length} tickets`);

    // Apply date filter
    filtered = this.applyDateFilter(filtered);

    this.filteredTickets = filtered;
    this.renderTickets();
    this.updateStats();
    
    // console.log(`✅ Final filtered tickets: ${filtered.length}`);
}
// ✅ PERBAIKAN: Enhanced applyDateFilter dengan debug logging yang detail
applyDateFilter(tickets) {
    if (!this.dateFilter.isActive) {
        // console.log('📅 Date filter is NOT active, returning all tickets:', tickets.length);
        return tickets;
    }
    
    const { startDate, endDate } = this.dateFilter;
    
    // console.log('🔍 [DATE FILTER DEBUG]', {
    //     isActive: this.dateFilter.isActive,
    //     startDate: startDate,
    //     endDate: endDate,
    //     startDateString: startDate?.toISOString(),
    //     endDateString: endDate?.toISOString(),
    //     totalTickets: tickets.length
    // });

    // Debug sample tickets
    // console.log('🎫 Sample tickets (first 5):');
    tickets.slice(0, 5).forEach((ticket, index) => {
        // console.log(`  ${index + 1}. ${ticket.code}:`, {
        //     created_at: ticket.created_at,
        //     date: new Date(ticket.created_at),
        //     dateString: new Date(ticket.created_at).toISOString(),
        //     isToday: this.isSameDay(new Date(ticket.created_at), new Date())
        // });
    });

    const filteredTickets = tickets.filter(ticket => {
        if (!ticket.created_at) {
            // console.log(`❌ Ticket ${ticket.code} has no created_at date`);
            return false;
        }
        
        const ticketDate = new Date(ticket.created_at);
        
        // Jika hanya start date yang ada, filter dari start date ke atas
        if (startDate && !endDate) {
            const isMatch = ticketDate >= startDate;
            // console.log(`📅 ${ticket.code}: ${ticketDate.toISOString()} >= ${startDate.toISOString()} = ${isMatch}`);
            return isMatch;
        }
        
        // Jika hanya end date yang ada, filter sampai end date
        if (!startDate && endDate) {
            const endOfDay = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
            const isMatch = ticketDate <= endOfDay;
            // console.log(`📅 ${ticket.code}: ${ticketDate.toISOString()} <= ${endOfDay.toISOString()} = ${isMatch}`);
            return isMatch;
        }
        
        // Jika kedua date ada, filter range
        if (startDate && endDate) {
            const endOfDay = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
            const isMatch = ticketDate >= startDate && ticketDate < endOfDay;
            // console.log(`📅 ${ticket.code}: ${startDate.toISOString()} <= ${ticketDate.toISOString()} < ${endOfDay.toISOString()} = ${isMatch}`);
            return isMatch;
        }
        
        return true;
    });

    // console.log(`✅ Date filter result: ${filteredTickets.length} tickets after filtering`);
    
    // Show which tickets passed the filter
    if (filteredTickets.length > 0) {
        // console.log('🎯 Tickets that passed date filter:');
        filteredTickets.forEach(ticket => {
            // console.log(`  ✅ ${ticket.code}: ${new Date(ticket.created_at).toISOString()}`);
        });
    } else {
        // console.log('❌ No tickets passed the date filter');
    }

    return filteredTickets;
}

// ✅ HELPER METHOD: Check if two dates are the same day
isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// ✅ PERBAIKAN: Enhanced handleTodayClick untuk pastikan timezone benar
handleTodayClick() {
    // console.log('📅 Today button clicked');
    
    const today = new Date();
    
    // Set waktu ke awal hari (00:00:00) untuk start date
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    
    // Set waktu ke akhir hari (23:59:59) untuk end date  
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    
    const todayString = today.toISOString().split('T')[0];
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput && endDateInput) {
        startDateInput.value = todayString;
        endDateInput.value = todayString;
        
        this.dateFilter = {
            startDate: startOfToday,  // Gunakan start of day
            endDate: endOfToday,      // Gunakan end of day
            isActive: true
        };
        
        // console.log('📅 Today filter applied:', {
        //     startDate: startOfToday.toISOString(),
        //     endDate: endOfToday.toISOString(),
        //     display: todayString
        // });
        
        // ✅ PERBAIKAN: Panggil applyAllFilters yang sudah di-bind
        this.applyAllFilters();
        
        this.showToastNotification('Showing tickets for today', 'info');
    } else {
        console.error('❌ Date input elements not found');
    }
}

initializeDateFilter() {
    // console.log('📅 Initializing date filter...');
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const todayBtn = document.getElementById('todayBtn');
    const clearDateBtn = document.getElementById('clearDateBtn');
    
    if (startDateInput && endDateInput) {
        // ✅ PERBAIKAN: Gunakan method yang sudah di-bind
        startDateInput.addEventListener('change', this.handleDateChange);
        endDateInput.addEventListener('change', this.handleDateChange);
    }
    
    if (todayBtn) {
        // ✅ PERBAIKAN: Gunakan method yang sudah di-bind
        todayBtn.addEventListener('click', this.handleTodayClick);
    }
    
    if (clearDateBtn) {
        // ✅ PERBAIKAN: Gunakan method yang sudah di-bind
        clearDateBtn.addEventListener('click', this.handleClearDateClick);
    }
    
    // console.log('✅ Date filter initialized');
}

handleDateChange() {
    // console.log('📅 Date input changed');
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (!startDateInput || !endDateInput) {
        console.error('❌ Date input elements not found');
        return;
    }
    
    const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
    
    // Validasi: end date tidak boleh sebelum start date
    if (startDate && endDate && endDate < startDate) {
        this.showToastNotification('End date cannot be before start date', 'error');
        endDateInput.value = '';
        return;
    }
    
    this.dateFilter = {
        startDate: startDate,
        endDate: endDate,
        isActive: !!(startDate || endDate)
    };
    
    // console.log('📅 Date filter updated:', this.dateFilter);
    
    // ✅ PERBAIKAN: Panggil applyAllFilters yang sudah di-bind
    this.applyAllFilters();
}


handleClearDateClick() {
    // console.log('🗑️ Clear date filter clicked');
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput && endDateInput) {
        startDateInput.value = '';
        endDateInput.value = '';
        
        this.dateFilter = {
            startDate: null,
            endDate: null,
            isActive: false
        };
        
        // console.log('📅 Date filter cleared');
        
        // ✅ PERBAIKAN: Panggil applyAllFilters yang sudah di-bind
        this.applyAllFilters();
        
        this.showToastNotification('Date filter cleared', 'info');
    } else {
        console.error('❌ Date input elements not found');
    }
}



filterTickets() {
    // console.log('🔍 Filter tickets called');
    this.applyAllFilters();
}

    // ==================== COMPREHENSIVE MIGRATION METHOD ====================
    async migrateTicketAssignments() {
        try {
            // console.log('🔄 Starting comprehensive ticket assignment migration...');
            
            // Get all tickets
            const ticketsQuery = query(collection(this.db, "tickets"));
            const ticketsSnapshot = await getDocs(ticketsQuery);
            
            // Get all admins
            const adminsQuery = query(collection(this.db, "admins"));
            const adminsSnapshot = await getDocs(adminsQuery);
            
            // Create admin mapping: name -> UID
            const adminMap = {};
            adminsSnapshot.forEach(doc => {
                const adminData = doc.data();
                if (adminData.name) {
                    adminMap[adminData.name] = doc.id;
                }
                if (adminData.email) {
                    adminMap[adminData.email] = doc.id;
                }
            });
            
            // console.log('👥 Admin mapping:', adminMap);
            
            let migratedCount = 0;
            let skippedCount = 0;
            
            // Show progress
            const migrationResult = await Swal.fire({
                title: 'Migrating Ticket Assignments...',
                html: `
                    <div class="migration-progress">
                        <i class="fas fa-sync-alt fa-spin migration-icon"></i>
                        <p>Converting name-based assignments to UID-based...</p>
                        <p id="migrationProgress">Preparing migration...</p>
                    </div>
                `,
                showConfirmButton: false,
                allowOutsideClick: false
            });

            for (let i = 0; i < ticketsSnapshot.docs.length; i++) {
                const doc = ticketsSnapshot.docs[i];
                const data = doc.data();
                
                // Update progress
                if (migrationResult && migrationResult.isVisible()) {
                    document.getElementById('migrationProgress').textContent = 
                        `Processing ${i + 1}/${ticketsSnapshot.size} tickets`;
                }
                
                let needsMigration = false;
                let newActionBy = data.action_by;
                let newAssignedTo = data.assigned_to;
                
                // Check if action_by needs migration (name -> UID)
                if (data.action_by && adminMap[data.action_by]) {
                    newActionBy = adminMap[data.action_by];
                    needsMigration = true;
                    // console.log(`🔄 Migrating action_by: "${data.action_by}" -> "${newActionBy}"`);
                }
                
                // Check if assigned_to needs migration
                if (data.assigned_to && adminMap[data.assigned_to]) {
                    newAssignedTo = adminMap[data.assigned_to];
                    needsMigration = true;
                    // console.log(`🔄 Migrating assigned_to: "${data.assigned_to}" -> "${newAssignedTo}"`);
                }
                
                if (needsMigration) {
                    try {
                        await updateDoc(doc.ref, {
                            action_by: newActionBy,
                            assigned_to: newAssignedTo,
                            assigned_name: data.action_by
                        });
                        migratedCount++;
                        // console.log(`✅ Migrated ticket ${data.code}`);
                    } catch (error) {
                        console.error(`❌ Error migrating ticket ${data.code}:`, error);
                    }
                } else {
                    skippedCount++;
                    // console.log(`⏭️ Skipped ticket ${data.code} - already using UID or no mapping found`);
                }
            }

            // Close progress dialog
            Swal.close();

            // Show final result
            await Swal.fire({
                title: 'Migration Complete!',
                html: `
                    <div class="migration-results">
                        <p><strong>Migration Results:</strong></p>
                        <ul>
                            <li>✅ Successfully migrated: ${migratedCount} tickets</li>
                            <li>⏭️ Skipped: ${skippedCount} tickets</li>
                            <li>📊 Total processed: ${ticketsSnapshot.size} tickets</li>
                        </ul>
                        <p><strong>The page will now refresh to apply changes.</strong></p>
                    </div>
                `,
                icon: 'success',
                confirmButtonColor: '#ef070a'
            });

            // console.log(`🎉 Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);
            
            // Refresh page to load updated data
            window.location.reload();
            
        } catch (error) {
            console.error('❌ Migration error:', error);
            await Swal.fire({
                title: 'Migration Failed',
                text: 'Error migrating ticket assignments: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    async init() {
        try {
            // console.log('🚀 Admin Dashboard initializing...');

            // ✅ BIND METHODS DI SINI SETELAH SEMUA METHOD SUDAH DIDEKLARASIKAN
        this.handleTableClick = this.handleTableClick.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        this.handleDateChange = this.handleDateChange.bind(this);
        this.handleTodayClick = this.handleTodayClick.bind(this);
        this.handleClearDateClick = this.handleClearDateClick.bind(this);
        this.applyAllFilters = this.applyAllFilters.bind(this);
        this.filterTickets = this.filterTickets.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleExportWithCustomDialog = this.handleExportWithCustomDialog.bind(this); // ← TAMBAHKAN INI
            
            // ✅ CHECK DOM ELEMENTS FIRST
            this.checkDOMElements();
            
            // Cek auth status
            await this.checkAuth();
            
            // Load admin info
            this.loadAdminInfo();
            
            // Setup event listeners
            this.initializeEventListeners();
            
            // Initialize update form
            this.initializeUpdateForm();
            
            // Load tickets
            await this.loadTickets();
            
            // ✅ SETUP BOTH REAL-TIME LISTENERS
        this.setupRealTimeListener();       // Untuk tickets
        this.setupUserDataListener();       // Untuk user data
            
            // console.log('✅ Admin Dashboard ready');
            
        } catch (error) {
            console.error('❌ Admin Dashboard init error:', error);
        }
    }

    // ========== REAL-TIME USER DATA LISTENER ==========
// ✅ FIX: Enhanced user data real-time listener dengan ticket reload
setupUserDataListener() {
    try {
        // console.log('🔍 [DEBUG] Setting up user data listener...');
        
        const usersQuery = query(collection(this.db, "users"));
        
        this.userUnsubscribe = onSnapshot(usersQuery, 
            // ✅ Success callback
            (snapshot) => {
                // console.log('🔄 [DEBUG] User data snapshot received:', {
                //     totalUsers: snapshot.size,
                //     changes: snapshot.docChanges().length
                // });
                
                let hasUserUpdates = false;

                snapshot.docChanges().forEach((change, index) => {
                    const userData = change.doc.data();
                    const userId = change.doc.id;
                    
                    // console.log(`📝 [DEBUG] Change ${index + 1}:`, {
                    //     type: change.type,
                    //     userId: userId,
                    //     userData: {
                    //         name: userData.full_name,
                    //         email: userData.email,
                    //         department: userData.department,
                    //         location: userData.location,
                    //         updated_at: userData.updated_at
                    //     }
                    // });

                    if (change.type === "modified") {
                        // console.log('🎯 [DEBUG] User MODIFIED - triggering update handler');
                        // ✅ SYNC LOCATION SEBELUM PROCESS
                        const syncedUserData = {
                            ...userData,
                            location: this.syncUserLocationWithDepartment(userData)
                        };
                        this.handleUserProfileUpdate(userId, userData);
                        hasUserUpdates = true;
                    }
                });

                // ✅ FIX: RELOAD TICKETS JIKA ADA USER UPDATES
                if (hasUserUpdates) {
                    // console.log('🔄 [DEBUG] User updates detected - reloading tickets...');
                    this.loadTickets(); // Ini akan memuat data terbaru dari Firestore
                }
            },
            // ✅ Error callback
            (error) => {
                console.error('❌ [DEBUG] User data listener ERROR:', error);
                this.showToastNotification('User data sync error', 'error');
            }
        );
        
        // console.log('✅ [DEBUG] User data listener ACTIVATED');
        
    } catch (error) {
        console.error('❌ [DEBUG] Error setting up user data listener:', error);
    }
}

// ✅ OPTIONAL: Auto-update location di Firestore ketika department berubah
async autoUpdateUserLocation(userId, userData) {
    try {
        const newLocation = this.syncUserLocationWithDepartment(userData);
        
        if (newLocation && newLocation !== userData.location) {
            // console.log('📝 Updating user location in Firestore:', {
            //     userId,
            //     from: userData.location,
            //     to: newLocation
            // });
            
            const userRef = doc(this.db, "users", userId);
            await updateDoc(userRef, {
                location: newLocation,
                updated_at: new Date().toISOString()
            });
            
            // console.log('✅ User location updated in Firestore');
        }
    } catch (error) {
        console.error('❌ Error updating user location:', error);
    }
}

// ✅ FIX: Enhanced user profile update handler
handleUserProfileUpdate(userId, userData) {
    try {
        // console.log('🎯 [ENHANCED] User profile update - FULL DATA:', userData);

        // ✅ SYNC LOCATION DI DATABASE JIKA PERLU
        this.autoUpdateUserLocation(userId, userData);

        // ✅ TAMPILKAN NOTIFICATION DENGAN LOCATION YANG SUDAH DISYNC
        this.showRealTimeUserUpdateNotification(userData);

        // ✅ UPDATE TICKETS DENGAN DATA TERBARU
        this.updateUserTicketsInRealTime(userId, userData);
        
        // ✅ CLEAR CACHE
        if (window.userCache && window.userCache[userId]) {
            delete window.userCache[userId];
        }

    } catch (error) {
        console.error('❌ Error handling user profile update:', error);
    }
}

// ✅ FIX: Enhanced auto-update location di Firestore
async autoUpdateUserLocation(userId, userData) {
    try {
        const syncedLocation = this.syncUserLocationWithDepartment(userData);
        
        // Cek jika location perlu diupdate di database
        if (syncedLocation && syncedLocation !== userData.location) {
            // console.log('📝 [AUTO-UPDATE] Updating user location in Firestore:', {
            //     userId,
            //     from: userData.location,
            //     to: syncedLocation
            // });
            
            const userRef = doc(this.db, "users", userId);
            await updateDoc(userRef, {
                location: syncedLocation,
                updated_at: new Date().toISOString()
            });
            
            // console.log('✅ User location updated in Firestore');
            
            // Update userData object untuk konsistensi
            userData.location = syncedLocation;
        }
    } catch (error) {
        console.error('❌ Error updating user location:', error);
    }
}

// ✅ DEBUG: Check ticket data in Firestore
async debugTicketData(ticketId) {
    try {
        // console.log('🔍 [DEBUG] Checking ticket data in Firestore:', ticketId);
        
        const ticketDoc = await getDoc(doc(this.db, "tickets", ticketId));
        if (ticketDoc.exists()) {
            const ticketData = ticketDoc.data();
            // console.log('📋 [DEBUG] Firestore ticket data:', {
            //     code: ticketData.code,
            //     user_name: ticketData.user_name,
            //     user_department: ticketData.user_department, // ← INI YANG DICEK!
            //     user_email: ticketData.user_email,
            //     user_id: ticketData.user_id
            // });
        } else {
            console.error('❌ [DEBUG] Ticket not found in Firestore');
        }
    } catch (error) {
        console.error('❌ [DEBUG] Error checking ticket data:', error);
    }
}

// ✅ FIX: Method untuk sync location dengan department
syncUserLocationWithDepartment(userData) {
    // Mapping department ke location
    const departmentLocationMap = {
        'Warehouse': 'Warehouse',
        'IT': 'IT Server',
        'HR': 'HRD',
        'HRD': 'HRD',
        'Admin': 'White Office',
        'Finance': 'White Office',
        'HSE': 'HSE Yard',
        'Clinic': 'Clinic',
        'Security': 'Security',
        'Store1': 'Store 1',
        'Store2': 'Store 2',
        'Store3': 'Store 3',
        'Store4': 'Store 4',
        'Store5': 'Store 5',
        'Store6': 'Store 6',
        'Store7': 'Store 7',
        'Store8': 'Store 8',
        'Store9': 'Store 9',
        'Civil': 'Yard',
        'Completion': 'Workshop9',
        'DC': 'Workshop10', // Dimentional Control
        'Document Control': 'White Office',
        'Engineer': 'Blue Office',
        'Engineering': 'Blue Office',
        'Maintenance': 'Workshop11',
        'Management': 'White Office 2nd Fl',
        'Planner': 'White Office',
        'Procurement': 'White Office',
        'QC': 'Workshop12', // Quality Control
        'Vendor': 'White Office',
        'Lainlain': 'Other Location'
        // Tambahkan mapping lainnya sesuai kebutuhan
    };
    
    const suggestedLocation = departmentLocationMap[userData.department];
    
    if (suggestedLocation && userData.location !== suggestedLocation) {
        // console.log('🔄 Auto-syncing location:', {
        //     from: userData.location,
        //     to: suggestedLocation,
        //     department: userData.department
        // });
        return suggestedLocation;
    }
    
    return userData.location; // Return original location jika tidak perlu sync
}

showRealTimeUserUpdateNotification(userData) {
    // ✅ DAPATKAN LOCATION YANG SUDAH DISYNC
    const syncedLocation = this.syncUserLocationWithDepartment(userData);

    // console.log('🔔 [NOTIFICATION SYNCED]', {
    //     name: userData.full_name,
    //     department: userData.department,
    //     originalLocation: userData.location,
    //     displayLocation: displayLocation
    // });

    const notification = document.createElement('div');
    notification.className = 'realtime-user-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-user-edit"></i>
            <div>
                <strong>User Profile Updated</strong>
                <p>${userData.full_name} - ${userData.department}</p>
                <small>Department: ${userData.department} | Location: ${displayLocation}</small>
            </div>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Styling
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        border-left: 4px solid #3b82f6;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 16px;
        z-index: 10000;
        max-width: 350px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 8000);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
}

updateUserTicketsInRealTime(userId, userData) {
    try {
        const syncedLocation = this.syncUserLocationWithDepartment(userData);
        
        // console.log('🔄 [REAL-TIME] Updating tickets for user:', {
        //     userId,
        //     userName: userData.full_name,
        //     userDepartment: userData.department,
        //     userEmail: userData.email,
        //     userLocation: syncedLocation // ← GUNAKAN SYNCED LOCATION
        // });
        
        const userTickets = this.tickets.filter(ticket => 
            ticket.user_id === userId || 
            ticket.user_email === userData.email
        );
    
        if (userTickets.length > 0) {
            // console.log(`📝 Found ${userTickets.length} tickets for user ${userData.full_name}`);
            
            userTickets.forEach(ticket => {
                const ticketIndex = this.tickets.findIndex(t => t.id === ticket.id);
                if (ticketIndex !== -1) {
                    this.tickets[ticketIndex].user_name = userData.full_name;
                    this.tickets[ticketIndex].user_department = userData.department;
                    this.tickets[ticketIndex].user_email = userData.email;
                    this.tickets[ticketIndex].user_phone = userData.phone;
                    
                    // ✅ FIX: UPDATE LOCATION DENGAN YANG SUDAH DISYNC
                    if (syncedLocation) {
                        this.tickets[ticketIndex].location = syncedLocation;
                    }
                }
            });
            
            this.renderTickets();
            this.updateStats();
            
            // console.log('✅ Tickets updated with synced location');
        }
        
    } catch (error) {
        console.error('❌ Error updating user tickets:', error);
    }
}

// ✅ FIX: Refresh users table
async refreshUsersTable() {
    try {
        // console.log('🔄 Refreshing users table...');
        
        const usersQuery = query(collection(this.db, "users"));
        const querySnapshot = await getDocs(usersQuery);
        
        const users = [];
        querySnapshot.forEach((doc) => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Render table
        this.renderUsersTable(users);
        
        // console.log('✅ Users table refreshed with', users.length, 'users');
        
    } catch (error) {
        console.error('❌ Error refreshing users table:', error);
    }
}

// ✅ FIX: Render users table
renderUsersTable(users) {
    const usersTable = document.getElementById('usersTable');
    if (!usersTable) return;
    
    const tbody = usersTable.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${this.escapeHtml(user.employee_id || '-')}</td>
            <td>
                <strong>${this.escapeHtml(user.full_name)}</strong>
                <br><small>${this.escapeHtml(user.email)}</small>
            </td>
            <td>${this.escapeHtml(user.phone || '-')}</td>
            <td>${this.escapeHtml(user.department)}</td>
            <td>${this.escapeHtml(user.location)}</td>
            <td>
                <span class="status-badge status-${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn-action btn-view" onclick="adminDashboard.viewUser('${user.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

// ✅ FIX: Enhanced notification
showUserUpdateNotification(userName, userData) {
    this.showToastNotification(
        `User Updated: ${userName}`,
        'info',
        `Department: ${userData.department}, Location: ${userData.location}`
    );
}

// Method untuk load users data (jika ada halaman manage users)
async loadUsersData() {
    try {
        const usersQuery = query(collection(this.db, "users"));
        const querySnapshot = await getDocs(usersQuery);
        
        const users = [];
        querySnapshot.forEach((doc) => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        this.renderUsersTable(users);
        
    } catch (error) {
        console.error('Error loading users data:', error);
    }
}

// Notification untuk update user data
showUserUpdateNotification(snapshot) {
    snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
            const userData = change.doc.data();
            // console.log('👤 User data updated:', userData.full_name);
            
            // Show subtle notification
            this.showToastNotification(
                `User profile updated: ${userData.full_name}`,
                'info'
            );
        }
    });
}

// Toast notification helper
showToastNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${type === 'info' ? 'info-circle' : 'check-circle'}"></i>
            <span>${message}</span>
            <button class="toast-close">&times;</button>
        </div>
    `;
    
    // Styling untuk toast
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-left: 4px solid ${type === 'info' ? '#3b82f6' : '#10b981'};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 12px 16px;
        z-index: 10000;
        max-width: 300px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove setelah 5 detik
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
    
    // Close button handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
}

// ✅ FIX: Check if we should show user updates
isOnUsersPage() {
    // Cek jika ada element users table ATAU jika kita ingin selalu show notifications
    return document.getElementById('usersTable') || 
           document.getElementById('usersSection') ||
           true; // Selalu return true untuk testing
}

    // ✅ CHECK DOM ELEMENTS - MATCH WITH ACTUAL HTML
    checkDOMElements() {
        const requiredElements = {
            'ticketsTableBody': document.getElementById('ticketsTableBody'),
            'emptyTicketsState': document.getElementById('emptyTicketsState'),
            'totalOpenTickets': document.getElementById('totalOpenTickets'),
            'totalInProgress': document.getElementById('totalInProgress'),
            'totalResolved': document.getElementById('totalResolved'),
            'totalHighPriority': document.getElementById('totalHighPriority'),
            'myTickets': document.getElementById('myTickets'),
            'ticketModal': document.getElementById('ticketModal'),
            'ticketModalBody': document.getElementById('ticketModalBody')
        };
        
        // console.log('🏗️ DOM Elements check:', requiredElements);
        
        for (const [name, element] of Object.entries(requiredElements)) {
            if (!element) {
                console.error(`❌ Missing DOM element: ${name}`);
            } else {
                // console.log(`✅ Found: ${name}`);
            }
        }
        
        return requiredElements;
    }

    async checkAuth() {
        try {
            // Cek dari localStorage dulu
            this.adminUser = JSON.parse(localStorage.getItem('adminUser'));
            
            if (!this.adminUser) {
                // Cek dari Firebase Auth
                const firebaseUser = await firebaseAuthService.getCurrentUser();
                if (firebaseUser) {
                    // Cek apakah user adalah admin
                    const adminDoc = await getDoc(doc(db, "admins", firebaseUser.uid));
                    if (adminDoc.exists()) {
                        this.adminUser = {
                            uid: firebaseUser.uid,
                            ...adminDoc.data()
                        };
                        localStorage.setItem('adminUser', JSON.stringify(this.adminUser));
                    } else {
                        window.location.href = 'login.html';
                        return;
                    }
                } else {
                    window.location.href = 'login.html';
                    return;
                }
            }

            // console.log('✅ Admin authenticated:', {
            //     uid: this.adminUser.uid,
            //     role: this.adminUser.role,
            //     name: this.adminUser.name,
            //     email: this.adminUser.email
            // });

        } catch (error) {
            console.error('Admin auth check failed:', error);
            window.location.href = 'login.html';
        }
    }

    // ==================== PERMISSION SYSTEM ====================
    canDeleteTicket(ticket) {
        if(this.adminUser.role === 'Super Admin') {
            return true;}
        // Admin biasa hanya bisa hapus jika mereka adalah action_by atau assigned_to ticket
    const isTicketOwner = this.isAssignedToCurrentAdmin(ticket);
    return isTicketOwner;
    }

    canStartTicket(ticket) {
        if (ticket.status !== 'Open') return false;
        
        if (this.adminUser.role === 'Super Admin') {
            return true;
        }
        
        const isUnassigned = !ticket.action_by && !ticket.assigned_to;
        const isAssignedToMe = this.isAssignedToCurrentAdmin(ticket);
        
        return isUnassigned || isAssignedToMe;
    }

    canResolveTicket(ticket) {
        if (ticket.status !== 'In Progress') return false;
        
        if (this.adminUser.role === 'Super Admin') {
            return true;
        }
        
        return this.isAssignedToCurrentAdmin(ticket);
    }

    canReopenTicket(ticket) {
        if (ticket.status !== 'Resolved') return false;
        
        if (this.adminUser.role === 'Super Admin') {
            return true;
        }
        
        return this.isAssignedToCurrentAdmin(ticket);
    }

    canTakeTicket(ticket) {
        return !ticket.action_by && !ticket.assigned_to;
    }

    canUpdateTicket(ticket) {
        if (this.adminUser.role === 'Super Admin') {
        return true;}

        return this.isAssignedToCurrentAdmin(ticket);
    }

    // ✅ HELPER METHOD UNTUK CHECK ASSIGNMENT (FLEXIBLE)
    isAssignedToCurrentAdmin(ticket) {
        // Check by UID (format baru)
        if (ticket.action_by === this.adminUser.uid || ticket.assigned_to === this.adminUser.uid) {
            return true;
        }
        
        // Check by name (format lama - compatibility)
        if (this.adminUser.name && 
            (ticket.action_by === this.adminUser.name || ticket.assigned_to === this.adminUser.name)) {
            return true;
        }
        
        // Check by email (fallback)
        if (this.adminUser.email && 
            (ticket.action_by === this.adminUser.email || ticket.assigned_to === this.adminUser.email)) {
            return true;
        }
        
        return false;
    }

    // ✅ METHOD UNTUK CHECK PERMISSIONS
    checkPermissions(ticket) {
        const isTicketOwner = this.isAssignedToCurrentAdmin(ticket);
        return {
            canDelete: this.canDeleteTicket(ticket),
            canReopen: this.canReopenTicket(ticket),
            canTake: this.canTakeTicket(ticket),
            canUpdate: this.canUpdateTicket(ticket),
            canStart: this.canStartTicket(ticket),
            canResolve: this.canResolveTicket(ticket),
            isSuperAdmin: this.adminUser.role === 'Super Admin',
            isTicketOwner: isTicketOwner
        };
    }

    loadAdminInfo() {
        if (this.adminUser) {
            const adminNameEl = document.getElementById('adminName');
            const adminRoleEl = document.getElementById('adminRole');
            const welcomeAdminEl = document.getElementById('welcomeAdmin');
            
            if (adminNameEl) adminNameEl.textContent = this.adminUser.name || this.adminUser.email;
            if (adminRoleEl) adminRoleEl.textContent = this.adminUser.role || 'Admin';
            if (welcomeAdminEl) welcomeAdminEl.textContent = this.adminUser.name || this.adminUser.email;
        }
    }

    // ==================== METHOD UNTUK GET ADMIN INFO ====================
    async getAdminInfo(adminUid) {
        try {
            if (!adminUid) return null;
            
            // Cek cache dulu
            if (window.adminCache && window.adminCache[adminUid]) {
                return window.adminCache[adminUid];
            }
            
            const adminDoc = await getDoc(doc(this.db, "admins", adminUid));
            if (adminDoc.exists()) {
                const adminData = adminDoc.data();
                const adminInfo = {
                    uid: adminUid,
                    name: adminData.name || 'Unknown Admin',
                    email: adminData.email || 'No Email',
                    role: adminData.role || 'Admin'
                };
                
                // Simpan ke cache
                if (!window.adminCache) window.adminCache = {};
                window.adminCache[adminUid] = adminInfo;
                
                return adminInfo;
            }
            
            return null;
        } catch (error) {
            console.error('Error getting admin info:', error);
            return null;
        }
    }

    async getAssignedAdminInfo(ticket) {
        try {
            const actionByInfo = ticket.action_by ? await this.getAdminInfo(ticket.action_by) : null;
            const assignedToInfo = ticket.assigned_to ? await this.getAdminInfo(ticket.assigned_to) : null;
            
            return {
                actionBy: actionByInfo,
                assignedTo: assignedToInfo
            };
        } catch (error) {
            console.error('Error getting assigned admin info:', error);
            return {
                actionBy: null,
                assignedTo: null
            };
        }
    }

    initializeEventListeners() {
    // console.log('🔧 Initializing event listeners...');
    
    // Logout
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', this.handleLogout);
    }

    // Manage Team Button
    const manageTeamBtn = document.getElementById('manageTeamBtn');
    if (manageTeamBtn) {
        manageTeamBtn.addEventListener('click', this.handleManageTeam);
    }

    // Filters
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    
    if (statusFilter) {
        statusFilter.addEventListener('change', this.filterTickets);
    }
    
    if (priorityFilter) {
        priorityFilter.addEventListener('change', this.filterTickets);
    }

    // ✅ TAMBAHKAN INI: Date Filter Listeners
    this.initializeDateFilter();

    // Modal close
    const closeModalBtn = document.getElementById('closeTicketModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            this.closeTicketModal();
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('ticketModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeTicketModal();
            }
        });
    }

    // ✅ EVENT DELEGATION UNTUK TICKET ACTIONS
    const tableBody = document.getElementById('ticketsTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', this.handleTableClick);
    }

    // Export button - ✅ PERBAIKAN: Gunakan method yang sudah di-bind
    const exportBtn = document.getElementById('exportTickets');
    if (exportBtn) {
        exportBtn.addEventListener('click', this.handleExport); // ← INI YANG DIPERBAIKI
    }

    // console.log('✅ All event listeners initialized');
}

    // ✅ INITIALIZE UPDATE FORM
    initializeUpdateForm() {
        const updateForm = document.getElementById('updateTicketForm');
        if (updateForm) {
            updateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (this.currentUpdatingTicketId) {
                    this.handleTicketUpdate(this.currentUpdatingTicketId);
                }
            });
            // console.log('✅ Update form event listener added');
        } else {
            console.warn('⚠️ Update form not found, will create dynamically');
        }
    }

    // ✅ METHOD HANDLE TABLE CLICK
    handleTableClick(e) {
        // console.log('🖱️ Table clicked:', e.target);
        // console.log('🔍 Element details:', {
        //     tagName: e.target.tagName,
        //     className: e.target.className,
        //     parentClass: e.target.parentElement?.className
        // });
        
        // Cari button action terdekat
        let button = e.target.closest('.btn-action');
        
        // Jika tidak ditemukan, mungkin user klik icon di dalam button
        if (!button && e.target.classList.contains('fa-eye')) {
            button = e.target.closest('button');
        }
        
        if (!button) {
            // console.log('❌ No action button found');
            return;
        }

        const action = button.dataset.action;
        // console.log('🎯 Action detected:', action);

        // Cari container action buttons
        const actionContainer = button.closest('.action-buttons');
        const ticketId = actionContainer?.dataset.ticketId;

        // console.log('🔍 Action details:', { 
        //     action: action,
        //     ticketId: ticketId,
        //     hasActionContainer: !!actionContainer,
        //     containerHTML: actionContainer?.outerHTML
        // });

        if (!ticketId) {
            console.error('❌ No ticket ID found in data attribute');
            return;
        }

        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) {
            console.error('❌ Ticket not found in local data:', ticketId);
            // console.log('📋 Available tickets:', this.tickets.map(t => t.id));
            return;
        }

        // console.log('🎫 Found ticket:', {
        //     code: ticket.code,
        //     status: ticket.status,
        //     action_by: ticket.action_by,
        //     assigned_to: ticket.assigned_to
        // });

        // Check permissions sebelum eksekusi action
        const permissions = this.checkPermissions(ticket);
        // console.log('🔐 Permissions:', permissions);

        // Eksekusi action berdasarkan jenis
        switch (action) {
            case 'view':
                // console.log('👀 View ticket clicked:', ticketId);
                this.viewTicket(ticketId);
                break;
            case 'start':
                // console.log('🚀 Start ticket clicked:', ticketId);
                if (permissions.canStart) {
                    this.updateTicketStatus(ticketId, 'In Progress');
                } else {
                    this.showPermissionError('start this ticket');
                }
                break;
            case 'resolve':
                // console.log('✅ Resolve ticket clicked:', ticketId);
                if (permissions.canResolve) {
                    this.updateTicketStatus(ticketId, 'Resolved');
                } else {
                    this.showPermissionError('resolve this ticket');
                }
                break;
            case 'reopen':
                // console.log('🔁 Reopen ticket clicked:', ticketId);
                if (permissions.canReopen) {
                    this.updateTicketStatus(ticketId, 'Open');
                } else {
                    this.showPermissionError('reopen this ticket');
                }
                break;
            case 'delete':
                // console.log('🗑️ Delete ticket clicked:', ticketId);
                if (permissions.canDelete) {
                    this.deleteTicket(ticketId);
                } else {
                    this.showPermissionError('delete this ticket');
                }
                break;
            case 'take':
                // console.log('👋 Take ticket clicked:', ticketId);
                if (permissions.canTake) {
                    this.takeTicket(ticketId);
                } else {
                    this.showPermissionError('take this ticket');
                }
                break;
            default:
                console.error('❌ Unknown action:', action);
        }
    }

    async showPermissionError(action) {
        const roleName = this.adminUser.role;
        
        let message = '';
        if (action.includes('delete')) {
            if(this.adminUser.role === 'Super Admin') {
                message = 'Only super admin and owner can ${action}.';
             } else{
            message = `Only Super Admin can ${action}. Your role (${roleName}) does not have delete permission.`;}
        } else {
            message = `You don't have permission to ${action}. Please contact Super Admin if you need this access.`;
        }
        
        await Swal.fire({
            title: 'Permission Denied',
            text: message,
            icon: 'error',
            confirmButtonColor: '#ef070a'
        });
    }

    async handleManageTeam(e) {
        e.preventDefault();
        window.location.href = 'manage-team.html';
    }

    async handleLogout() {
        const result = await Swal.fire({
            title: 'Logout Confirmation',
            text: 'Are you sure you want to logout?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, Logout',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await firebaseAuthService.logout();
            } catch (error) {
                // console.log('Firebase logout:', error.message);
            }
            
            localStorage.removeItem('adminUser');
            window.location.href = 'login.html';
        }
    }

    setupRealTimeListener() {
        try {
            const q = query(collection(this.db, "tickets"), orderBy("created_at", "desc"));
            
            this.unsubscribe = onSnapshot(q, (snapshot) => {
                // console.log('🔄 Real-time update: tickets changed');
                this.loadTickets();
            });
            
            // console.log('✅ Real-time listener activated');
        } catch (error) {
            console.error('❌ Error setting up real-time listener:', error);
        }
    }

   // ✅ FIX: Enhanced loadTickets dengan user data sync
async loadTickets() {
    try {
        // console.log('🔄 Loading tickets dengan user data sync...');
        
        const q = query(
            collection(this.db, "tickets"), 
            orderBy("created_at", "desc")
        );

        const querySnapshot = await getDocs(q);
        const allTickets = [];
        
        querySnapshot.forEach((doc) => {
            try {
                const data = doc.data();
                const ticket = this.normalizeTicketData(doc.id, data);
                
                // console.log(`🎫 [LOAD] Ticket ${ticket.code}:`, {
                //     department: ticket.user_department,
                //     name: ticket.user_name,
                //     email: ticket.user_email
                // });
                
                allTickets.push(ticket);
            } catch (error) {
                console.error(`❌ Error processing ticket ${doc.id}:`, error);
            }
        });

        this.tickets = allTickets;
        this.filteredTickets = [...this.tickets];
        
        this.updateGlobalTicketsData();
        this.renderTickets();
        this.updateStats();
        
        // console.log(`✅ Loaded ${allTickets.length} tickets`);
        
    } catch (error) {
        console.error('❌ Error loading tickets:', error);
        this.showError('Failed to load tickets: ' + error.message);
    }
}

    // ✅ NORMALIZE TICKET DATA
    normalizeTicketData(id, data) {
        try {
            const created_at = data.created_at?.toDate ? 
                data.created_at.toDate().toISOString() : 
                (data.created_at || new Date().toISOString());
                
            const last_updated = data.last_updated?.toDate ? 
                data.last_updated.toDate().toISOString() : 
                (data.last_updated || new Date().toISOString());

            return {
                id: id || '',
                code: data.code || 'UNKNOWN',
                subject: data.subject || 'No Subject',
                user_name: data.user_name || 'Unknown User',
                user_email: data.user_email || '',
                user_department: data.user_department || '',
                location: data.location || '',
                inventory: data.inventory || '',
                device: data.device || '',
                message: data.message || '',
                priority: data.priority || 'Medium',
                status: data.status || data.qa || 'Open',
                created_at: created_at,
                last_updated: last_updated,
                action_by: data.action_by || '',
                assigned_to: data.assigned_to || '',
                note: data.note || '',
                qa: data.qa || '',
                user_phone: data.user_phone || '',
                updates: Array.isArray(data.updates) ? data.updates : []
            };
        } catch (error) {
            console.error(`❌ Error normalizing ticket ${id}:`, error);
            return {
                id: id || 'error',
                code: 'ERROR',
                subject: 'Error Processing Ticket',
                user_name: 'System',
                user_email: '',
                user_department: '',
                location: '',
                inventory: '',
                device: '',
                message: '',
                priority: 'Medium',
                status: 'Open',
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                action_by: '',
                assigned_to: '',
                note: '',
                qa: '',
                user_phone: '',
                updates: []
            };
        }
    }

    updateGlobalTicketsData() {
        try {
            const validTickets = this.tickets.filter(ticket => 
                ticket && typeof ticket === 'object' && ticket.id && ticket.code
            );

            if (typeof window.updateAllTickets === 'function') {
                window.updateAllTickets(validTickets);
            }
            
            if (!window.adminData) window.adminData = {};
            window.adminData.tickets = validTickets;
            
        } catch (error) {
            console.error('❌ Error updating global tickets data:', error);
        }
    }

    filterTickets() {
        const statusFilter = document.getElementById('statusFilter');
        const priorityFilter = document.getElementById('priorityFilter');

        const statusValue = statusFilter ? statusFilter.value : 'all';
        const priorityValue = priorityFilter ? priorityFilter.value : 'all';

        this.filteredTickets = this.tickets.filter(ticket => {
            const statusMatch = statusValue === 'all' || ticket.status === statusValue;
            const priorityMatch = priorityValue === 'all' || ticket.priority === priorityValue;
            return statusMatch && priorityMatch;
        });

        this.renderTickets();
        this.updateStats();
    }

    // ? METHOD UNTUK GET ADMIN INFO BY UID
async getAdminDisplayInfo(adminUid) {
    try {
        if (!adminUid) return 'Unassigned';
        
        // Cek cache dulu
        if (window.adminCache && window.adminCache[adminUid]) {
            const admin = window.adminCache[adminUid];
            return `${admin.name} (${admin.email})`;
        }
        
        // Ambil dari Firestore
        const adminDoc = await getDoc(doc(this.db, "admins", adminUid));
        if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            const displayInfo = `${adminData.name || 'Unknown Admin'} (${adminData.email || 'No Email'})`;
            
            // Simpan ke cache
            if (!window.adminCache) window.adminCache = {};
            window.adminCache[adminUid] = {
                name: adminData.name || 'Unknown Admin',
                email: adminData.email || 'No Email'
            };
            
            return displayInfo;
        }
        
        return 'Unknown Admin';
    } catch (error) {
        console.error('Error getting admin display info:', error);
        return 'Error loading admin info';
    }
}

// ? METHOD UNTUK GET ASSIGNED ADMIN DISPLAY INFO
async getAssignedAdminDisplayInfo(ticket) {
    try {
        let displayInfo = 'Unassigned';
        
        // Prioritaskan assigned_to, lalu action_by
        if (ticket.assigned_to) {
            displayInfo = await this.getAdminDisplayInfo(ticket.assigned_to);
        } else if (ticket.action_by) {
            displayInfo = await this.getAdminDisplayInfo(ticket.action_by);
        } else if (ticket.assigned_name) {
            // Fallback ke assigned_name (format lama)
            displayInfo = ticket.assigned_name;
        }
        
        return displayInfo;
    } catch (error) {
        console.error('Error getting assigned admin display info:', error);
        return 'Error loading assignment info';
    }
}

    // ? RENDER TICKETS TO MOBILE CARDS
// ? RENDER TICKETS TO MOBILE CARDS - MODIFIED VERSION
async renderTicketsToCards() {
    const cardsContainer = document.getElementById('ticketsCards');
    const emptyState = document.getElementById('emptyTicketsState');

    if (!cardsContainer || !emptyState) {
        console.error('? Required DOM elements for cards not found');
        return;
    }

    if (this.filteredTickets.length === 0) {
        cardsContainer.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Buat array promises untuk load semua admin info
    const cardPromises = this.filteredTickets.map(async (ticket) => {
        const permissions = this.checkPermissions(ticket);
        const assignedAdminDisplay = await this.getAssignedAdminDisplayInfo(ticket);
        
        // console.log(`?? Rendering ticket card ${ticket.id}:`, {
        //     code: ticket.code,
        //     status: ticket.status,
        //     assignedAdmin: assignedAdminDisplay
        // });
        
        // Tentukan action buttons berdasarkan status dan permissions
        let actionButtons = '';
        
        // ? VIEW BUTTON - SELALU TERSEDIA
        actionButtons += `
            <button class="btn-card-action btn-view" onclick="adminDashboard.viewTicket('${ticket.id}')" title="View Ticket Details">
                <i class="fas fa-eye"></i> View
            </button>
        `;
        
        // Take Ticket button
        if (!ticket.action_by && !ticket.assigned_to && permissions.canTake) {
            actionButtons += `
                <button class="btn-card-action btn-take" onclick="adminDashboard.takeTicket('${ticket.id}')" title="Take this ticket">
                    <i class="fas fa-hand-paper"></i> Take
                </button>
            `;
        }
        
        // Action buttons berdasarkan status
        if (ticket.status === 'Open') {
            if (permissions.canStart) {
                actionButtons += `
                    <button class="btn-card-action btn-edit" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'In Progress')" title="Start Working on this ticket">
                        <i class="fas fa-play"></i> Start
                    </button>
                `;
            }
        } else if (ticket.status === 'In Progress') {
            if (permissions.canResolve) {
                actionButtons += `
                    <button class="btn-card-action btn-resolve" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'Resolved')" title="Mark as Resolved">
                        <i class="fas fa-check"></i> Resolve
                    </button>
                `;
            }
        } else if (ticket.status === 'Resolved') {
            if (permissions.canReopen) {
                actionButtons += `
                    <button class="btn-card-action btn-edit" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'Open')" title="Reopen Ticket">
                        <i class="fas fa-redo"></i> Reopen
                    </button>
                `;
            }
        }
        
        // Delete button
        if (permissions.canDelete) {
            actionButtons += `
                <button class="btn-card-action btn-delete" onclick="adminDashboard.deleteTicket('${ticket.id}')" title="Delete Ticket">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `;
        }

        // Format tanggal
        const createdDate = ticket.created_at ? 
            new Date(ticket.created_at).toLocaleString() : 'N/A';

        return `
            <div class="ticket-card" data-ticket-id="${ticket.id}">
                <div class="ticket-header">
                    <div class="ticket-id">${ticket.code || 'N/A'}</div>
                    <div class="ticket-date">${createdDate}</div>
                </div>
                
                <div class="ticket-title">${ticket.subject || 'No Subject'}</div>
                
                <div class="ticket-user-info">
                    <div class="ticket-user">${ticket.user_name || 'Unknown'}</div>
                    <div class="ticket-department">${ticket.user_department || 'N/A'}</div>
                </div>
                
                <div class="ticket-location">
                    <i class="fas fa-map-marker-alt"></i> ${ticket.location || 'N/A'}
                </div>
                
                <div class="ticket-meta">
                    <span class="priority-badge priority-${(ticket.priority || 'medium').toLowerCase()}">
                        <i class="fas fa-${ticket.priority === 'High' ? 'exclamation-circle' : 'flag'}"></i> 
                        ${ticket.priority || 'Medium'}
                    </span>
                    <span class="status-badge status-${(ticket.status || 'open').toLowerCase().replace(' ', '-')}">
                        <i class="fas fa-${this.getStatusIcon(ticket.status)}"></i> 
                        ${ticket.status || 'Open'}
                    </span>
                </div>
                
                ${ticket.message ? `
                <div class="ticket-description">
                    ${this.truncateText(ticket.message, 100)}
                </div>
                ` : ''}
                
                <div class="ticket-footer">
                    <div class="ticket-assignee">
                        <i class="fas fa-user-shield"></i> 
                        ${assignedAdminDisplay}
                    </div>
                    <div class="ticket-actions">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        `;
    });

    // Tunggu semua promises selesai
    const cardsHtmlArray = await Promise.all(cardPromises);
    const cardsHtml = cardsHtmlArray.join('');

    cardsContainer.innerHTML = cardsHtml;
    
    // console.log(`?? Rendered ${this.filteredTickets.length} ticket cards`);
}

// ? HELPER METHOD UNTUK TRUNCATE TEXT
truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return this.escapeHtml(text);
    return this.escapeHtml(text.substring(0, maxLength)) + '...';
}

// ? HELPER METHOD UNTUK STATUS ICON
getStatusIcon(status) {
    const icons = {
        'Open': 'clock',
        'In Progress': 'tools', 
        'Resolved': 'check-circle',
        'Closed': 'check-circle',
        'Completed': 'check-circle'
    };
    return icons[status] || 'ticket-alt';
}

    // ✅ RENDER TICKETS
    // ? RENDER TICKETS - MODIFIED VERSION DENGAN ASYNC
async renderTickets() {
    const tableBody = document.getElementById('ticketsTableBody');
    const emptyState = document.getElementById('emptyTicketsState');

    if (!tableBody || !emptyState) {
        console.error('? Required DOM elements not found');
        return;
    }

    if (this.filteredTickets.length === 0) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'block';
        // Juga clear cards container
        const cardsContainer = document.getElementById('ticketsCards');
        if (cardsContainer) cardsContainer.innerHTML = '';
        return;
    }

    emptyState.style.display = 'none';

    // Buat array promises untuk load semua admin info
    const rowPromises = this.filteredTickets.map(async (ticket) => {
        const permissions = this.checkPermissions(ticket);
        const assignedAdminDisplay = await this.getAssignedAdminDisplayInfo(ticket);
        
        // console.log(`?? Rendering ticket ${ticket.id}:`, {
        //     id: ticket.id,
        //     code: ticket.code,
        //     user_name: ticket.user_name,
        //     user_department: ticket.user_department, // ← INI YANG DIPERIKSA!
        //     user_email: ticket.user_email,
        //     user_id: ticket.user_id
        // });
        
        // ✅ DEBUG: Cek department yang akan di-render
        const displayDepartment = ticket.user_department || 'N/A';
        // console.log(`🏢 [DEBUG RENDER] Ticket ${ticket.code} department: "${displayDepartment}"`);
        
        // Tentukan action buttons berdasarkan status dan permissions
        let actionButtons = '';
        
        // ? VIEW BUTTON - SELALU TERSEDIA
        actionButtons += `
            <button class="btn-action btn-view" data-action="view" title="View Ticket Details">
                <i class="fas fa-eye"></i> View
            </button>
        `;
        
        // Take Ticket button
        if (!ticket.action_by && !ticket.assigned_to && permissions.canTake) {
            actionButtons += `
                <button class="btn-action btn-take" data-action="take" title="Take this ticket">
                    <i class="fas fa-hand-paper"></i> Take
                </button>
            `;
        }
        
        // Action buttons berdasarkan status
        if (ticket.status === 'Open') {
            if (permissions.canStart) {
                actionButtons += `
                    <button class="btn-action btn-edit" data-action="start" title="Start Working on this ticket">
                        <i class="fas fa-play"></i> Start
                    </button>
                `;
            }
        } else if (ticket.status === 'In Progress') {
            if (permissions.canResolve) {
                actionButtons += `
                    <button class="btn-action btn-resolve" data-action="resolve" title="Mark as Resolved">
                        <i class="fas fa-check"></i> Resolve
                    </button>
                `;
            }
        } else if (ticket.status === 'Resolved') {
            if (permissions.canReopen) {
                actionButtons += `
                    <button class="btn-action btn-edit" data-action="reopen" title="Reopen Ticket">
                        <i class="fas fa-redo"></i> Reopen
                    </button>
                `;
            }
        }
        
        // Delete button
        if (permissions.canDelete) {
            actionButtons += `
                <button class="btn-action btn-delete" data-action="delete" title="Delete Ticket">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `;
        }

        return `
            <tr>
                <td><strong>${ticket.code || 'N/A'}</strong></td>
                <td>${ticket.subject || 'No Subject'}</td>
                <td>
                    <div>${ticket.user_name || 'Unknown'}</div>
                    <small class="text-muted">${ticket.user_email || 'No Email'}</small>
                </td>
                <td>${ticket.user_department || 'N/A'}</td>
                <td>${ticket.location || 'N/A'}</td>
                <td>
                    <span class="priority-badge priority-${(ticket.priority || 'medium').toLowerCase()}">
                        ${ticket.priority || 'Medium'}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${(ticket.status || 'open').toLowerCase().replace(' ', '-')}">
                        ${ticket.status || 'Open'}
                    </span>
                </td>
                <td>${ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'N/A'}</td>
                <td>
                    <div class="action-buttons" data-ticket-id="${ticket.id}">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    });

    // Tunggu semua promises selesai
    const ticketsHtmlArray = await Promise.all(rowPromises);
    const ticketsHtml = ticketsHtmlArray.join('');

    tableBody.innerHTML = ticketsHtml;
    
    // ? RENDER CARDS UNTUK MOBILE
    await this.renderTicketsToCards();
    
    // ? DEBUG: Cek apakah buttons ter-render dengan benar
    this.debugRenderedButtons();
    
    this.updateTableForMobile();
}

    

    // ✅ METHOD UNTUK DEBUG RENDERED BUTTONS
    debugRenderedButtons() {
        const tableBody = document.getElementById('ticketsTableBody');
        if (!tableBody) {
            console.error('❌ Table body not found for debugging');
            return;
        }

        // Cek semua action buttons yang di-render
        const actionButtons = tableBody.querySelectorAll('.btn-action');
        // console.log(`🎯 Found ${actionButtons.length} action buttons in table`);

        actionButtons.forEach((button, index) => {
            const action = button.dataset.action;
            const actionContainer = button.closest('.action-buttons');
            const ticketId = actionContainer?.dataset.ticketId;
            
        });

        // Cek khusus view buttons
        const viewButtons = tableBody.querySelectorAll('.btn-view');
        // console.log(`👀 Found ${viewButtons.length} view buttons`);

        viewButtons.forEach((button, index) => {
            // console.log(`📱 View button ${index + 1}:`, {
            //     outerHTML: button.outerHTML,
            //     dataset: button.dataset,
            //     parentDataset: button.closest('.action-buttons')?.dataset
            // });
        });
    }

    updateTableForMobile() {
        const tableCells = document.querySelectorAll('#ticketsTableBody td');
        const headers = document.querySelectorAll('#ticketsTable th');
        
        tableCells.forEach((cell, index) => {
            const headerIndex = index % headers.length;
            const headerText = headers[headerIndex].textContent;
            cell.setAttribute('data-label', headerText);
        });
    }

updateStats() {
    const totalTickets = this.filteredTickets.length;
    const openTickets = this.filteredTickets.filter(ticket => ticket.status === 'Open').length;
    const inProgressTickets = this.filteredTickets.filter(ticket => ticket.status === 'In Progress').length;
    const resolvedTickets = this.filteredTickets.filter(ticket => ticket.status === 'Resolved').length;
    const highPriorityTickets = this.filteredTickets.filter(ticket => ticket.priority === 'High').length;
    const myTickets = this.filteredTickets.filter(ticket => 
        ticket.action_by === this.adminUser?.uid || 
        ticket.assigned_to === this.adminUser?.uid
    ).length;

    this.updateElementText('totalOpenTickets', openTickets);
    this.updateElementText('totalInProgress', inProgressTickets);
    this.updateElementText('totalResolved', resolvedTickets);
    this.updateElementText('totalHighPriority', highPriorityTickets);
    this.updateElementText('myTickets', myTickets);
    
    // ✅ TAMBAHKAN: Show active filter info
    this.showActiveFilterInfo();
}

// ✅ METHOD UNTUK SHOW ACTIVE FILTER INFO
showActiveFilterInfo() {
    const filterInfo = [];
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter && statusFilter.value !== 'all') {
        filterInfo.push(`Status: ${statusFilter.value}`);
    }
    
    // Priority filter
    const priorityFilter = document.getElementById('priorityFilter');
    if (priorityFilter && priorityFilter.value !== 'all') {
        filterInfo.push(`Priority: ${priorityFilter.value}`);
    }
    
    // Date filter
    if (this.dateFilter.isActive) {
        const startDate = this.dateFilter.startDate;
        const endDate = this.dateFilter.endDate;
        
        if (startDate && endDate) {
            if (startDate.getTime() === endDate.getTime()) {
                // Same day (Today filter)
                filterInfo.push(`Date: ${startDate.toLocaleDateString()}`);
            } else {
                filterInfo.push(`Date: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
            }
        } else if (startDate) {
            filterInfo.push(`From: ${startDate.toLocaleDateString()}`);
        } else if (endDate) {
            filterInfo.push(`Until: ${endDate.toLocaleDateString()}`);
        }
    }
    
    // Update filter info display
    this.updateFilterInfoDisplay(filterInfo);
}

// ✅ METHOD UNTUK UPDATE FILTER INFO DISPLAY
updateFilterInfoDisplay(filterInfo) {
    // Cari atau buat element untuk menampilkan info filter
    let filterInfoEl = document.getElementById('activeFilterInfo');
    
    if (!filterInfoEl) {
        filterInfoEl = document.createElement('div');
        filterInfoEl.id = 'activeFilterInfo';
        filterInfoEl.className = 'active-filter-info';
        
        // Tambahkan sebelum tickets table
        const ticketsSection = document.querySelector('.tickets-section');
        if (ticketsSection) {
            const tableContainer = ticketsSection.querySelector('.tickets-table-container');
            if (tableContainer) {
                tableContainer.insertBefore(filterInfoEl, tableContainer.firstChild);
            }
        }
    }
    
    if (filterInfo.length > 0) {
        filterInfoEl.innerHTML = `
            <div class="filter-info-content">
                <i class="fas fa-filter"></i>
                <span>Active filters: ${filterInfo.join(', ')}</span>
                <small>Showing ${this.filteredTickets.length} of ${this.tickets.length} tickets</small>
            </div>
        `;
        filterInfoEl.style.display = 'block';
    } else {
        filterInfoEl.style.display = 'none';
    }
}

// ✅ METHOD UNTUK UPDATE FILTER INFO DISPLAY
updateFilterInfoDisplay(filterInfo) {
    // Cari atau buat element untuk menampilkan info filter
    let filterInfoEl = document.getElementById('activeFilterInfo');
    
    if (!filterInfoEl) {
        filterInfoEl = document.createElement('div');
        filterInfoEl.id = 'activeFilterInfo';
        filterInfoEl.className = 'active-filter-info';
        
        // Tambahkan sebelum tickets table
        const ticketsSection = document.querySelector('.tickets-section');
        if (ticketsSection) {
            const tableContainer = ticketsSection.querySelector('.tickets-table-container');
            if (tableContainer) {
                tableContainer.insertBefore(filterInfoEl, tableContainer.firstChild);
            }
        }
    }
    
    if (filterInfo.length > 0) {
        filterInfoEl.innerHTML = `
            <div class="filter-info-content">
                <i class="fas fa-filter"></i>
                <span>Active filters: ${filterInfo.join(', ')}</span>
                <small>Showing ${this.filteredTickets.length} of ${this.tickets.length} tickets</small>
            </div>
        `;
        filterInfoEl.style.display = 'block';
    } else {
        filterInfoEl.style.display = 'none';
    }
}

    updateElementText(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    // ✅ METHOD UPDATE TICKET STATUS - MODIFIED VERSION
    async updateTicketStatus(ticketId, newStatus) {
        try {
            // console.log(`🔄 Updating ticket ${ticketId} to status: ${newStatus}`);
            
            const ticketRef = doc(this.db, "tickets", ticketId);
            const ticket = this.tickets.find(t => t.id === ticketId);
            
            if (!ticket) {
                throw new Error('Ticket not found');
            }

            const permissions = this.checkPermissions(ticket);
            let hasPermission = false;

            switch (newStatus) {
                case 'In Progress':
                    hasPermission = permissions.canStart;
                    break;
                case 'Resolved':
                    hasPermission = permissions.canResolve;
                    break;
                case 'Open':
                    hasPermission = permissions.canReopen;
                    break;
                default:
                    hasPermission = permissions.canUpdate;
            }

            if (!hasPermission) {
                await this.showPermissionError(`change status to ${newStatus}`);
                return;
            }

            // ✅ VALIDASI KHUSUS UNTUK STATUS RESOLVED
            if (newStatus === 'Resolved') {
                return await this.showResolveConfirmation(ticket);
            }

            const updateData = {
            status: newStatus,
            // ✅ HANYA UPDATE last_updated JIKA BUKAN STATUS FINAL
            ...(isCurrentlyFinalStatus && !isChangingToFinalStatus ? {} : {
                last_updated: serverTimestamp()
            })
        };

            if (newStatus === 'In Progress') {
                updateData.action_by = this.adminUser.uid;
                updateData.assigned_to = this.adminUser.uid;
                updateData.assigned_name = this.adminUser.name || this.adminUser.email;
            }

            // Add to updates array
            const updateNote = {
                status: newStatus,
                notes: `Status changed to ${newStatus} by ${this.adminUser.name || this.adminUser.email}`,
                timestamp: new Date().toISOString(),
                updatedBy: this.adminUser.name || this.adminUser.email
            };

            const ticketDoc = await getDoc(ticketRef);
            const currentData = ticketDoc.data();
            const currentUpdates = Array.isArray(currentData.updates) ? currentData.updates : [];
            updateData.updates = [...currentUpdates, updateNote];

            // Update QA field
            if (newStatus === 'Resolved') {
                updateData.qa = 'Finish';
            } else if (newStatus === 'Open') {
                updateData.qa = 'Open';
            } else if (newStatus === 'In Progress') {
                updateData.qa = 'In Progress';
            }

            await updateDoc(ticketRef, updateData);
            
            await Swal.fire({
                title: 'Success!',
                text: `Ticket status updated to ${newStatus}`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

            await this.loadTickets();

        } catch (error) {
            console.error('❌ Error updating ticket status:', error);
            await Swal.fire({
                title: 'Error!',
                text: 'Failed to update ticket status: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    // ✅ METHOD UNTUK RESOLVE CONFIRMATION DENGAN NOTE
    async showResolveConfirmation(ticket) {
        try {
            const { value: formValues } = await Swal.fire({
                title: `Resolve Ticket ${ticket.code}`,
                html: `
                    <div class="resolve-modal">
                        <div class="ticket-info">
                            <p><strong>Subject:</strong> ${this.escapeHtml(ticket.subject)}</p>
                            <p><strong>User:</strong> ${this.escapeHtml(ticket.user_name)}</p>
                            <p><strong>Current Status:</strong> ${this.escapeHtml(ticket.status)}</p>
                        </div>
                        
                        <div class="form-group">
                            <label for="resolveNote">
                                <i class="fas fa-sticky-note"></i> Resolution Notes *
                            </label>
                            <textarea 
                                id="resolveNote" 
                                class="swal2-textarea" 
                                placeholder="Please describe the solution, steps taken, or reason for closure. This will be included in reports and is REQUIRED."
                                rows="4"
                                required
                            >${ticket.note || ''}</textarea>
                            <small>This note will be visible to the user and included in Excel reports</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="resolveStatus">
                                <i class="fas fa-flag"></i> Final Status *
                            </label>
                            <select 
                                id="resolveStatus" 
                                class="swal2-select" 
                                required
                            >
                                <option value="">Select Status</option>
                                <option value="Resolved" selected>Resolved - Issue has been fixed</option>
                                <option value="Closed">Closed - Ticket completed</option>
                                <option value="Completed">Completed - Work finished</option>
                            </select>
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Confirm Resolution',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#6b7280',
                focusConfirm: false,
                preConfirm: () => {
                    const note = document.getElementById('resolveNote').value.trim();
                    const status = document.getElementById('resolveStatus').value;
                    
                    if (!note) {
                        Swal.showValidationMessage('⚠️ Resolution notes are REQUIRED before resolving a ticket');
                        return false;
                    }
                    
                    if (!status) {
                        Swal.showValidationMessage('⚠️ Please select a final status');
                        return false;
                    }
                    
                    if (note.length < 10) {
                        Swal.showValidationMessage('⚠️ Please provide more detailed notes (minimum 10 characters)');
                        return false;
                    }
                    
                    return { note, status };
                },
                didOpen: () => {
                    // Auto-focus ke textarea
                    setTimeout(() => {
                        const textarea = document.getElementById('resolveNote');
                        if (textarea) textarea.focus();
                    }, 300);
                }
            });

            if (formValues) {
                await this.executeTicketResolution(ticket.id, formValues.status, formValues.note);
            }
            
        } catch (error) {
            console.error('❌ Error in resolve confirmation:', error);
            // User cancelled the action, no need to show error
        }
    }

    // ✅ METHOD UNTUK EKSEKUSI RESOLUTION SETELAH KONFIRMASI
    async executeTicketResolution(ticketId, newStatus, note) {
        try {
            // console.log(`✅ Executing resolution for ticket ${ticketId} with note`);
            
            const ticketRef = doc(this.db, "tickets", ticketId);
            
            const updateData = {
                status: newStatus,
                note: note,
                last_updated: serverTimestamp(),
                qa: 'Finish'
            };

            // Add to updates array dengan note yang lengkap
            const updateNote = {
                status: newStatus,
                notes: `Ticket resolved by ${this.adminUser.name || this.adminUser.email}. Resolution: ${note}`,
                timestamp: new Date().toISOString(),
                updatedBy: this.adminUser.name || this.adminUser.email
            };

            const ticketDoc = await getDoc(ticketRef);
            const currentData = ticketDoc.data();
            const currentUpdates = Array.isArray(currentData.updates) ? currentData.updates : [];
            updateData.updates = [...currentUpdates, updateNote];

            await updateDoc(ticketRef, updateData);
            
            await Swal.fire({
                title: 'Ticket Resolved!',
                html: `
                    <div class="resolution-success">
                        <p><strong>✅ Ticket has been successfully resolved</strong></p>
                        <p><strong>Resolution Notes:</strong></p>
                        <div class="resolution-notes">
                            ${this.escapeHtml(note)}
                        </div>
                        <small>These notes will be included in Excel reports</small>
                    </div>
                `,
                icon: 'success',
                confirmButtonColor: '#10b981',
                timer: 4000
            });

            await this.loadTickets();

        } catch (error) {
            console.error('❌ Error executing ticket resolution:', error);
            await Swal.fire({
                title: 'Resolution Failed!',
                text: 'Failed to resolve ticket: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    // ✅ METHOD TAKE TICKET
    async takeTicket(ticketId) {
        try {
            // console.log(`👋 Taking ticket: ${ticketId}`);
            
            const ticketRef = doc(this.db, "tickets", ticketId);
            const ticket = this.tickets.find(t => t.id === ticketId);
            
            if (!ticket) {
                throw new Error('Ticket not found');
            }

            const permissions = this.checkPermissions(ticket);
            if (!permissions.canTake) {
                await this.showPermissionError('take this ticket');
                return;
            }

            const updateData = {
                action_by: this.adminUser.uid,
                assigned_to: this.adminUser.uid,
                assigned_name: this.adminUser.name || this.adminUser.email,
                status: 'In Progress',
                last_updated: serverTimestamp()
            };

            // Add to updates array
            const updateNote = {
                status: 'In Progress',
                notes: `Ticket taken by ${this.adminUser.name || this.adminUser.email}`,
                timestamp: new Date().toISOString(),
                updatedBy: this.adminUser.name || this.adminUser.email
            };

            const ticketDoc = await getDoc(ticketRef);
            const currentData = ticketDoc.data();
            const currentUpdates = Array.isArray(currentData.updates) ? currentData.updates : [];
            updateData.updates = [...currentUpdates, updateNote];

            await updateDoc(ticketRef, updateData);
            
            await Swal.fire({
                title: 'Success!',
                text: 'Ticket has been assigned to you',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

            await this.loadTickets();

        } catch (error) {
            console.error('❌ Error taking ticket:', error);
            await Swal.fire({
                title: 'Error!',
                text: 'Failed to take ticket: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    // ✅ METHOD VIEW TICKET
    // ✅ UPDATE VIEW TICKET METHOD UNTUK REAL-TIME
async viewTicket(ticketId) {
    try {
        // console.log(`👀 Viewing ticket with real-time: ${ticketId}`);
        
        // Set current modal ticket
        this.currentModalTicketId = ticketId;
        
        // Cek cached data dulu untuk loading cepat
        const cachedTicket = this.tickets.find(t => t.id === ticketId);
        if (cachedTicket) {
            // console.log('📦 Using cached ticket data for initial display');
            await this.showTicketModal(ticketId);
        } else {
            // Fallback: load dari Firestore
            const ticketDoc = await getDoc(doc(this.db, "tickets", ticketId));
            if (ticketDoc.exists()) {
                await this.showTicketModal(ticketId);
            } else {
                throw new Error('Ticket not found');
            }
        }
        
    } catch (error) {
        console.error('❌ Error viewing ticket:', error);
        await Swal.fire({
            title: 'Error!',
            text: 'Failed to load ticket: ' + error.message,
            icon: 'error'
        });
    }
}

    // ✅ METHOD DELETE TICKET
    async deleteTicket(ticketId) {
        try {
            const ticket = this.tickets.find(t => t.id === ticketId);
            if (!ticket) return;

            const permissions = this.checkPermissions(ticket);
            if (!permissions.canDelete) {
                await this.showPermissionError('delete this ticket');
                return;
            }

            const result = await Swal.fire({
                title: 'Delete Ticket?',
                text: 'This action cannot be undone!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, Delete',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(this.db, "tickets", ticketId));
                
                await Swal.fire({
                    title: 'Deleted!',
                    text: 'Ticket has been deleted',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
                
                await this.loadTickets();
            }
        } catch (error) {
            console.error('❌ Error deleting ticket:', error);
            await Swal.fire({
                title: 'Error!',
                text: 'Failed to delete ticket',
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    // ✅ METHOD SHOW TICKET MODAL - FIXED VERSION
    // ✅ METHOD SHOW TICKET MODAL DENGAN REAL-TIME DATA
async showTicketModal(ticketId) {
    try {
        // console.log(`👀 Opening real-time modal for ticket: ${ticketId}`);
        
        const modal = document.getElementById('ticketModal');
        const modalBody = document.getElementById('ticketModalBody');
        
        if (!modal || !modalBody) {
            console.error('❌ Modal elements not found');
            return;
        }

        // Show loading state
        modalBody.innerHTML = `
            <div class="modal-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading ticket details...</p>
            </div>
        `;

        // Show modal immediately
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');

        // Setup real-time listener untuk ticket
        this.setupTicketRealTimeListener(ticketId, modalBody);
        
    } catch (error) {
        console.error('❌ Error opening modal:', error);
        this.showErrorModal(modalBody, 'Failed to load ticket details');
    }
}

// ✅ REAL-TIME LISTENER UNTUK TICKET DATA
setupTicketRealTimeListener(ticketId, modalBody) {
    try {
        // console.log(`🔮 Setting up real-time listener for ticket: ${ticketId}`);
        
        const ticketRef = doc(this.db, "tickets", ticketId);
        
        // Unsubscribe previous listener jika ada
        if (this.ticketModalUnsubscribe) {
            this.ticketModalUnsubscribe();
        }
        
        this.ticketModalUnsubscribe = onSnapshot(ticketRef, 
            // ✅ Success callback
            async (docSnapshot) => {
                try {
                    if (!docSnapshot.exists()) {
                        this.showErrorModal(modalBody, 'Ticket not found');
                        return;
                    }
                    
                    const ticketData = docSnapshot.data();
                    const ticket = this.normalizeTicketData(ticketId, ticketData);
                    
                    // console.log('🔄 Real-time ticket update received:', {
                    //     code: ticket.code,
                    //     status: ticket.status,
                    //     last_updated: ticket.last_updated
                    // });
                    
                    // Render modal content dengan data terbaru
                    await this.renderRealTimeModalContent(ticket, modalBody);
                    
                } catch (error) {
                    console.error('❌ Error processing real-time update:', error);
                    this.showErrorModal(modalBody, 'Error updating ticket view');
                }
            },
            // ✅ Error callback
            (error) => {
                console.error('❌ Real-time listener error:', error);
                this.showErrorModal(modalBody, 'Connection error - showing cached data');
                
                // Fallback ke cached data
                const cachedTicket = this.tickets.find(t => t.id === ticketId);
                if (cachedTicket) {
                    this.renderRealTimeModalContent(cachedTicket, modalBody);
                }
            }
        );
        
        // console.log('✅ Real-time ticket listener activated');
        
    } catch (error) {
        console.error('❌ Error setting up real-time listener:', error);
        this.showErrorModal(modalBody, 'Failed to setup real-time updates');
    }
}

// ✅ RENDER MODAL CONTENT DENGAN REAL-TIME DATA
async renderRealTimeModalContent(ticket, modalBody) {
    try {
        // console.log('🎨 Rendering real-time modal content for:', ticket.code);
        
        // Dapatkan info admin terbaru
        const assignedAdmins = await this.getAssignedAdminInfo(ticket);
        const permissions = this.checkPermissions(ticket);
        
        // Generate HTML content
        const modalHTML = this.getTicketModalHTML(ticket, assignedAdmins, permissions);
        
        // Update modal body dengan animation
        modalBody.style.opacity = '0.7';
        setTimeout(() => {
            modalBody.innerHTML = modalHTML;
            modalBody.style.opacity = '1';
            
            // Add real-time update indicator
            this.addRealTimeIndicator(modalBody);
            
        }, 150);
        
        // console.log('✅ Modal content updated in real-time');
        
    } catch (error) {
        console.error('❌ Error rendering modal content:', error);
        throw error;
    }
}

// ✅ REAL-TIME UPDATE INDICATOR
addRealTimeIndicator(modalBody) {
    const existingIndicator = modalBody.querySelector('.real-time-indicator');
    if (existingIndicator) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'real-time-indicator';
    indicator.innerHTML = `
        <div class="real-time-pulse">
            <i class="fas fa-circle"></i>
            <span>Live Updates</span>
        </div>
    `;
    
    // Insert setelah header
    const modalHeader = modalBody.querySelector('.modal-header');
    if (modalHeader) {
        modalHeader.appendChild(indicator);
    }
}


    // ✅ FALLBACK METHOD JIKA MODAL UTAMA TIDAK BEKERJA
    createFallbackModal(ticket, assignedAdmins, permissions) {
        try {
            // console.log('🔄 Creating fallback modal...');
            
            // Remove existing fallback modal if any
            const existingFallback = document.getElementById('fallbackTicketModal');
            if (existingFallback) {
                existingFallback.remove();
            }
            
            // Create new modal
            const fallbackModal = document.createElement('div');
            fallbackModal.id = 'fallbackTicketModal';
            fallbackModal.className = 'fallback-modal';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'fallback-modal-content';
            
            const modalHTML = this.getTicketModalHTML(ticket, assignedAdmins, permissions);
            modalContent.innerHTML = modalHTML;
            
            // Add close button to fallback modal
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '<i class="fas fa-times"></i>';
            closeButton.className = 'fallback-close-btn';
            closeButton.onclick = () => {
                fallbackModal.remove();
                document.body.classList.remove('modal-open', 'no-scroll');
            };
            
            modalContent.appendChild(closeButton);
            
            fallbackModal.appendChild(modalContent);
            document.body.appendChild(fallbackModal);
            
            // Close on backdrop click
            fallbackModal.onclick = (e) => {
                if (e.target === fallbackModal) {
                    fallbackModal.remove();
                    document.body.classList.remove('modal-open', 'no-scroll');
                }
            };
            
            // console.log('✅ Fallback modal created');
            
        } catch (error) {
            console.error('❌ Error creating fallback modal:', error);
        }
    }

    // ✅ METHOD UNTUK GET MODAL HTML
   getTicketModalHTML(ticket, assignedAdmins, permissions) {
    const lastUpdated = ticket.last_updated ? 
        new Date(ticket.last_updated).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }) : 'Just now';
        
    return `
        <div class="ticket-details real-time-ticket">
            <!-- Real-time Header -->
            <div class="ticket-real-time-header">
                <div class="ticket-summary-bar">
                    <span class="ticket-code">${this.escapeHtml(ticket.code)}</span>
                    <span class="status-badge status-${(ticket.status || 'open').toLowerCase().replace(' ', '-')}">
                        ${this.escapeHtml(ticket.status)}
                    </span>
                </div>
                <div class="real-time-info">
                    <small class="last-updated">
                        <i class="fas fa-clock"></i> 
                        Updated: ${lastUpdated}
                    </small>
                </div>
            </div>

            <!-- Ticket Info dengan Auto-update -->
            <div class="ticket-section">
                <h3><i class="fas fa-info-circle"></i> Ticket Information</h3>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Subject:</strong></div>
                    <div class="ticket-col value" data-field="subject">${this.escapeHtml(ticket.subject)}</div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Priority:</strong></div>
                    <div class="ticket-col" data-field="priority">
                        <span class="priority-badge priority-${(ticket.priority || 'medium').toLowerCase()}">
                            ${this.escapeHtml(ticket.priority)}
                        </span>
                    </div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Status:</strong></div>
                    <div class="ticket-col" data-field="status">
                        <span class="status-badge status-${(ticket.status || 'open').toLowerCase().replace(' ', '-')}">
                            ${this.escapeHtml(ticket.status)}
                        </span>
                    </div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Created:</strong></div>
                    <div class="ticket-col value">
                        ${ticket.created_at ? new Date(ticket.created_at).toLocaleString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: false
                        }) : 'N/A'}
                    </div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Last Updated:</strong></div>
                    <div class="ticket-col value" data-field="last_updated">
                        ${lastUpdated}
                    </div>
                </div>
            </div>

            <!-- User Info -->
            <div class="ticket-section">
                <h3><i class="fas fa-user"></i> User Information</h3>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Name:</strong></div>
                    <div class="ticket-col value" data-field="user_name">${this.escapeHtml(ticket.user_name)}</div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Department:</strong></div>
                    <div class="ticket-col value" data-field="user_department">${this.escapeHtml(ticket.user_department)}</div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Email:</strong></div>
                    <div class="ticket-col value" data-field="user_email">${this.escapeHtml(ticket.user_email)}</div>
                </div>
            </div>

            <!-- Assignment Info dengan Real-time -->
            <div class="ticket-section">
                <h3><i class="fas fa-user-tie"></i> Assignment</h3>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Action By:</strong></div>
                    <div class="ticket-col value" data-field="action_by">
                        ${assignedAdmins.actionBy ? 
                            `${this.escapeHtml(assignedAdmins.actionBy.name)} 
                             <small>(${this.escapeHtml(assignedAdmins.actionBy.email)})</small>` : 
                            '<em>Unassigned</em>'}
                    </div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Assigned To:</strong></div>
                    <div class="ticket-col value" data-field="assigned_to">
                        ${assignedAdmins.assignedTo ? 
                            `${this.escapeHtml(assignedAdmins.assignedTo.name)} 
                             <small>(${this.escapeHtml(assignedAdmins.assignedTo.email)})</small>` : 
                            '<em>Unassigned</em>'}
                    </div>
                </div>
            </div>

            <!-- Update History dengan Real-time -->
            <div class="ticket-section">
                <h3><i class="fas fa-history"></i> Update History 
                    <span class="update-count">(${ticket.updates ? ticket.updates.length : 0} updates)</span>
                </h3>
                <div class="updates-timeline" data-field="updates">
                    ${ticket.updates && ticket.updates.length > 0 ? 
                        ticket.updates.slice().reverse().map(update => `
                            <div class="update-item">
                                <div class="update-header">
                                    <strong>${this.escapeHtml(update.status || 'Updated')}</strong>
                                    <span class="update-time">
                                        ${update.timestamp ? new Date(update.timestamp).toLocaleString('en-GB', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit', hour12: false
                                        }) : 'Unknown'}
                                    </span>
                                </div>
                                <div class="update-notes">${this.escapeHtml(update.notes || '–')}</div>
                                <div class="update-by">by ${this.escapeHtml(update.updatedBy || 'System')}</div>
                            </div>
                        `).join('') : 
                        '<div class="no-updates">No updates yet</div>'
                    }
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="modal-actions">
                ${permissions.canUpdate ? `
                    <button class="btn-primary" onclick="adminDashboard.updateTicketModal('${ticket.id}')">
                        <i class="fas fa-edit"></i> Update Ticket
                    </button>
                ` : ''}
                
                <div class="action-buttons-group">
                    ${ticket.status === 'Open' && permissions.canStart ? `
                        <button class="btn-action btn-edit" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'In Progress')">
                            <i class="fas fa-play"></i> Start
                        </button>
                    ` : ''}
                    ${ticket.status === 'In Progress' && permissions.canResolve ? `
                        <button class="btn-action btn-resolve" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'Resolved')">
                            <i class="fas fa-check"></i> Resolve
                        </button>
                    ` : ''}
                    ${permissions.canDelete ? `
                        <button class="btn-action btn-delete" onclick="adminDashboard.deleteTicket('${ticket.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
                
                <button class="btn-secondary" onclick="adminDashboard.closeTicketModal()">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
}

// ✅ METHOD UNTUK UPDATE SPECIFIC FIELDS SAAT REAL-TIME UPDATE
updateModalField(modalBody, fieldName, newValue) {
    const fieldElements = modalBody.querySelectorAll(`[data-field="${fieldName}"]`);
    
    fieldElements.forEach(element => {
        // Animation untuk perubahan
        element.style.transition = 'all 0.3s ease';
        element.style.backgroundColor = '#fff3cd'; // Highlight color
        
        // Update content berdasarkan field type
        if (fieldName === 'status') {
            element.innerHTML = `<span class="status-badge status-${newValue.toLowerCase().replace(' ', '-')}">${newValue}</span>`;
        } else if (fieldName === 'priority') {
            element.innerHTML = `<span class="priority-badge priority-${newValue.toLowerCase()}">${newValue}</span>`;
        } else if (fieldName === 'last_updated') {
            element.textContent = new Date(newValue).toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            });
        } else if (fieldName === 'updates') {
            // Handle updates array changes
            this.renderUpdatesTimeline(element, newValue);
        } else {
            element.textContent = newValue;
        }
        
        // Remove highlight setelah beberapa saat
        setTimeout(() => {
            element.style.backgroundColor = '';
        }, 1000);
    });
}

// ✅ RENDER UPDATES TIMELINE
renderUpdatesTimeline(container, updates) {
    if (!updates || updates.length === 0) {
        container.innerHTML = '<div class="no-updates">No updates yet</div>';
        return;
    }
    
    const updatesHTML = updates.slice().reverse().map(update => `
        <div class="update-item">
            <div class="update-header">
                <strong>${this.escapeHtml(update.status || 'Updated')}</strong>
                <span class="update-time">
                    ${update.timestamp ? new Date(update.timestamp).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: false
                    }) : 'Unknown'}
                </span>
            </div>
            <div class="update-notes">${this.escapeHtml(update.notes || '–')}</div>
            <div class="update-by">by ${this.escapeHtml(update.updatedBy || 'System')}</div>
        </div>
    `).join('');
    
    container.innerHTML = updatesHTML;
}

// ✅ ERROR HANDLING UNTUK MODAL
showErrorModal(modalBody, message) {
    modalBody.innerHTML = `
        <div class="modal-error">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Ticket</h3>
            <p>${message}</p>
            <button class="btn-primary" onclick="adminDashboard.closeTicketModal()">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
}
    // ✅ METHOD UNTUK ESCAPE HTML
    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

   closeTicketModal() {
    // console.log('🚪 Closing ticket modal with cleanup...');
    
    // Unsubscribe real-time listener
    if (this.ticketModalUnsubscribe) {
        this.ticketModalUnsubscribe();
        this.ticketModalUnsubscribe = null;
        // console.log('✅ Real-time listener unsubscribed');
    }
    
    const modal = document.getElementById('ticketModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        // console.log('✅ Ticket modal closed');
    }
}

// ✅ FIX: updateTicketModal dengan simple approach
async updateTicketModal(ticketId) {
    try {
        // console.log('✏️ Opening update modal for ticket:', ticketId);
        
        const ticketDoc = await getDoc(doc(this.db, "tickets", ticketId));
        if (!ticketDoc.exists()) {
            throw new Error('Ticket not found');
        }

        const ticket = this.normalizeTicketData(ticketId, ticketDoc.data());
        this.currentUpdatingTicketId = ticketId;
        
        // Gunakan simple modal
        await this.showUpdateFormModalSimple(ticket);
        
    } catch (error) {
        console.error('❌ Error opening update modal:', error);
        await Swal.fire({
            title: 'Error!',
            text: 'Failed to open update form',
            icon: 'error'
        });
    }
}

// ✅ SIMPLE SOLUTION: Gunakan modal basic tanpa tab
async showUpdateFormModalSimple(ticket) {
    try {
        // console.log('🔧 [SIMPLE] Creating simple update modal...');
        
        // Remove existing modal if any
        const existingModal = document.getElementById('updateTicketModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create simple modal
        const updateModal = document.createElement('div');
        updateModal.id = 'updateTicketModal';
        updateModal.className = 'modal';
        updateModal.style.display = 'flex';
        
        // Simple HTML tanpa tab - hanya form basic
        updateModal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Update Ticket: ${ticket.code}</h3>
                    <button type="button" class="close-btn" onclick="adminDashboard.closeUpdateModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="updateTicketForm">
                        <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <!-- BASIC TICKET INFO -->
                            <div class="form-group">
                                <label for="updateSubject">Subject *</label>
                                <input type="text" id="updateSubject" class="form-control" value="${this.escapeHtml(ticket.subject)}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="updatePriority">Priority *</label>
                                <select id="updatePriority" class="form-control" required>
                                    <option value="Low" ${ticket.priority === 'Low' ? 'selected' : ''}>Low</option>
                                    <option value="Medium" ${ticket.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                                    <option value="High" ${ticket.priority === 'High' ? 'selected' : ''}>High</option>
                                    <option value="Critical" ${ticket.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="updateStatus">Status *</label>
                                <select id="updateStatus" class="form-control" required>
                                    <option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>Open</option>
                                    <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                </select>
                            </div>

<div class="form-group">
    <label for="updateLocation">Location *</label>
    <select id="updateLocation" class="form-control" required>
        <option value="">Select Location</option>
        <option value="Blue Office" ${ticket.location === 'Blue Office' ? 'selected' : ''}>Blue Office</option>
        <option value="Clinic" ${ticket.location === 'Clinic' ? 'selected' : ''}>Clinic</option>
        <option value="Control Room" ${ticket.location === 'Control Room' ? 'selected' : ''}>Control Room</option>
        <option value="Dark Room" ${ticket.location === 'Dark Room' ? 'selected' : ''}>Dark Room</option>
        <option value="Green Office" ${ticket.location === 'Green Office' ? 'selected' : ''}>Green Office</option>
        <option value="HRD" ${ticket.location === 'HRD' ? 'selected' : ''}>HR Department</option>
        <option value="HSE Yard" ${ticket.location === 'HSE Yard' ? 'selected' : ''}>HSE Yard</option>
        <option value="IT Server" ${ticket.location === 'IT Server' ? 'selected' : ''}>IT Server</option>
        <option value="IT Store" ${ticket.location === 'IT Store' ? 'selected' : ''}>IT Store</option>
        <option value="Multi Purposes Building" ${ticket.location === 'Multi Purposes Building' ? 'selected' : ''}>Multi Purposes Building</option>
        <option value="Red Office" ${ticket.location === 'Red Office' ? 'selected' : ''}>Red Office</option>
        <option value="Security" ${ticket.location === 'Security' ? 'selected' : ''}>Security</option>
        <option value="Store 1" ${ticket.location === 'Store1' ? 'selected' : ''}>Store 1</option>
        <option value="Store 2" ${ticket.location === 'Store2' ? 'selected' : ''}>Store 2</option>
        <option value="Store 3" ${ticket.location === 'Store3' ? 'selected' : ''}>Store 3</option>
        <option value="Store 4" ${ticket.location === 'Store4' ? 'selected' : ''}>Store 4</option>
        <option value="Store 5" ${ticket.location === 'Store5' ? 'selected' : ''}>Store 5</option>
        <option value="Store 6" ${ticket.location === 'Store6' ? 'selected' : ''}>Store 6</option>
        <option value="Store 7" ${ticket.location === 'Store7' ? 'selected' : ''}>Store 7</option>
        <option value="Store 8" ${ticket.location === 'Store8' ? 'selected' : ''}>Store 8</option>
        <option value="Store 9" ${ticket.location === 'Store9' ? 'selected' : ''}>Store 9</option>
        <option value="Warehouse" ${ticket.location === 'Warehouse' ? 'selected' : ''}>Warehouse</option>
        <option value="White Office" ${ticket.location === 'White Office' ? 'selected' : ''}>White Office</option>
        <option value="White Office 2nd Fl" ${ticket.location === 'White Office 2nd Fl' ? 'selected' : ''}>White Office 2nd Floor</option>
        <option value="White Office 3rd Fl" ${ticket.location === 'White Office 3rd Fl' ? 'selected' : ''}>White Office 3rd Floor</option>
        <option value="Welding School" ${ticket.location === 'Welding School' ? 'selected' : ''}>Welding School</option>
        <option value="Workshop9" ${ticket.location === 'Workshop9' ? 'selected' : ''}>Workshop 9</option>
        <option value="Workshop10" ${ticket.location === 'Workshop10' ? 'selected' : ''}>Workshop 10</option>
        <option value="Workshop11" ${ticket.location === 'Workshop11' ? 'selected' : ''}>Workshop 11</option>
        <option value="Workshop12" ${ticket.location === 'Workshop12' ? 'selected' : ''}>Workshop 12</option>
        <option value="Yard" ${ticket.location === 'Yard' ? 'selected' : ''}>Yard</option>
        <option value="Lainlain" ${ticket.location === 'Lainlain' ? 'selected' : ''}>Other Location</option>
    </select>
</div>

                            <!-- USER INFO -->
                            <div class="form-group">
                                <label for="updateUserName">User Name *</label>
                                <input type="text" id="updateUserName" class="form-control" value="${this.escapeHtml(ticket.user_name)}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="updateUserEmail">User Email *</label>
                                <input type="email" id="updateUserEmail" class="form-control" value="${this.escapeHtml(ticket.user_email)}" required>
                            </div>
                            
                            <div class="form-group">
    <label for="updateUserDepartment">Department *</label>
    <select id="updateUserDepartment" class="form-control" required>
        <option value="">Select Department</option>
        <option value="Admin" ${ticket.user_department === 'Admin' ? 'selected' : ''}>Admin</option>
        <option value="Civil" ${ticket.user_department === 'Civil' ? 'selected' : ''}>Civil</option>
        <option value="Clinic" ${ticket.user_department === 'Clinic' ? 'selected' : ''}>Clinic</option>
        <option value="Completion" ${ticket.user_department === 'Completion' ? 'selected' : ''}>Completion</option>
        <option value="DC" ${ticket.user_department === 'DC' ? 'selected' : ''}>Dimentional Control (DC)</option>
        <option value="Document Control" ${ticket.user_department === 'Document Control' ? 'selected' : ''}>Document Control</option>
        <option value="Engineer" ${ticket.user_department === 'Engineer' ? 'selected' : ''}>Engineering</option>
        <option value="Finance" ${ticket.user_department === 'Finance' ? 'selected' : ''}>Finance</option>
        <option value="HR" ${ticket.user_department === 'HR' ? 'selected' : ''}>Human Resources (HRD)</option>
        <option value="HSE" ${ticket.user_department === 'HSE' ? 'selected' : ''}>HSE</option>
        <option value="IT" ${ticket.user_department === 'IT' ? 'selected' : ''}>IT</option>
        <option value="Maintenance" ${ticket.user_department === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
        <option value="Management" ${ticket.user_department === 'Management' ? 'selected' : ''}>Management</option>
        <option value="Planner" ${ticket.user_department === 'Planner' ? 'selected' : ''}>Planner</option>
        <option value="Procurement" ${ticket.user_department === 'Procurement' ? 'selected' : ''}>Procurement</option>
        <option value="QC" ${ticket.user_department === 'QC' ? 'selected' : ''}>Quality Control (QC)</option>
        <option value="Vendor" ${ticket.user_department === 'Vendor' ? 'selected' : ''}>Vendor</option>
        <option value="Warehouse" ${ticket.user_department === 'Warehouse' ? 'selected' : ''}>Warehouse</option>
        <option value="Lainlain" ${ticket.user_department === 'Lainlain' ? 'selected' : ''}>Other Department</option>
    </select>
</div>

                            <div class="form-group">
                                <label for="updateUserPhone">Phone</label>
                                <input type="text" id="updateUserPhone" class="form-control" value="${this.escapeHtml(ticket.user_phone || '')}" placeholder="Phone number">
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="updateAdminNotes">Admin Notes</label>
                            <textarea id="updateAdminNotes" class="form-control" rows="3" placeholder="Admin notes...">${this.escapeHtml(ticket.note || '')}</textarea>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="adminDashboard.closeUpdateModal()">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Update Ticket
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Append to body
        document.body.appendChild(updateModal);
        document.body.classList.add('modal-open');
        
        // Add form submit event
        document.getElementById('updateTicketForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTicketUpdateSimple(this.currentUpdatingTicketId);
        });
        
        // console.log('✅ Simple modal created successfully');
        
        // Verify elements exist
        this.verifyModalElements();
            
    } catch (error) {
        console.error('❌ Error creating simple modal:', error);
    }
}

// ✅ Verify modal elements
verifyModalElements() {
    // console.log('🔍 Verifying modal elements:');
    const elements = [
        'updateSubject', 'updatePriority', 'updateStatus', 'updateLocation',
        'updateUserName', 'updateUserEmail', 'updateUserDepartment', 'updateUserPhone',
        'updateAdminNotes'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        // console.log(`   ${id}: ${element ? '✅ EXISTS' : '❌ MISSING'}`);
    });
}

// ✅ FIX: Enhanced showUpdateFormModal dengan DOM verification
async showUpdateFormModal(ticket) {
    try {
        // console.log('🔧 [DEBUG] showUpdateFormModal called for ticket:', ticket.code);
        
        let updateModal = document.getElementById('updateTicketModal');
        
        if (!updateModal) {
            // console.log('🔄 Creating update modal...');
            
            // Create modal element
            updateModal = document.createElement('div');
            updateModal.id = 'updateTicketModal';
            updateModal.className = 'modal';
            
            // console.log('📝 Modal element created, setting innerHTML...');
            
            // Set HTML content
            updateModal.innerHTML = this.getUpdateModalHTML(ticket);
            
            // console.log('📦 Appending modal to document body...');
            
            // Append to body
            document.body.appendChild(updateModal);
            
            // console.log('✅ Modal created and appended to DOM');
            
            // Verify modal exists in DOM
            const verifiedModal = document.getElementById('updateTicketModal');
            if (!verifiedModal) {
                throw new Error('Modal failed to create in DOM');
            }
            
            // console.log('🔍 Modal verified in DOM:', verifiedModal);
            
            // Add form submit event
            const updateForm = document.getElementById('updateTicketForm');
            if (updateForm) {
                updateForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    if (this.currentUpdatingTicketId) {
                        this.handleTicketUpdate(this.currentUpdatingTicketId);
                    }
                });
                // console.log('✅ Form event listener added');
            } else {
                console.error('❌ Update form not found');
            }

            // Initialize tab switching
            this.initializeTabSwitching();
        } else {
            // console.log('ℹ️ Modal already exists, reusing...');
        }
        
        // Show modal
        // console.log('🎯 Showing modal...');
        updateModal.style.display = 'flex';
        updateModal.classList.add('show');
        document.body.classList.add('modal-open');
        
        // console.log('🔍 [DEBUG] Starting to populate form data...');
        
        // Populate form data dengan delay untuk memastikan DOM ready
        setTimeout(() => {
            this.populateFormDataSafely(ticket);
        }, 100);
        
        // console.log('✅ Update modal process completed');
            
    } catch (error) {
        console.error('❌ Error showing update form:', error);
        throw error;
    }
}

// ✅ NEW: Separate method untuk modal HTML
getUpdateModalHTML(ticket) {
    return `
        <div class="modal-content update-modal-content large">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Update Ticket: ${ticket.code}</h3>
                <button type="button" class="close-btn" onclick="adminDashboard.closeUpdateModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-tabs">
                    <button type="button" class="tab-btn active" data-tab="ticket-tab">Ticket Details</button>
                    <button type="button" class="tab-btn" data-tab="user-tab">User Information</button>
                </div>

                <form id="updateTicketForm">
                    <!-- TAB 1: TICKET DETAILS -->
                    <div id="ticket-tab" class="tab-content active">
                        <div class="form-section">
                            <h4><i class="fas fa-ticket-alt"></i> Ticket Information</h4>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="updateSubject">Subject *</label>
                                    <input type="text" id="updateSubject" class="form-control" value="" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="updatePriority">Priority *</label>
                                    <select id="updatePriority" class="form-control" required>
                                        <option value="">Select Priority</option>
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="updateStatus">Status *</label>
                                    <select id="updateStatus" class="form-control" required>
                                        <option value="">Select Status</option>
                                        <option value="Open">Open</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Resolved">Resolved</option>
                                    </select>
                                </div>

                                <div class="form-group">
            <label for="location">Location *</label>
            <select id="location" name="location" required>
              <option value="">Select Location</option>
              <option value="Blue Office">Blue Office</option>
              <option value="Clinic">Clinic</option>
              <option value="Control Room">Control Room</option>
              <option value="Dark Room">Dark Room</option>
              <option value="Green Office">Green Office</option>
              <option value="HRD">HR Department</option>
              <option value="HSE Yard">HSE Yard</option>
              <option value="IT Server">IT Server</option>
              <option value="IT Store">IT Store</option>
              <option value="Multi Purposes Building">Multi Purposes Building</option>
              <option value="Red Office">Red Office</option>
              <option value="Security">Security</option>
              <option value="Store1">Store 1</option>
              <option value="Store2">Store 2</option>
              <option value="Store3">Store 3</option>
              <option value="Store4">Store 4</option>
              <option value="Store5">Store 5</option>
              <option value="Store6">Store 6</option>
              <option value="Store7">Store 7</option>
              <option value="Store8">Store 8</option>
              <option value="Store9">Store 9</option>
              <option value="Warehouse">Warehouse</option>
              <option value="White Office">White Office</option>
              <option value="White Office 2nd Fl">White Office 2nd Floor</option>
              <option value="White Office 3rd Fl">White Office 3rd Floor</option>
              <option value="Welding School">Welding School</option>
              <option value="Workshop9">Workshop 9</option>
              <option value="Workshop10">Workshop 10</option>
              <option value="Workshop11">Workshop 11</option>
              <option value="Workshop12">Workshop 12</option>
              <option value="Yard">Yard</option>
              <option value="Lainlain">Other Location</option>
            </select>
          </div>
        </div>

                                <div class="form-group">
                                    <label for="updateDevice">Device Type</label>
                                    <select id="updateDevice" class="form-control">
                                        <option value="">Select Device</option>
                                        <option value="PC Hardware">PC Hardware</option>
                                        <option value="PC Software">PC Software</option>
                                        <option value="Laptop">Laptop</option>
                                        <option value="Printer">Printer</option>
                                        <option value="Network">Network</option>
                                        <option value="Projector">Projector</option>
                                        <option value="Backup Data">Backup Data</option>
                                        <option value="Others">Others</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="updateInventory">Inventory Number</label>
                                    <input type="text" id="updateInventory" class="form-control" value="" placeholder="e.g., IT-001">
                                </div>
                            </div>

                            <div class="form-group full-width">
                                <label for="updateAdminNotes">Admin Notes</label>
                                <textarea id="updateAdminNotes" class="form-control" rows="4" placeholder="Add admin notes, resolution details, or updates..."></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: USER INFORMATION -->
                    <div id="user-tab" class="tab-content">
                        <div class="form-section">
                            <h4><i class="fas fa-user-edit"></i> User Information</h4>
                            <div class="form-notice">
                                <i class="fas fa-info-circle"></i>
                                <span>Updating user information here will also update the user's profile.</span>
                            </div>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="updateEmployeeId">Employee ID</label>
                                    <input type="text" id="updateEmployeeId" class="form-control" value="" placeholder="e.g., EMP001">
                                </div>
                                
                                <div class="form-group">
                                    <label for="updateUserName">Full Name *</label>
                                    <input type="text" id="updateUserName" class="form-control" value="" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="updateUserEmail">Email Address *</label>
                                    <input type="email" id="updateUserEmail" class="form-control" value="" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="updateUserPhone">Phone Number</label>
                                    <input type="tel" id="updateUserPhone" class="form-control" value="" placeholder="e.g., +628123456789">
                                </div>
                                
                                <div class="form-group">
                                    <label for="updateUserDepartment">Department *</label>
                                    <select id="updateUserDepartment" class="form-control" required>
                                        <option value="">Select Department</option>
                                        <option value="IT">IT Department</option>
                                        <option value="Admin">Admin</option>
                                        <option value="HR">HR Department</option>
                                        <option value="Finance">Finance</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="Operations">Operations</option>
                                        <option value="Lainlain">Lain-lain</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
            <label for="location">Location *</label>
            <select id="location" name="location" required>
              <option value="">Select Location</option>
              <option value="Blue Office">Blue Office</option>
              <option value="Clinic">Clinic</option>
              <option value="Control Room">Control Room</option>
              <option value="Dark Room">Dark Room</option>
              <option value="Green Office">Green Office</option>
              <option value="HRD">HR Department</option>
              <option value="HSE Yard">HSE Yard</option>
              <option value="IT Server">IT Server</option>
              <option value="IT Store">IT Store</option>
              <option value="Multi Purposes Building">Multi Purposes Building</option>
              <option value="Red Office">Red Office</option>
              <option value="Security">Security</option>
              <option value="Store1">Store 1</option>
              <option value="Store2">Store 2</option>
              <option value="Store3">Store 3</option>
              <option value="Store4">Store 4</option>
              <option value="Store5">Store 5</option>
              <option value="Store6">Store 6</option>
              <option value="Store7">Store 7</option>
              <option value="Store8">Store 8</option>
              <option value="Store9">Store 9</option>
              <option value="Warehouse">Warehouse</option>
              <option value="White Office">White Office</option>
              <option value="White Office 2nd Fl">White Office 2nd Floor</option>
              <option value="White Office 3rd Fl">White Office 3rd Floor</option>
              <option value="Welding School">Welding School</option>
              <option value="Workshop9">Workshop 9</option>
              <option value="Workshop10">Workshop 10</option>
              <option value="Workshop11">Workshop 11</option>
              <option value="Workshop12">Workshop 12</option>
              <option value="Yard">Yard</option>
              <option value="Lainlain">Other Location</option>
            </select>
          </div>
        </div>
                            </div>

                            <div class="form-group full-width">
                                <label for="updateUserMessage">Problem Description</label>
                                <textarea id="updateUserMessage" class="form-control" rows="4" placeholder="Original problem description from user..."></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="adminDashboard.closeUpdateModal()">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Update All Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// ✅ FIX: Enhanced populateFormData dengan retry mechanism
populateFormDataSafely(ticket) {
    try {
        // console.log('📝 Populating form data for ticket:', ticket.code);
        
        // List semua element yang perlu diisi
        const formElements = [
            // Ticket elements
            { id: 'updateSubject', value: ticket.subject, type: 'input' },
            { id: 'updatePriority', value: ticket.priority, type: 'select' },
            { id: 'updateStatus', value: ticket.status, type: 'select' },
            { id: 'updateLocation', value: ticket.location || '', type: 'select' },
            { id: 'updateDevice', value: ticket.device || '', type: 'select' },
            { id: 'updateInventory', value: ticket.inventory || '', type: 'input' },
            { id: 'updateAdminNotes', value: ticket.note || '', type: 'textarea' },
            
            // User elements  
            { id: 'updateEmployeeId', value: ticket.employee_id || '', type: 'input' },
            { id: 'updateUserName', value: ticket.user_name || '', type: 'input' },
            { id: 'updateUserEmail', value: ticket.user_email || '', type: 'input' },
            { id: 'updateUserPhone', value: ticket.user_phone || '', type: 'input' },
            { id: 'updateUserDepartment', value: ticket.user_department || '', type: 'select' },
            { id: 'updateUserLocation', value: ticket.user_location || '', type: 'select' },
            { id: 'updateUserMessage', value: ticket.message || '', type: 'textarea' }
        ];

        // console.log('🔍 Checking and populating form elements:');
        
        let successCount = 0;
        let failCount = 0;
        const failedElements = [];

        // Try to populate each element
        formElements.forEach(element => {
            if (this.setElementValueWithRetry(element.id, element.value, element.type)) {
                successCount++;
            } else {
                failCount++;
                failedElements.push(element.id);
            }
        });

        // console.log(`📊 Form population result: ${successCount} success, ${failCount} failed`);
        
        if (failedElements.length > 0) {
            console.warn('⚠️ Failed to set these elements:', failedElements);
            
            // Retry failed elements after short delay
            setTimeout(() => {
                // console.log('🔄 Retrying failed elements...');
                this.retryFailedElements(failedElements, ticket);
            }, 200);
        }

    } catch (error) {
        console.error('❌ Error populating form data:', error);
    }
}

// ✅ NEW: Set element value dengan retry mechanism
setElementValueWithRetry(elementId, value, elementType, retryCount = 0) {
    try {
        const element = document.getElementById(elementId);
        
        if (!element) {
            if (retryCount < 3) {
                // console.log(`🔄 Retrying ${elementId} (attempt ${retryCount + 1})...`);
                setTimeout(() => {
                    this.setElementValueWithRetry(elementId, value, elementType, retryCount + 1);
                }, 100 * (retryCount + 1));
                return false;
            }
            
            console.warn(`⚠️ Element not found after ${retryCount} retries: ${elementId}`);
            return false;
        }
        
        // Set value berdasarkan element type
        switch (elementType) {
            case 'select':
                element.value = value || '';
                break;
            case 'textarea':
                element.value = value || '';
                break;
            case 'input':
            default:
                element.value = value || '';
                break;
        }
        
        // console.log(`   ✅ Set ${elementId} = "${value}"`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error setting value for ${elementId}:`, error);
        return false;
    }
}

// ✅ NEW: Retry failed elements
retryFailedElements(failedElements, ticket) {
    failedElements.forEach(elementId => {
        const value = this.getValueFromTicket(elementId, ticket);
        const elementType = this.getElementType(elementId);
        this.setElementValueWithRetry(elementId, value, elementType);
    });
}

// ✅ NEW: Helper untuk mendapatkan value dari ticket data
getValueFromTicket(elementId, ticket) {
    const valueMap = {
        'updateSubject': ticket.subject,
        'updatePriority': ticket.priority,
        'updateStatus': ticket.status,
        'updateLocation': ticket.location || '',
        'updateDevice': ticket.device || '',
        'updateInventory': ticket.inventory || '',
        'updateAdminNotes': ticket.note || '',
        'updateEmployeeId': ticket.employee_id || '',
        'updateUserName': ticket.user_name || '',
        'updateUserEmail': ticket.user_email || '',
        'updateUserPhone': ticket.user_phone || '',
        'updateUserDepartment': ticket.user_department || '',
        'updateUserLocation': ticket.user_location || '',
        'updateUserMessage': ticket.message || ''
    };
    
    return valueMap[elementId] || '';
}

// ✅ NEW: Helper untuk menentukan element type
getElementType(elementId) {
    if (elementId.includes('Notes') || elementId.includes('Message')) {
        return 'textarea';
    }
    if (elementId.includes('Priority') || elementId.includes('Status') || 
        elementId.includes('Location') || elementId.includes('Device') || 
        elementId.includes('Department')) {
        return 'select';
    }
    return 'input';
}

// ✅ NEW: Helper method untuk set value dengan safety
setElementValueSafely(elementId, value) {
    try {
        const element = document.getElementById(elementId);
        if (!element) {
            // console.warn(`⚠️ Element not found: ${elementId}`);
            return false;
        }
        
        if (element.tagName === 'SELECT') {
            element.value = value || '';
        } else if (element.tagName === 'TEXTAREA') {
            element.value = value || '';
        } else if (element.tagName === 'INPUT') {
            element.value = value || '';
        }
        
        // console.log(`   ✅ Set ${elementId} = "${value}"`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error setting value for ${elementId}:`, error);
        return false;
    }
}

// ✅ FIX: Enhanced tab switching dengan error handling
initializeTabSwitching() {
    try {
        // console.log('🔧 Initializing tab switching...');
        
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        // console.log(`📊 Found ${tabBtns.length} tab buttons and ${tabContents.length} tab contents`);
        
        if (tabBtns.length === 0 || tabContents.length === 0) {
            console.warn('⚠️ No tabs found for initialization');
            return;
        }
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // console.log(`🎯 Tab clicked: ${targetTab}`);
                
                // Remove active class from all tabs
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Add active class to current tab
                btn.classList.add('active');
                
                const targetElement = document.getElementById(targetTab);
                if (targetElement) {
                    targetElement.classList.add('active');
                    // console.log(`✅ Activated tab: ${targetTab}`);
                } else {
                    console.error(`❌ Tab content not found: ${targetTab}`);
                }
            });
        });
        
        // console.log('✅ Tab switching initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing tab switching:', error);
    }
}

// ✅ SIMPLE: Handle ticket update dengan protection untuk resolved tickets
async handleTicketUpdateSimple(ticketId) {
    try {
        const submitBtn = document.querySelector('#updateTicketForm button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        submitBtn.disabled = true;
        
        // Get current ticket data
        const ticketRef = doc(this.db, "tickets", ticketId);
        const ticketDoc = await getDoc(ticketRef);
        const currentData = ticketDoc.data();
        
        // ✅ CEK APAKAH TICKET SUDAH RESOLVED/CLOSED
        const finalStatuses = ['Resolved', 'Closed', 'Completed', 'Finished'];
        const isCurrentlyFinalStatus = finalStatuses.includes(currentData.status);
        const newStatus = document.getElementById('updateStatus').value;
        const isChangingToFinalStatus = finalStatuses.includes(newStatus);
        
        // Collect data
        const updateData = {
            // Ticket data
            subject: document.getElementById('updateSubject').value,
            priority: document.getElementById('updatePriority').value,
            status: newStatus,
            location: document.getElementById('updateLocation').value,
            note: document.getElementById('updateAdminNotes').value,
            
            // ✅ HANYA UPDATE last_updated JIKA:
            // 1. BUKAN status final, ATAU
            // 2. SEDANG berubah MENJADI status final
            ...(isCurrentlyFinalStatus && !isChangingToFinalStatus ? {} : {
                last_updated: serverTimestamp()
            }),
            
            // User data (update ticket juga)
            user_name: document.getElementById('updateUserName').value,
            user_email: document.getElementById('updateUserEmail').value,
            user_department: document.getElementById('updateUserDepartment').value,
            user_phone: document.getElementById('updateUserPhone').value
        };

        // console.log('📝 Update data:', updateData);
        // console.log('🛡️ Duration protection:', {
        //     wasFinal: isCurrentlyFinalStatus,
        //     changingToFinal: isChangingToFinalStatus,
        //     updateLastUpdated: !(isCurrentlyFinalStatus && !isChangingToFinalStatus)
        // });

        const userId = currentData.user_id;

        if (!userId) {
            throw new Error('User ID not found');
        }

        // ✅ UPDATE USER PROFILE
        const userRef = doc(this.db, "users", userId);
        await updateDoc(userRef, {
            full_name: updateData.user_name,
            email: updateData.user_email,
            department: updateData.user_department,
            phone: updateData.user_phone,
            updated_at: new Date().toISOString()
        });

        // console.log('✅ User profile updated');

        // ✅ UPDATE TICKET
        await updateDoc(ticketRef, updateData);

        // Close modal
        this.closeUpdateModal();
        
        // Show success dengan info duration protection
        let successMessage = 'Ticket and user data updated successfully';
        if (isCurrentlyFinalStatus && !isChangingToFinalStatus) {
            successMessage += ' (Duration preserved - ticket was already resolved)';
        }
        
        await Swal.fire({
            title: 'Success!',
            text: successMessage,
            icon: 'success',
            timer: 2000
        });

        // Refresh data
        await this.loadTickets();
        
    } catch (error) {
        console.error('❌ Error updating:', error);
        
        // Reset button
        const submitBtn = document.querySelector('#updateTicketForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Ticket';
            submitBtn.disabled = false;
        }
        
        await Swal.fire({
            title: 'Error!',
            text: error.message,
            icon: 'error'
        });
    }
}

 // ✅ FIX: Enhanced ticket update dengan duration protection
async handleTicketUpdate(ticketId) {
    try {
        const submitBtn = document.querySelector('#updateTicketForm button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Show loading
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating Ticket & User Data...';
        submitBtn.disabled = true;
        
        // Get current ticket data untuk cek status
        const ticketRef = doc(this.db, "tickets", ticketId);
        const ticketDoc = await getDoc(ticketRef);
        const currentTicketData = ticketDoc.data();
        
        // ✅ CEK STATUS UNTUK DURATION PROTECTION
        const finalStatuses = ['Resolved', 'Closed', 'Completed', 'Finished'];
        const isCurrentlyFinalStatus = finalStatuses.includes(currentTicketData.status);
        const newStatus = document.getElementById('updateStatus').value;
        const isChangingToFinalStatus = finalStatuses.includes(newStatus);
        
        // Collect ticket update data
        const ticketUpdateData = {
            subject: document.getElementById('updateSubject').value,
            priority: document.getElementById('updatePriority').value,
            status: newStatus,
            location: document.getElementById('updateLocation').value,
            device: document.getElementById('updateDevice').value,
            inventory: document.getElementById('updateInventory').value,
            note: document.getElementById('updateAdminNotes').value,
            
            // ✅ DURATION PROTECTION: Hanya update last_updated jika:
            // - Bukan status final, ATAU  
            // - Sedang berubah MENJADI status final
            ...(isCurrentlyFinalStatus && !isChangingToFinalStatus ? {} : {
                last_updated: serverTimestamp()
            })
        };

        // Collect user update data
        const userUpdateData = {
            employee_id: document.getElementById('updateEmployeeId').value,
            full_name: document.getElementById('updateUserName').value,
            email: document.getElementById('updateUserEmail').value,
            phone: document.getElementById('updateUserPhone').value,
            department: document.getElementById('updateUserDepartment').value,
            location: document.getElementById('updateUserLocation').value
        };

        // Validate required user fields
        if (!userUpdateData.full_name || !userUpdateData.email || !userUpdateData.department) {
            await Swal.fire({
                title: 'Validation Error!',
                text: 'Please fill in all required user fields (Name, Email, Department)',
                icon: 'warning',
                confirmButtonColor: '#ef070a'
            });
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userUpdateData.email)) {
            await Swal.fire({
                title: 'Invalid Email!',
                text: 'Please enter a valid email address',
                icon: 'warning',
                confirmButtonColor: '#ef070a'
            });
            return;
        }

        // console.log('📝 Update data collected:', {
        //     ticket: ticketUpdateData,
        //     user: userUpdateData,
        //     durationProtection: {
        //         wasFinal: isCurrentlyFinalStatus,
        //         changingToFinal: isChangingToFinalStatus,
        //         updateLastUpdated: !(isCurrentlyFinalStatus && !isChangingToFinalStatus)
        //     }
        // });

        const userId = currentTicketData.user_id;

        if (!userId) {
            throw new Error('User ID not found in ticket data');
        }

        // ✅ UPDATE USER PROFILE DI FIRESTORE
        // console.log('👤 Updating user profile for:', userId);
        const userRef = doc(this.db, "users", userId);
        await updateDoc(userRef, {
            ...userUpdateData,
            updated_at: new Date().toISOString()
        });

        // console.log('✅ User profile updated successfully');

        // ✅ UPDATE ALL TICKETS USER INI (untuk konsistensi data)
        await this.updateUserTicketsInFirestore(userId, userUpdateData);

        // Add to updates array untuk ticket
        const updateNote = {
            status: ticketUpdateData.status,
            notes: `Ticket and user information updated by ${this.adminUser.name || this.adminUser.email}`,
            timestamp: new Date().toISOString(),
            updatedBy: this.adminUser.name || this.adminUser.email,
            changes: {
                ticket: {
                    subject: ticketUpdateData.subject,
                    priority: ticketUpdateData.priority,
                    status: ticketUpdateData.status
                },
                user: {
                    name: userUpdateData.full_name,
                    department: userUpdateData.department,
                    email: userUpdateData.email
                }
            },
            // ✅ TAMBAHKAN INFO DURATION PROTECTION
            durationPreserved: isCurrentlyFinalStatus && !isChangingToFinalStatus
        };

        // Get current updates
        const currentUpdates = Array.isArray(currentTicketData.updates) ? currentTicketData.updates : [];
        ticketUpdateData.updates = [...currentUpdates, updateNote];

        // Update ticket dengan user data terbaru juga
        const finalTicketUpdate = {
            ...ticketUpdateData,
            user_name: userUpdateData.full_name,
            user_email: userUpdateData.email,
            user_department: userUpdateData.department,
            user_phone: userUpdateData.phone,
            employee_id: userUpdateData.employee_id
        };

        // Update QA field based on status
        if (ticketUpdateData.status === 'Resolved' && (!ticketUpdateData.note || ticketUpdateData.note.trim() === '')) {
            await Swal.fire({
                title: 'Note Required!',
                text: 'Resolution notes are required when setting status to Resolved',
                icon: 'warning',
                confirmButtonColor: '#ef070a'
            });
            return;
        } else if (ticketUpdateData.status === 'Open') {
            finalTicketUpdate.qa = 'Open';
        } else if (ticketUpdateData.status === 'In Progress') {
            finalTicketUpdate.qa = 'In Progress';
        }
        
        // console.log('🎯 Final update data:', finalTicketUpdate);

        // Execute update ticket
        await updateDoc(ticketRef, finalTicketUpdate);
        
        // Close modal
        
        // Show success message dengan info duration
        let successTitle = 'Success!';
        let successDetails = `
            <div class="update-success">
                <p><strong>✅ Ticket and User Data Updated Successfully!</strong></p>
                <div class="update-details">
                    <p><strong>Ticket Changes:</strong></p>
                    <ul>
                        <li>Status: ${ticketUpdateData.status}</li>
                        <li>Priority: ${ticketUpdateData.priority}</li>
                        ${isCurrentlyFinalStatus && !isChangingToFinalStatus ? 
                          '<li><em>⚠️ Duration preserved (ticket was already resolved)</em></li>' : ''}
                    </ul>
                    <p><strong>User Changes:</strong></p>
                    <ul>
                        <li>Name: ${userUpdateData.full_name}</li>
                        <li>Department: ${userUpdateData.department}</li>
                        <li>Email: ${userUpdateData.email}</li>
                    </ul>
                </div>
            </div>
        `;

        await Swal.fire({
            title: successTitle,
            html: successDetails,
            icon: 'success',
            confirmButtonColor: '#10b981',
            confirmButtonText: 'OK'
        });

        // Refresh data
        await this.loadTickets();
        
    } catch (error) {
        console.error('❌ Error updating ticket and user data:', error);
        
        // Reset button
        const submitBtn = document.querySelector('#updateTicketForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Update All Changes';
            submitBtn.disabled = false;
        }
        
        await Swal.fire({
            title: 'Update Failed!',
            text: 'Failed to update: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#ef070a'
        });
    }
}

// ✅ HELPER METHOD: Check if status is final
isFinalStatus(status) {
    const finalStatuses = ['Resolved', 'Closed', 'Completed', 'Finished'];
    return finalStatuses.includes(status);
}

// ✅ HELPER METHOD: Check if should update last_updated
shouldUpdateLastUpdated(currentStatus, newStatus) {
    const isCurrentlyFinal = this.isFinalStatus(currentStatus);
    const isChangingToFinal = this.isFinalStatus(newStatus);
    
    // Update last_updated hanya jika:
    // - Bukan status final, ATAU
    // - Sedang berubah MENJADI status final
    return !isCurrentlyFinal || isChangingToFinal;
}

// ✅ NEW: Helper method untuk update semua tickets user
async updateUserTicketsInFirestore(userId, userUpdates) {
    try {
        // console.log('🔄 Updating all tickets for user:', userId);
        
        const ticketsQuery = query(
            collection(this.db, "tickets"),
            where("user_id", "==", userId)
        );

        const querySnapshot = await getDocs(ticketsQuery);
        let updatedCount = 0;

        for (const docSnapshot of querySnapshot.docs) {
            const ticketRef = doc(this.db, "tickets", docSnapshot.id);
            
            await updateDoc(ticketRef, {
                user_name: userUpdates.full_name,
                user_email: userUpdates.email,
                user_department: userUpdates.department,
                user_phone: userUpdates.phone,
                employee_id: userUpdates.employee_id,
                last_updated: serverTimestamp()
            });
            
            updatedCount++;
        }

        // console.log(`✅ Updated ${updatedCount} tickets for user consistency`);
        return updatedCount;
        
    } catch (error) {
        console.error('❌ Error updating user tickets:', error);
        return 0;
    }
}

    // ✅ METHOD UNTUK CLOSE UPDATE MODAL
    closeUpdateModal() {
        const updateModal = document.getElementById('updateTicketModal');
        if (updateModal) {
            updateModal.style.display = 'none';
            updateModal.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
        this.currentUpdatingTicketId = null;
    }

  // ✅ ENHANCED EXPORT DATA PREPARATION YANG COMPATIBLE
getDisplayedTicketsForExport() {
    try {
        // console.log('📊 Preparing export data for filtered tickets...');
        
        const exportTickets = this.filteredTickets.map(ticket => {
            // Format dates untuk export - SESUAI DENGAN FORMAT DI EXPORT.JS
            const createdDate = ticket.created_at ? 
                new Date(ticket.created_at) : null;
                
            const updatedDate = ticket.last_updated ? 
                new Date(ticket.last_updated) : null;
            
            // Get assigned admin info - SESUAI DENGAN LOGIC DI EXPORT.JS
            let assignedAdmin = 'Unassigned';
            if (ticket.assigned_to) {
                const adminInfo = window.adminCache && window.adminCache[ticket.assigned_to];
                if (adminInfo) {
                    assignedAdmin = `${adminInfo.name} (${adminInfo.email})`;
                } else {
                    assignedAdmin = ticket.assigned_to;
                }
            } else if (ticket.action_by) {
                const adminInfo = window.adminCache && window.adminCache[ticket.action_by];
                if (adminInfo) {
                    assignedAdmin = `${adminInfo.name} (${adminInfo.email})`;
                } else {
                    assignedAdmin = ticket.action_by;
                }
            }
            
            // ✅ FORMAT DATA SESUAI DENGAN YANG DIHARAPKAN OLEH EXPORT.JS
            return {
                id: ticket.id,
                code: ticket.code || 'UNKNOWN',
                subject: ticket.subject || 'No Subject',
                name: ticket.user_name || 'Unknown User', // ← export.js pakai 'name'
                user_name: ticket.user_name || 'Unknown User', // ← backup field
                user_email: ticket.user_email || '',
                department: ticket.user_department || '',
                user_department: ticket.user_department || '', // ← backup field
                location: ticket.location || '',
                inventory: ticket.inventory || '',
                device: ticket.device || '',
                message: ticket.message || '',
                priority: ticket.priority || 'Medium',
                status_ticket: ticket.status || 'Open', // ← export.js pakai 'status_ticket'
                status: ticket.status || 'Open', // ← backup field
                qa: ticket.qa || '',
                action_by: ticket.action_by || '',
                assigned_to: assignedAdmin,
                assigned_name: ticket.assigned_name || '', // ← field tambahan
                note: ticket.note || '',
                user_phone: ticket.user_phone || '',
                createdAt: createdDate, // ← Date object untuk export.js
                created_at: ticket.created_at, // ← raw timestamp
                updatedAt: updatedDate, // ← Date object untuk export.js
                last_updated: ticket.last_updated, // ← raw timestamp
                raw_created_at: ticket.created_at,
                raw_updated_at: ticket.last_updated
            };
        });
        
        // console.log(`✅ Prepared ${exportTickets.length} tickets for export`);
        return exportTickets;
        
    } catch (error) {
        console.error('❌ Error preparing export data:', error);
        return [];
    }
}


// ✅ HELPER METHOD UNTUK DAPATKAN EXPORT METHOD YANG DIGUNAKAN
getUsedExportMethod() {
    if (typeof window.handleExportToExcel === 'function') return 'handleExportToExcel';
    if (typeof window.exportToExcelAppendSorted === 'function') return 'exportToExcelAppendSorted';
    if (typeof window.exportToExcel === 'function') return 'exportToExcel';
    return 'CSV Fallback';
}

// ✅ PERBAIKAN: Enhanced Export Compatibility Fix
async fixExportCompatibility() {
    try {
        // console.log('🔧 Fixing export compatibility...');
        
        // ✅ PERBAIKI MISSING FUNCTION: window.originalExportToExcelAppendSorted
        if (typeof window.originalExportToExcelAppendSorted === 'undefined') {
            // console.log('🔄 Creating missing function: originalExportToExcelAppendSorted');
            
            if (typeof window.exportToExcelAppendSorted === 'function') {
                window.originalExportToExcelAppendSorted = window.exportToExcelAppendSorted;
                // console.log('✅ originalExportToExcelAppendSorted set to exportToExcelAppendSorted');
            } else {
                window.originalExportToExcelAppendSorted = function(displayedTickets, filterInfo) {
                    console.warn('⚠️ originalExportToExcelAppendSorted called but not implemented');
                    return this.fallbackExport(displayedTickets);
                }.bind(this);
            }
        }
        
        // ✅ PERBAIKI MISSING FUNCTION: setExportFilterInfo
        if (typeof window.setExportFilterInfo === 'undefined') {
            // console.log('🔄 Creating missing function: setExportFilterInfo');
            window.setExportFilterInfo = function(filterInfo) {
                console.log('📊 setExportFilterInfo called:', filterInfo);
                window.exportFilterInfo = filterInfo;
            };
        }
        
        // ✅ PASTIKAN appendToExistingExcel ADA
        if (typeof window.appendToExistingExcel === 'undefined') {
            // console.log('🔄 Creating missing function: appendToExistingExcel');
            window.appendToExistingExcel = async function(displayedTickets, filterInfo) {
                // console.log('📥 appendToExistingExcel called:', displayedTickets?.length, 'tickets');
                await Swal.fire({
                    title: 'Append Function Not Available',
                    text: 'The append to existing file feature is not available in this version.',
                    icon: 'warning'
                });
                // Fallback to new file creation
                if (typeof window.originalExportToExcelAppendSorted === 'function') {
                    return window.originalExportToExcelAppendSorted(displayedTickets, filterInfo);
                }
            };
        }
        
        // console.log('✅ Export compatibility check completed');
        
    } catch (error) {
        console.error('❌ Error fixing export compatibility:', error);
    }
}

// ✅ ENHANCED FALLBACK EXPORT
async fallbackExport(exportData) {
    try {
        // console.log('📄 Starting fallback CSV export...');
        
        const headers = [
            'Ticket Code', 'Subject', 'User Name', 'User Email', 'Department', 
            'Location', 'Priority', 'Status', 'Created Date', 'Last Updated',
            'Assigned To', 'Admin Notes', 'Device Type', 'Inventory Number'
        ];
        
        const csvData = exportData.map(ticket => [
            ticket.code || '',
            ticket.subject || '',
            ticket.name || '',
            ticket.user_email || '',
            ticket.department || '',
            ticket.location || '',
            ticket.priority || '',
            ticket.status_ticket || '',
            ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-GB') : '',
            ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleDateString('en-GB') : '',
            ticket.assigned_to || '',
            ticket.note || '',
            ticket.device || '',
            ticket.inventory || ''
        ]);

        const csvContent = [headers, ...csvData]
            .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const timestamp = new Date().toISOString().split('T')[0];
        link.href = url;
        link.setAttribute('download', `tickets-export-${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // console.log('✅ Fallback CSV export completed');
        
    } catch (error) {
        console.error('❌ Fallback export error:', error);
        throw error;
    }
}

// ✅ GET CURRENT FILTER INFO YANG COMPATIBLE
getCurrentFilterInfo() {
    try {
        const statusFilter = document.getElementById('statusFilter');
        const priorityFilter = document.getElementById('priorityFilter');
        
        const statusValue = statusFilter ? statusFilter.value : 'all';
        const priorityValue = priorityFilter ? priorityFilter.value : 'all';
        
        let filterText = '';
        
        // Status filter info
        if (statusValue !== 'all') {
            filterText += `Status: ${statusValue}`;
        }
        
        // Priority filter info
        if (priorityValue !== 'all') {
            if (filterText) filterText += ', ';
            filterText += `Priority: ${priorityValue}`;
        }
        
        // Date filter info
        if (this.dateFilter.isActive) {
            const startDate = this.dateFilter.startDate;
            const endDate = this.dateFilter.endDate;
            
            if (filterText) filterText += ', ';
            
            if (startDate && endDate) {
                if (startDate.getTime() === endDate.getTime()) {
                    filterText += `Date: ${startDate.toLocaleDateString()}`;
                } else {
                    filterText += `Date: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                }
            } else if (startDate) {
                filterText += `From: ${startDate.toLocaleDateString()}`;
            } else if (endDate) {
                filterText += `Until: ${endDate.toLocaleDateString()}`;
            }
        }
        
        // Add user info
        const currentUser = this.adminUser;
        let userInfo = 'Unknown User';
        
        if (currentUser) {
            userInfo = currentUser.name || currentUser.email || currentUser.uid;
        }
        
        const finalFilterInfo = filterText ? 
            `${userInfo} - ${filterText}` : 
            `${userInfo} - All Tickets`;
            
        // console.log('📊 Current filter info:', finalFilterInfo);
        return finalFilterInfo;
        
    } catch (error) {
        console.error('❌ Error getting filter info:', error);
        return 'My Assigned Tickets';
    }
}

    async fallbackExport(exportData) {
        const headers = ['Code', 'Subject', 'User', 'Department', 'Location', 'Priority', 'Status', 'Created Date'];
        const csvData = exportData.map(ticket => [
            ticket.code || '',
            ticket.subject || '',
            ticket.name || '',
            ticket.department || '',
            ticket.location || '',
            ticket.priority || '',
            ticket.status_ticket || '',
            ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''
        ]);

        const csvContent = [headers, ...csvData]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tickets-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        await Swal.fire({
            title: 'Exported!',
            text: `${exportData.length} tickets exported as CSV (Fallback)`,
            icon: 'success',
            timer: 3000,
            showConfirmButton: false
        });
    }

    showError(message) {
        console.error('Error:', message);
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        
        const tableBody = document.getElementById('ticketsTableBody');
        if (tableBody) {
            tableBody.removeEventListener('click', this.handleTableClick);
        }
        
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.removeEventListener('click', this.handleLogout);
        }
    }
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    const adminDashboard = new AdminDashboard();
    window.adminDashboard = adminDashboard;
});

window.addEventListener('beforeunload', function() {
    if (window.adminDashboard) {
        window.adminDashboard.destroy();
    }
});

window.addEventListener('resize', function() {
    if (window.adminDashboard && window.adminDashboard.updateTableForMobile) {
        window.adminDashboard.updateTableForMobile();
    }
});

export default AdminDashboard;