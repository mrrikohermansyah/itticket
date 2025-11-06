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
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// Import auth service
import firebaseAuthService from '../../../../assets/js/services/firebase-auth-service.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Admin Dashboard
class AdminDashboard {
    constructor() {
        this.adminUser = null;
        this.tickets = [];
        this.filteredTickets = [];
        this.currentFilter = 'all';
        this.unsubscribe = null;
        this.db = db;
        this.auth = auth;
        
        // ✅ Binding untuk event handlers
        this.handleTableClick = this.handleTableClick.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Admin Dashboard initializing...');
            
            // Cek auth status
            await this.checkAuth();
            
            // Load admin info
            this.loadAdminInfo();
            
            // Setup event listeners
            this.initializeEventListeners();
            
            // Load tickets
            await this.loadTickets();
            
            // Setup real-time updates
            this.setupRealTimeListener();
            
            console.log('✅ Admin Dashboard ready');
            
        } catch (error) {
            console.error('❌ Admin Dashboard init error:', error);
        }
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

            console.log('✅ Admin authenticated:', this.adminUser);

        } catch (error) {
            console.error('Admin auth check failed:', error);
            window.location.href = 'login.html';
        }
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

    initializeEventListeners() {
        // Logout
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout);
        }

        // Manage Team Button
        const manageTeamBtn = document.getElementById('manageTeamBtn');
        if (manageTeamBtn) {
            manageTeamBtn.addEventListener('click', (e) => {
                this.handleManageTeam(e);
            });
        }

        // Filters
        const statusFilter = document.getElementById('statusFilter');
        const priorityFilter = document.getElementById('priorityFilter');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.filterTickets();
            });
        }
        
        if (priorityFilter) {
            priorityFilter.addEventListener('change', () => {
                this.filterTickets();
            });
        }

        // Search functionality
        const searchInput = document.getElementById('searchTickets');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

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

        // ✅ EVENT DELEGATION YANG DIPERBAIKI
        const tableBody = document.getElementById('ticketsTableBody');
        if (tableBody) {
            tableBody.addEventListener('click', this.handleTableClick);
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshTickets');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadTickets();
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportTickets');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.handleExport();
            });
        }
    }

    // ✅ METHOD HANDLE TABLE CLICK YANG DIPERBAIKI
    handleTableClick(e) {
        const button = e.target.closest('.btn-action');
        if (!button) return;

        const actionContainer = e.target.closest('.action-buttons');
        const ticketId = actionContainer?.dataset.ticketId;
        const action = button.dataset.action;

        if (!ticketId) {
            console.log('❌ No ticket ID found');
            return;
        }

        console.log('🔄 Action clicked:', { action, ticketId });

        switch (action) {
            case 'view':
                this.viewTicket(ticketId);
                break;
            case 'start':
                this.updateTicketStatus(ticketId, 'In Progress');
                break;
            case 'resolve':
                this.updateTicketStatus(ticketId, 'Resolved');
                break;
            case 'reopen':
                this.updateTicketStatus(ticketId, 'Open');
                break;
            case 'delete':
                this.deleteTicket(ticketId);
                break;
            default:
                console.log('❌ Unknown action:', action);
        }
    }

    async handleManageTeam(e) {
        e.preventDefault();
        console.log('Manage Team clicked...');
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
                // Logout dari Firebase
                await firebaseAuthService.logout();
            } catch (error) {
                console.log('Firebase logout:', error.message);
            }
            
            // Hapus data localStorage
            localStorage.removeItem('adminUser');
            
            window.location.href = 'login.html';
        }
    }

    setupRealTimeListener() {
        try {
            if (!this.db) {
                console.error('❌ Cannot setup real-time listener: db not initialized');
                return;
            }
            
            const q = query(collection(this.db, "tickets"), orderBy("created_at", "desc"));
            
            this.unsubscribe = onSnapshot(q, (snapshot) => {
                console.log('🔄 Real-time update: tickets changed');
                this.loadTickets(); // Auto-refresh
            });
            
            console.log('✅ Real-time listener activated');
        } catch (error) {
            console.error('❌ Error setting up real-time listener:', error);
        }
    }

    // ✅ LOAD TICKETS YANG DIPERBAIKI
    async loadTickets() {
        try {
            console.log('🔄 Loading tickets...');
            
            const q = query(
                collection(this.db, "tickets"), 
                orderBy("created_at", "desc")
            );

            const querySnapshot = await getDocs(q);
            const tickets = [];
            
            querySnapshot.forEach((doc) => {
                try {
                    const data = doc.data();
                    const ticket = this.normalizeTicketData(doc.id, data);
                    tickets.push(ticket);
                } catch (error) {
                    console.error(`❌ Error processing ticket ${doc.id}:`, error);
                    console.log('Problematic data:', doc.data());
                }
            });

            this.tickets = tickets;
            this.filteredTickets = [...tickets];
            
            // ✅ UPDATE GLOBAL DATA SETELAH LOAD
            this.updateGlobalTicketsData();
            
            this.renderTickets();
            this.updateStats();
            
            console.log('✅ Tickets loaded:', tickets.length);
            
        } catch (error) {
            console.error('❌ Error loading tickets:', error);
            this.showError('Failed to load tickets');
        }
    }

    // ✅ NORMALIZE TICKET DATA YANG DIPERBAIKI
    normalizeTicketData(id, data) {
        try {
            // Handle Firestore timestamps
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
                note: data.note || '',
                qa: data.qa || '',
                user_phone: data.user_phone || '',
                updates: Array.isArray(data.updates) ? data.updates : []
            };
        } catch (error) {
            console.error(`❌ Error normalizing ticket ${id}:`, error);
            // Return minimal valid ticket data
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
                note: '',
                qa: '',
                user_phone: '',
                updates: []
            };
        }
    }

    // ✅ UPDATE GLOBAL TICKETS DATA YANG DIPERBAIKI
    updateGlobalTicketsData() {
        try {
            console.log('🔄 Updating global tickets data...');
            
            // ✅ GUNAKAN DATA LOKAL YANG SUDAH DINORMALISASI
            const validTickets = this.tickets.filter(ticket => 
                ticket && 
                typeof ticket === 'object' && 
                ticket.id && 
                ticket.code
            );

            console.log(`📊 Sending ${validTickets.length} valid tickets to export module`);
            
            // Pastikan window.updateAllTickets ada
            if (typeof window.updateAllTickets === 'function') {
                window.updateAllTickets(validTickets);
            } else {
                console.warn('⚠️ window.updateAllTickets not available');
            }
            
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

    handleSearch(searchTerm) {
        if (!searchTerm) {
            this.filteredTickets = [...this.tickets];
            this.filterTickets();
            return;
        }

        const term = searchTerm.toLowerCase();
        this.filteredTickets = this.tickets.filter(ticket => 
            (ticket.code && ticket.code.toLowerCase().includes(term)) ||
            (ticket.subject && ticket.subject.toLowerCase().includes(term)) ||
            (ticket.user_name && ticket.user_name.toLowerCase().includes(term)) ||
            (ticket.user_email && ticket.user_email.toLowerCase().includes(term)) ||
            (ticket.user_department && ticket.user_department.toLowerCase().includes(term)) ||
            (ticket.location && ticket.location.toLowerCase().includes(term)) ||
            (ticket.device && ticket.device.toLowerCase().includes(term))
        );

        this.renderTickets();
    }

    renderTickets() {
        const tableBody = document.getElementById('ticketsTableBody');
        const emptyState = document.getElementById('emptyTicketsState');

        if (!tableBody || !emptyState) {
            console.error('Required DOM elements not found');
            return;
        }

        if (this.filteredTickets.length === 0) {
            tableBody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        const ticketsHtml = this.filteredTickets.map(ticket => {
            // Tentukan action buttons berdasarkan status
            let actionButtons = '';
            
            if (ticket.status === 'Open') {
                actionButtons = `
                    <button class="btn-action btn-view" data-action="view" title="View Ticket">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-action btn-edit" data-action="start" title="Start Working">
                        <i class="fas fa-play"></i> Start
                    </button>
                    <button class="btn-action btn-delete" data-action="delete" title="Delete Ticket">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                `;
            } else if (ticket.status === 'In Progress') {
                actionButtons = `
                    <button class="btn-action btn-view" data-action="view" title="View Ticket">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-action btn-resolve" data-action="resolve" title="Mark as Resolved">
                        <i class="fas fa-check"></i> Resolve
                    </button>
                    <button class="btn-action btn-delete" data-action="delete" title="Delete Ticket">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                `;
            } else if (ticket.status === 'Resolved') {
                actionButtons = `
                    <button class="btn-action btn-view" data-action="view" title="View Ticket">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-action btn-edit" data-action="reopen" title="Reopen Ticket">
                        <i class="fas fa-redo"></i> Reopen
                    </button>
                    <button class="btn-action btn-delete" data-action="delete" title="Delete Ticket">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                `;
            } else {
                // Default actions
                actionButtons = `
                    <button class="btn-action btn-view" data-action="view" title="View Ticket">
                        <i class="fas fa-eye"></i> View
                    </button>
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
                    <td>${ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        <div class="action-buttons" data-ticket-id="${ticket.id}">
                            ${actionButtons}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = ticketsHtml;
    }
    

    updateStats() {
        const totalTickets = this.filteredTickets.length;
        const openTickets = this.filteredTickets.filter(ticket => ticket.status === 'Open').length;
        const inProgressTickets = this.filteredTickets.filter(ticket => ticket.status === 'In Progress').length;
        const resolvedTickets = this.filteredTickets.filter(ticket => ticket.status === 'Resolved').length;
        const highPriorityTickets = this.filteredTickets.filter(ticket => ticket.priority === 'High').length;

        // Update stats elements
        this.updateElementText('totalTickets', totalTickets);
        this.updateElementText('totalOpenTickets', openTickets);
        this.updateElementText('totalInProgress', inProgressTickets);
        this.updateElementText('totalResolved', resolvedTickets);
        this.updateElementText('totalHighPriority', highPriorityTickets);
    }

    updateElementText(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    // ... (method-method lainnya seperti viewTicket, closeTicketModal, updateTicketStatus, deleteTicket tetap sama)

    // ✅ GET DISPLAYED TICKETS FOR EXPORT YANG DIPERBAIKI
    async getDisplayedTicketsForExport() {
        try {
            console.log('🔥 Getting tickets for export...');
            
            // ✅ GUNAKAN DATA YANG SUDAH DIFILTER DAN DINORMALISASI
            const exportTickets = this.filteredTickets.map(ticket => ({
                id: ticket.id,
                code: ticket.code,
                subject: ticket.subject,
                name: ticket.user_name,
                user_email: ticket.user_email,
                department: ticket.user_department,
                location: ticket.location,
                inventory: ticket.inventory,
                device: ticket.device,
                message: ticket.message,
                priority: ticket.priority,
                status_ticket: ticket.status,
                qa: ticket.qa,
                action_by: ticket.action_by,
                note: ticket.note,
                user_phone: ticket.user_phone,
                createdAt: ticket.created_at,
                updatedAt: ticket.last_updated,
                last_updated: ticket.last_updated
            }));
            
            console.log('✅ Export data prepared:', exportTickets.length, 'tickets');
            return exportTickets;
            
        } catch (error) {
            console.error('❌ Error preparing export data:', error);
            return [];
        }
    }

    // ✅ HANDLE EXPORT YANG DIPERBAIKI
    async handleExport() {
        try {
            console.log('🔄 Starting export process...');
            
            const exportBtn = document.getElementById('exportTickets');
            const originalText = exportBtn.innerHTML;
            
            // Show loading state
            exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
            exportBtn.disabled = true;

            // ✅ DAPATKAN DATA UNTUK EXPORT
            const exportData = await this.getDisplayedTicketsForExport();
            
            if (exportData.length === 0) {
                await Swal.fire({
                    title: 'No Data',
                    text: 'No tickets available for export.',
                    icon: 'warning',
                    confirmButtonColor: '#ef070a'
                });
                return;
            }

            // Update global data
            if (window.updateAllTickets && typeof window.updateAllTickets === 'function') {
                window.updateAllTickets(exportData);
            }
            
            // Beri waktu untuk proses update data
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Panggil export function dari export.js
            if (typeof window.handleExportToExcel === 'function') {
                console.log('✅ Calling export function...');
                await window.handleExportToExcel();
            } else {
                console.warn('⚠️ Export function not available, using fallback');
                await this.fallbackExport(exportData);
            }
            
        } catch (error) {
            console.error('❌ Export error:', error);
            await Swal.fire({
                title: 'Export Failed',
                text: 'Could not export data. Please try again.',
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        } finally {
            // Reset button state
            const exportBtn = document.getElementById('exportTickets');
            if (exportBtn) {
                exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Export Excel';
                exportBtn.disabled = false;
            }
        }
    }

    // FALLBACK EXPORT
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
        // Implementasi showError
        console.error('Error:', message);
    }

    // Cleanup ketika instance dihancurkan
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        
        // Remove event listeners
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
// Tambahkan kode ini di dalam file admin.js setelah data tickets dimuat
function updateTableForMobile() {
  const tableCells = document.querySelectorAll('#ticketsTableBody td');
  const headers = document.querySelectorAll('#ticketsTable th');
  
  tableCells.forEach((cell, index) => {
    const headerIndex = index % headers.length;
    const headerText = headers[headerIndex].textContent;
    cell.setAttribute('data-label', headerText);
  });
}

// Panggil fungsi ini setelah mengisi tabel dengan data
updateTableForMobile();

// Juga panggil saat window di-resize untuk menangani orientasi perubahan
window.addEventListener('resize', updateTableForMobile);

// Initialize admin dashboard ketika DOM siap
document.addEventListener('DOMContentLoaded', function() {
    const adminDashboard = new AdminDashboard();
    window.adminDashboard = adminDashboard;
});

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (window.adminDashboard) {
        window.adminDashboard.destroy();
    }
});

export default AdminDashboard;