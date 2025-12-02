// Import Firebase modules dengan LENGKAP
import {
    collection,
    addDoc,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    Timestamp,
    deleteField,
    onSnapshot,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    setPersistence,
    browserSessionPersistence,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { auth, db } from '../../../../assets/js/utils/firebase-config.js';

// Import auth service
import firebaseAuthService from '../../../../assets/js/services/firebase-auth-service.js';

// Use shared Firebase instances from firebase-config.js

// Bulk resolve helper
window.bulkResolveTicketsByDateRange = async function(startDateStr, endDateStr) {
  try {
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T23:59:59`);
    const startTS = Timestamp.fromDate(start);
    const endTS = Timestamp.fromDate(end);

    const q1 = query(collection(db, 'tickets'), where('created_at', '>=', startTS), where('created_at', '<=', endTS));
    const q2 = query(collection(db, 'tickets'), where('createdAt', '>=', startTS), where('createdAt', '<=', endTS));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    let docs = [...snap1.docs, ...snap2.docs];
    if (docs.length === 0) {
      const allSnap = await getDocs(collection(db, 'tickets'));
      docs = allSnap.docs.filter(d => {
        const data = d.data();
        let dt = null;
        if (data.created_at && typeof data.created_at.toDate === 'function') dt = data.created_at.toDate();
        else if (data.createdAt && typeof data.createdAt.toDate === 'function') dt = data.createdAt.toDate();
        else if (typeof data.created_at === 'string') dt = new Date(data.created_at);
        else if (typeof data.createdAt === 'string') dt = new Date(data.createdAt);
        if (!dt || isNaN(dt.getTime())) return false;
        return dt >= start && dt <= end;
      });
    }
    let updated = 0, skipped = 0, matched = 0;

    for (const docSnap of docs) {
      const d = docSnap.data();
      const s1 = (d.status || '').toString().trim().toLowerCase();
      const s2 = (d.status_ticket || '').toString().trim().toLowerCase();
      const isClosed = s1 === 'closed' || s2 === 'closed' || s1 === 'close' || s2 === 'close' || s1.includes('closed') || s2.includes('closed');
      const isProgress = s1 === 'on progress' || s2 === 'on progress' || s1 === 'in progress' || s2 === 'in progress' || s1.includes('progress') || s2.includes('progress');
      const alreadyResolved = s1 === 'resolved' || s2 === 'resolved';
      const isTarget = (isClosed || isProgress) && !alreadyResolved;
      if (!isTarget) { skipped++; continue; }

      matched++;
      await updateDoc(doc(db, 'tickets', docSnap.id), {
        status: 'Resolved',
        status_ticket: 'Resolved',
        last_updated: serverTimestamp()
      });
      updated++;
    }

    return { matched, updated, skipped };
  } catch (e) {
    console.error('Bulk resolve failed:', e);
    throw e;
  }
};

window.migrateDepartmentToUserDepartmentRange = async function(startDateStr, endDateStr) {
  try {
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T23:59:59`);
    const startTS = Timestamp.fromDate(start);
    const endTS = Timestamp.fromDate(end);

    const q1 = query(collection(db, 'tickets'), where('created_at', '>=', startTS), where('created_at', '<=', endTS));
    const q2 = query(collection(db, 'tickets'), where('createdAt', '>=', startTS), where('createdAt', '<=', endTS));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    let docs = [...snap1.docs, ...snap2.docs];
    if (docs.length === 0) {
      const allSnap = await getDocs(collection(db, 'tickets'));
      docs = allSnap.docs.filter(d => {
        const data = d.data();
        let dt = null;
        if (data.created_at && typeof data.created_at.toDate === 'function') dt = data.created_at.toDate();
        else if (data.createdAt && typeof data.createdAt.toDate === 'function') dt = data.createdAt.toDate();
        else if (typeof data.created_at === 'string') dt = new Date(data.created_at);
        else if (typeof data.createdAt === 'string') dt = new Date(data.createdAt);
        if (!dt || isNaN(dt.getTime())) return false;
        return dt >= start && dt <= end;
      });
    }

    let updated = 0, skipped = 0;
    for (const docSnap of docs) {
      const d = docSnap.data();
      const dep = (d.department || '').toString().trim();
      const currentUserDep = (d.user_department || '').toString().trim();
      if (!dep) { skipped++; continue; }
      const newUserDep = currentUserDep || dep;
      if (newUserDep === currentUserDep) { skipped++; continue; }
      await updateDoc(doc(db, 'tickets', docSnap.id), { user_department: newUserDep, last_updated: serverTimestamp() });
      updated++;
    }

    return { matched: docs.length, updated, skipped };
  } catch (e) {
    console.error('Department migration failed:', e);
    throw e;
  }
};

window.migrateAssignmentLocationRange = async function(startDateStr, endDateStr) {
  try {
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T23:59:59`);
    const startTS = Timestamp.fromDate(start);
    const endTS = Timestamp.fromDate(end);

    const q1 = query(collection(db, 'tickets'), where('created_at', '>=', startTS), where('created_at', '<=', endTS));
    const q2 = query(collection(db, 'tickets'), where('createdAt', '>=', startTS), where('createdAt', '<=', endTS));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    let docs = [...snap1.docs, ...snap2.docs];
    if (docs.length === 0) {
      const allSnap = await getDocs(collection(db, 'tickets'));
      docs = allSnap.docs.filter(d => {
        const data = d.data();
        let dt = null;
        if (data.created_at && typeof data.created_at.toDate === 'function') dt = data.created_at.toDate();
        else if (data.createdAt && typeof data.createdAt.toDate === 'function') dt = data.createdAt.toDate();
        else if (typeof data.created_at === 'string') dt = new Date(data.created_at);
        else if (typeof data.createdAt === 'string') dt = new Date(data.createdAt);
        if (!dt || isNaN(dt.getTime())) return false;
        return dt >= start && dt <= end;
      });
    }

    let updated = 0, skipped = 0;
    for (const docSnap of docs) {
      const d = docSnap.data();
      if (!d.is_assignment) { skipped++; continue; }
      const assignLoc = (d.assignment_location || '').toString().trim();
      const loc = (d.location || '').toString().trim();
      if (!assignLoc) { skipped++; continue; }

      const newLocation = assignLoc;
      const updatePayload = { location: newLocation, last_updated: serverTimestamp() };

      if (typeof d.assignment_location !== 'undefined') {
        updatePayload.assignment_location = deleteField();
      }

      if (typeof d.message === 'string' && d.message.includes('Location:')) {
        updatePayload.message = d.message.replace(/(Location:\s*)([^|]+)(?=\s*\|?|$)/, `$1${newLocation}`);
      }
      if (typeof d.assignment_message === 'string' && d.assignment_message.includes('Location:')) {
        updatePayload.assignment_message = d.assignment_message.replace(/(Location:\s*)([^|]+)(?=\s*\|?|$)/, `$1${newLocation}`);
      }

      await updateDoc(doc(db, 'tickets', docSnap.id), updatePayload);
      updated++;
    }

    return { matched: docs.length, updated, skipped };
  } catch (e) {
    console.error('Assignment location migration failed:', e);
    throw e;
  }
};

// App Check dihapus: tidak ada inisialisasi App Check di admin

window.normalizeTicketCodes = async function() {
  try {
    const snap = await getDocs(collection(db, 'tickets'));
    const gen = (typeof window !== 'undefined') ? window.generateTicketId : undefined;
    let updated = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (typeof data.code === 'string' && (data.code.startsWith('TKT-') || data.code.indexOf('-') === -1 || data.code.length <= 3)) {
        const dept = data.user_department || data.department || 'Lainlain';
        const device = data.device || 'Others';
        const location = data.location || 'Lainlain';
        const ts = (data.created_at?.toDate ? data.created_at.toDate() : (data.createdAt?.toDate ? data.createdAt.toDate() : new Date()));
        const newCode = gen ? gen(dept, device, location, docSnap.id, ts) : `${dept}-${location}-${device}`;
        await updateDoc(doc(db, 'tickets', docSnap.id), { code: newCode });
        updated++;
      }
    }
    
    return updated;
  } catch (e) {
    console.error('❌ Failed to normalize tickets:', e);
    throw e;
  }
};

window.normalizeTicketStatusAndCode = async function () {
  try {
    const snap = await getDocs(collection(db, 'tickets'));
    const gen = (typeof window !== 'undefined') ? window.generateTicketId : undefined;
    let updated = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();

      const dept = data.user_department || data.department || 'Lainlain';
      const device = data.device || 'Others';
      const location = data.location || 'Lainlain';
      const ts = (data.created_at?.toDate ? data.created_at.toDate() : (data.createdAt?.toDate ? data.createdAt.toDate() : new Date()));

      const needsCodeFix = typeof data.code === 'string' && (data.code.startsWith('TKT-') || data.code.indexOf('-') === -1 || data.code.length <= 3);
      const newCode = needsCodeFix && gen ? gen(dept, device, location, docSnap.id, ts) : (needsCodeFix ? `${dept}-${location}-${device}` : data.code);

      let newStatus = data.status || data.status_ticket || (data.qa === 'Finish' ? 'Resolved' : (data.qa || 'Open'));
      if (newStatus === 'Closed') newStatus = 'Resolved';

      const updatePayload = {};
      if (needsCodeFix) updatePayload.code = newCode;
      if (newStatus && newStatus !== data.status) updatePayload.status = newStatus;

      if (Object.keys(updatePayload).length > 0) {
        await updateDoc(doc(db, 'tickets', docSnap.id), updatePayload);
        updated++;
      }
    }
    
    return updated;
  } catch (e) {
    console.error('❌ Failed to normalize status/code:', e);
    throw e;
  }
};

window.recodeAllTicketCodesWithNewMapping = async function () {
  try {
    const snap = await getDocs(collection(db, 'tickets'));
    const gen = (typeof window !== 'undefined') ? window.generateTicketId : undefined;
    let updated = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const dept = data.user_department || data.department || 'Lainlain';
      const device = data.device || 'Others';
      const location = data.location || 'Lainlain';
      const ts = (data.created_at?.toDate ? data.created_at.toDate() : (data.createdAt?.toDate ? data.createdAt.toDate() : new Date()));
      const newCode = gen ? gen(dept, device, location, docSnap.id, ts) : `${dept}-${location}-${device}`;
      if (typeof data.code !== 'string' || data.code !== newCode) {
        await updateDoc(doc(db, 'tickets', docSnap.id), { code: newCode });
        updated++;
      }
    }
    return updated;
  } catch (e) {
    console.error('❌ Failed to recode all tickets:', e);
    throw e;
  }
};

window.backfillResolvedAt = async function () {
  try {
    const snap = await getDocs(collection(db, 'tickets'));
    let updated = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const hasResolved = !!data.resolved_at;
      if (hasResolved) continue;
      const lu = data.last_updated;
      if (!lu) continue;
      await updateDoc(doc(db, 'tickets', docSnap.id), { resolved_at: lu });
      updated++;
    }
    
    return updated;
  } catch (e) {
    console.error('❌ Backfill resolved_at failed:', e);
    throw e;
  }
};

// Admin Dashboard dengan Permission System
class AdminDashboard {
    constructor() {
        this.adminUser = null;
        this.tickets = [];
        this.assignments = [];
        this.filteredTickets = [];
        this.selectedTickets = new Set();
        this.currentFilters = {
            status: 'all',
            priority: 'all',
            date: {
                startDate: null,
                endDate: null,
                isActive: false
            }
        };
        this.db = db;
        this.auth = auth;
        this.currentUpdatingTicketId = null;
        this.currentModalTicketId = null;
        this.unsubscribe = null;
        this.userUnsubscribe = null;
        this.ticketModalUnsubscribe = null;
        this.ticketUserModalUnsubscribe = null;
        this.assignmentsUnsubAll = null;
        this.assignmentsUnsubMine = null;
        this.assignmentsUnsubMineEmail = null;
        this.pageSize = 10;
        this.lastVisible = null;
        this.hasMoreTickets = true;
        this.isShowingAll = false;
        this.cacheTTL = 60000;
        this.deferRealtimeUntil = 0;

        this.init();
    }

    async init() {
        try {
            const mainElEarly = document.querySelector('.admin-main');
            if (mainElEarly) {
                mainElEarly.style.visibility = 'visible';
            }

            // Bind methods
            this.bindMethods();

            // Check DOM elements
            this.checkDOMElements();

            // Configure per-tab session persistence for admin
            try { await setPersistence(this.auth, browserSessionPersistence); } catch {}

            // Check authentication
            await this.checkAuth();

            // Load admin info
            this.loadAdminInfo();

            // Setup event listeners
            this.initializeEventListeners();
            this.injectSwalStyles();
            
            this.restoreFilters();

            const mainEl = document.querySelector('.admin-main');
            if (mainEl) {
                mainEl.style.visibility = 'visible';
            }

            // Load initial data
            this.isShowingAll = false;
            let usedCache = false;
            try {
                const key = `adminTickets:${this.adminUser?.uid || 'global'}`;
                const cached = JSON.parse(localStorage.getItem(key) || 'null');
                const now = Date.now();
                if (cached && Array.isArray(cached.tickets) && cached.tickets.length && cached.ts && (now - cached.ts) < this.cacheTTL) {
                    this.tickets = cached.tickets;
                    this.applyAllFilters();
                    this.updatePaginationControls();
                    this.deferRealtimeUntil = cached.ts + this.cacheTTL;
                    usedCache = true;
                }
            } catch (_) {}
            if (!usedCache) {
                await this.loadTickets();
            }
            await this.loadAssignments();

            this.setupRealTimeListeners();
            this.setupAssignmentsRealtime();

            if (mainEl) {
                mainEl.classList.add('page-enter-animate');
                mainEl.addEventListener('animationend', function () {
                    mainEl.classList.remove('page-enter-animate');
                }, { once: true });
            }

        } catch (error) {
            console.error('❌ Admin Dashboard init error:', error);
            const mainEl = document.querySelector('.admin-main');
            if (mainEl) {
                mainEl.style.visibility = 'visible';
            }
            this.showNotification('Initialization Error', 'error', error.message);
        }
    }

    injectSwalStyles() {
        try {
            if (document.getElementById('swal-theme')) return;
            const style = document.createElement('style');
            style.id = 'swal-theme';
            style.textContent = `
                .swal2-popup { border-radius: 16px !important; padding: 1.25rem !important; background: var(--white) !important; box-shadow: 0 12px 32px rgba(0,0,0,0.12) !important; width: min(600px, 92vw) !important; font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif !important; }
                .swal2-title { color: var(--black) !important; font-size: 1.25rem !important; font-weight: 600 !important; letter-spacing: .2px !important; }
                .swal2-html-container { color: var(--gray-600) !important; font-size: .95rem !important; line-height: 1.6 !important; text-align: left !important; }
                .swal2-html-container.swal-center { text-align: center !important; }
                .swal2-actions { gap: .5rem !important; }
                .swal2-confirm { background-color: #10b981 !important; color: #ffffff !important; border-radius: 10px !important; padding: .6rem 1rem !important; font-weight: 600 !important; border: none !important; }
                .swal2-cancel, .swal2-deny { background-color: #6b7280 !important; color: #ffffff !important; border-radius: 10px !important; padding: .6rem 1rem !important; font-weight: 600 !important; border: none !important; }
                .swal2-confirm:hover { filter: brightness(0.95) !important; }
                .swal2-cancel:hover, .swal2-deny:hover { filter: brightness(0.9) !important; }
                .swal2-modal .swal2-input, .swal2-modal .swal2-textarea, .swal2-select { border: 1px solid var(--border) !important; border-radius: 10px !important; padding: .55rem .75rem !important; background: var(--surface) !important; color: var(--black) !important; }
                .swal2-modal .swal2-input:focus, .swal2-modal .swal2-textarea:focus, .swal2-select:focus { outline: none !important; border-color: #10b981 !important; }
                .swal2-icon.swal2-success { border-color: #10b981 !important; }
                .swal2-icon.swal2-success [class^=swal2-success-line] { background-color: #10b981 !important; }
                .swal2-icon.swal2-success .swal2-success-ring { border-color: rgba(16,185,129,0.25) !important; }
            `;
            document.head.appendChild(style);
        } catch {}
    }

    // ✅ METHOD BINDING - TERPUSAT
    bindMethods() {
        this.handleTableClick = this.handleTableClick.bind(this);
        this.handleSelectionChange = this.handleSelectionChange.bind(this);
        this.selectAllVisibleTickets = this.selectAllVisibleTickets.bind(this);
        this.bulkDeleteSelected = this.bulkDeleteSelected.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        this.handleDateChange = this.handleDateChange.bind(this);
        this.handleTodayClick = this.handleTodayClick.bind(this);
        this.handleThisMonthClick = this.handleThisMonthClick.bind(this);
        this.handleClearDateClick = this.handleClearDateClick.bind(this);
        this.applyAllFilters = this.applyAllFilters.bind(this);
        this.filterTickets = this.filterTickets.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleManageTeam = this.handleManageTeam.bind(this);
        this.showNotification = this.showNotification.bind(this);
        this.updateBulkDeleteVisibility = this.updateBulkDeleteVisibility.bind(this);
        this.loadMoreTickets = this.loadMoreTickets.bind(this);
        this.loadAllTickets = this.loadAllTickets.bind(this);
        this.resetTicketsView = this.resetTicketsView.bind(this);
        this.updatePaginationControls = this.updatePaginationControls.bind(this);
    }

    // ✅ NOTIFICATION SYSTEM
    showNotification(title, type = 'info', message = '', duration = 5000) {
        try {
            // Remove existing notification
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

            // Auto remove after duration
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

        } catch (error) {
            console.error('❌ Error showing notification:', error);
        }
    }

    hideNotification(notification) {
        if (!notification || !notification.parentNode) return;

        notification.classList.add('notification-hiding');

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // ✅ AUTHENTICATION & PERMISSION SYSTEM
    async checkAuth() {
        try {
            const firebaseUser = await new Promise((resolve) => {
                const unsub = onAuthStateChanged(this.auth, (u) => {
                    unsub();
                    resolve(u);
                });
            });

            if (!firebaseUser) {
                localStorage.removeItem('adminUser');
                window.location.href = 'login.html';
                return;
            }

            let adminSnap = await getDoc(doc(this.db, 'admins', firebaseUser.uid));
            if (!adminSnap.exists() || adminSnap.data().is_active === false) {
                try {
                    const q = query(collection(this.db, 'admins'), where('email', '==', firebaseUser.email));
                    const byEmail = await getDocs(q);
                    if (!byEmail.empty) {
                        const found = byEmail.docs[0];
                        const data = found.data();
                        await setDoc(doc(this.db, 'admins', firebaseUser.uid), {
                            ...data,
                            uid: firebaseUser.uid,
                            migrated_from: found.id,
                            last_updated: new Date().toISOString()
                        });
                        try { await deleteDoc(doc(this.db, 'admins', found.id)); } catch (e) {}
                        this.adminUser = { uid: firebaseUser.uid, ...data };
                        localStorage.setItem('adminUser', JSON.stringify(this.adminUser));
                        console.info('Current admin user:', { uid: this.adminUser.uid, email: this.adminUser.email, role: this.adminUser.role, is_active: this.adminUser.is_active });
                        return;
                    }
                    // Jika tidak ditemukan, paksa buat minimal admin record
                    try {
                        await firebaseAuthService.ensureAdminRecord(firebaseUser.uid, firebaseUser.email || '');
                        adminSnap = await getDoc(doc(this.db, 'admins', firebaseUser.uid));
                        if (adminSnap.exists()) {
                            this.adminUser = { uid: firebaseUser.uid, ...adminSnap.data() };
                            localStorage.setItem('adminUser', JSON.stringify(this.adminUser));
                            console.info('Current admin user:', { uid: this.adminUser.uid, email: this.adminUser.email, role: this.adminUser.role, is_active: this.adminUser.is_active });
                            return;
                        }
                    } catch (_) {}
                } catch (e) {}
                // Teruskan dengan sesi minimal agar UI tetap berjalan
                this.adminUser = { uid: firebaseUser.uid, email: firebaseUser.email || '', role: 'Admin', is_active: true };
                localStorage.setItem('adminUser', JSON.stringify(this.adminUser));
                console.info('Current admin user:', { uid: this.adminUser.uid, email: this.adminUser.email, role: this.adminUser.role, is_active: this.adminUser.is_active });
                // lanjut
            }

            this.adminUser = { uid: firebaseUser.uid, ...adminSnap.data() };
            localStorage.setItem('adminUser', JSON.stringify(this.adminUser));
            console.info('Current admin user:', { uid: this.adminUser.uid, email: this.adminUser.email, role: this.adminUser.role, is_active: this.adminUser.is_active });
        } catch (error) {
            console.error('Admin auth check failed:', error);
            // Gunakan sesi minimal jika auth sudah ada
            try {
                const u = await new Promise((resolve) => {
                    const unsub = onAuthStateChanged(this.auth, (x) => { unsub(); resolve(x); });
                });
                if (u) {
                    this.adminUser = { uid: u.uid, email: u.email || '', role: 'Admin', is_active: true };
                    localStorage.setItem('adminUser', JSON.stringify(this.adminUser));
                    return;
                }
            } catch (_) {}
            localStorage.removeItem('adminUser');
            window.location.href = 'login.html';
        }
    }

    // ✅ PERMISSION METHODS
    canDeleteTicket(ticket) {
        if (this.adminUser.role === 'Super Admin') return true;
        return this.isAssignedToCurrentAdmin(ticket);
    }

    canStartTicket(ticket) {
        if (ticket.status !== 'Open') return false;
        if (this.adminUser.role === 'Super Admin') return true;

        const isUnassigned = !ticket.action_by && !ticket.assigned_to;
        const isAssignedToMe = this.isAssignedToCurrentAdmin(ticket);

        return isUnassigned || isAssignedToMe;
    }

    canResolveTicket(ticket) {
        if (ticket.status !== 'In Progress') return false;
        if (this.adminUser.role === 'Super Admin') return true;
        return this.isAssignedToCurrentAdmin(ticket);
    }

    canReopenTicket(ticket) {
        if (ticket.status !== 'Resolved') return false;
        if (this.adminUser.role === 'Super Admin') return true;
        return this.isAssignedToCurrentAdmin(ticket);
    }

    canTakeTicket(ticket) {
        const scope = (ticket && (ticket.assignment_scope || ticket.scope || '')).toLowerCase();
        if (ticket && ticket.is_assignment && scope === 'all') {
            const alreadyTakenByMe = Array.isArray(ticket.taken_by) && ticket.taken_by.includes(this.adminUser?.uid);
            if (alreadyTakenByMe) return false;
            return true;
        }
        return !ticket.action_by && !ticket.assigned_to;
    }

    canUpdateTicket(ticket) {
        if (this.adminUser.role === 'Super Admin') return true;
        return this.isAssignedToCurrentAdmin(ticket);
    }

    canReleaseTicket(ticket) {
        if (this.adminUser.role === 'Super Admin') return true;
        return this.isAssignedToCurrentAdmin(ticket) && ticket.status !== 'Resolved';
    }

    isAssignedToCurrentAdmin(ticket) {
        // Check by UID
        if (ticket.action_by === this.adminUser.uid || ticket.assigned_to === this.adminUser.uid) {
            return true;
        }

        // Check broadcast/target assignment fields
        if ((ticket.target_admin_uid && ticket.target_admin_uid === this.adminUser.uid)) {
            return true;
        }

        // Check by name (compatibility)
        if (this.adminUser.name &&
            (ticket.action_by === this.adminUser.name || ticket.assigned_to === this.adminUser.name)) {
            return true;
        }

        // Check by email (fallback)
        if (this.adminUser.email &&
            (ticket.action_by === this.adminUser.email || ticket.assigned_to === this.adminUser.email || ticket.target_admin_email === this.adminUser.email)) {
            return true;
        }

        // Check if taken_by includes current admin
        if (Array.isArray(ticket.taken_by) && ticket.taken_by.includes(this.adminUser.uid)) {
            return true;
        }

        return false;
    }

    checkPermissions(ticket) {
        const isTicketOwner = this.isAssignedToCurrentAdmin(ticket);
        return {
            canDelete: this.canDeleteTicket(ticket),
            canReopen: this.canReopenTicket(ticket),
            canTake: this.canTakeTicket(ticket),
            canUpdate: this.canUpdateTicket(ticket),
            canStart: this.canStartTicket(ticket),
            canResolve: this.canResolveTicket(ticket),
            canRelease: this.canReleaseTicket(ticket),
            isSuperAdmin: this.adminUser.role === 'Super Admin',
            isTicketOwner: isTicketOwner
        };
    }

    // ✅ DOM & EVENT MANAGEMENT
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

        

        for (const [name, element] of Object.entries(requiredElements)) {
            if (!element) {
                console.error(`❌ Missing DOM element: ${name}`);
            }
        }

        return requiredElements;
    }

    initializeEventListeners() {
        

        // Logout
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout);
        }

        // Manage Team
        const manageTeamBtn = document.getElementById('manageTeamBtn');
        if (manageTeamBtn) {
            manageTeamBtn.addEventListener('click', this.handleManageTeam);
        }

        // Filters
        const statusFilter = document.getElementById('statusFilter');
        const priorityFilter = document.getElementById('priorityFilter');

        if (statusFilter) statusFilter.addEventListener('change', this.filterTickets);
        if (priorityFilter) priorityFilter.addEventListener('change', this.filterTickets);

        // Date Filters
        this.initializeDateFilter();

        // Modal close
        const closeModalBtn = document.getElementById('closeTicketModal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.closeTicketModal());
        }

        // Table click delegation
        const tableBody = document.getElementById('ticketsTableBody');
        if (tableBody) {
            tableBody.addEventListener('click', this.handleTableClick);
            tableBody.addEventListener('change', this.handleSelectionChange);
        }

        // Export button
        const exportBtn = document.getElementById('exportTickets');
        if (exportBtn) {
            exportBtn.addEventListener('click', this.handleExport);
        }

        // Bulk selection controls
        const selectAll = document.getElementById('selectAllTickets');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => this.selectAllVisibleTickets(e.target.checked));
        }
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', this.bulkDeleteSelected);
        }
        const bulkDeleteFloating = document.getElementById('bulkDeleteFloating');
        if (bulkDeleteFloating) {
            bulkDeleteFloating.addEventListener('click', this.bulkDeleteSelected);
        }

        this.updateBulkDeleteVisibility();

        const showMoreBtn = document.getElementById('showMoreTickets');
        if (showMoreBtn) {
            showMoreBtn.addEventListener('click', this.loadMoreTickets);
        }
        const showAllBtn = document.getElementById('showAllTickets');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', this.loadAllTickets);
        }
        const resetViewBtn = document.getElementById('resetTicketsView');
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', this.resetTicketsView);
        }
    }

    initializeDateFilter() {
        

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const todayBtn = document.getElementById('todayBtn');
        const thisMonthBtn = document.getElementById('thisMonthBtn');
        const clearDateBtn = document.getElementById('clearDateBtn');

        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', this.handleDateChange);
            endDateInput.addEventListener('change', this.handleDateChange);
        }

        if (todayBtn) todayBtn.addEventListener('click', this.handleTodayClick);
        if (thisMonthBtn) thisMonthBtn.addEventListener('click', this.handleThisMonthClick);
        if (clearDateBtn) clearDateBtn.addEventListener('click', this.handleClearDateClick);

        
    }

    // ✅ FILTER SYSTEM
    applyAllFilters() {
        

        // Get current filter values
        const statusFilter = document.getElementById('statusFilter');
        const priorityFilter = document.getElementById('priorityFilter');

        // Update current filters state
        this.currentFilters.status = statusFilter ? statusFilter.value : 'all';
        this.currentFilters.priority = priorityFilter ? priorityFilter.value : 'all';

        

        // Apply all filters sequentially
        let filtered = [...this.tickets];

        // Exclude deleted/archived tickets first
        filtered = filtered.filter(t => !t.deleted && !t.archived);

        // 1. Apply status filter
        if (this.currentFilters.status !== 'all') {
            filtered = filtered.filter(ticket => ticket.status === this.currentFilters.status);
        }

        // 2. Apply priority filter
        if (this.currentFilters.priority !== 'all') {
            filtered = filtered.filter(ticket => ticket.priority === this.currentFilters.priority);
        }

        // 3. Apply date filter (only if valid)
        if (this.currentFilters.date.isActive) {
            filtered = this.applyDateFilter(filtered);
        }

        // Fallback: jika hasil filter kosong tetapi data ada, tampilkan semua
        if (filtered.length === 0 && this.tickets.length > 0) {
            filtered = [...this.tickets];
        }

        // 4. Admin dapat melihat semua tiket; filter di atas sudah cukup

        this.filteredTickets = filtered;
        this.renderTickets();
        this.updateStats();

        this.persistFilters();

        
    }

    persistFilters() {
        try {
            const payload = {
                status: this.currentFilters.status,
                priority: this.currentFilters.priority,
                date: {
                    startDate: this.currentFilters.date.startDate ? this.currentFilters.date.startDate.toISOString() : null,
                    endDate: this.currentFilters.date.endDate ? this.currentFilters.date.endDate.toISOString() : null,
                    isActive: !!this.currentFilters.date.isActive
                }
            };
            const key = `adminFilters:${this.adminUser?.uid || 'global'}`;
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {}
    }

    setFilterUIFromState() {
        try {
            const statusFilter = document.getElementById('statusFilter');
            const priorityFilter = document.getElementById('priorityFilter');
            const startDateInput = document.getElementById('startDate');
            const endDateInput = document.getElementById('endDate');

            if (statusFilter && this.currentFilters.status) statusFilter.value = this.currentFilters.status;
            if (priorityFilter && this.currentFilters.priority) priorityFilter.value = this.currentFilters.priority;

            if (startDateInput && this.currentFilters.date.startDate) {
                const d = new Date(this.currentFilters.date.startDate.getTime() - this.currentFilters.date.startDate.getTimezoneOffset() * 60000);
                startDateInput.value = d.toISOString().split('T')[0];
            }
            if (endDateInput && this.currentFilters.date.endDate) {
                const d = new Date(this.currentFilters.date.endDate.getTime() - this.currentFilters.date.endDate.getTimezoneOffset() * 60000);
                endDateInput.value = d.toISOString().split('T')[0];
            }
        } catch (e) {}
    }

    restoreFilters() {
        try {
            const key = `adminFilters:${this.adminUser?.uid || 'global'}`;
            let raw = localStorage.getItem(key);
            if (!raw) raw = localStorage.getItem('adminFilters');
            if (!raw) return;
            const saved = JSON.parse(raw);
            const parseDate = (v) => {
                if (!v) return null;
                const d = new Date(v);
                return (d instanceof Date && !isNaN(d.getTime())) ? d : null;
            };
            const startDate = parseDate(saved?.date?.startDate);
            const endDate = parseDate(saved?.date?.endDate);
            this.currentFilters = {
                status: saved?.status || 'all',
                priority: saved?.priority || 'all',
                date: {
                    startDate: startDate,
                    endDate: endDate,
                    isActive: !!(startDate || endDate)
                }
            };
            this.setFilterUIFromState();
        } catch (e) {}
    }

    applyDateFilter(tickets) {
        if (!this.currentFilters.date.isActive) return tickets;

        const { startDate, endDate } = this.currentFilters.date;
        const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());
        const hasStart = isValidDate(startDate);
        const hasEnd = isValidDate(endDate);
        if (!hasStart && !hasEnd) return tickets;

        return tickets.filter(ticket => {
            let ticketDate = null;
            if (ticket.created_at) {
                const d1 = new Date(ticket.created_at);
                if (!isNaN(d1.getTime())) ticketDate = d1;
            }
            if (!ticketDate && ticket.last_updated) {
                const d2 = new Date(ticket.last_updated);
                if (!isNaN(d2.getTime())) ticketDate = d2;
            }
            if (!ticketDate) return false;

            // Case 1: Both start and end date provided
            if (hasStart && hasEnd) {
                const startOfDay = new Date(startDate);
                startOfDay.setHours(0, 0, 0, 0);

                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);

                return ticketDate >= startOfDay && ticketDate <= endOfDay;
            }

            // Case 2: Only start date provided
            if (hasStart && !hasEnd) {
                const startOfDay = new Date(startDate);
                startOfDay.setHours(0, 0, 0, 0);
                return ticketDate >= startOfDay;
            }

            // Case 3: Only end date provided
            if (!hasStart && hasEnd) {
                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);
                return ticketDate <= endOfDay;
            }

            return true;
        });
    }

    handleDateChange() {

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (!startDateInput || !endDateInput) {
            console.error('❌ Date input elements not found');
            return;
        }

        const parseInputDate = (v) => {
            if (!v) return null;
            const d = new Date(v);
            return (d instanceof Date && !isNaN(d.getTime())) ? d : null;
        };
        const startDate = parseInputDate(startDateInput.value);
        const endDate = parseInputDate(endDateInput.value);

        // Validation: end date cannot be before start date
        if (startDate && endDate && endDate < startDate) {
            this.showNotification('Date Error', 'error', 'End date cannot be before start date');
            endDateInput.value = '';
            return;
        }

        // Update date filter
        this.currentFilters.date = {
            startDate: startDate,
            endDate: endDate,
            isActive: !!(startDate || endDate)
        };

        

        // Apply combined filters
        this.applyAllFilters();
    }

    handleTodayClick() {
        

        const today = new Date();
        const todayString = today.toISOString().split('T')[0];

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (startDateInput && endDateInput) {
            startDateInput.value = todayString;
            endDateInput.value = todayString;

            const startOfToday = new Date(today);
            startOfToday.setHours(0, 0, 0, 0);

            const endOfToday = new Date(today);
            endOfToday.setHours(23, 59, 59, 999);

            this.currentFilters.date = {
                startDate: startOfToday,
                endDate: endOfToday,
                isActive: true
            };

            this.applyAllFilters();
            this.showNotification('Date Filter', 'info', 'Showing tickets for today');
        }
    }

    handleThisMonthClick() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (startDateInput && endDateInput) {
            const toISODate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
            startDateInput.value = toISODate(start);
            endDateInput.value = toISODate(end);

            const startOfMonth = new Date(start);
            startOfMonth.setHours(0, 0, 0, 0);

            const endOfMonth = new Date(end);
            endOfMonth.setHours(23, 59, 59, 999);

            this.currentFilters.date = {
                startDate: startOfMonth,
                endDate: endOfMonth,
                isActive: true
            };

            this.applyAllFilters();
            this.showNotification('Date Filter', 'info', 'Showing tickets for this month');
        }
    }

    handleClearDateClick() {
        

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const todayBtn = document.getElementById('todayBtn');
        const statusFilter = document.getElementById('statusFilter');
        const priorityFilter = document.getElementById('priorityFilter');

        // Clear date inputs
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';

        // Remove any today active indicator
        if (todayBtn && todayBtn.classList) {
            todayBtn.classList.remove('active');
        }

        // Reset selects to 'all' if available
        if (statusFilter) statusFilter.value = 'all';
        if (priorityFilter) priorityFilter.value = 'all';

        // Reset internal filter state
        this.currentFilters = {
            status: 'all',
            priority: 'all',
            date: {
                startDate: null,
                endDate: null,
                isActive: false
            }
        };

        this.applyAllFilters();
        this.showNotification('Filters', 'info', 'All filters have been reset');
    }

    filterTickets() {
        
        this.applyAllFilters();
    }

    // ✅ DATA MANAGEMENT
    async loadTickets() {
        try {
            

            let querySnapshot;
            try {
                const baseQuery = query(collection(this.db, "tickets"), orderBy("created_at", "desc"));
                if (this.isShowingAll) {
                    querySnapshot = await getDocs(baseQuery);
                } else {
                    querySnapshot = await getDocs(query(baseQuery, limit(this.pageSize)));
                }
            } catch (e) {
                console.warn('Fallback tickets query without orderBy due to error:', e?.message || e);
                querySnapshot = await getDocs(collection(this.db, 'tickets'));
            }
            // If empty, try fallback without orderBy
            if (!querySnapshot || querySnapshot.docs.length === 0) {
                // Coba pastikan admin record lalu ulangi sekali
                try { if (this.adminUser?.uid) await firebaseAuthService.ensureAdminRecord(this.adminUser.uid, this.adminUser.email || ''); } catch (_) {}
                const fallbackSnap = await getDocs(collection(this.db, 'tickets'));
                querySnapshot = fallbackSnap;
            }
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

            allTickets.sort((a, b) => {
                const da = a.created_at ? new Date(a.created_at).getTime() : 0;
                const db = b.created_at ? new Date(b.created_at).getTime() : 0;
                return db - da;
            });

            this.tickets = allTickets;
            this.updateGlobalTicketsData();
            try {
                const key = `adminTickets:${this.adminUser?.uid || 'global'}`;
                const cache = { ts: Date.now(), tickets: this.tickets.slice(0, 100) };
                localStorage.setItem(key, JSON.stringify(cache));
            } catch (_) {}

            // Cascade soft-delete for broadcast assignments deleted by users
            const broadcastsToCascade = allTickets.filter(t => t.is_assignment && ((t.assignment_scope || t.scope || '').toLowerCase() === 'all') && t.deleted && !t.cascade_deleted_children);
            if (broadcastsToCascade.length > 0) {
                for (const b of broadcastsToCascade) {
                    try {
                        const cq = query(collection(this.db, 'tickets'), where('source_assignment_id', '==', b.id));
                        const csnap = await getDocs(cq);
                        const updates = [];
                        csnap.forEach(ds => {
                            const cref = doc(this.db, 'tickets', ds.id);
                            updates.push(updateDoc(cref, { deleted: true, deleted_at: serverTimestamp(), last_updated: serverTimestamp() }));
                        });
                        if (updates.length > 0) {
                            await Promise.all(updates);
                        }
                        const bref = doc(this.db, 'tickets', b.id);
                        await updateDoc(bref, { cascade_deleted_children: true, last_updated: serverTimestamp() });
                    } catch (e) {
                        console.error('Cascade delete failed for broadcast', b.id, e);
                    }
                }
            }

            this.lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
            this.hasMoreTickets = !this.isShowingAll && querySnapshot.docs.length === this.pageSize;
            console.info('Loaded tickets:', this.tickets.length);
            // Jika masih kosong, coba fetch spesifik untuk admin yang login
            if ((!Array.isArray(this.tickets) || this.tickets.length === 0) && this.adminUser) {
                try {
                    const uid = this.adminUser.uid;
                    const email = this.adminUser.email || '';
                    const queries = [
                        query(collection(this.db, 'tickets'), where('assigned_to', '==', uid)),
                        query(collection(this.db, 'tickets'), where('action_by', '==', uid)),
                        query(collection(this.db, 'tickets'), where('target_admin_uid', '==', uid)),
                        ...(email ? [query(collection(this.db, 'tickets'), where('target_admin_email', '==', email))] : [])
                    ];
                    const snaps = await Promise.all(queries.map(q => getDocs(q).catch(() => null)));
                    const targeted = [];
                    for (const s of snaps) {
                        if (!s) continue;
                        s.forEach(docSnap => {
                            const data = docSnap.data();
                            const t = this.normalizeTicketData(docSnap.id, data);
                            targeted.push(t);
                        });
                    }
                    if (targeted.length > 0) {
                        // Hilangkan duplikat id
                        const map = new Map();
                        for (const t of targeted) map.set(t.id, t);
                        this.tickets = Array.from(map.values()).sort((a,b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
                        this.updateGlobalTicketsData();
                    }
                } catch (e) {
                    console.warn('Targeted fetch failed:', e?.message || e);
                }
            }
            this.applyAllFilters();
            this.updatePaginationControls();

            

        } catch (error) {
            console.error('❌ Error loading tickets:', error);
            // Jika permission denied, pastikan admin record lalu coba sekali lagi
            try {
                if (this.adminUser?.uid) {
                    const ok = await firebaseAuthService.ensureAdminRecord(this.adminUser.uid, this.adminUser.email || '');
                    if (ok) {
                        try {
                            const snap2 = await getDocs(collection(this.db, 'tickets'));
                            const allTickets = [];
                            snap2.forEach((docSnap) => {
                                try {
                                    const data = docSnap.data();
                                    const ticket = this.normalizeTicketData(docSnap.id, data);
                                    allTickets.push(ticket);
                                } catch {}
                            });
                            allTickets.sort((a,b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
                            this.tickets = allTickets;
                            this.updateGlobalTicketsData();
                            this.applyAllFilters();
                            this.updatePaginationControls();
                            return;
                        } catch (e2) {
                            console.warn('Retry load tickets failed:', e2?.message || e2);
                        }
                    }
                }
            } catch (_) {}
            this.showNotification('Data Error', 'error', 'Failed to load tickets');
        }
    }

    updatePaginationControls() {
        const moreBtn = document.getElementById('showMoreTickets');
        const allBtn = document.getElementById('showAllTickets');
        if (moreBtn) {
            moreBtn.disabled = !this.hasMoreTickets;
        }
        if (allBtn) {
            allBtn.disabled = this.isShowingAll;
        }
    }

    async loadMoreTickets() {
        try {
            if (!this.hasMoreTickets || !this.lastVisible) return;
            const baseQuery = query(collection(this.db, "tickets"), orderBy("created_at", "desc"));
            const snap = await getDocs(query(baseQuery, startAfter(this.lastVisible), limit(this.pageSize)));
            const newTickets = [];
            snap.forEach((docSnap) => {
                try {
                    const data = docSnap.data();
                    const ticket = this.normalizeTicketData(docSnap.id, data);
                    newTickets.push(ticket);
                } catch {}
            });
            this.tickets = this.tickets.concat(newTickets);
            this.updateGlobalTicketsData();
            this.lastVisible = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : this.lastVisible;
            this.hasMoreTickets = snap.docs.length === this.pageSize;
            this.applyAllFilters();
            this.updatePaginationControls();
        } catch (e) {
            console.error('❌ Error loading more tickets:', e);
        }
    }

    async loadAllTickets() {
        try {
            this.isShowingAll = true;
            await this.loadTickets();
        } catch (e) {
            console.error('❌ Error loading all tickets:', e);
        }
    }

    async resetTicketsView() {
        try {
            this.isShowingAll = false;
            await this.loadTickets();
        } catch (e) {
            console.error('❌ Error resetting tickets view:', e);
        }
    }

    parseDateToISO(v) {
        try {
            if (!v) return null;
            if (v?.toDate && typeof v.toDate === 'function') {
                return v.toDate().toISOString();
            }
            if (v instanceof Date) {
                return v.toISOString();
            }
            const s = String(v);
            let d = new Date(s);
            if (!isNaN(d.getTime())) return d.toISOString();
            const t = s.replace(' at ', ' ').replace(/ UTC[+\-]\d+/i, '');
            d = new Date(t);
            if (!isNaN(d.getTime())) return d.toISOString();
            const m = Date.parse(t);
            if (!isNaN(m)) return new Date(m).toISOString();
            return null;
        } catch { return null; }
    }

    normalizeTicketData(id, data) {
        try {
            const created_at = this.parseDateToISO(data.created_at) || this.parseDateToISO(data.createdAt) || new Date().toISOString();
            const last_updated = this.parseDateToISO(data.last_updated) || this.parseDateToISO(data.updatedAt) || created_at;
            const resolved_at = this.parseDateToISO(data.resolved_at) || null;

            return {
                id: id || '',
                code: data.code || 'UNKNOWN',
                subject: data.subject || 'No Subject',
                user_name: data.user_name || 'Unknown User',
                user_email: data.user_email || '',
                user_department: data.user_department || '',
                location: data.location || '',
                activity: (data.assignment_activity || data.activity || ''),
                assignment_activity: (data.assignment_activity || ''),
                is_assignment: !!data.is_assignment,
                assignment_scope: data.assignment_scope || data.scope || '',
                target_admin_uid: data.target_admin_uid || '',
                target_admin_email: data.target_admin_email || '',
                created_by_name: data.created_by_name || data.created_by_email || data.user_name || '',
                created_by_email: data.created_by_email || '',
                created_by_uid: data.created_by_uid || '',
                inventory: data.inventory || '',
                device: data.device || '',
                message: data.message || '',
                priority: data.priority || 'Medium',
                status: data.status || data.status_ticket || (data.qa === 'Finish' ? 'Resolved' : (data.qa || 'Open')),
                created_at: created_at,
                last_updated: last_updated,
                resolved_at: resolved_at,
                action_by: data.action_by || '',
                assigned_to: data.assigned_to || '',
                assigned_name: data.assigned_name || '',
                note: data.note || '',
                qa: data.qa || '',
                user_phone: data.user_phone || '',
                updates: Array.isArray(data.updates) ? data.updates : [],
                taken_by: Array.isArray(data.taken_by) ? data.taken_by : [],
                user_id: data.user_id || '',
                deleted: !!data.deleted,
                archived: !!data.archived,
                cascade_deleted_children: !!data.cascade_deleted_children
            };
        } catch (error) {
            console.error(`❌ Error normalizing ticket ${id}:`, error);
            return this.createErrorTicket(id);
        }
    }

    createErrorTicket(id) {
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

    // ✅ REAL-TIME LISTENERS
    setupRealTimeListeners() {
        this.setupTicketsRealTimeListener();
        this.setupUserDataListener();
        this.setupAdminDataListener();
    }

    async loadAssignments() {
        try {
            if (!this.adminUser) return;
            const listEl = document.getElementById('assignmentsList');
            if (listEl) {
                listEl.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading assignments...</p>
                    </div>
                `;
            }
            const mineTicketsQ = query(collection(this.db, 'tickets'), where('is_assignment', '==', true), where('target_admin_uid', '==', this.adminUser.uid));
            const mineTicketsEmailQ = query(collection(this.db, 'tickets'), where('is_assignment', '==', true), where('target_admin_email', '==', this.adminUser.email));
            const allTicketsQ = query(collection(this.db, 'tickets'), where('is_assignment', '==', true), where('assignment_scope', '==', 'all'));
            const [mt, mte, at] = await Promise.all([
                getDocs(mineTicketsQ), getDocs(mineTicketsEmailQ), getDocs(allTicketsQ)
            ]);
            const items = [];
            const toItem = (docSnap) => {
                const d = docSnap.data();
                return {
                    id: docSnap.id,
                    activity: d.assignment_activity || d.activity || '',
                    location: d.assignment_location || d.location || '',
                    scope: d.assignment_scope || d.scope || 'single',
                    priority: d.priority || 'Medium',
                    created_at: d.created_at?.toDate ? d.created_at.toDate() : null,
                    created_by_name: d.created_by_name || d.created_by_email || '',
                    target_uid: d.target_admin_uid || null,
                    target_email: d.target_admin_email || null,
                    subject: d.assignment_subject || d.subject || '',
                    message: d.assignment_message || d.message || ''
                };
            };
            mt.forEach(ds => items.push(toItem(ds)));
            mte.forEach(ds => items.push(toItem(ds)));
            at.forEach(ds => items.push(toItem(ds)));
            // Filter only assignments for current admin or ALL
            const filtered = items.filter(a => a.scope === 'all' || a.target_uid === this.adminUser.uid || a.target_email === this.adminUser.email);
            // Sort newest first
            filtered.sort((a,b) => (b.created_at?.getTime()||0) - (a.created_at?.getTime()||0));
            this.assignments = filtered;
            this.renderAssignments();
        } catch (err) {
            console.error('Error loading assignments:', err);
        }
    }

    setupAssignmentsRealtime() {
        try {
            if (!this.adminUser) return;
            if (this.assignmentsUnsubAll) this.assignmentsUnsubAll();
            if (this.assignmentsUnsubMine) this.assignmentsUnsubMine();
            if (this.assignmentsUnsubMineEmail) this.assignmentsUnsubMineEmail();

            const mineTicketsQ = query(collection(this.db, 'tickets'), where('is_assignment', '==', true), where('target_admin_uid', '==', this.adminUser.uid));
            const mineTicketsEmailQ = query(collection(this.db, 'tickets'), where('is_assignment', '==', true), where('target_admin_email', '==', this.adminUser.email));
            const allTicketsQ = query(collection(this.db, 'tickets'), where('is_assignment', '==', true), where('assignment_scope', '==', 'all'));
            this.assignmentsUnsubMine = onSnapshot(mineTicketsQ, (snap) => {
                const arr = [];
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                        arr.push({
                            id: docSnap.id,
                            activity: d.assignment_activity || d.activity || '',
                            location: d.assignment_location || d.location || '',
                            scope: d.assignment_scope || d.scope || 'single',
                            priority: d.priority || 'Medium',
                            created_at: d.created_at?.toDate ? d.created_at.toDate() : null,
                            created_by_name: d.created_by_name || d.created_by_email || '',
                            subject: d.assignment_subject || d.subject || '',
                            message: d.assignment_message || d.message || ''
                        });
                    });
                this.mergeAssignments(arr);
            });
            const handleEmailSnap = (snap) => {
                const arr = [];
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                        arr.push({
                            id: docSnap.id,
                            activity: d.assignment_activity || d.activity || '',
                            location: d.assignment_location || d.location || '',
                            scope: d.assignment_scope || d.scope || 'single',
                            priority: d.priority || 'Medium',
                            created_at: d.created_at?.toDate ? d.created_at.toDate() : null,
                            created_by_name: d.created_by_name || d.created_by_email || '',
                            subject: d.assignment_subject || d.subject || '',
                            message: d.assignment_message || d.message || ''
                        });
                    });
                this.mergeAssignments(arr);
            };
            this.assignmentsUnsubMineEmail = onSnapshot(mineTicketsEmailQ, handleEmailSnap);
            this.assignmentsUnsubAll = onSnapshot(allTicketsQ, (snap) => {
                const arr = [];
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                        arr.push({
                            id: docSnap.id,
                            activity: d.assignment_activity || d.activity || '',
                            location: d.assignment_location || d.location || '',
                            scope: d.assignment_scope || d.scope || 'all',
                            priority: d.priority || 'Medium',
                            created_at: d.created_at?.toDate ? d.created_at.toDate() : null,
                            created_by_name: d.created_by_name || d.created_by_email || '',
                            subject: d.assignment_subject || d.subject || '',
                            message: d.assignment_message || d.message || ''
                        });
                    });
                this.mergeAssignments(arr);
            });
        } catch (err) {
            console.error('Error setting assignments realtime:', err);
        }
    }

    mergeAssignments(newItems) {
        const map = new Map(this.assignments.map(a => [a.id, a]));
        newItems.forEach(item => { map.set(item.id, item); });
        const merged = Array.from(map.values());
        const filtered = merged.filter(a => a.scope === 'all' || a.target_uid === this.adminUser.uid || a.target_email === this.adminUser.email);
        this.assignments = filtered.sort((a,b) => (b.created_at?.getTime()||0) - (a.created_at?.getTime()||0));
        this.renderAssignments();
    }

    renderAssignments() {
        const listEl = document.getElementById('assignmentsList');
        if (!listEl) return;
        if (!this.assignments || this.assignments.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No assignments</h3>
                    <p>Assignments created by IT will appear here</p>
                </div>
            `;
            return;
        }
        const html = this.assignments.map(a => {
            const date = a.created_at ? a.created_at.toLocaleString() : '';
            const subject = a.subject ? this.escapeHtml(a.subject) : '';
            const message = a.message ? this.escapeHtml(a.message) : '';
            return `
                <div class="ticket-item">
                    <div class="ticket-content">
                        <div class="ticket-header">
                            <div class="ticket-code">${a.activity}</div>
                            <div class="ticket-priority">
                                ${a.scope === 'all' ? 'All IT' : 'You'}
                                <span class="priority-badge priority-${(a.priority||'Medium').toLowerCase()}">${a.priority||'Medium'}</span>
                            </div>
                        </div>
                        <h4 class="ticket-subject">Location: ${a.location}</h4>
                        ${subject ? `<div class="ticket-meta"><strong>Subject:</strong> ${subject}</div>` : ''}
                        ${message ? `<div class="ticket-meta"><strong>Message:</strong> ${message}</div>` : ''}
                        <div class="ticket-meta">
                            <span class="ticket-date">${date}</span>
                            <span class="ticket-device">Created by: ${a.created_by_name}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        listEl.innerHTML = html;
    }

    setupTicketsRealTimeListener() {
        try {
            const now = Date.now();
            if (this.deferRealtimeUntil && now < this.deferRealtimeUntil) {
                const delay = this.deferRealtimeUntil - now;
                setTimeout(() => { try { this.setupTicketsRealTimeListener(); } catch (_) {} }, delay);
                return;
            }
            try {
                const q = query(collection(this.db, "tickets"), orderBy("created_at", "desc"), limit(this.pageSize));
                this.unsubscribe = onSnapshot(q, (snapshot) => {
                    const newTickets = [];
                    snapshot.forEach((docSnap) => {
                        try {
                            const data = docSnap.data();
                            const t = this.normalizeTicketData(docSnap.id, data);
                            newTickets.push(t);
                        } catch {}
                    });
                    newTickets.sort((a,b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
                    this.tickets = newTickets;
                    this.updateGlobalTicketsData();
                    try {
                        const key = `adminTickets:${this.adminUser?.uid || 'global'}`;
                        const cache = { ts: Date.now(), tickets: this.tickets.slice(0, 100) };
                        localStorage.setItem(key, JSON.stringify(cache));
                    } catch (_) {}
                    this.lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
                    this.hasMoreTickets = !this.isShowingAll && snapshot.docs.length === this.pageSize;
                    this.applyAllFilters();
                    this.updatePaginationControls();
                }, (error) => {
                    console.warn('Realtime listener error, switching to fallback:', error?.message || error);
                    if (this.unsubscribe) this.unsubscribe();
                    this.unsubscribe = onSnapshot(collection(this.db, 'tickets'), (snap) => {
                        const arr = [];
                        snap.forEach((ds) => { try { arr.push(this.normalizeTicketData(ds.id, ds.data())); } catch {} });
                        arr.sort((a,b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
                        this.tickets = arr;
                        this.updateGlobalTicketsData();
                        try {
                            const key = `adminTickets:${this.adminUser?.uid || 'global'}`;
                            const cache = { ts: Date.now(), tickets: this.tickets.slice(0, 100) };
                            localStorage.setItem(key, JSON.stringify(cache));
                        } catch (_) {}
                        this.applyAllFilters();
                        this.updatePaginationControls();
                    });
                });
            } catch (err) {
                console.warn('Realtime listener orderBy failed, using collection fallback:', err?.message || err);
                this.unsubscribe = onSnapshot(collection(this.db, 'tickets'), (snap) => {
                    const arr = [];
                    snap.forEach((ds) => { try { arr.push(this.normalizeTicketData(ds.id, ds.data())); } catch {} });
                    arr.sort((a,b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
                    this.tickets = arr;
                    this.updateGlobalTicketsData();
                    try {
                        const key = `adminTickets:${this.adminUser?.uid || 'global'}`;
                        const cache = { ts: Date.now(), tickets: this.tickets.slice(0, 100) };
                        localStorage.setItem(key, JSON.stringify(cache));
                    } catch (_) {}
                    this.applyAllFilters();
                    this.updatePaginationControls();
                });
            }

            
        } catch (error) {
            console.error('❌ Error setting up tickets real-time listener:', error);
        }
    }

    setupUserDataListener() {
        try {
            const usersQuery = query(collection(this.db, "users"));

            this.userUnsubscribe = onSnapshot(usersQuery,
                (snapshot) => {
                    let hasUserUpdates = false;

                    snapshot.docChanges().forEach((change) => {
                        const userData = change.doc.data();
                        const userId = change.doc.id;

                        if (change.type === "modified" || change.type === "added") {
                            this.handleUserProfileUpdate(userId, userData);
                            hasUserUpdates = true;
                        }
                    });

                    if (hasUserUpdates) {
                        this.loadTickets();
                    }
                },
                (error) => {
                    console.error('❌ User data listener error:', error);
                }
            );

            

        } catch (error) {
            console.error('❌ Error setting up user data listener:', error);
        }
    }

    setupAdminDataListener() {
        try {
            const adminsQuery = query(collection(this.db, "admins"));

            onSnapshot(adminsQuery, (snapshot) => {
                let hasAdminUpdates = false;

                snapshot.docChanges().forEach((change) => {
                    const adminData = change.doc.data();
                    const adminId = change.doc.id;

                    if (change.type === "modified" || change.type === "added") {
                        if (!window.adminCache) window.adminCache = {};
                        window.adminCache[adminId] = {
                            name: adminData.name || 'Unknown Admin',
                            email: adminData.email || 'No Email'
                        };

                        this.updateAdminAssignmentsInRealTime(adminId, adminData);
                        if (this.adminUser && this.adminUser.uid === adminId) {
                            this.adminUser.name = adminData.name || this.adminUser.name;
                            this.adminUser.email = adminData.email || this.adminUser.email;
                            this.adminUser.role = adminData.role || this.adminUser.role;
                            this.loadAdminInfo();
                        }
                        hasAdminUpdates = true;
                    }
                });

                if (hasAdminUpdates) {
                    this.renderTickets();
                    this.updateStats && this.updateStats();
                }
            }, (error) => {
                console.error('❌ Admin data listener error:', error);
            });

            

        } catch (error) {
            console.error('❌ Error setting up admin data listener:', error);
        }
    }

    updateAdminAssignmentsInRealTime(adminId, adminData) {
        try {
            const affectedTickets = this.tickets.filter(t => t.assigned_to === adminId || t.action_by === adminId);
            if (affectedTickets.length > 0) {
                const name = adminData.name || (window.adminCache && window.adminCache[adminId]?.name) || '';
                const email = adminData.email || (window.adminCache && window.adminCache[adminId]?.email) || '';
                affectedTickets.forEach(ticket => {
                    // No field mutation needed; display uses cache via getAssignedAdminDisplayInfo
                    // Keep for potential legacy assigned_name compatibility
                    if (ticket.assigned_to === adminId && !ticket.assigned_name) {
                        ticket.assigned_name = name || email || ticket.assigned_name;
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error updating admin assignments in UI:', error);
        }
    }

    handleUserProfileUpdate(userId, userData) {
        try {
            // Auto-update location jika perlu
            this.autoUpdateUserLocation(userId, userData);

            // Update tickets dengan data user terbaru
            this.updateUserTicketsInRealTime(userId, userData);

            // Clear cache
            if (window.userCache && window.userCache[userId]) {
                delete window.userCache[userId];
            }

        } catch (error) {
            console.error('❌ Error handling user profile update:', error);
        }
    }

    async autoUpdateUserLocation(userId, userData) {
        try {
            const syncedLocation = this.syncUserLocationWithDepartment(userData);

            if (syncedLocation && syncedLocation !== userData.location) {
                const userRef = doc(this.db, "users", userId);
                await updateDoc(userRef, {
                    location: syncedLocation,
                    updated_at: new Date().toISOString()
                });

                userData.location = syncedLocation;
            }
        } catch (error) {
            console.error('❌ Error updating user location:', error);
        }
    }

    syncUserLocationWithDepartment(userData) {
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
            'DC': 'Workshop10',
            'Document Control': 'White Office',
            'Engineer': 'Blue Office',
            'Engineering': 'Blue Office',
            'Maintenance': 'Workshop11',
            'Management': 'White Office 2nd Fl',
            'Planner': 'White Office',
            'Procurement': 'White Office',
            'QC': 'Workshop12',
            'Vendor': 'White Office',
            'Lainlain': 'Other Location'
        };

        const suggestedLocation = departmentLocationMap[userData.department];

        if (suggestedLocation && userData.location !== suggestedLocation) {
            return suggestedLocation;
        }

        return userData.location;
    }

    updateUserTicketsInRealTime(userId, userData) {
        try {
            const syncedLocation = this.syncUserLocationWithDepartment(userData);
            const userTickets = this.tickets.filter(ticket =>
                ticket.user_id === userId ||
                ticket.user_email === userData.email
            );

            if (userTickets.length > 0) {
                userTickets.forEach(ticket => {
                    const ticketIndex = this.tickets.findIndex(t => t.id === ticket.id);
                    if (ticketIndex !== -1) {
                        this.tickets[ticketIndex].user_name = userData.full_name;
                        this.tickets[ticketIndex].user_department = userData.department;
                        this.tickets[ticketIndex].user_email = userData.email;
                        this.tickets[ticketIndex].user_phone = userData.phone;

                        if (syncedLocation) {
                            this.tickets[ticketIndex].location = syncedLocation;
                        }
                    }
                });

                this.renderTickets();
                this.updateStats();
            }

        } catch (error) {
            console.error('❌ Error updating user tickets:', error);
        }
    }

    // ✅ RENDER SYSTEM
    async renderTickets() {
        const tableBody = document.getElementById('ticketsTableBody');
        const emptyState = document.getElementById('emptyTicketsState');

        if (!tableBody || !emptyState) {
            console.error('❌ Required DOM elements not found');
            return;
        }

        if (this.filteredTickets.length === 0) {
            tableBody.innerHTML = '';
            emptyState.style.display = 'block';
            const cardsContainer = document.getElementById('ticketsCards');
            if (cardsContainer) cardsContainer.innerHTML = '';
            return;
        }

        emptyState.style.display = 'none';

        const rowPromises = this.filteredTickets.map(async (ticket) => {
            const permissions = this.checkPermissions(ticket);
            const assignedAdminDisplay = await this.getAssignedAdminDisplayInfo(ticket);
            const assignedInfo = await this.getAssignedAdminInfo(ticket);
            const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v||''));
            const assignedEmail = (
                // 1) If assigned to current admin, use current admin email
                (ticket.assigned_to && this.adminUser && ticket.assigned_to === this.adminUser.uid && this.adminUser.email) ? this.adminUser.email :
                // 2) From admins/<uid>
                (assignedInfo && assignedInfo.assignedTo && assignedInfo.assignedTo.email) ? assignedInfo.assignedTo.email :
                // 3) If assigned_to already an email string
                (isEmail(ticket.assigned_to) ? String(ticket.assigned_to) :
                // 4) target_admin_email for assignment tickets
                (ticket.target_admin_email || '-'))
            );
            const userDisplay = await this.getUserDisplayInfo(ticket);

            let actionButtons = this.generateActionButtons(ticket, permissions);

            return `
                <tr data-ticket-id="${ticket.id}">
                    <td style="text-align:center;">
                        <input type="checkbox" class="ticket-select" data-ticket-id="${ticket.id}" ${this.selectedTickets.has(ticket.id) ? 'checked' : ''} aria-label="Select ticket ${ticket.code || ''}">
                    </td>
                    <td><strong>${ticket.code || 'N/A'}</strong></td>
                    <td>
                        ${ticket.subject || 'No Subject'}
                        ${ticket.is_assignment ? `
                            <div class=\"assignment-inline-meta\">
                                <small>${(ticket.assignment_scope || '').toLowerCase() === 'all' ? 'All IT' : 'Assignment'} • Created by: ${this.escapeHtml(ticket.created_by_name || ticket.user_name || '-')}</small>
                            </div>
                        ` : ''}
                    </td>
                    <td>
                        <div>${userDisplay.name || 'Unknown'}</div>
                        <small class="text-muted">${userDisplay.email || 'No Email'}</small>
                    </td>
                    <td>${userDisplay.department || 'N/A'}</td>
                    <td>${assignedEmail}</td>
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

        const ticketsHtmlArray = await Promise.all(rowPromises);
        tableBody.innerHTML = ticketsHtmlArray.join('');

        // Update master checkbox state
        const selectAll = document.getElementById('selectAllTickets');
        if (selectAll) {
            const visibleIds = this.filteredTickets.map(t => t.id);
            const allSelected = visibleIds.length > 0 && visibleIds.every(id => this.selectedTickets.has(id));
            selectAll.checked = allSelected;
        }

        await this.renderTicketsToCards();
        this.updateTableForMobile();
        this.updateBulkDeleteVisibility();
    }

    handleSelectionChange(e) {
        const cb = e.target.closest('.ticket-select');
        if (!cb) return;
        const id = cb.dataset.ticketId;
        if (!id) return;
        if (cb.checked) this.selectedTickets.add(id); else this.selectedTickets.delete(id);

        const selectAll = document.getElementById('selectAllTickets');
        if (selectAll) {
            const visibleIds = this.filteredTickets.map(t => t.id);
            const allSelected = visibleIds.length > 0 && visibleIds.every(i => this.selectedTickets.has(i));
            selectAll.checked = allSelected;
        }

        this.updateBulkDeleteVisibility();
    }

    selectAllVisibleTickets(checked) {
        const visibleIds = this.filteredTickets.map(t => t.id);
        const tableBody = document.getElementById('ticketsTableBody');
        if (checked) {
            visibleIds.forEach(id => this.selectedTickets.add(id));
        } else {
            visibleIds.forEach(id => this.selectedTickets.delete(id));
        }
        if (tableBody) {
            tableBody.querySelectorAll('.ticket-select').forEach(cb => {
                const id = cb.dataset.ticketId;
                if (visibleIds.includes(id)) cb.checked = !!checked;
            });
        }

        this.updateBulkDeleteVisibility();
    }

    async bulkDeleteSelected() {
        try {
            const ids = Array.from(this.selectedTickets);
            if (ids.length === 0) {
                this.showNotification('Bulk Delete', 'info', 'No tickets selected');
                return;
            }

            // Check permission per ticket
            const deletable = ids.filter(id => {
                const t = this.tickets.find(x => x.id === id);
                const p = t ? this.checkPermissions(t) : null;
                return p && p.canDelete;
            });

            if (deletable.length === 0) {
                await this.showPermissionError('delete selected tickets');
                return;
            }

            const result = await Swal.fire({
                title: 'Delete Selected Tickets?',
                html: `You are about to delete <strong>${deletable.length}</strong> tickets. This cannot be undone.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, Delete',
                cancelButtonText: 'Cancel'
            });

            if (!result.isConfirmed) return;

            let success = 0, fail = 0;
            for (const id of deletable) {
                try {
                    await deleteDoc(doc(this.db, 'tickets', id));
                    success++;
                    this.selectedTickets.delete(id);
                } catch (err) {
                    fail++;
                }
            }

            await this.loadTickets();

            const msg = `Deleted: ${success}${fail ? `, Failed: ${fail}` : ''}`;
            this.showNotification('Bulk Delete', 'success', msg);
            this.updateBulkDeleteVisibility();
        } catch (error) {
            console.error('❌ Bulk delete error:', error);
            this.showNotification('Bulk Delete Error', 'error', error.message);
        }
    }

    updateBulkDeleteVisibility() {
        const btn = document.getElementById('bulkDeleteFloating');
        if (!btn) return;
        const hasVisibleSelected = Array.isArray(this.filteredTickets) && this.filteredTickets.some(t => this.selectedTickets.has(t.id));
        btn.style.display = hasVisibleSelected ? 'inline-flex' : 'none';
    }

    generateActionButtons(ticket, permissions) {
        let actionButtons = '';

        // View button - always available
        actionButtons += `
            <button class="btn-action btn-view" data-action="view" title="View Ticket Details">
                <i class="fas fa-eye"></i> View
            </button>
        `;

        // Take Ticket button
        const isAllAssignment = ticket.is_assignment && ((ticket.assignment_scope || ticket.scope || '').toLowerCase() === 'all');
        if (permissions.canTake) {
            actionButtons += `
                <button class="btn-action btn-take" data-action="take" title="Take this ticket">
                    <i class="fas fa-hand-paper"></i> Take
                </button>
            `;
        }

        if ((permissions.isTicketOwner || permissions.isSuperAdmin) && permissions.canRelease) {
            actionButtons += `
                <button class="btn-action btn-release" data-action="release" title="Release this ticket">
                    <i class="fas fa-undo"></i> Release
                </button>
            `;
        }

        // Action buttons based on status
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

        return actionButtons;
    }

    async renderTicketsToCards() {
        const cardsContainer = document.getElementById('ticketsCards');
        const emptyState = document.getElementById('emptyTicketsState');

        if (!cardsContainer || !emptyState) return;

        if (this.filteredTickets.length === 0) {
            cardsContainer.innerHTML = '';
            return;
        }

        const cardPromises = this.filteredTickets.map(async (ticket) => {
            const permissions = this.checkPermissions(ticket);
            const assignedAdminDisplay = await this.getAssignedAdminDisplayInfo(ticket);
            const userDisplay = await this.getUserDisplayInfo(ticket);

            let actionButtons = this.generateCardActionButtons(ticket, permissions);

            const createdDate = ticket.created_at ?
                new Date(ticket.created_at).toLocaleString() : 'N/A';

            return `
                <div class="ticket-card" data-ticket-id="${ticket.id}">
                    <div class="ticket-header">
                        <div class="ticket-id">${ticket.code || 'N/A'}</div>
                        <div class="ticket-date">${createdDate}</div>
                    </div>
                    
                    <div class="ticket-title">${escapeHTML(ticket.subject || 'No Subject')}</div>
                    ${ticket.is_assignment ? `
                    <div class=\"ticket-assignment-meta\">
                        <small>${(ticket.assignment_scope || '').toLowerCase() === 'all' ? 'All IT' : 'Assignment'} • Created by: ${escapeHTML(ticket.created_by_name || ticket.user_name || '-')}</small>
                    </div>
                    ` : ''}
                    
                    <div class="ticket-user-info">
                        <div class="ticket-user">${userDisplay.name || 'Unknown'}</div>
                        <div class="ticket-department">${userDisplay.department || 'N/A'}</div>
                    </div>
                    
                    <div class="ticket-location">
                        <i class="fas fa-map-marker-alt"></i> ${escapeHTML(ticket.location || 'N/A')}
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
                        ${escapeHTML(this.truncateText(ticket.message, 100))}
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

        const cardsHtmlArray = await Promise.all(cardPromises);
        cardsContainer.innerHTML = cardsHtmlArray.join('');
    }

    generateCardActionButtons(ticket, permissions) {
        let actionButtons = '';

        actionButtons += `
            <button class="btn-card-action btn-view" onclick="adminDashboard.viewTicket('${ticket.id}')" title="View Ticket Details">
                <i class="fas fa-eye"></i> View
            </button>
        `;

        const isAllAssignment = ticket.is_assignment && ((ticket.assignment_scope || ticket.scope || '').toLowerCase() === 'all');
        if (permissions.canTake) {
            actionButtons += `
                <button class="btn-card-action btn-take" onclick="adminDashboard.takeTicket('${ticket.id}')" title="Take this ticket">
                    <i class="fas fa-hand-paper"></i> Take
                </button>
            `;
        }

        if ((permissions.isTicketOwner || permissions.isSuperAdmin) && permissions.canRelease) {
            actionButtons += `
                <button class="btn-card-action btn-release" onclick="adminDashboard.releaseTicket('${ticket.id}')" title="Release this ticket">
                    <i class="fas fa-undo"></i> Release
                </button>
            `;
        }

        if (ticket.status === 'Open' && permissions.canStart) {
            actionButtons += `
                <button class="btn-card-action btn-edit" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'In Progress')" title="Start Working on this ticket">
                    <i class="fas fa-play"></i> Start
                </button>
            `;
        } else if (ticket.status === 'In Progress' && permissions.canResolve) {
            actionButtons += `
                <button class="btn-card-action btn-resolve" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'Resolved')" title="Mark as Resolved">
                    <i class="fas fa-check"></i> Resolve
                </button>
            `;
        } else if (ticket.status === 'Resolved' && permissions.canReopen) {
            actionButtons += `
                <button class="btn-card-action btn-edit" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'Open')" title="Reopen Ticket">
                    <i class="fas fa-redo"></i> Reopen
                </button>
            `;
        }

        if (permissions.canDelete) {
            actionButtons += `
                <button class="btn-card-action btn-delete" onclick="adminDashboard.deleteTicket('${ticket.id}')" title="Delete Ticket">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `;
        }

        return actionButtons;
    }

    // ✅ TICKET ACTIONS HANDLER
    handleTableClick(e) {
        let button = e.target.closest('.btn-action');

        if (!button && e.target.classList.contains('fa-eye')) {
            button = e.target.closest('button');
        }

        if (!button) return;

        const action = button.dataset.action;
        const actionContainer = button.closest('.action-buttons');
        const ticketId = actionContainer?.dataset.ticketId;

        if (!ticketId) {
            console.error('❌ No ticket ID found in data attribute');
            return;
        }

        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) {
            console.error('❌ Ticket not found in local data:', ticketId);
            return;
        }

        const permissions = this.checkPermissions(ticket);

        switch (action) {
            case 'view':
                this.viewTicket(ticketId);
                break;
            case 'start':
                if (permissions.canStart) {
                    this.updateTicketStatus(ticketId, 'In Progress');
                } else {
                    this.showPermissionError('start this ticket');
                }
                break;
            case 'resolve':
                if (permissions.canResolve) {
                    this.updateTicketStatus(ticketId, 'Resolved');
                } else {
                    this.showPermissionError('resolve this ticket');
                }
                break;
            case 'reopen':
                if (permissions.canReopen) {
                    this.updateTicketStatus(ticketId, 'Open');
                } else {
                    this.showPermissionError('reopen this ticket');
                }
                break;
            case 'delete':
                if (permissions.canDelete) {
                    this.deleteTicket(ticketId);
                } else {
                    this.showPermissionError('delete this ticket');
                }
                break;
            case 'take':
                if (permissions.canTake) {
                    this.takeTicket(ticketId);
                } else {
                    this.showPermissionError('take this ticket');
                }
                break;
            case 'release':
                if (permissions.canRelease) {
                    this.releaseTicket(ticketId);
                } else {
                    this.showPermissionError('release this ticket');
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
            if (this.adminUser.role === 'Super Admin') {
                message = 'Only super admin and owner can ${action}.';
            } else {
                message = `Only Super Admin can ${action}. Your role (${roleName}) does not have delete permission.`;
            }
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

    // ✅ TICKET OPERATIONS
    async updateTicketStatus(ticketId, newStatus) {
        try {
            

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

            // Special validation for Resolved status
            if (newStatus === 'Resolved') {
                return await this.showResolveConfirmation(ticket);
            }

            await this.executeStatusUpdate(ticketId, newStatus, ticket);

        } catch (error) {
            console.error('❌ Error updating ticket status:', error);
            this.showNotification('Update Error', 'error', 'Failed to update ticket status');
        }
    }

    async executeStatusUpdate(ticketId, newStatus, ticket) {
        const ticketRef = doc(this.db, "tickets", ticketId);

        const updateData = {
            status: newStatus,
            last_updated: serverTimestamp()
        };

        if (newStatus === 'In Progress') {
            updateData.action_by = this.adminUser.uid;
            updateData.assigned_to = this.adminUser.uid;
            updateData.assigned_name = this.adminUser.name || this.adminUser.email;
        }

        if (newStatus === 'Open') {
            const finalStatuses = ['Resolved', 'Closed', 'Completed', 'Finished'];
            if (finalStatuses.includes(ticket.status)) {
                updateData.reopen_at = serverTimestamp();
            } else {
                updateData.reopen_at = serverTimestamp();
            }
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

        this.showNotification('Status Updated', 'success', `Ticket status updated to ${newStatus}`);
        await this.loadTickets();
    }

    async takeTicket(ticketId) {
        try {
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

            const isAllAssignment = ticket.is_assignment && ((ticket.assignment_scope || ticket.scope || '').toLowerCase() === 'all');

            if (isAllAssignment) {
                const subject = ticket.assignment_subject || ticket.subject || (ticket.assignment_activity || ticket.activity || 'Assignment');
                const message = ticket.assignment_message || ticket.message || '';
                const location = ticket.assignment_location || ticket.location || '';

                const newDocRef = await addDoc(collection(this.db, 'tickets'), {
                    subject: subject,
                    message: message,
                    location: location,
                    inventory: ticket.inventory || '',
                    device: ticket.device || 'Others',
                    priority: ticket.priority || 'Medium',
                    // Tetap gunakan admin sebagai pemilik dokumen (sesuai rules),
                    // namun kolom User di UI akan menampilkan creator assignment.
                    user_id: this.adminUser.uid,
                    user_name: this.adminUser.name || this.adminUser.email || '',
                    user_email: this.adminUser.email || '',
                    user_department: this.adminUser.department || 'IT',
                    user_phone: this.adminUser.phone || '',
                    created_by_uid: ticket.created_by_uid || ticket.user_id || '',
                    created_by_email: ticket.created_by_email || ticket.user_email || '',
                    created_by_name: ticket.created_by_name || ticket.user_name || 'IT',
                    assignment_scope: 'all',
                    source_assignment_id: ticket.id,
                    status: 'Open',
                    qa: 'Open',
                    created_at: serverTimestamp(),
                    last_updated: serverTimestamp(),
                    updates: [{
                        status: 'Open',
                        notes: 'Assignment copy created',
                        timestamp: new Date().toISOString(),
                        updatedBy: this.adminUser.name || this.adminUser.email
                    }],
                    action_by: '',
                    note: '',
                    is_assignment: false,
                    assignment_activity: ticket.assignment_activity || ticket.activity || ''
                });

                const gen = (typeof window !== 'undefined') ? window.generateTicketId : undefined;
                if (typeof gen === 'function') {
                    const code = gen(this.adminUser.department || 'IT', ticket.device || 'Others', location, newDocRef.id, (ticket.assignment_activity || ticket.activity || ''));
                    await updateDoc(newDocRef, { code });
                }

                const inProgressUpdate = {
                    status: 'In Progress',
                    notes: `Ticket taken by ${this.adminUser.name || this.adminUser.email}`,
                    timestamp: new Date().toISOString(),
                    updatedBy: this.adminUser.name || this.adminUser.email
                };

                await updateDoc(newDocRef, {
                    action_by: this.adminUser.uid,
                    assigned_to: this.adminUser.uid,
                    assigned_name: this.adminUser.name || this.adminUser.email,
                    status: 'In Progress',
                    qa: 'In Progress',
                    last_updated: serverTimestamp(),
                    updates: arrayUnion(inProgressUpdate)
                });

                const ticketDoc = await getDoc(ticketRef);
                const currentData = ticketDoc.data() || {};
                await updateDoc(ticketRef, {
                    taken_by: arrayUnion(this.adminUser.uid),
                    last_updated: serverTimestamp(),
                    updates: arrayUnion({
                        status: currentData.status || 'Open',
                        notes: `Taken by ${this.adminUser.name || this.adminUser.email}`,
                        timestamp: new Date().toISOString(),
                        updatedBy: this.adminUser.name || this.adminUser.email
                    })
                });

                this.showNotification('Ticket Taken', 'success', 'Ticket has been assigned to you');
                return;
            }

            const updateData = {
                action_by: this.adminUser.uid,
                assigned_to: this.adminUser.uid,
                assigned_name: this.adminUser.name || this.adminUser.email,
                status: 'In Progress',
                last_updated: serverTimestamp()
            };

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

            this.showNotification('Ticket Taken', 'success', 'Ticket has been assigned to you');
        } catch (error) {
            console.error('❌ Error taking ticket:', error);
            this.showNotification('Take Error', 'error', 'Failed to take ticket');
        }
    }

    async releaseTicket(ticketId) {
        try {
            const ticketRef = doc(this.db, "tickets", ticketId);
            const ticketDoc = await getDoc(ticketRef);
            if (!ticketDoc.exists()) throw new Error('Ticket not found');
            const data = ticketDoc.data();

            const updateData = {
                action_by: '',
                assigned_to: '',
                assigned_name: '',
                status: 'Open',
                last_updated: serverTimestamp()
            };

            const updateNote = {
                status: 'Open',
                notes: `Ticket released by ${this.adminUser.name || this.adminUser.email}`,
                timestamp: new Date().toISOString(),
                updatedBy: this.adminUser.name || this.adminUser.email
            };

            const currentUpdates = Array.isArray(data.updates) ? data.updates : [];
            updateData.updates = [...currentUpdates, updateNote];

            await updateDoc(ticketRef, updateData);
            this.showNotification('Ticket Released', 'success', 'Ticket is now available for other admins');
            await this.loadTickets();
        } catch (error) {
            console.error('❌ Error releasing ticket:', error);
            this.showNotification('Release Error', 'error', 'Failed to release ticket');
        }
    }

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
                const scope = (ticket.assignment_scope || ticket.scope || '').toLowerCase();
                const isBroadcast = ticket.is_assignment && scope === 'all';
                if (isBroadcast) {
                    const q = query(collection(this.db, 'tickets'), where('source_assignment_id', '==', ticketId));
                    const snap = await getDocs(q);
                    const deletions = [];
                    snap.forEach(ds => deletions.push(deleteDoc(doc(this.db, 'tickets', ds.id))));
                    if (deletions.length > 0) {
                        await Promise.all(deletions);
                    }
                }

                await deleteDoc(doc(this.db, "tickets", ticketId));

                this.showNotification('Ticket Deleted', 'success', 'Ticket has been deleted');
                await this.loadTickets();
            }
        } catch (error) {
            console.error('❌ Error deleting ticket:', error);
            this.showNotification('Delete Error', 'error', 'Failed to delete ticket');
        }
    }

    // ✅ RESOLUTION CONFIRMATION
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
                        
                        <label for="resolveNote">
                            <i class="fas fa-sticky-note"></i> Resolution Notes *
                        </label>
                        <textarea 
                            id="resolveNote" 
                            class="swal2-textarea" 
                            placeholder="Please describe the solution, steps taken, or reason for closure."
                            rows="4"
                            minlength="10"
                            autocomplete="off"
                            required
                        >${ticket.note || ''}</textarea>
                        <small>This note will be visible to the user and included in Excel reports</small>

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
                `,
                showCancelButton: true,
                confirmButtonText: 'Confirm Resolution',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#6b7280',
                focusConfirm: false,
                didOpen: () => {
                    const el = document.getElementById('resolveNote');
                    if (el) el.focus();
                },
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
                }
            });

            if (formValues) {
                await this.executeTicketResolution(ticket.id, formValues.status, formValues.note);
            }

        } catch (error) {
            console.error('❌ Error in resolve confirmation:', error);
        }
    }

    async executeTicketResolution(ticketId, newStatus, note) {
        try {
            const ticketRef = doc(this.db, "tickets", ticketId);

            const ticketDoc = await getDoc(ticketRef);
            const currentData = ticketDoc.data();

            const finalStatuses = ['Resolved', 'Closed', 'Completed', 'Finished'];
            const isCurrentlyFinalStatus = finalStatuses.includes(currentData?.status);

            const updateData = {
                status: newStatus,
                note: note,
                qa: 'Finish',
                resolved_at: serverTimestamp()
            };

            if (!isCurrentlyFinalStatus) {
                updateData.last_updated = serverTimestamp();
            }

            const updateNote = {
                status: newStatus,
                notes: `Ticket resolved by ${this.adminUser.name || this.adminUser.email}. Resolution: ${note}`,
                timestamp: new Date().toISOString(),
                updatedBy: this.adminUser.name || this.adminUser.email
            };

            const currentUpdates = Array.isArray(currentData.updates) ? currentData.updates : [];
            updateData.updates = [...currentUpdates, updateNote];

            await updateDoc(ticketRef, updateData);

            this.showNotification('Ticket Resolved', 'success', 'Ticket has been successfully resolved');
            await this.loadTickets();

        } catch (error) {
            console.error('❌ Error executing ticket resolution:', error);
            this.showNotification('Resolution Error', 'error', 'Failed to resolve ticket');
        }
    }

    // ✅ MODAL MANAGEMENT
    async viewTicket(ticketId) {
        try {
            this.currentModalTicketId = ticketId;

            const cachedTicket = this.tickets.find(t => t.id === ticketId);
            if (cachedTicket) {
                await this.showTicketModal(ticketId);
            } else {
                const ticketDoc = await getDoc(doc(this.db, "tickets", ticketId));
                if (ticketDoc.exists()) {
                    await this.showTicketModal(ticketId);
                } else {
                    throw new Error('Ticket not found');
                }
            }

        } catch (error) {
            console.error('❌ Error viewing ticket:', error);
            this.showNotification('View Error', 'error', 'Failed to load ticket');
        }
    }

    async showTicketModal(ticketId) {
        try {
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

            modal.style.display = 'flex';
            document.body.classList.add('modal-open');

            if (!modal.dataset.backdropAttached) {
                modal.addEventListener('click', (e) => {
                    const isBackdrop = e.target === modal || !e.target.closest('.modal-content');
                    if (isBackdrop) {
                        this.closeTicketModal();
                    }
                });
                modal.dataset.backdropAttached = 'true';
            }

            // Setup real-time listener
            this.setupTicketRealTimeListener(ticketId, modalBody);

        } catch (error) {
            console.error('❌ Error opening modal:', error);
            this.showErrorModal(modalBody, 'Failed to load ticket details');
        }
    }

    setupTicketRealTimeListener(ticketId, modalBody) {
        try {
            const ticketRef = doc(this.db, "tickets", ticketId);

            // Unsubscribe previous listener
            if (this.ticketModalUnsubscribe) {
                this.ticketModalUnsubscribe();
            }

            this.ticketModalUnsubscribe = onSnapshot(ticketRef,
                async (docSnapshot) => {
                    try {
                        if (!docSnapshot.exists()) {
                            this.showErrorModal(modalBody, 'Ticket not found');
                            return;
                        }

                        const ticketData = docSnapshot.data();
                        const ticket = this.normalizeTicketData(ticketId, ticketData);
                        if (ticket.user_id) {
                            try {
                                const userDoc = await getDoc(doc(this.db, "users", ticket.user_id));
                                if (userDoc.exists()) {
                                    const userProfile = userDoc.data();
                                    ticket.user_name = userProfile.full_name || ticket.user_name;
                                    ticket.user_email = userProfile.email || ticket.user_email;
                                    ticket.user_department = userProfile.department || ticket.user_department;
                                }
                            } catch (e) {
                                console.error('Error fetching user profile for modal:', e);
                            }
                        }
                        await this.renderRealTimeModalContent(ticket, modalBody);
                        if (!this.ticketUserModalUnsubscribe && ticket.user_id) {
                            const userRef = doc(this.db, "users", ticket.user_id);
                            this.ticketUserModalUnsubscribe = onSnapshot(userRef, (userSnap) => {
                                if (!userSnap.exists()) return;
                                const user = userSnap.data();
                                const nameEl = modalBody.querySelector('[data-field="user_name"]');
                                const emailEl = modalBody.querySelector('[data-field="user_email"]');
                                const deptEl = modalBody.querySelector('[data-field="user_department"]');
                                if (nameEl) nameEl.textContent = this.escapeHtml(user.full_name || 'Unknown User');
                                if (emailEl) emailEl.textContent = this.escapeHtml(user.email || '');
                                if (deptEl) deptEl.textContent = this.escapeHtml(user.department || '');
                            }, (err) => {
                                console.error('User profile listener error:', err);
                            });
                        }

                    } catch (error) {
                        console.error('❌ Error processing real-time update:', error);
                        this.showErrorModal(modalBody, 'Error updating ticket view');
                    }
                },
                (error) => {
                    console.error('❌ Real-time listener error:', error);
                    this.showErrorModal(modalBody, 'Connection error - showing cached data');

                    // Fallback to cached data
                    const cachedTicket = this.tickets.find(t => t.id === ticketId);
                    if (cachedTicket) {
                        this.renderRealTimeModalContent(cachedTicket, modalBody);
                    }
                }
            );

        } catch (error) {
            console.error('❌ Error setting up real-time listener:', error);
            this.showErrorModal(modalBody, 'Failed to setup real-time updates');
        }
    }

    async renderRealTimeModalContent(ticket, modalBody) {
        try {
            const assignedAdmins = await this.getAssignedAdminInfo(ticket);
            const permissions = this.checkPermissions(ticket);
            const userDisplay = await this.getUserDisplayInfo(ticket);
            const modalHTML = this.getTicketModalHTML(ticket, assignedAdmins, permissions, userDisplay);

            modalBody.style.opacity = '0.7';
        setTimeout(() => {
            modalBody.innerHTML = modalHTML;
            modalBody.style.opacity = '1';
            const modalContent = modalBody.closest('.modal-content');
            if (modalContent) {
                const actionsHTML = this.getTicketActionsHTML(ticket, permissions);
                const existing = modalContent.querySelector('.modal-actions');
                if (existing) {
                    existing.outerHTML = actionsHTML;
                } else {
                    const temp = document.createElement('div');
                    temp.innerHTML = actionsHTML;
                    modalContent.appendChild(temp.firstElementChild);
                }
            }
            this.addRealTimeIndicator(modalBody);
        }, 150);

        } catch (error) {
            console.error('❌ Error rendering modal content:', error);
            throw error;
        }
    }

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

        const modalHeader = modalBody.querySelector('.modal-header');
        if (modalHeader) {
            modalHeader.appendChild(indicator);
        }
    }

    closeTicketModal() {
        

        // Unsubscribe real-time listener
        if (this.ticketModalUnsubscribe) {
            this.ticketModalUnsubscribe();
            this.ticketModalUnsubscribe = null;
        }

        if (this.ticketUserModalUnsubscribe) {
            this.ticketUserModalUnsubscribe();
            this.ticketUserModalUnsubscribe = null;
        }

        const modal = document.getElementById('ticketModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }

    // ✅ METHOD UNTUK MODAL HTML YANG HILANG
    getTicketModalHTML(ticket, assignedAdmins, permissions, userDisplay) {
        const lastUpdated = ticket.last_updated ?
            new Date(ticket.last_updated).toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            }) : 'Just now';
        const createdDate = ticket.created_at ? new Date(ticket.created_at) : null;
        const resolvedDate = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
        const durationMinutes = (resolvedDate && createdDate && resolvedDate >= createdDate)
            ? Math.floor((resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60))
            : 0;
        const durationDisplay = `${durationMinutes} Minutes`;
        const resolvedDisplay = resolvedDate ? new Date(ticket.resolved_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }) : 'Not resolved';

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
                    <div class="ticket-col"><strong>Message:</strong></div>
                    <div class="ticket-col value" data-field="subject">${this.escapeHtml(ticket.message)}</div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Activity:</strong></div>
                    <div class="ticket-col value" data-field="activity">${this.escapeHtml(ticket.assignment_activity || ticket.activity || '-')}</div>
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
                    <div class="ticket-col"><strong>Inventory Code:</strong></div>
                    <div class="ticket-col value" data-field="inventory">
                        ${this.escapeHtml(ticket.inventory || 'Not specified')}
                    </div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Location:</strong></div>
                    <div class="ticket-col value" data-field="location">
                        ${this.escapeHtml(ticket.location || 'N/A')}
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
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Duration:</strong></div>
                    <div class="ticket-col value" data-field="duration">
                        ${durationDisplay}
                    </div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Resolved At:</strong></div>
                    <div class="ticket-col value" data-field="resolved_at">
                        ${resolvedDisplay}
                    </div>
                </div>
            </div>

            <!-- User Info -->
            <div class="ticket-section">
                <h3><i class="fas fa-user"></i> User Information</h3>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Name:</strong></div>
                    <div class="ticket-col value" data-field="user_name">${this.escapeHtml(userDisplay.name)}</div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Department:</strong></div>
                    <div class="ticket-col value" data-field="user_department">${this.escapeHtml(userDisplay.department || 'N/A')}</div>
                </div>
                <div class="ticket-row">
                    <div class="ticket-col"><strong>Email:</strong></div>
                    <div class="ticket-col value" data-field="user_email">${this.escapeHtml(userDisplay.email || '')}</div>
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
                <!--<div class="ticket-row">
                    <div class="ticket-col"><strong>Assigned To:</strong></div>
                    <div class="ticket-col value" data-field="assigned_to">
                        ${assignedAdmins.assignedTo ?
                `${this.escapeHtml(assignedAdmins.assignedTo.name)} 
                            <small>(${this.escapeHtml(assignedAdmins.assignedTo.email)})</small>` :
                '<em>Unassigned</em>'}
                    </div>
                </div>-->
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

            
        </div>
    `;
    }

    getTicketActionsHTML(ticket, permissions) {
        return `
            <div class="modal-actions">
                ${permissions.canUpdate ? `
                    <button class="btn-primary" onclick="adminDashboard.showUpdateFormModal('${ticket.id}')">
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
                    ${ticket.status === 'Resolved' && permissions.canReopen ? `
                        <button class="btn-action btn-edit" onclick="adminDashboard.updateTicketStatus('${ticket.id}', 'Open')">
                            <i class="fas fa-redo"></i> Reopen
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
        `;
    }

    // ✅ METHOD UNTUK ERROR MODAL YANG HILANG
    showErrorModal(modalBody, message) {
        modalBody.innerHTML = `
        <div class="modal-error">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Ticket</h3>
        <p>${escapeHTML(message)}</p>
            <button class="btn-primary" onclick="adminDashboard.closeTicketModal()">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;
    }

    // ✅ EXPORT FUNCTIONALITY
    async handleExport() {
        try {
            
            await this.handleExportWithCustomDialog();
        } catch (error) {
            console.error('❌ Export error:', error);
            this.showNotification('Export Error', 'error', 'Failed to export tickets');
        }
    }

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
                return;
            }

            let exportSuccess = false;

            if (exportAction === false) {
                // Append to Existing File
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
                }
            } else {
                // Create New File
                if (typeof window.createNewFileWithTemplate === 'function') {
                    try {
                        await window.createNewFileWithTemplate(exportData, this.getCurrentFilterInfo());
                        exportSuccess = true;
                    } catch (error) {
                        console.error('❌ New file export failed:', error);
                        await Swal.fire({
                            title: 'Export Failed',
                            text: 'Failed to create new file: ' + error.message,
                            icon: 'error'
                        });
                    }
                }
            }

            if (!exportSuccess) {
                // Fallback to CSV
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

    // ✅ METHOD UNTUK EXPORT COMPATIBILITY YANG HILANG
    async fixExportCompatibility() {
        try {
            

            // Fix missing function: window.originalExportToExcelAppendSorted
            if (typeof window.originalExportToExcelAppendSorted === 'undefined') {
                if (typeof window.exportToExcelAppendSorted === 'function') {
                    window.originalExportToExcelAppendSorted = window.exportToExcelAppendSorted;
                } else {
                    window.originalExportToExcelAppendSorted = function (displayedTickets, filterInfo) {
                        console.warn('⚠️ originalExportToExcelAppendSorted called but not implemented');
                        return this.fallbackExport(displayedTickets);
                    }.bind(this);
                }
            }

            // Fix missing function: setExportFilterInfo
            if (typeof window.setExportFilterInfo === 'undefined') {
                window.setExportFilterInfo = function (filterInfo) {
                    
                    window.exportFilterInfo = filterInfo;
                };
            }

            // Fix missing function: appendToExistingExcel
            if (typeof window.appendToExistingExcel === 'undefined') {
                window.appendToExistingExcel = async function (displayedTickets, filterInfo) {
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

        } catch (error) {
            console.error('❌ Error fixing export compatibility:', error);
        }
    }

    // ✅ METHOD UNTUK FALLBACK EXPORT YANG HILANG
    async fallbackExport(exportData) {
        try {
            const headers = [
                'Ticket Code', 'Subject', 'Activity', 'User Name', 'User Email', 'Department',
                'Location', 'Priority', 'Status', 'Created Date', 'Last Updated',
                'Assigned To', 'Admin Notes', 'Device Type', 'Inventory Number'
            ];

            const csvData = exportData.map(ticket => [
                ticket.code || '',
                ticket.subject || '',
                ticket.activity || '',
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

            

        } catch (error) {
            console.error('❌ Fallback export error:', error);
            throw error;
        }
    }

    // ✅ METHOD UNTUK GET DISPLAYED TICKETS FOR EXPORT YANG HILANG
    getDisplayedTicketsForExport() {
        try {
            const exportTickets = this.filteredTickets.map(ticket => {
                const createdDate = ticket.created_at ?
                    new Date(ticket.created_at) : null;

                const updatedDate = ticket.last_updated ?
                    new Date(ticket.last_updated) : null;

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

                const cachedUser = (ticket.user_id && window.userCache) ? window.userCache[ticket.user_id] : null;
                const resolvedFullName = (cachedUser && cachedUser.full_name) || ticket.user_name || 'Unknown User';

                const activityRaw = ticket.assignment_activity || ticket.activity || '';
                const act = (activityRaw || '').trim();
                const actLower = act.toLowerCase();
                let activityCode = '';
                if (actLower === 'deliver') activityCode = 'MV';
                else if (actLower === 'software install' || actLower === 'software config' || actLower === 'install it standard apps' || actLower === 'reinstall windows') activityCode = 'SW';
                else if (actLower === 'setup meeting') activityCode = 'HW';
                else if (actLower === 'drone update area' || actLower === 'drone lifting' || actLower === 'ceremony sail away') activityCode = 'DR';
                else if (actLower === 'back up data') activityCode = 'DR';
                else if (actLower === 'network' || actLower === 'connect share folder') activityCode = 'NW';
                else if (actLower === 'weekly safety talk' || actLower === 'stand by meeting' || actLower === 'stand by sunday' || actLower === 'other') activityCode = 'OT';
                const activityName = act;
                const subjectForExport = ticket.is_assignment ? (ticket.subject || activityName || 'No Subject') : (ticket.subject || 'No Subject');

                return {
                    id: ticket.id,
                    user_id: ticket.user_id || '',
                    code: activityCode || '',
                    subject: subjectForExport,
                    activity: activityName,
                    name: resolvedFullName,
                    full_name: resolvedFullName,
                    user_name: ticket.user_name || 'Unknown User',
                    user_email: (cachedUser && cachedUser.email) || ticket.user_email || '',
                    department: ticket.user_department || '',
                    user_department: ticket.user_department || '',
                    location: ticket.location || '',
                    inventory: ticket.inventory || '',
                    device: ticket.device || '',
                    message: ticket.message || '',
                    priority: ticket.priority || 'Medium',
                    status_ticket: ticket.status || 'Open',
                    status: ticket.status || 'Open',
                    qa: ticket.qa || '',
                    action_by: ticket.action_by || '',
                    assigned_to: assignedAdmin,
                    assigned_name: ticket.assigned_name || '',
                    note: ticket.note || '',
                    user_phone: ticket.user_phone || '',
                    createdAt: createdDate,
                    created_at: ticket.created_at,
                    resolved_at: ticket.resolved_at,
                    updatedAt: updatedDate,
                    last_updated: ticket.last_updated,
                    raw_created_at: ticket.created_at,
                    raw_updated_at: ticket.last_updated
                };
            });

            return exportTickets;

        } catch (error) {
            console.error('❌ Error preparing export data:', error);
            return [];
        }
    }

    // ✅ METHOD UNTUK GET CURRENT FILTER INFO YANG HILANG
    getCurrentFilterInfo() {
        try {
            let filterText = '';

            // Status filter info
            if (this.currentFilters.status !== 'all') {
                filterText += `Status: ${this.currentFilters.status}`;
            }

            // Priority filter info
            if (this.currentFilters.priority !== 'all') {
                if (filterText) filterText += ', ';
                filterText += `Priority: ${this.currentFilters.priority}`;
            }

            // Date filter info
            if (this.currentFilters.date.isActive) {
                const startDate = this.currentFilters.date.startDate;
                const endDate = this.currentFilters.date.endDate;

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

            return finalFilterInfo;

        } catch (error) {
            console.error('❌ Error getting filter info:', error);
            return 'My Assigned Tickets';
        }
    }

    // ✅ UTILITY METHODS
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

    updateStats() {
        const totalTickets = this.filteredTickets.length;
        const openTickets = this.filteredTickets.filter(ticket => ticket.status === 'Open').length;
        const inProgressTickets = this.filteredTickets.filter(ticket => ticket.status === 'In Progress').length;
        const resolvedTickets = this.filteredTickets.filter(ticket => ticket.status === 'Resolved').length;
        const highPriorityTickets = this.filteredTickets.filter(ticket => ticket.priority === 'High').length;
        const myTickets = this.tickets.filter(ticket => this.isAssignedToCurrentAdmin(ticket)).length;

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

    updateTableForMobile() {
        const tableCells = document.querySelectorAll('#ticketsTableBody td');
        const headers = document.querySelectorAll('#ticketsTable th');

        tableCells.forEach((cell, index) => {
            const headerIndex = index % headers.length;
            const headerText = headers[headerIndex].textContent;
            cell.setAttribute('data-label', headerText);
        });
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

    async getAdminInfo(adminUid) {
        try {
            if (!adminUid) return null;

            // Check cache first
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

                // Save to cache
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

    async getAssignedAdminDisplayInfo(ticket) {
        try {
            let displayInfo = 'Unassigned';

            // Prioritize assigned_to, then action_by
            if (ticket.assigned_to) {
                displayInfo = await this.getAdminDisplayInfo(ticket.assigned_to);
            } else if (ticket.action_by) {
                displayInfo = await this.getAdminDisplayInfo(ticket.action_by);
            } else if (ticket.assigned_name) {
                // Fallback to assigned_name (old format)
                displayInfo = ticket.assigned_name;
            }

            return displayInfo;
        } catch (error) {
            console.error('Error getting assigned admin display info:', error);
            return 'Error loading assignment info';
        }
    }

    async getAdminDisplayInfo(adminUid) {
        try {
            if (!adminUid) return 'Unassigned';

            // Check cache first
            if (window.adminCache && window.adminCache[adminUid]) {
                const admin = window.adminCache[adminUid];
                return `${admin.name} (${admin.email})`;
            }

            // Get from Firestore
            const adminDoc = await getDoc(doc(this.db, "admins", adminUid));
            if (adminDoc.exists()) {
                const adminData = adminDoc.data();
                const displayInfo = `${adminData.name || 'Unknown Admin'} (${adminData.email || 'No Email'})`;

                // Save to cache
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

    async getUserDisplayInfo(ticket) {
        try {
            const nameFallback = ticket.user_name || ticket.name || 'Unknown';
            const emailFallback = ticket.user_email || '';
            const deptFallback = ticket.user_department || 'N/A';
            const phoneFallback = ticket.user_phone || '';

            // Jika ticket berhubungan dengan assignment (memiliki assignment_activity),
            // selalu tampilkan creator assignment di kolom User, bukan admin yang take
            if ((ticket.assignment_activity || '').trim()) {
                return {
                    name: ticket.created_by_name || nameFallback,
                    email: ticket.created_by_email || emailFallback,
                    department: 'IT',
                    phone: phoneFallback
                };
            }
            if (ticket.user_id) {
                if (window.userCache && window.userCache[ticket.user_id]) {
                    const u = window.userCache[ticket.user_id];
                    return { name: u.full_name || nameFallback, email: u.email || emailFallback, department: u.department || deptFallback, phone: u.phone || phoneFallback };
                }
                const userDoc = await getDoc(doc(this.db, "users", ticket.user_id));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (!window.userCache) window.userCache = {};
                    window.userCache[ticket.user_id] = userData;
                    return { name: userData.full_name || nameFallback, email: userData.email || emailFallback, department: userData.department || deptFallback, phone: userData.phone || phoneFallback };
                }
            }
            return { name: nameFallback, email: emailFallback, department: deptFallback, phone: phoneFallback };
        } catch (e) {
            return { name: ticket.user_name || ticket.name || 'Unknown', email: ticket.user_email || '', department: ticket.user_department || 'N/A', phone: ticket.user_phone || '' };
        }
    }

    // ✅ METHOD UNTUK SHOW UPDATE FORM MODAL YANG HILANG
    async showUpdateFormModal(ticketId) {
        try {
            const ticketDoc = await getDoc(doc(this.db, "tickets", ticketId));
            if (!ticketDoc.exists()) {
                throw new Error('Ticket not found');
            }

            const ticket = this.normalizeTicketData(ticketId, ticketDoc.data());
            const userDisplay = await this.getUserDisplayInfo(ticket);
            const permissions = this.checkPermissions(ticket);
            this.currentUpdatingTicketId = ticketId;

            await this.showUpdateFormModalSimple(ticket, userDisplay, permissions);

        } catch (error) {
            console.error('❌ Error opening update modal:', error);
            this.showNotification('Modal Error', 'error', 'Failed to open update form');
        }
    }

    // ✅ METHOD UNTUK SHOW UPDATE FORM MODAL SIMPLE YANG HILANG
    async showUpdateFormModalSimple(ticket, userDisplay, permissions) {
        try {
            const isSuperAdmin = permissions && permissions.isSuperAdmin;
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

            const modalHTML = `
            <div class="modal-content large" style="max-width: 700px;">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Update Ticket: ${ticket.code}</h3>
                    <button type="button" class="close-btn" onclick="adminDashboard.closeUpdateModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="updateTicketForm">
                        <div class="form-section">
                            <h4 style="margin-bottom: 1rem;"><i class="fas fa-edit"></i> Ticket Details</h4>
                            <div class="form-grid" style="grid-template-columns: 1fr; gap: 0.75rem;">
                                <div class="form-group">
                                    <label for="updateSubject">Subject *</label>
                                    <input type="text" id="updateSubject" class="form-control" value="${this.escapeHtml(ticket.subject)}" required>
                                </div>
                                <div class="form-group">
                                    <label for="updatePriority">Priority *</label>
                                    <select id="updatePriority" class="form-control" required>
                                        <option value="">Select Priority</option>
                                        <option value="Low" ${ticket.priority === 'Low' ? 'selected' : ''}>Low</option>
                                        <option value="Medium" ${ticket.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                                        <option value="High" ${ticket.priority === 'High' ? 'selected' : ''}>High</option>
                                        <option value="Critical" ${ticket.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="updateStatus">Status *</label>
                                    <select id="updateStatus" class="form-control" required>
                                        <option value="">Select Status</option>
                                        <option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>Open</option>
                                        <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                        <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="updateInventory">Inventory Code</label>
                                    <input type="text" id="updateInventory" class="form-control" value="${this.escapeHtml(ticket.inventory || '')}" placeholder="e.g., IT-001, LAP-002">
                                </div>
                                <div class="form-group">
                                    <label for="updateDevice">Device Type</label>
                                    <select id="updateDevice" class="form-control">
                                        <option value="">Select Device</option>
                                        <option value="PC Hardware" ${ticket.device === 'PC Hardware' ? 'selected' : ''}>PC Hardware</option>
                                        <option value="PC Software" ${ticket.device === 'PC Software' ? 'selected' : ''}>PC Software</option>
                                        <option value="Laptop" ${ticket.device === 'Laptop' ? 'selected' : ''}>Laptop</option>
                                        <option value="Printer" ${ticket.device === 'Printer' ? 'selected' : ''}>Printer</option>
                                        <option value="Network" ${ticket.device === 'Network' ? 'selected' : ''}>Network</option>
                                        <option value="Projector" ${ticket.device === 'Projector' ? 'selected' : ''}>Projector</option>
                                        <option value="Backup Data" ${ticket.device === 'Backup Data' ? 'selected' : ''}>Backup Data</option>
                                        <option value="Others" ${ticket.device === 'Others' ? 'selected' : ''}>Others</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="updateActivity">Activity</label>
                                    <select id="updateActivity" class="form-control">
                                        <option value="">Select Activity</option>
                                        <option value="Weekly Safety Talk" ${(ticket.assignment_activity || ticket.activity) === 'Weekly Safety Talk' ? 'selected' : ''}>Weekly Safety Talk</option>
                                        <option value="Ceremony Sail Away" ${(ticket.assignment_activity || ticket.activity) === 'Ceremony Sail Away' ? 'selected' : ''}>Ceremony Sail Away</option>
                                        <option value="Deliver" ${(ticket.assignment_activity || ticket.activity) === 'Deliver' ? 'selected' : ''}>Deliver</option>
                                        <option value="Software Install" ${(ticket.assignment_activity || ticket.activity) === 'Software Install' ? 'selected' : ''}>Software Install</option>
                                        <option value="Setup Meeting" ${(ticket.assignment_activity || ticket.activity) === 'Setup Meeting' ? 'selected' : ''}>Setup Meeting</option>
                                        <option value="Drone Update Area" ${(ticket.assignment_activity || ticket.activity) === 'Drone Update Area' ? 'selected' : ''}>Drone Update Area</option>
                                        <option value="Drone Lifting" ${(ticket.assignment_activity || ticket.activity) === 'Drone Lifting' ? 'selected' : ''}>Drone Lifting</option>
                                        <option value="Stand By Meeting" ${(ticket.assignment_activity || ticket.activity) === 'Stand By Meeting' ? 'selected' : ''}>Stand By Meeting</option>
                                        <option value="Stand By Sunday" ${(ticket.assignment_activity || ticket.activity) === 'Stand By Sunday' ? 'selected' : ''}>Stand By Sunday</option>
                                        <option value="Back Up Data" ${(ticket.assignment_activity || ticket.activity) === 'Back Up Data' ? 'selected' : ''}>Back Up Data</option>
                                        <option value="Connect Share Folder" ${(ticket.assignment_activity || ticket.activity) === 'Connect Share Folder' ? 'selected' : ''}>Connect Share Folder</option>
                                        <option value="Software Config" ${(ticket.assignment_activity || ticket.activity) === 'Software Config' ? 'selected' : ''}>Software Config</option>
                                        <option value="Install IT Standard Apps" ${(ticket.assignment_activity || ticket.activity) === 'Install IT Standard Apps' ? 'selected' : ''}>Install IT Standard Apps</option>
                                        <option value="Reinstall Windows" ${(ticket.assignment_activity || ticket.activity) === 'Reinstall Windows' ? 'selected' : ''}>Reinstall Windows</option>
                                        <option value="Other" ${(ticket.assignment_activity || ticket.activity) === 'Other' ? 'selected' : ''}>Other</option>
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
                                        <option value="Rest Area" ${ticket.location === 'Rest Area' ? 'selected' : ''}>Rest Area</option>
                                        <option value="Lainlain" ${ticket.location === 'Lainlain' ? 'selected' : ''}>Other Location</option>
                                    </select>
                                </div>
                                <div class="form-group" style="margin-top: 1rem;">
                                    <label for="updateAdminNotes">Admin Notes</label>
                                    <textarea id="updateAdminNotes" class="form-control" rows="3" placeholder="Admin notes...">${this.escapeHtml(ticket.note || '')}</textarea>
                                </div>
                            </div>
                        </div>
                        <div class="form-section" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                            <h4 style="margin-bottom: 1rem;"><i class="fas fa-user"></i> User Information</h4>
                            <div class="form-grid" style="grid-template-columns: 1fr; gap: 0.75rem;">
                                <div class="form-group">
                                    <label for="updateUserName">User Name *</label>
                                    <input type="text" id="updateUserName" class="form-control" value="${this.escapeHtml(userDisplay.name)}" ${isSuperAdmin ? '' : 'disabled'} required>
                                </div>
                                <div class="form-group">
                                    <label for="updateUserEmail">User Email *</label>
                                    <input type="email" id="updateUserEmail" class="form-control" value="${this.escapeHtml(userDisplay.email || '')}" ${isSuperAdmin ? '' : 'disabled'} required>
                                </div>
                                <div class="form-group">
                                    <label for="updateUserDepartment">Department *</label>
                                    <select id="updateUserDepartment" class="form-control" ${isSuperAdmin ? '' : 'disabled'} required>
                                        <option value="">Select Department</option>
                                        <option value="Admin" ${userDisplay.department === 'Admin' ? 'selected' : ''}>Admin</option>
                                        <option value="Civil" ${userDisplay.department === 'Civil' ? 'selected' : ''}>Civil</option>
                                        <option value="Clinic" ${userDisplay.department === 'Clinic' ? 'selected' : ''}>Clinic</option>
                                        <option value="Client" ${userDisplay.department === 'Client' ? 'selected' : ''}>Client</option>
                                        <option value="Completion" ${userDisplay.department === 'Completion' ? 'selected' : ''}>Completion</option>
                                        <option value="DC" ${userDisplay.department === 'DC' ? 'selected' : ''}>Dimentional Control (DC)</option>
                                        <option value="Document Control" ${userDisplay.department === 'Document Control' ? 'selected' : ''}>Document Control</option>
                                        <option value="Engineer" ${userDisplay.department === 'Engineer' ? 'selected' : ''}>Engineering</option>
                                        <option value="Finance" ${userDisplay.department === 'Finance' ? 'selected' : ''}>Finance</option>
                                        <option value="HSE" ${userDisplay.department === 'HSE' ? 'selected' : ''}>HSE</option>
                                        <option value="HR" ${userDisplay.department === 'HR' ? 'selected' : ''}>Human Resources (HRD)</option>
                                        <option value="IT" ${userDisplay.department === 'IT' ? 'selected' : ''}>IT</option>
                                        <option value="Maintenance" ${userDisplay.department === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                                        <option value="Management" ${userDisplay.department === 'Management' ? 'selected' : ''}>Management</option>
                                        <option value="PGA" ${userDisplay.department === 'PGA' ? 'selected' : ''}>PGA</option>
                                        <option value="Planner" ${userDisplay.department === 'Planner' ? 'selected' : ''}>Planner</option>
                                        <option value="Procurement" ${userDisplay.department === 'Procurement' ? 'selected' : ''}>Procurement</option>
                                        <option value="QC" ${userDisplay.department === 'QC' ? 'selected' : ''}>Quality Control (QC)</option>
                                        <option value="Vendor" ${userDisplay.department === 'Vendor' ? 'selected' : ''}>Vendor</option>
                                        <option value="Warehouse" ${userDisplay.department === 'Warehouse' ? 'selected' : ''}>Warehouse</option>
                                        <option value="Lainlain" ${userDisplay.department === 'Lainlain' ? 'selected' : ''}>Other Department</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="updateUserPhone">Phone</label>
                                    <input type="text" id="updateUserPhone" class="form-control" value="${this.escapeHtml(userDisplay.phone || ticket.user_phone || '')}" ${isSuperAdmin ? '' : 'disabled'} placeholder="Phone number">
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="adminDashboard.closeUpdateModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button type="button" class="btn-primary" onclick="document.getElementById('updateTicketForm')?.requestSubmit()">
                        <i class="fas fa-save"></i> Update Ticket
                    </button>
                </div>
            </div>
        `;

            updateModal.innerHTML = modalHTML;
            document.body.appendChild(updateModal);
            document.body.classList.add('modal-open');

            updateModal.addEventListener('click', (e) => {
                const isBackdrop = e.target === updateModal || !e.target.closest('.modal-content');
                if (isBackdrop) {
                    this.closeUpdateModal();
                }
            });

            // Add form submit event
            const updateForm = document.getElementById('updateTicketForm');
            if (updateForm) {
                updateForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    if (this.currentUpdatingTicketId) {
                        this.handleTicketUpdateSimple(this.currentUpdatingTicketId);
                    }
                });
            }

        } catch (error) {
            console.error('❌ Error creating simple modal:', error);
            this.showNotification('Modal Error', 'error', 'Failed to create update form');
        }
    }

    // ✅ METHOD UNTUK CLOSE UPDATE MODAL YANG HILANG
    closeUpdateModal() {
        const updateModal = document.getElementById('updateTicketModal');
        if (updateModal) {
            updateModal.style.display = 'none';
            updateModal.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
        this.currentUpdatingTicketId = null;
    }

    // ✅ METHOD UNTUK HANDLE TICKET UPDATE SIMPLE YANG HILANG
    async handleTicketUpdateSimple(ticketId) {
        try {
            const submitBtn = document.querySelector('#updateTicketForm button[type="submit"]');
            const originalText = submitBtn?.innerHTML || '';

            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                submitBtn.disabled = true;
            }

            // Get current ticket data
            const ticketRef = doc(this.db, "tickets", ticketId);
            const ticketDoc = await getDoc(ticketRef);

            if (!ticketDoc.exists()) {
                throw new Error('Ticket not found in database');
            }

            const currentData = ticketDoc.data();

            // Check if ticket is already resolved/closed
            const finalStatuses = ['Resolved', 'Closed', 'Completed', 'Finished'];
            const isCurrentlyFinalStatus = finalStatuses.includes(currentData.status);
            const newStatus = this.getElementValueSafely('updateStatus');
            const isChangingToFinalStatus = finalStatuses.includes(newStatus);

            // Safety check for required elements
            const requiredElements = [
                'updateSubject', 'updatePriority', 'updateStatus', 'updateLocation',
                'updateUserName', 'updateUserEmail', 'updateUserDepartment'
            ];

            const missingElements = [];
            for (const elementId of requiredElements) {
                if (!document.getElementById(elementId)) {
                    missingElements.push(elementId);
                }
            }

            if (missingElements.length > 0) {
                throw new Error(`Required fields not found: ${missingElements.join(', ')}. Please refresh and try again.`);
            }

            // Collect data with safety check
            const updateData = {
                subject: this.getElementValueSafely('updateSubject'),
                priority: this.getElementValueSafely('updatePriority'),
                status: newStatus,
                location: this.getElementValueSafely('updateLocation'),
                inventory: this.getElementValueSafely('updateInventory'),
                device: this.getElementValueSafely('updateDevice'),
                note: this.getElementValueSafely('updateAdminNotes'),

                // Only update last_updated if not final status or changing to final status
                ...(isCurrentlyFinalStatus && !isChangingToFinalStatus ? {} : {
                    last_updated: serverTimestamp()
                }),

                // User data
                user_name: this.getElementValueSafely('updateUserName'),
                user_email: this.getElementValueSafely('updateUserEmail'),
                user_department: this.getElementValueSafely('updateUserDepartment'),
                user_phone: this.getElementValueSafely('updateUserPhone')
            };


            const newActivity = this.getElementValueSafely('updateActivity');
            if (newActivity) {
                updateData.activity = newActivity;
                if (currentData.is_assignment) {
                    updateData.assignment_activity = newActivity;
                }
            }

            // Keep assignment message and fields in sync with new location
            try {
                const newLoc = updateData.location || '';
                if (typeof currentData.message === 'string' && currentData.message.includes('Location:')) {
                    const replaced = currentData.message.replace(/(Location:\s*)([^|]+)(?=\s*\|?|$)/, `$1${newLoc}`);
                    updateData.message = replaced;
                }
                if (typeof currentData.assignment_message === 'string' && currentData.assignment_message.includes('Location:')) {
                    const replacedAssign = currentData.assignment_message.replace(/(Location:\s*)([^|]+)(?=\s*\|?|$)/, `$1${newLoc}`);
                    updateData.assignment_message = replacedAssign;
                }
                if (currentData.is_assignment && typeof currentData.assignment_location !== 'undefined') {
                    updateData.assignment_location = deleteField();
                }
            } catch (_) {}

            const isSuperAdmin = this.adminUser && this.adminUser.role === 'Super Admin';

            if (!isSuperAdmin) {
                delete updateData.user_name;
                delete updateData.user_email;
                delete updateData.user_department;
                delete updateData.user_phone;
            }

            const userId = currentData.user_id;

            if (!userId) {
                throw new Error('User ID not found in ticket data');
            }

            // Update user profile (only by Super Admin)
            if (isSuperAdmin) {
                const userRef = doc(this.db, "users", userId);
                await updateDoc(userRef, {
                    full_name: updateData.user_name,
                    email: updateData.user_email,
                    department: updateData.user_department,
                    phone: updateData.user_phone,
                    updated_at: new Date().toISOString()
                });
            }

            // Update ticket
            await updateDoc(ticketRef, updateData);

            // Close modal
            this.closeUpdateModal();

            // Show success message
            let successMessage = 'Ticket and user data updated successfully';
            if (isCurrentlyFinalStatus && !isChangingToFinalStatus) {
                successMessage += ' (Duration preserved - ticket was already resolved)';
            }

            this.showNotification('Update Success', 'success', successMessage);

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

            this.showNotification('Update Error', 'error', error.message);
        }
    }

    // ✅ HELPER METHODS
    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return this.escapeHtml(text);
        return this.escapeHtml(text.substring(0, maxLength)) + '...';
    }

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

    getElementValueSafely(elementId) {
        try {
            const element = document.getElementById(elementId);

            if (!element) {
                console.warn(`⚠️ Element not found: ${elementId}`);
                return '';
            }

            let value = '';

            if (element.tagName === 'SELECT') {
                value = element.value || '';
            } else if (element.tagName === 'TEXTAREA') {
                value = element.value || '';
            } else if (element.tagName === 'INPUT') {
                value = element.value || '';
            } else {
                value = element.value || element.textContent || '';
            }

            return value;

        } catch (error) {
            console.error(`❌ Error getting value for ${elementId}:`, error);
            return '';
        }
    }

    // ✅ EVENT HANDLERS
    async handleManageTeam(e) {
        e.preventDefault();
        window.location.href = 'manage-team.html';
    }

    async handleLogout() {
        try {
            console.info('Logout button clicked');
            let confirmed = false;
            if (window.Swal && typeof Swal.fire === 'function') {
                const result = await Swal.fire({
                    title: 'Logout Confirmation',
                    text: 'Are you sure you want to logout?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: 'Yes, Logout',
                    cancelButtonText: 'Cancel',
                    customClass: { htmlContainer: 'swal-center' }
                });
                confirmed = !!result.isConfirmed;
            } else {
                confirmed = window.confirm('Are you sure you want to logout?');
            }

            if (!confirmed) return;

            try {
                await firebaseAuthService.logout();
            } catch (error) {
                console.warn('Logout via service failed, continuing client-side cleanup:', error?.message || error);
            }

            try { localStorage.removeItem('adminUser'); } catch {}
            window.location.href = 'login.html';
        } catch (e) {
            console.error('Logout handler error:', e);
            // Fallback hard redirect to login
            try { localStorage.removeItem('adminUser'); } catch {}
            window.location.href = 'login.html';
        }
    }

    // ✅ CLEANUP
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        if (this.userUnsubscribe) {
            this.userUnsubscribe();
        }

        if (this.ticketModalUnsubscribe) {
            this.ticketModalUnsubscribe();
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

// Initialize admin dashboard (robust against DOMContentLoaded race)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        const adminDashboard = new AdminDashboard();
        window.adminDashboard = adminDashboard;
    });
} else {
    const adminDashboard = new AdminDashboard();
    window.adminDashboard = adminDashboard;
}

window.addEventListener('beforeunload', function () {
    if (window.adminDashboard) {
        window.adminDashboard.destroy();
    }
});

window.addEventListener('resize', function () {
    if (window.adminDashboard && window.adminDashboard.updateTableForMobile) {
        window.adminDashboard.updateTableForMobile();
    }
});

export default AdminDashboard;
const escapeHTML = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
