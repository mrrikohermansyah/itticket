import {
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query, where, orderBy,
  serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../utils/firebase-config.js';

// Import instance
import firebaseAuthService from '../services/firebase-auth-service.js';

class Dashboard {
  constructor() {
    this.currentUser = null;
    this.tickets = [];
    this.authService = firebaseAuthService;
    this.db = db;
    this.unsubscribeTickets = null;
    this.init();
  }

  async init() {
    try {
      

      const user = await this.authService.getCurrentUser();

      if (!user) {
        
        this.redirectToLogin();
        return;
      }

      

      const profile = await this.authService.getUserProfile(user.uid);
      if (profile) {
        this.currentUser = {
          id: user.uid,
          email: user.email || profile.email || '',
          ...profile
        };
      } else {
        this.currentUser = {
          id: user.uid,
          email: user.email || '',
          full_name: (user.email || '').split('@')[0] || 'User',
          role: 'user',
          department: '',
          location: ''
        };
      }

      this.loadUserInfo();
      this.initializeEventListeners();
      await this.setupRealtimeTickets();

      // Initialize IT assignment section for specific email
      if (this.currentUser && (this.currentUser.email || '').toLowerCase() === 'it@meb.com') {
        this.initializeAssignmentSection();
      }

      

    } catch (error) {
      console.error('❌ Dashboard init error:', error);
      // Jangan redirect dulu, biarkan user tetap di dashboard
      this.showError('System initializing...');
    }
  }

  async setupRealtimeTickets() {
    try {
      

      // Cek dulu apakah user sudah ada
      if (!this.currentUser || !this.currentUser.id) {
        
        return;
      }

      const q = query(
        collection(this.db, "tickets"),
        where("user_id", "==", this.currentUser.id),
        orderBy("created_at", "desc")
      );

      // Remove previous listener if exists
      if (this.unsubscribeTickets) {
        this.unsubscribeTickets();
      }

      try {
        const testSnapshot = await getDocs(q);
        const initialTickets = [];
        testSnapshot.forEach((docSnap) => {
          const t = this.normalizeTicketData(docSnap.id, docSnap.data());
          initialTickets.push(t);
        });
        this.tickets = initialTickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        this.renderTickets();
        this.updateStats();
        const mainEl = document.getElementById('dashboardMain');
        if (mainEl) {
          mainEl.style.visibility = 'visible';
          mainEl.classList.add('enter-animate');
          mainEl.addEventListener('animationend', () => {
            mainEl.classList.remove('enter-animate');
          }, { once: true });
        }
      } catch (testError) {
        console.error('❌ Firestore access denied:', testError);
        this.showFirestoreError();
        return; // Stop here if no permission
      }

      // ✅ Setup realtime listener dengan error handling
      this.unsubscribeTickets = onSnapshot(q,
        (snapshot) => {
          
          this.processTicketsSnapshot(snapshot);
        },
        (error) => {
          console.error('❌ Realtime listener error:', error);
          this.showFirestoreError();
        }
      );

    } catch (error) {
      console.error('❌ Error setting up realtime listener:', error);
      this.showFirestoreError();
    }
  }

  // Method baru untuk handle Firestore errors
  showFirestoreError() {
    

    // Tampilkan message ke user
    const ticketsList = document.getElementById('ticketsList');
    if (ticketsList) {
      ticketsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Database Access Limited</h3>
                <p>You can still submit new tickets, but viewing existing tickets is temporarily unavailable.</p>
                <button class="btn-retry" id="retryTickets">Retry Connection</button>
            </div>
        `;

      // Add retry button listener
      document.getElementById('retryTickets')?.addEventListener('click', () => {
        this.setupRealtimeTickets();
      });
    }
  }

  // Pisahkan processing logic
  processTicketsSnapshot(snapshot) {
    

    const adminCache = new Map();
    const processPromises = [];

    for (const change of snapshot.docChanges()) {
      const doc = change.doc;
      let ticket = this.normalizeTicketData(doc.id, doc.data());

      // Skip deleted tickets
      if (ticket.deleted) {
        const index = this.tickets.findIndex(t => t.id === doc.id);
        if (index !== -1) this.tickets.splice(index, 1);
        continue;
      }

      // Process admin names
      if (ticket.admin_id) {
        processPromises.push(this.resolveAdminName(ticket, adminCache));
      }

      if (change.type === "added") {
        const existingIndex = this.tickets.findIndex(t => t.id === doc.id);
        if (existingIndex === -1) {
          this.tickets.unshift(ticket);
        }
      }
      if (change.type === "modified") {
        const index = this.tickets.findIndex(t => t.id === doc.id);
        if (index !== -1) {
          this.tickets[index] = ticket;
        } else {
          this.tickets.unshift(ticket);
        }
      }
      if (change.type === "removed") {
        this.tickets = this.tickets.filter(t => t.id !== doc.id);
      }
    }

    // Wait for all admin names to resolve
    Promise.all(processPromises).then(() => {
      this.tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      this.renderTickets();
      this.updateStats();
      
    });
  }

  // Method untuk resolve admin names
  async resolveAdminName(ticket, adminCache) {
    if (!adminCache.has(ticket.admin_id)) {
      const adminInfo = await this.getAdminName(ticket.admin_id);
      adminCache.set(ticket.admin_id, adminInfo);
    }
    const adminInfo = adminCache.get(ticket.admin_id);
    if (ticket.action_by === 'Admin' || ticket.action_by === 'Loading...') {
      ticket.action_by = adminInfo.name;
      ticket.action_by_email = adminInfo.email;
    }
  }

  // Normalize ticket data
  // Normalize ticket data
  normalizeTicketData(id, data) {
    let actionByName = data.action_by || '';
    let adminId = data.assigned_to || '';

    if (!adminId) {
      if (actionByName.startsWith('Admin (') && actionByName.includes(')')) {
        adminId = this.extractAdminId(actionByName);
        actionByName = 'Admin';
      } else if (actionByName && actionByName.length > 10 && !actionByName.includes(' ')) {
        adminId = actionByName;
        actionByName = 'Admin';
      }
    }

    let actualAdminName = '';
    let actualAdminEmail = '';
    if (data.updates && data.updates.length > 0) {
      const lastUpdate = data.updates[data.updates.length - 1];
      if (lastUpdate.updatedBy && lastUpdate.updatedBy !== 'Admin') {
        actualAdminName = lastUpdate.updatedBy;
      }
      if (lastUpdate.updatedByEmail) {
        actualAdminEmail = lastUpdate.updatedByEmail;
      }
    }

    let assignedToDisplay = 'Unassigned';
    let assignedEmail = '';

    if (data.assigned_name) {
      assignedToDisplay = data.assigned_name;
    } else if (adminId) {
      assignedToDisplay = 'Admin';
    } else if (actionByName && !actionByName.startsWith('Admin (') && actionByName !== 'Admin') {
      assignedToDisplay = actionByName;
      if (actionByName.includes('@')) {
        const emailMatch = actionByName.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
        if (emailMatch) {
          assignedEmail = emailMatch[1];
          assignedToDisplay = actionByName.replace(`(${assignedEmail})`, '').trim();
        }
      }
    }



    return {
      id: id,
      code: data.code,
      subject: data.subject,
      user_name: data.user_name,
      user_email: data.user_email,
      user_department: data.user_department,
      location: data.location,
      inventory: data.inventory,
      device: data.device,
      message: data.message,
      priority: data.priority,
      status: data.status || data.qa || 'Open',
      created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() :
        (data.created_at || new Date().toISOString()),
      last_updated: data.last_updated?.toDate ? data.last_updated.toDate().toISOString() :
        (data.last_updated || new Date().toISOString()),
      action_by: assignedToDisplay,
      action_by_email: assignedEmail,
      note: data.note || '',
      qa: data.qa || '',
      user_phone: data.user_phone || '',
      updates: data.updates || [],
      deleted: data.deleted || false,
      archived: data.archived || false,
      admin_id: adminId,
      original_action_by: data.action_by,
      deleted_at: data.deleted_at?.toDate ? data.deleted_at.toDate().toISOString() :
        (data.deleted_at || null),
      deleted_by: data.deleted_by || '',
      deleted_by_name: data.deleted_by_name || '',
      delete_reason: data.delete_reason || ''
    };
  }

  // Method untuk extract admin ID dari string action_by
  extractAdminId(actionByString) {
    if (!actionByString) return '';

    // Pattern: "Admin (ZlATPRsp...)"
    const match = actionByString.match(/Admin\s*\(([^)]+)\)/);
    return match ? match[1] : '';
  }

  // Method untuk mendapatkan nama admin dari ID
  async getAdminName(adminId) {
    if (!adminId) return { name: 'Admin', email: '' };

    // Restrict cross-user reads for non-admins to comply with Firestore rules
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      return { name: 'Admin', email: '' };
    }

    try {
      const adminDoc = await getDoc(doc(this.db, "admins", adminId));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        return {
          name: adminData.full_name || adminData.name || 'Admin',
          email: adminData.email || ''
        };
      }

      const userDoc = await getDoc(doc(this.db, "users", adminId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          name: userData.full_name || 'Admin',
          email: userData.email || ''
        };
      }

      return { name: 'Admin', email: '' };
    } catch (error) {
      console.error('Error getting admin name:', error);
      return { name: 'Admin', email: '' };
    }
  }

  // Helper method untuk menentukan apakah ticket open
  isTicketOpen(ticket) {
    const status = (ticket.status || '').toLowerCase().trim();
    const qa = (ticket.qa || '').toLowerCase().trim();

    // PRIORITIZE STATUS over QA
    // Jika status sudah jelas resolved/closed, abaikan qa
    if (status === 'resolved' || status === 'closed' || status === 'completed' || status === 'finished') {
      return false;
    }

    // Jika status jelas open/in progress
    if (status === 'open' || status === 'in progress' || status === 'pending') {
      return true;
    }

    // Jika status tidak jelas, check qa sebagai fallback
    if (qa === 'open') {
      return true;
    }

    if (qa === 'finish' || qa === 'finished') {
      return false;
    }

    // Default case: jika tidak ada info yang jelas, consider as resolved untuk safety
    return false;
  }

  // Helper method untuk menentukan apakah ticket resolved
  isTicketResolved(ticket) {
    return (
      ticket.status === 'Resolved' ||
      ticket.qa === 'Finish' ||
      ticket.status === 'Closed' ||
      ticket.status === 'Completed'
    );
  }

  // Method untuk mendapatkan display status
  getTicketStatusDisplay(ticket) {
    const status = (ticket.status || '').toLowerCase().trim();
    const qa = (ticket.qa || '').toLowerCase().trim();

    // Prioritize status over qa
    if (status === 'resolved' || status === 'closed' || status === 'completed' || status === 'finished') {
      return 'Resolved';
    }

    if (status === 'in progress') {
      return 'In Progress';
    }

    if (status === 'pending') {
      return 'Pending';
    }

    // Fallback to qa
    if (qa === 'finish' || qa === 'finished') {
      return 'Resolved';
    }

    // Default case - jika tidak ada status yang jelas, anggap Open
    if (!status || status === 'open' || qa === 'open') {
      return 'Open';
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Method untuk menentukan apakah ticket bisa di-delete oleh user
  canDeleteTicket(ticket) {
    // 1. User hanya bisa delete ticket yang mereka buat sendiri
    if (ticket.user_id !== this.currentUser.id) {
      return false;
    }

    // 2. Hanya ticket dengan status tertentu yang bisa di-delete
    const currentStatus = this.getTicketStatusDisplay(ticket);
    const deletableStatuses = ['Open', 'Pending'];

    return deletableStatuses.includes(currentStatus);
  }

  // Render tickets ke UI
  renderTickets() {
    const ticketsList = document.getElementById('ticketsList');
    if (!ticketsList) {
      console.error('❌ ticketsList element not found!');
      return;
    }

    const activeTickets = this.tickets.filter(ticket =>
      !ticket.deleted && !ticket.archived
    );

    if (activeTickets.length === 0) {
      ticketsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-ticket-alt"></i>
        <h3>No tickets yet</h3>
        <p>Submit your first support ticket above</p>
      </div>
    `;
      return;
    }

    const ticketsToShow = activeTickets.slice(0, 5);

    const ticketsHtml = ticketsToShow.map(ticket => {
      const statusDisplay = this.getTicketStatusDisplay(ticket);
      const canDelete = this.canDeleteTicket(ticket);

      return `
      <div class="ticket-item ${ticket.id.startsWith('temp-') ? 'ticket-temporary' : ''} ${canDelete ? 'deletable' : ''}">
        <div class="ticket-content">
          <div class="ticket-header">
            <div class="ticket-code">${ticket.code}</div>
            <div class="ticket-priority priority-${(ticket.priority || 'medium').toLowerCase()}">
              ${ticket.priority || 'Medium'}
            </div>
          </div>
          <h4 class="ticket-subject">${ticket.subject || 'No subject'}</h4>
          <div class="ticket-meta">
            <span class="ticket-device">${ticket.device || 'No device'}</span>
            <span class="ticket-location">${ticket.location || 'No location'}</span>
            <span class="ticket-status status-${statusDisplay.toLowerCase().replace(' ', '-')}">
              ${statusDisplay}
            </span>
            <span class="ticket-date">
              ${ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : 'Unknown date'}
            </span>
          </div>
          <!-- Tampilkan assigned to hanya jika bukan "Unassigned" -->
          ${ticket.action_by && ticket.action_by !== 'Unassigned' && ticket.action_by !== 'Loading...' ? `
            <div class="ticket-assigned">
              <small>
                <strong>Assigned to:</strong> 
                ${ticket.action_by}
                ${ticket.action_by_email ? ` (${ticket.action_by_email})` : ''}
              </small>
            </div>
          ` : ticket.action_by === 'Loading...' ? `
            <div class="ticket-assigned">
              <small>
                <strong>Assigned to:</strong> 
                <i class="fas fa-spinner fa-spin"></i> Loading...
              </small>
            </div>
          ` : `
            <div class="ticket-unassigned">
              <small><strong>Assigned to:</strong> <span class="unassigned-text">Unassigned</span></small>
            </div>
          `}
          ${ticket.note ? `
            <div class="ticket-notes">
              <small><strong>Admin Notes:</strong> ${ticket.note}</small>
            </div>
          ` : ''}
          ${ticket.updates && ticket.updates.length > 1 ? `
            <div class="ticket-updates">
              <small><strong>Latest Update:</strong> ${ticket.updates[ticket.updates.length - 1].notes}</small>
            </div>
          ` : ''}
          
          <!-- Tombol Delete -->
          ${canDelete ? `
            <div class="ticket-actions">
              <button class="btn-delete-ticket" data-ticket-id="${ticket.id}" data-ticket-code="${ticket.code}">
                <i class="fas fa-trash"></i> Delete Ticket
              </button>
            </div>
          ` : ''}
          
          ${ticket.id.startsWith('temp-') ? `
            <div class="ticket-saving">
              <small><i class="fas fa-spinner fa-spin"></i> Saving...</small>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    }).join('');

    ticketsList.innerHTML = ticketsHtml;

    // Add event listeners untuk tombol delete
    this.attachDeleteEventListeners();
  }

  // Method untuk attach event listeners ke tombol delete
  attachDeleteEventListeners() {
    const deleteButtons = document.querySelectorAll('.btn-delete-ticket');

    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const ticketId = button.getAttribute('data-ticket-id');
        const ticketCode = button.getAttribute('data-ticket-code');

        this.handleDeleteTicket(ticketId, ticketCode);
      });
    });
  }

  // Method untuk handle delete ticket
  async handleDeleteTicket(ticketId, ticketCode) {
    try {
      // Konfirmasi delete
      const result = await Swal.fire({
        title: 'Delete Ticket?',
        html: `
          <div class="delete-confirmation">
            <p>Are you sure you want to delete ticket <strong>${ticketCode}</strong>?</p>
            <p class="warning-text">This action cannot be undone!</p>
            <div class="form-group">
              <label for="deleteReason"><strong>Reason for deletion (optional):</strong></label>
              <textarea 
                id="deleteReason" 
                class="swal2-textarea" 
                placeholder="Please provide a reason for deleting this ticket..."
                rows="3"
              ></textarea>
            </div>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        reverseButtons: true,
        focusCancel: true
      });

      if (result.isConfirmed) {
        const deleteReason = document.getElementById('deleteReason')?.value.trim() || 'No reason provided';

        // Show loading
        Swal.fire({
          title: 'Deleting Ticket...',
          text: 'Please wait while we delete your ticket',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // Update ticket dengan status deleted
        const ticketRef = doc(this.db, "tickets", ticketId);
        await updateDoc(ticketRef, {
          deleted: true,
          deleted_at: serverTimestamp(),
          deleted_by: this.currentUser.id,
          deleted_by_name: this.currentUser.full_name || 'User',
          delete_reason: deleteReason,
          last_updated: serverTimestamp()
        });

        // Success message
        await Swal.fire({
          title: 'Deleted!',
          html: `
            <div class="delete-success">
              <i class="fas fa-check-circle text-success"></i>
              <p>Ticket <strong>${ticketCode}</strong> has been deleted successfully.</p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#10b981',
          timer: 3000,
          timerProgressBar: true
        });

        
      }
    } catch (error) {
      console.error('❌ Error deleting ticket:', error);

      await Swal.fire({
        title: 'Error!',
        text: error.message || 'Failed to delete ticket. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#ef4444'
      });
    }
  }

  // Update stats dashboard
  updateStats() {
    const activeTickets = this.tickets.filter(ticket =>
      !ticket.deleted && !ticket.archived
    );

    const openTickets = activeTickets.filter(ticket => this.isTicketOpen(ticket));
    const resolvedTickets = activeTickets.filter(ticket => !this.isTicketOpen(ticket));

    const openEl = document.getElementById('openTickets');
    const resolvedEl = document.getElementById('resolvedTickets');

    if (openEl) openEl.textContent = openTickets.length;
    if (resolvedEl) resolvedEl.textContent = resolvedTickets.length;

    
  }

  // Show real-time notification
  showRealtimeNotification(ticket) {
    const statusChanges = ['In Progress', 'Resolved', 'Closed', 'Finish', 'Rejected'];

    if (statusChanges.includes(ticket.status)) {
      const notification = document.createElement('div');
      notification.className = 'realtime-notification';
      notification.innerHTML = `
        <div class="notification-content">
          <i class="fas fa-sync-alt"></i>
          <div>
            <strong>Ticket ${ticket.code} Updated</strong>
            <p>Status changed to: <span class="status-${ticket.status.toLowerCase()}">${ticket.status}</span></p>
            ${ticket.action_by && ticket.action_by !== 'Unassigned' ? `
              <p>Now assigned to: <strong>${ticket.action_by}</strong></p>
            ` : ''}
          </div>
          <button class="notification-close">&times;</button>
        </div>
      `;

      // Styling untuk notification
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-left: 4px solid #ef070a;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 16px;
        z-index: 10000;
        max-width: 350px;
        animation: slideInRight 0.3s ease-out;
      `;

      notification.querySelector('.notification-content').style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
      `;

      notification.querySelector('.notification-close').style.cssText = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        margin-left: auto;
      `;

      // Close button handler
      notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
      });

      // Auto remove setelah 5 detik
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 5000);
    }
  }

  // Cleanup
  cleanup() {
    if (this.unsubscribeTickets) {
      this.unsubscribeTickets();
      
    }
  }

  redirectToLogin() {
    
    this.cleanup();
    window.location.href = '../auth/login.html';
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
      this.cleanup();
      await this.authService.logout();
    }
  }

  loadUserInfo() {
    if (this.currentUser) {
      const userNameElement = document.getElementById('userName');
      const userEmailElement = document.getElementById('userEmail');
      const welcomeUserNameElement = document.getElementById('welcomeUserName');

      if (userNameElement) userNameElement.textContent = this.currentUser.full_name || 'User';
      if (userEmailElement) userEmailElement.textContent = this.currentUser.email || '';
      if (welcomeUserNameElement) welcomeUserNameElement.textContent = this.currentUser.full_name || 'User';

      if (document.getElementById('user_id')) {
        document.getElementById('user_id').value = this.currentUser.id;
        document.getElementById('user_name').value = this.currentUser.full_name || '';
        document.getElementById('user_email').value = this.currentUser.email || '';
        document.getElementById('user_department').value = this.currentUser.department || '';
        document.getElementById('created_at').value = new Date().toISOString();
      }
    }
  }

  initializeEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => this.openProfileModal());
    }

    const closeProfileModal = document.getElementById('closeProfileModal');
    if (closeProfileModal) {
      closeProfileModal.addEventListener('click', () => this.closeProfileModal());
    }

    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    if (cancelProfileEdit) {
      cancelProfileEdit.addEventListener('click', () => this.closeProfileModal());
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
    }

    const ticketForm = document.getElementById('ticketForm');
    if (ticketForm) {
      ticketForm.addEventListener('submit', (e) => this.handleTicketSubmit(e));
      ticketForm.addEventListener('reset', () => this.hideMessages());
    }

    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) this.closeProfileModal();
      });
    }

    // Assignment form events
    const assignmentScope = document.getElementById('assignment_scope');
    const assignmentMemberGroup = document.getElementById('assignmentMemberGroup');
    const assignmentForm = document.getElementById('assignmentForm');
    if (assignmentScope) {
      assignmentScope.addEventListener('change', () => {
        const v = assignmentScope.value;
        assignmentMemberGroup.style.display = v === 'single' ? 'block' : 'none';
      });
    }
    if (assignmentForm) {
      assignmentForm.addEventListener('submit', (e) => this.handleAssignmentSubmit(e));
    }
  }

  async initializeAssignmentSection() {
    const section = document.getElementById('itAssignmentSection');
    if (section) section.style.display = '';
    await this.loadITMembersForAssignment();
  }

  async loadITMembersForAssignment() {
    const memberSelect = document.getElementById('assignment_member');
    if (!memberSelect) return;

    const options = [];
    const emailsSet = new Set();

    const fallbackEmails = [
      'ade.reinalwi@meitech-ekabintan.com',
      'wahyu.nugroho@meitech-ekabintan.com',
      'riko.hermansyah@meitech-ekabintan.com',
      'abdurahman.hakim@meitech-ekabintan.com'
    ];

    for (const em of fallbackEmails) {
      const local = em.split('@')[0].replace(/\./g, ' ');
      const displayName = local.replace(/\b\w/g, c => c.toUpperCase());
      options.push({ uid: '', name: displayName, email: em });
      emailsSet.add(em.toLowerCase());
    }

    try {
      const snap = await getDocs(collection(this.db, 'admins'));
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const name = d.name || d.full_name || d.email || 'Unknown';
        const email = d.email || '';
        const isActive = d.is_active !== false;
        if (isActive) {
          const lower = email.toLowerCase();
          if (!emailsSet.has(lower)) {
            options.push({ uid: docSnap.id, name, email });
            if (email) emailsSet.add(lower);
          } else {
            const idx = options.findIndex(o => o.email.toLowerCase() === lower);
            if (idx !== -1) options[idx] = { uid: docSnap.id, name, email };
          }
        }
      });
    } catch (err) {
    }

    options.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    memberSelect.innerHTML = '<option value="" disabled selected>Select IT Member</option>' +
      options.map(o => `<option data-uid="${o.uid}" data-email="${o.email}" value="${o.uid || o.email}">${o.name}${o.email ? ` (${o.email})` : ''}</option>`).join('');
  }

  async handleAssignmentSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById('submitAssignmentBtn');
    if (!submitBtn) return;
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'flex';

    try {
      const scope = document.getElementById('assignment_scope')?.value || '';
      const memberSelect = document.getElementById('assignment_member');
      const selectedOpt = memberSelect && memberSelect.selectedIndex >= 0 ? memberSelect.options[memberSelect.selectedIndex] : null;
      const memberUid = selectedOpt ? (selectedOpt.dataset.uid || '') : '';
      const memberEmail = selectedOpt ? (selectedOpt.dataset.email || '') : '';
      const activity = document.getElementById('assignment_activity')?.value || '';
      const location = document.getElementById('assignment_location')?.value || '';
      const priority = document.getElementById('assignment_priority')?.value || 'Medium';
      const assignmentSubject = document.getElementById('assignment_subject')?.value?.trim() || '';
      const assignmentMessage = document.getElementById('assignment_message')?.value?.trim() || '';

      if (!scope || !activity || !location || (scope === 'single' && !memberUid && !memberEmail)) {
        throw new Error('Please fill in all required assignment fields');
      }

      let targetAdmin = null;
      if (scope === 'single') {
        if (memberUid) {
          const targetSnap = await getDoc(doc(this.db, 'admins', memberUid));
          if (targetSnap.exists()) {
            const td = targetSnap.data();
            targetAdmin = {
              uid: targetSnap.id,
              name: td.name || td.full_name || '',
              email: td.email || ''
            };
          } else {
            targetAdmin = { uid: memberUid, email: memberEmail || '' };
          }
        } else if (memberEmail) {
          targetAdmin = { uid: null, name: memberEmail.split('@')[0], email: memberEmail };
        }
      }

      try {
        await addDoc(collection(this.db, 'assignments'), {
          scope,
          activity,
          location,
          priority,
          subject: assignmentSubject || `Assignment: ${activity}`,
          message: assignmentMessage || `Scope: ${scope}${scope === 'single' ? ` | Target: ${targetAdmin?.name || memberEmail || ''}` : ' | All IT'} | Location: ${location}`,
          target_admin_uid: targetAdmin?.uid || null,
          target_admin_name: targetAdmin?.name || null,
          target_admin_email: targetAdmin?.email || memberEmail || null,
          created_by_uid: this.currentUser.id,
          created_by_email: this.currentUser.email,
          created_by_name: this.currentUser.full_name || 'IT',
          status: 'Assigned',
          created_at: serverTimestamp()
        });
      } catch (permErr) {
        // Fallback: create as ticket with is_assignment flag (allowed by Firestore rules)
        const ticketRef = await addDoc(collection(this.db, 'tickets'), {
          subject: assignmentSubject || `Assignment: ${activity}`,
          message: assignmentMessage || `Scope: ${scope}${scope === 'single' ? ` | Target: ${targetAdmin?.name || memberEmail || ''}` : ' | All IT'} | Location: ${location}`,
          location: location,
          inventory: '',
          device: 'Others',
          priority: priority || 'Medium',
          user_id: this.currentUser.id,
          user_name: this.currentUser.full_name || '',
          user_email: this.currentUser.email || '',
          user_department: this.currentUser.department || 'IT',
          user_phone: this.currentUser.phone || '',
          status: 'Open',
          qa: 'Open',
          created_at: serverTimestamp(),
          last_updated: serverTimestamp(),
          updates: [{
            status: 'Open',
            notes: 'Assignment created',
            timestamp: new Date().toISOString(),
            updatedBy: this.currentUser.full_name || 'IT'
          }],
          action_by: '',
          note: '',
          is_assignment: true,
          assignment_scope: scope,
          assignment_activity: activity,
          assignment_subject: assignmentSubject || `Assignment: ${activity}`,
          assignment_message: assignmentMessage || `Scope: ${scope}${scope === 'single' ? ` | Target: ${targetAdmin?.name || memberEmail || ''}` : ' | All IT'} | Location: ${location}`,
          target_admin_uid: targetAdmin?.uid || null,
          target_admin_email: targetAdmin?.email || memberEmail || null
        });

        const ticketCode = window.generateTicketId(
          this.currentUser.department || 'IT',
          'Others',
          location,
          ticketRef.id
        );
        await updateDoc(ticketRef, { code: ticketCode });
      }

      await Swal.fire({
        title: 'Assignment Created',
        text: 'Assignment has been created successfully',
        icon: 'success',
        confirmButtonColor: '#ef070a'
      });
      form.reset();
      const assignmentMemberGroup = document.getElementById('assignmentMemberGroup');
      if (assignmentMemberGroup) assignmentMemberGroup.style.display = 'none';
    } catch (error) {
      console.error('Error creating assignment:', error);
      await Swal.fire({
        title: 'Error',
        text: error.message || 'Failed to create assignment',
        icon: 'error',
        confirmButtonColor: '#ef070a'
      });
    } finally {
      submitBtn.disabled = false;
      if (btnText) btnText.style.display = 'block';
      if (btnLoading) btnLoading.style.display = 'none';
    }
  }

  openProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (profileModal && this.currentUser) {
      document.getElementById('edit_employee_id').value = this.currentUser.employee_id || '';
      document.getElementById('edit_full_name').value = this.currentUser.full_name || '';
      document.getElementById('edit_email').value = this.currentUser.email || '';
      document.getElementById('edit_phone').value = this.currentUser.phone || '';
      document.getElementById('edit_department').value = this.currentUser.department || '';
      document.getElementById('edit_location').value = this.currentUser.location || '';
      const employeeIdField = document.getElementById('edit_employee_id');
      if (employeeIdField) {
        employeeIdField.readOnly = false;
        employeeIdField.placeholder = "Optional - Employee ID";
        employeeIdField.title = "Employee ID (optional)";
        employeeIdField.style.backgroundColor = '';
        employeeIdField.style.color = '';
        employeeIdField.style.cursor = '';
      }
      profileModal.style.display = 'flex';
    }
  }
  closeProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
      // Reset employee_id field ke state normal
      const employeeIdField = document.getElementById('edit_employee_id');
      if (employeeIdField) {
        employeeIdField.readOnly = false;
        employeeIdField.style.backgroundColor = '';
        employeeIdField.style.color = '';
        employeeIdField.style.cursor = '';
        employeeIdField.title = '';
        employeeIdField.placeholder = '';
      }

      profileModal.style.display = 'none';
    }
  }

  // Enhanced profile update dengan ticket sync
  async handleProfileUpdate(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating Profile & Tickets...';
    submitBtn.disabled = true;

    try {
      const formData = this.getFormData(form);

      // Pre-process data sebelum validasi
      const processedData = this.preProcessFormData(formData);

      // Validasi form
      const validation = this.validateProfileForm(processedData);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // Update profile menggunakan service (sekarang termasuk ticket update)
      const result = await firebaseAuthService.updateUserProfile(this.currentUser.id, processedData);

      if (!result.success) {
        throw new Error(result.message);
      }

      // Update current user data dengan data yang sudah diproses
      this.currentUser = {
        ...this.currentUser,
        ...processedData,
        updated_at: new Date().toISOString()
      };

      this.loadUserInfo();

      await Swal.fire({
        title: 'Success!',
        text: result.message || 'Profile updated successfully! All related tickets have been updated.',
        icon: 'success',
        confirmButtonColor: '#ef070a',
        confirmButtonText: 'OK'
      });

      this.closeProfileModal();

    } catch (error) {
      console.error('❌ Profile update error:', error);
      await Swal.fire({
        title: 'Error!',
        text: error.message,
        icon: 'error',
        confirmButtonColor: '#ef070a',
        confirmButtonText: 'OK'
      });
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  // Pre-process form data untuk handle empty values
  preProcessFormData(formData) {
    const processed = { ...formData };

    // Handle empty employee_id (ubah "-" jadi empty string)
    if (processed.employee_id === '-' || processed.employee_id === 'null') {
      processed.employee_id = '';
    }

    // Handle empty phone
    if (!processed.phone || processed.phone === 'null' || processed.phone === 'undefined') {
      processed.phone = '';
    }

    // Trim semua string values
    Object.keys(processed).forEach(key => {
      if (typeof processed[key] === 'string') {
        processed[key] = processed[key].trim();
      }
    });

    return processed;
  }

  // Enhanced form validation
  validateProfileForm(formData) {
    const requiredFields = ['full_name', 'email', 'department', 'location'];

    for (const field of requiredFields) {
      if (!formData[field] || formData[field].toString().trim() === '') {
        return {
          isValid: false,
          message: `${field.replace('_', ' ')} is required`
        };
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return {
        isValid: false,
        message: 'Please enter a valid email address'
      };
    }

    return { isValid: true };
  }

  getFormData(form) {
    const data = {};
    for (const [key, value] of new FormData(form)) {
      data[key] = value;
    }
    return data;
  }

  async handleTicketSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById('submitTicketBtn');
    if (!submitBtn) return;

    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'flex';
    this.hideMessages();

    try {
      const formData = this.getFormData(form);
      const validation = this.validateTicketForm(formData);
      if (!validation.isValid) throw new Error(validation.message);

      // Diagnostic: ensure auth uid matches payload
      if (!this.currentUser || !this.currentUser.id) {
        throw new Error('Not authenticated. Please sign in again.');
      }
      if (this.currentUser && formData) {
        console.debug('[TicketSubmit] auth.uid=', this.currentUser.id, ' payload.user_id will be set to same uid');
      }

      // ✅ BUAT TICKET DULU UNTUK DAPAT ID
      const ticketRef = await addDoc(collection(this.db, "tickets"), {
        // Data sementara tanpa code
        subject: formData.subject,
        message: formData.message,
        location: formData.location,
        inventory: formData.inventory,
        device: formData.device,
        priority: formData.priority,
        user_id: this.currentUser.id,
        user_name: this.currentUser.full_name || '',
        user_email: this.currentUser.email || '',
        user_department: this.currentUser.department || '',
        user_phone: this.currentUser.phone || '',
        status: 'Open',
        qa: 'Open',
        created_at: serverTimestamp(),
        last_updated: serverTimestamp(),
        updates: [{
          status: 'Open',
          notes: 'Ticket created by user',
          timestamp: new Date().toISOString(),
          updatedBy: this.currentUser.full_name || 'User'
        }],
        action_by: '',
        note: ''
      });

      

      // ✅ GENERATE CODE DENGAN FIRESTORE ID (3 karakter terakhir)
      const ticketCode = window.generateTicketId(
        this.currentUser.department,
        formData.device,
        formData.location,
        ticketRef.id  // Kirim Firestore ID untuk diambil 3 karakter terakhir
      );

      

      // ✅ UPDATE TICKET DENGAN CODE YANG SUDAH DIGENERATE
      await updateDoc(ticketRef, {
        code: ticketCode
      });

      // ✅ TAMPILKAN SWEETALERT SUCCESS DENGAN DURASI
      await this.showSuccessAlert(ticketCode, formData);
      form.reset();

    } catch (error) {
      console.error('[TicketSubmit] code=', error?.code, ' message=', error?.message);
      const msg = (error && (error.code === 'permission-denied' || /insufficient permissions/i.test(error?.message)))
        ? 'Permission denied. Please sign in again or contact support.'
        : (error.message || 'Failed to create ticket');
      console.error('❌ Error creating ticket:', error);
      this.showError(msg);
    } finally {
      submitBtn.disabled = false;
      if (btnText) btnText.style.display = 'block';
      if (btnLoading) btnLoading.style.display = 'none';
    }
  }

  validateTicketForm(formData) {
    const required = ['inventory', 'device', 'location', 'priority', 'subject', 'message'];
    for (const field of required) {
      if (!formData[field]?.trim()) {
        return { isValid: false, message: 'Please fill in all required fields' };
      }
    }
    return { isValid: true };
  }

  // Method untuk menampilkan SweetAlert sukses dengan durasi
  async showSuccessAlert(ticketCode, formData) {
    // Format priority untuk display
    const priorityMap = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'urgent': 'Urgent'
    };

    const priorityDisplay = priorityMap[formData.priority] || formData.priority;

    return Swal.fire({
      title: '🎉 Ticket Created Successfully!',
      html: `
        <div class="ticket-success-alert">
          <div class="success-header">
            <i class="fas fa-check-circle"></i>
            <h3>Your ticket has been submitted</h3>
          </div>
          
          <div class="ticket-details">
            <div class="detail-row">
              <span class="detail-label">Ticket Code:</span>
              <span class="detail-value ticket-code">${ticketCode}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Subject:</span>
              <span class="detail-value">${formData.subject}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Priority:</span>
              <span class="detail-value priority-${formData.priority}">${priorityDisplay}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Device:</span>
              <span class="detail-value">${formData.device}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${formData.location}</span>
            </div>
          </div>

          <div class="success-message">
            <p>✅ Your ticket has been logged and our team will review it shortly.</p>
            <p>📧 You will receive updates via email.</p>
            <p>⏰ Expected response time: <strong>1-2 business days</strong></p>
          </div>
        </div>
      `,
      icon: 'success',
      iconColor: '#10b981',
      confirmButtonText: 'Got It!',
      confirmButtonColor: '#ef070a',
      background: '#f8fafc',
      showClass: {
        popup: 'animate__animated animate__fadeInDown animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster'
      },
      timer: 8000, // Auto close setelah 8 detik
      timerProgressBar: true,
      willClose: () => {
        
      }
    });
  }

  showError(message) {
    const el = document.getElementById('ticketErrorMessage');
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
      setTimeout(() => el.style.display = 'none', 5000);
    }
  }

  showSuccess(message) {
    const el = document.getElementById('ticketSuccessMessage');
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
      setTimeout(() => el.style.display = 'none', 5000);
    }
  }

  hideMessages() {
    const e = document.getElementById('ticketErrorMessage');
    const s = document.getElementById('ticketSuccessMessage');
    if (e) e.style.display = 'none';
    if (s) s.style.display = 'none';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  
  new Dashboard();
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .status-open { color: #ef070a; }
  .status-in-progress { color: #f59e0b; }
  .status-pending { color: #8b5cf6; }
  .status-resolved { color: #10b981; }
  .status-closed { color: #6b7280; }
  .status-finish { color: #10b981; }
  .status-rejected { color: #ef4444; }
  
  .ticket-temporary {
    opacity: 0.7;
    background: #f8f9fa;
  }
  
  .ticket-saving {
    color: #6c757d;
    font-style: italic;
  }
  
  .ticket-assigned {
    background: #f8f9fa;
    padding: 8px 12px;
    border-radius: 6px;
    margin: 8px 0;
    border-left: 3px solid #ef070a;
  }
  
  .ticket-unassigned {
    background: #f3f4f6;
    padding: 8px 12px;
    border-radius: 6px;
    margin: 8px 0;
    border-left: 3px solid #9ca3af;
  }
  
  .unassigned-text {
    color: #6b7280;
    font-style: italic;
  }
  
  .ticket-assigned small, .ticket-unassigned small {
    color: #495057;
    font-weight: 500;
  }
  
  .ticket-notes, .ticket-updates {
    background: #fff3cd;
    padding: 8px 12px;
    border-radius: 6px;
    margin: 6px 0;
    border-left: 3px solid #ffc107;
  }
  
  .ticket-notes small, .ticket-updates small {
    color: #856404;
  }
  
  .ticket-actions {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
  }
  
  .btn-delete-ticket {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .btn-delete-ticket:hover {
    background: #fecaca;
    color: #b91c1c;
    border-color: #fca5a5;
  }
  
  .btn-delete-ticket:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .ticket-item.deletable {
    border: 2px solid #f59e0b;
    background: #fffbeb;
  }

  
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #6b7280;
  }
  
  .empty-state i {
    font-size: 3rem;
    margin-bottom: 16px;
    color: #d1d5db;
  }
  
  .empty-state h3 {
    margin: 0 0 8px 0;
    color: #374151;
  }
  
  .empty-state p {
    margin: 0;
    color: #6b7280;
  }
`;

// CSS untuk success alert
const successAlertStyle = document.createElement('style');
successAlertStyle.textContent = `
  .ticket-success-alert {
    text-align: left;
    padding: 10px 0;
  }
  
  .success-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    justify-content: center;
  }
  
  .success-header i {
    font-size: 2rem;
    color: #10b981;
  }
  
  .success-header h3 {
    margin: 0;
    color: #065f46;
    font-size: 1.4rem;
  }
  
  .ticket-details {
    background: white;
    border-radius: 8px;
    padding: 15px;
    margin: 15px 0;
    border: 1px solid #e5e7eb;
  }
  
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .detail-row:last-child {
    border-bottom: none;
  }
  
  .detail-label {
    font-weight: 600;
    color: #374151;
  }
  
  .detail-value {
    color: #6b7280;
  }
  
  .ticket-code {
    font-weight: bold;
    color: #ef070a;
    font-size: 1.1em;
  }
  
  .success-message {
    background: #d1fae5;
    border: 1px solid #a7f3d0;
    border-radius: 8px;
    padding: 15px;
    margin-top: 15px;
  }
  
  .success-message p {
    margin: 5px 0;
    color: #065f46;
  }
  
  .swal2-popup {
    border-radius: 12px !important;
  }
  
  .swal2-timer-progress-bar {
    background: #ef070a !important;
  }
`;

// CSS untuk delete confirmation
const deleteConfirmationStyle = document.createElement('style');
deleteConfirmationStyle.textContent = `
  .delete-confirmation {
    text-align: left;
  }
  
  .warning-text {
    color: #dc2626;
    font-weight: 600;
    margin: 10px 0;
  }
  
  .delete-success {
    text-align: center;
  }
  
  .delete-success i {
    font-size: 3rem;
    margin-bottom: 15px;
  }
  
  .text-success {
    color: #10b981;
  }
`;

// Tambahkan semua styles ke document head
document.head.appendChild(style);
document.head.appendChild(successAlertStyle);
document.head.appendChild(deleteConfirmationStyle);
