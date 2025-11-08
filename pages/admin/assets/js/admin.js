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
        this.unsubscribe = null;
        this.db = db;
        this.auth = auth;
        this.currentUpdatingTicketId = null;
        
        // ✅ Binding untuk event handlers
        this.handleTableClick = this.handleTableClick.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        
        this.init();
    }

    // ==================== COMPREHENSIVE MIGRATION METHOD ====================
    async migrateTicketAssignments() {
        try {
            console.log('🔄 Starting comprehensive ticket assignment migration...');
            
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
            
            console.log('👥 Admin mapping:', adminMap);
            
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
                    console.log(`🔄 Migrating action_by: "${data.action_by}" -> "${newActionBy}"`);
                }
                
                // Check if assigned_to needs migration
                if (data.assigned_to && adminMap[data.assigned_to]) {
                    newAssignedTo = adminMap[data.assigned_to];
                    needsMigration = true;
                    console.log(`🔄 Migrating assigned_to: "${data.assigned_to}" -> "${newAssignedTo}"`);
                }
                
                if (needsMigration) {
                    try {
                        await updateDoc(doc.ref, {
                            action_by: newActionBy,
                            assigned_to: newAssignedTo,
                            assigned_name: data.action_by
                        });
                        migratedCount++;
                        console.log(`✅ Migrated ticket ${data.code}`);
                    } catch (error) {
                        console.error(`❌ Error migrating ticket ${data.code}:`, error);
                    }
                } else {
                    skippedCount++;
                    console.log(`⏭️ Skipped ticket ${data.code} - already using UID or no mapping found`);
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

            console.log(`🎉 Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);
            
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
            console.log('🚀 Admin Dashboard initializing...');
            
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
            
            // Setup real-time updates
            this.setupRealTimeListener();
            
            console.log('✅ Admin Dashboard ready');
            
        } catch (error) {
            console.error('❌ Admin Dashboard init error:', error);
        }
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
        
        console.log('🏗️ DOM Elements check:', requiredElements);
        
        for (const [name, element] of Object.entries(requiredElements)) {
            if (!element) {
                console.error(`❌ Missing DOM element: ${name}`);
            } else {
                console.log(`✅ Found: ${name}`);
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

            console.log('✅ Admin authenticated:', {
                uid: this.adminUser.uid,
                role: this.adminUser.role,
                name: this.adminUser.name,
                email: this.adminUser.email
            });

        } catch (error) {
            console.error('Admin auth check failed:', error);
            window.location.href = 'login.html';
        }
    }

    // ==================== PERMISSION SYSTEM ====================
    canDeleteTicket(ticket) {
        return this.adminUser.role === 'Super Admin';
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
        return true;
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
        return {
            canDelete: this.canDeleteTicket(ticket),
            canReopen: this.canReopenTicket(ticket),
            canTake: this.canTakeTicket(ticket),
            canUpdate: this.canUpdateTicket(ticket),
            canStart: this.canStartTicket(ticket),
            canResolve: this.canResolveTicket(ticket),
            isSuperAdmin: this.adminUser.role === 'Super Admin',
            isTicketOwner: this.isAssignedToCurrentAdmin(ticket)
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
        console.log('🔧 Initializing event listeners...');
        
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

        // Export button
        const exportBtn = document.getElementById('exportTickets');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.handleExport();
            });
        }

        console.log('✅ All event listeners initialized');
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
            console.log('✅ Update form event listener added');
        } else {
            console.warn('⚠️ Update form not found, will create dynamically');
        }
    }

    // ✅ METHOD HANDLE TABLE CLICK
    handleTableClick(e) {
        console.log('🖱️ Table clicked:', e.target);
        console.log('🔍 Element details:', {
            tagName: e.target.tagName,
            className: e.target.className,
            parentClass: e.target.parentElement?.className
        });
        
        // Cari button action terdekat
        let button = e.target.closest('.btn-action');
        
        // Jika tidak ditemukan, mungkin user klik icon di dalam button
        if (!button && e.target.classList.contains('fa-eye')) {
            button = e.target.closest('button');
        }
        
        if (!button) {
            console.log('❌ No action button found');
            return;
        }

        const action = button.dataset.action;
        console.log('🎯 Action detected:', action);

        // Cari container action buttons
        const actionContainer = button.closest('.action-buttons');
        const ticketId = actionContainer?.dataset.ticketId;

        console.log('🔍 Action details:', { 
            action: action,
            ticketId: ticketId,
            hasActionContainer: !!actionContainer,
            containerHTML: actionContainer?.outerHTML
        });

        if (!ticketId) {
            console.error('❌ No ticket ID found in data attribute');
            return;
        }

        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) {
            console.error('❌ Ticket not found in local data:', ticketId);
            console.log('📋 Available tickets:', this.tickets.map(t => t.id));
            return;
        }

        console.log('🎫 Found ticket:', {
            code: ticket.code,
            status: ticket.status,
            action_by: ticket.action_by,
            assigned_to: ticket.assigned_to
        });

        // Check permissions sebelum eksekusi action
        const permissions = this.checkPermissions(ticket);
        console.log('🔐 Permissions:', permissions);

        // Eksekusi action berdasarkan jenis
        switch (action) {
            case 'view':
                console.log('👀 View ticket clicked:', ticketId);
                this.viewTicket(ticketId);
                break;
            case 'start':
                console.log('🚀 Start ticket clicked:', ticketId);
                if (permissions.canStart) {
                    this.updateTicketStatus(ticketId, 'In Progress');
                } else {
                    this.showPermissionError('start this ticket');
                }
                break;
            case 'resolve':
                console.log('✅ Resolve ticket clicked:', ticketId);
                if (permissions.canResolve) {
                    this.updateTicketStatus(ticketId, 'Resolved');
                } else {
                    this.showPermissionError('resolve this ticket');
                }
                break;
            case 'reopen':
                console.log('🔁 Reopen ticket clicked:', ticketId);
                if (permissions.canReopen) {
                    this.updateTicketStatus(ticketId, 'Open');
                } else {
                    this.showPermissionError('reopen this ticket');
                }
                break;
            case 'delete':
                console.log('🗑️ Delete ticket clicked:', ticketId);
                if (permissions.canDelete) {
                    this.deleteTicket(ticketId);
                } else {
                    this.showPermissionError('delete this ticket');
                }
                break;
            case 'take':
                console.log('👋 Take ticket clicked:', ticketId);
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
            message = `Only Super Admin can ${action}. Your role (${roleName}) does not have delete permission.`;
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
                console.log('Firebase logout:', error.message);
            }
            
            localStorage.removeItem('adminUser');
            window.location.href = 'login.html';
        }
    }

    setupRealTimeListener() {
        try {
            const q = query(collection(this.db, "tickets"), orderBy("created_at", "desc"));
            
            this.unsubscribe = onSnapshot(q, (snapshot) => {
                console.log('🔄 Real-time update: tickets changed');
                this.loadTickets();
            });
            
            console.log('✅ Real-time listener activated');
        } catch (error) {
            console.error('❌ Error setting up real-time listener:', error);
        }
    }

    // ✅ LOAD TICKETS
    async loadTickets() {
        try {
            console.log('🔄 Loading tickets...');
            
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
        
        console.log(`?? Rendering ticket card ${ticket.id}:`, {
            code: ticket.code,
            status: ticket.status,
            assignedAdmin: assignedAdminDisplay
        });
        
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
            new Date(ticket.created_at).toLocaleDateString() : 'N/A';

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
    
    console.log(`?? Rendered ${this.filteredTickets.length} ticket cards`);
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
        
        console.log(`?? Rendering ticket ${ticket.id}:`, {
            code: ticket.code,
            status: ticket.status,
            assignedAdmin: assignedAdminDisplay
        });
        
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
                <td>${ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : 'N/A'}</td>
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
        console.log(`🎯 Found ${actionButtons.length} action buttons in table`);

        actionButtons.forEach((button, index) => {
            const action = button.dataset.action;
            const actionContainer = button.closest('.action-buttons');
            const ticketId = actionContainer?.dataset.ticketId;
            
            console.log(`🔍 Button ${index + 1}:`, {
                action: action,
                ticketId: ticketId,
                text: button.textContent.trim(),
                hasDataAction: !!button.dataset.action,
                hasTicketId: !!ticketId
            });
        });

        // Cek khusus view buttons
        const viewButtons = tableBody.querySelectorAll('.btn-view');
        console.log(`👀 Found ${viewButtons.length} view buttons`);

        viewButtons.forEach((button, index) => {
            console.log(`📱 View button ${index + 1}:`, {
                outerHTML: button.outerHTML,
                dataset: button.dataset,
                parentDataset: button.closest('.action-buttons')?.dataset
            });
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
            console.log(`🔄 Updating ticket ${ticketId} to status: ${newStatus}`);
            
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
                last_updated: serverTimestamp()
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
            console.log(`✅ Executing resolution for ticket ${ticketId} with note`);
            
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
            console.log(`👋 Taking ticket: ${ticketId}`);
            
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
    async viewTicket(ticketId) {
        try {
            console.log(`👀 Viewing ticket: ${ticketId}`);
            
            // Cek dulu di local data
            const localTicket = this.tickets.find(t => t.id === ticketId);
            if (!localTicket) {
                console.error('❌ Ticket not found in local data');
                await Swal.fire({
                    title: 'Error!',
                    text: 'Ticket not found in local data',
                    icon: 'error',
                    confirmButtonColor: '#ef070a'
                });
                return;
            }

            console.log('📋 Local ticket data:', localTicket);

            // Ambil data terbaru dari Firestore
            const ticketDoc = await getDoc(doc(this.db, "tickets", ticketId));
            
            if (!ticketDoc.exists()) {
                console.error('❌ Ticket not found in Firestore');
                await Swal.fire({
                    title: 'Error!',
                    text: 'Ticket not found in database',
                    icon: 'error',
                    confirmButtonColor: '#ef070a'
                });
                return;
            }

            const ticket = this.normalizeTicketData(ticketId, ticketDoc.data());
            console.log('🎫 Ticket data from Firestore:', ticket);
            
            // Show ticket details in modal
            await this.showTicketModal(ticket);
            
        } catch (error) {
            console.error('❌ Error viewing ticket:', error);
            await Swal.fire({
                title: 'Error!',
                text: 'Failed to load ticket details: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#ef070a'
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
    async showTicketModal(ticket) {
        try {
            console.log('🎫 showTicketModal called for ticket:', ticket.code);
            
            const modal = document.getElementById('ticketModal');
            const modalBody = document.getElementById('ticketModalBody');
            
            if (!modal || !modalBody) {
                console.error('❌ Modal elements not found');
                await Swal.fire({
                    title: 'Error!',
                    text: 'Modal elements not found in page',
                    icon: 'error'
                });
                return;
            }

            console.log('🔍 Modal elements found, preparing content...');

            // Dapatkan info admin
            const assignedAdmins = await this.getAssignedAdminInfo(ticket);
            const permissions = this.checkPermissions(ticket);

            console.log('👥 Assigned admins:', assignedAdmins);
            console.log('🔐 Permissions:', permissions);

            // Render content langsung
            const modalHTML = this.getTicketModalHTML(ticket, assignedAdmins, permissions);
            modalBody.innerHTML = modalHTML;

            // ✅ PERBAIKAN UTAMA: Multiple approach untuk show modal
            console.log('🔄 Showing modal with multiple methods...');
            
            // Method 1: Style langsung dengan important
            modal.style.display = 'flex !important';
            
            // Method 2: Tambah class show
            modal.classList.add('show', 'active', 'visible');
            
            // Method 3: Force reflow multiple times
            void modal.offsetWidth;
            void modal.offsetHeight;
            
            // Method 4: Set timeout untuk memastikan render
            setTimeout(() => {
                modal.style.display = 'flex';
                document.body.classList.add('modal-open', 'no-scroll');
                
                // Method 5: Check dan retry jika masih tidak visible
                setTimeout(() => {
                    const computedStyle = window.getComputedStyle(modal);
                    console.log('📊 Final modal computed styles:', {
                        display: computedStyle.display,
                        opacity: computedStyle.opacity,
                        visibility: computedStyle.visibility,
                        zIndex: computedStyle.zIndex
                    });
                    
                    if (computedStyle.display !== 'flex' && computedStyle.display !== 'block') {
                        console.warn('⚠️ Modal still not visible, using fallback method...');
                        // Fallback: create new modal
                        this.createFallbackModal(ticket, assignedAdmins, permissions);
                    }
                }, 50);
            }, 10);

            console.log('✅ Modal show methods executed');

        } catch (error) {
            console.error('❌ Error showing modal:', error);
            await Swal.fire({
                title: 'Error!',
                text: 'Failed to show ticket details: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    // ✅ FALLBACK METHOD JIKA MODAL UTAMA TIDAK BEKERJA
    createFallbackModal(ticket, assignedAdmins, permissions) {
        try {
            console.log('🔄 Creating fallback modal...');
            
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
            
            console.log('✅ Fallback modal created');
            
        } catch (error) {
            console.error('❌ Error creating fallback modal:', error);
        }
    }

    // ✅ METHOD UNTUK GET MODAL HTML
    getTicketModalHTML(ticket, assignedAdmins, permissions) {
        return `
            <div class="ticket-details">
                <div class="detail-section">
                    <h3><i class="fas fa-ticket-alt"></i> Ticket Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Ticket Code:</label>
                            <span>${this.escapeHtml(ticket.code)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Subject:</label>
                            <span>${this.escapeHtml(ticket.subject)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Status:</label>
                            <span class="status-badge status-${(ticket.status || 'open').toLowerCase().replace(' ', '-')}">
                                ${this.escapeHtml(ticket.status)}
                            </span>
                        </div>
                        <div class="detail-item">
                            <label>Priority:</label>
                            <span class="priority-badge priority-${(ticket.priority || 'medium').toLowerCase()}">
                                ${this.escapeHtml(ticket.priority)}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3><i class="fas fa-user"></i> User Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Name:</label>
                            <span>${this.escapeHtml(ticket.user_name)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Email:</label>
                            <span>${this.escapeHtml(ticket.user_email)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Department:</label>
                            <span>${this.escapeHtml(ticket.user_department)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Phone:</label>
                            <span>${this.escapeHtml(ticket.user_phone || 'N/A')}</span>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3><i class="fas fa-cogs"></i> Technical Details</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Location:</label>
                            <span>${this.escapeHtml(ticket.location)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Inventory:</label>
                            <span>${this.escapeHtml(ticket.inventory)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Device:</label>
                            <span>${this.escapeHtml(ticket.device)}</span>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3><i class="fas fa-comment-alt"></i> Problem Description</h3>
                    <div class="message-box">
                        ${this.escapeHtml(ticket.message)}
                    </div>
                </div>

                ${ticket.note ? `
                <div class="detail-section">
                    <h3><i class="fas fa-sticky-note"></i> Admin Notes</h3>
                    <div class="note-box">
                        ${this.escapeHtml(ticket.note)}
                    </div>
                </div>
                ` : ''}

                <div class="detail-section">
                    <h3><i class="fas fa-users"></i> Assignment Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Action By:</label>
                            <span>
                                ${assignedAdmins.actionBy ? 
                                    `${this.escapeHtml(assignedAdmins.actionBy.name)} (${this.escapeHtml(assignedAdmins.actionBy.email)})` : 
                                    'Not assigned'}
                            </span>
                        </div>
                        <div class="detail-item">
                            <label>Assigned To:</label>
                            <span>
                                ${assignedAdmins.assignedTo ? 
                                    `${this.escapeHtml(assignedAdmins.assignedTo.name)} (${this.escapeHtml(assignedAdmins.assignedTo.email)})` : 
                                    'Not assigned'}
                            </span>
                        </div>
                        ${this.adminUser.role ? `
                        <div class="detail-item">
                            <label>Your Role:</label>
                            <span class="role-badge">${this.escapeHtml(this.adminUser.role)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>

                ${ticket.updates && ticket.updates.length > 0 ? `
                <div class="detail-section">
                    <h3><i class="fas fa-history"></i> Update History</h3>
                    <div class="updates-timeline">
                        ${ticket.updates.slice().reverse().map(update => `
                            <div class="update-item">
                                <div class="update-header">
                                    <strong>${this.escapeHtml(update.status || 'Updated')}</strong>
                                    <span class="update-time">
                                        ${update.timestamp ? new Date(update.timestamp).toLocaleString() : 'Unknown time'}
                                    </span>
                                </div>
                                <div class="update-notes">${this.escapeHtml(update.notes || 'No notes')}</div>
                                <div class="update-by">
                                    By: ${this.escapeHtml(update.updatedBy || 'System')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="modal-actions">
                    ${permissions.canUpdate ? `
                        <button class="btn-primary" onclick="adminDashboard.updateTicketModal('${ticket.id}')">
                            <i class="fas fa-edit"></i> Update Ticket
                        </button>
                    ` : ''}
                    
                    <div class="modal-action-buttons">
                        ${ticket.status === 'Open' && permissions.canStart ? `
                            <button class="btn-action btn-edit" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'In Progress')">
                                <i class="fas fa-play"></i> Start Ticket
                            </button>
                        ` : ''}
                        
                        ${ticket.status === 'In Progress' && permissions.canResolve ? `
                            <button class="btn-action btn-resolve" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'Resolved')">
                                <i class="fas fa-check"></i> Resolve Ticket
                            </button>
                        ` : ''}
                        
                        ${ticket.status === 'Resolved' && permissions.canReopen ? `
                            <button class="btn-action btn-edit" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'Open')">
                                <i class="fas fa-redo"></i> Reopen Ticket
                            </button>
                        ` : ''}
                        
                        ${permissions.canDelete ? `
                            <button class="btn-action btn-delete" onclick="adminDashboard.deleteTicket('${ticket.id}')">
                                <i class="fas fa-trash"></i> Delete Ticket
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
        console.log('🚪 Closing ticket modal...');
        
        const modal = document.getElementById('ticketModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show', 'active', 'visible');
            document.body.classList.remove('modal-open', 'no-scroll');
            console.log('✅ Ticket modal closed');
        }
        
        // Juga close fallback modal jika ada
        const fallbackModal = document.getElementById('fallbackTicketModal');
        if (fallbackModal) {
            fallbackModal.remove();
            console.log('✅ Fallback modal closed');
        }
    }

    // ✅ METHOD UPDATE TICKET MODAL - FIXED
    async updateTicketModal(ticketId) {
        try {
            console.log('✏️ Opening update modal for ticket:', ticketId);
            
            const ticketDoc = await getDoc(doc(this.db, "tickets", ticketId));
            if (!ticketDoc.exists()) {
                throw new Error('Ticket not found');
            }

            const ticket = this.normalizeTicketData(ticketId, ticketDoc.data());
            this.currentUpdatingTicketId = ticketId;
            
            await this.showUpdateFormModal(ticket);
            
        } catch (error) {
            console.error('❌ Error opening update modal:', error);
            await Swal.fire({
                title: 'Error!',
                text: 'Failed to open update form',
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    // ✅ METHOD SHOW UPDATE FORM MODAL
    async showUpdateFormModal(ticket) {
        try {
            let updateModal = document.getElementById('updateTicketModal');
            
            if (!updateModal) {
                // Create modal jika belum ada
                updateModal = document.createElement('div');
                updateModal.id = 'updateTicketModal';
                updateModal.className = 'modal';
                updateModal.innerHTML = `
                    <div class="modal-content update-modal-content">
                        <div class="modal-header">
                            <h3>Update Ticket: ${ticket.code}</h3>
                            <button type="button" class="close-btn" onclick="adminDashboard.closeUpdateModal()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="updateTicketForm">
                                <div class="form-group">
                                    <label for="updateSubject">Subject:</label>
                                    <input type="text" id="updateSubject" class="form-control" value="${this.escapeHtml(ticket.subject)}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="updatePriority">Priority:</label>
                                    <select id="updatePriority" class="form-control" required>
                                        <option value="Low" ${ticket.priority === 'Low' ? 'selected' : ''}>Low</option>
                                        <option value="Medium" ${ticket.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                                        <option value="High" ${ticket.priority === 'High' ? 'selected' : ''}>High</option>
                                        <option value="Critical" ${ticket.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="updateStatus">Status:</label>
                                    <select id="updateStatus" class="form-control" required>
                                        <option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>Open</option>
                                        <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                        <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="updateAdminNotes">Admin Notes:</label>
                                    <textarea id="updateAdminNotes" class="form-control" rows="4" placeholder="Add admin notes...">${this.escapeHtml(ticket.note || '')}</textarea>
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
                document.body.appendChild(updateModal);
                
                // Add form submit event
                document.getElementById('updateTicketForm').addEventListener('submit', (e) => {
                    e.preventDefault();
                    if (this.currentUpdatingTicketId) {
                        this.handleTicketUpdate(this.currentUpdatingTicketId);
                    }
                });
            }
            
            // Show modal dan isi data
            updateModal.style.display = 'flex';
            updateModal.classList.add('show');
            document.body.classList.add('modal-open');
            
            document.getElementById('updateSubject').value = ticket.subject;
            document.getElementById('updatePriority').value = ticket.priority;
            document.getElementById('updateStatus').value = ticket.status;
            document.getElementById('updateAdminNotes').value = ticket.note || '';
            
        } catch (error) {
            console.error('❌ Error showing update form:', error);
            throw error;
        }
    }

    // ✅ METHOD UNTUK HANDLE TICKET UPDATE
    async handleTicketUpdate(ticketId) {
        try {
            const submitBtn = document.querySelector('#updateTicketForm button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            // Show loading
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitBtn.disabled = true;
            
            const updateData = {
                subject: document.getElementById('updateSubject').value,
                priority: document.getElementById('updatePriority').value,
                status: document.getElementById('updateStatus').value,
                note: document.getElementById('updateAdminNotes').value,
                last_updated: serverTimestamp()
            };
            
            // Add to updates array
            const updateNote = {
                status: updateData.status,
                notes: `Ticket updated by ${this.adminUser.name || this.adminUser.email}`,
                timestamp: new Date().toISOString(),
                updatedBy: this.adminUser.name || this.adminUser.email,
                changes: {
                    subject: updateData.subject,
                    priority: updateData.priority,
                    status: updateData.status
                }
            };
            
            // Get current updates
            const ticketRef = doc(this.db, "tickets", ticketId);
            const ticketDoc = await getDoc(ticketRef);
            const currentData = ticketDoc.data();
            const currentUpdates = Array.isArray(currentData.updates) ? currentData.updates : [];
            updateData.updates = [...currentUpdates, updateNote];
            
            // Update QA field based on status
            if (updateData.status === 'Resolved' && (!updateData.note || updateData.note.trim() === '')) {
                await Swal.fire({
                    title: 'Note Required!',
                    text: 'Resolution notes are required when setting status to Resolved',
                    icon: 'warning',
                    confirmButtonColor: '#ef070a'
                });
                return;
            } else if (updateData.status === 'Open') {
                updateData.qa = 'Open';
            } else if (updateData.status === 'In Progress') {
                updateData.qa = 'In Progress';
            }
            
            console.log('📝 Update data:', updateData);
            
            // Execute update
            await updateDoc(ticketRef, updateData);
            
            // Close modal
            this.closeUpdateModal();
            
            // Show success message
            await Swal.fire({
                title: 'Success!',
                text: 'Ticket updated successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Refresh data
            await this.loadTickets();
            
        } catch (error) {
            console.error('❌ Error updating ticket:', error);
            
            // Reset button
            const submitBtn = document.querySelector('#updateTicketForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Ticket';
                submitBtn.disabled = false;
            }
            
            await Swal.fire({
                title: 'Update Failed!',
                text: 'Failed to update ticket: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
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

    // ✅ EXPORT METHODS
    getDisplayedTicketsForExport() {
        try {
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
                assigned_to: ticket.assigned_to,
                note: ticket.note,
                user_phone: ticket.user_phone,
                createdAt: ticket.created_at,
                updatedAt: ticket.last_updated
            }));
            
            return exportTickets;
            
        } catch (error) {
            console.error('❌ Error preparing export data:', error);
            return [];
        }
    }

    async handleExport() {
        try {
            const exportBtn = document.getElementById('exportTickets');
            const originalText = exportBtn.innerHTML;
            
            exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
            exportBtn.disabled = true;

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

            if (window.updateAllTickets && typeof window.updateAllTickets === 'function') {
                window.updateAllTickets(exportData);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (typeof window.handleExportToExcel === 'function') {
                await window.handleExportToExcel();
            } else {
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
            const exportBtn = document.getElementById('exportTickets');
            if (exportBtn) {
                exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Export Excel';
                exportBtn.disabled = false;
            }
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