// Import dependencies
import { 
  getAuth, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query, where, orderBy,
  serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// Import instance
import firebaseAuthService from '../services/firebase-auth-service.js';

// Firebase configuration dari CONFIG
const firebaseConfig = window.CONFIG.FIREBASE_CONFIG;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

class Dashboard {
  constructor() {
    this.currentUser = null;
    this.tickets = [];
    this.authService = firebaseAuthService;
    this.db = getFirestore(app);
    this.unsubscribeTickets = null;
    this.init();
  }

  async init() {
    try {
        console.log('Dashboard initializing...');
        
        const user = await this.authService.getCurrentUser();
        
        if (!user) {
            this.redirectToLogin();
            return;
        }

        // Check admin collection
        const adminDoc = await getDoc(doc(this.db, "admins", user.uid));
        
        if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            console.log('✅ Admin detected:', adminData.role, 'redirecting to admin dashboard...');
            window.location.href = '../admin/index.html';
            return;
        }

        // Check user collection
        const userDoc = await getDoc(doc(this.db, "users", user.uid));
        
        if (!userDoc.exists()) {
            console.log('❌ User data not found in Firestore');
            this.redirectToLogin();
            return;
        }

        const userData = userDoc.data();
        
        // Check role
        if (userData.role && userData.role !== 'user') {
            console.log('🔄 Non-user role detected:', userData.role, 'redirecting to admin...');
            window.location.href = '../admin/index.html';
            return;
        }

        // Regular user
        this.currentUser = {
            id: user.uid,
            ...userData
        };

        console.log('✅ User authenticated:', this.currentUser);

        // Setup realtime listener FIRST
        await this.setupRealtimeTickets();
        this.loadUserInfo();
        this.initializeEventListeners();

    } catch (error) {
        console.error('Dashboard init error:', error);
        this.redirectToLogin();
    }
  }

  // Setup Realtime Listener for Tickets
  async setupRealtimeTickets() {
    try {
      const q = query(
        collection(this.db, "tickets"), 
        where("user_id", "==", this.currentUser.id),
        orderBy("created_at", "desc")
      );

      // Remove previous listener if exists
      if (this.unsubscribeTickets) {
        this.unsubscribeTickets();
      }

      // ✅ FIRST: Load initial data immediately
      const initialSnapshot = await getDocs(q);
      this.tickets = [];
      
      initialSnapshot.forEach(doc => {
        const ticket = this.normalizeTicketData(doc.id, doc.data());
        this.tickets.push(ticket);
      });
      
      // Render initial data
      this.renderTickets();
      this.updateStats();
      console.log('✅ Initial tickets loaded:', this.tickets.length);

      // Debug initial tickets
      console.log('=== INITIAL TICKET LOAD ===');
      this.debugTicketStatus();

      // ✅ SECOND: Setup realtime listener for changes
      this.unsubscribeTickets = onSnapshot(q, (snapshot) => {
        console.log('🔄 Realtime update received for tickets');
        
        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const ticket = this.normalizeTicketData(doc.id, doc.data());
          
          if (change.type === "added") {
            // Check if ticket already exists (avoid duplicates)
            const existingIndex = this.tickets.findIndex(t => t.id === doc.id);
            if (existingIndex === -1) {
              console.log('➕ New ticket detected:', ticket.code);
              this.tickets.unshift(ticket); // Add to beginning
            }
          }
          if (change.type === "modified") {
            console.log('✏️ Updated ticket:', ticket.code, 'Status:', ticket.status);
            const index = this.tickets.findIndex(t => t.id === doc.id);
            if (index !== -1) {
              this.tickets[index] = ticket;
              this.showRealtimeNotification(ticket);
            } else {
              // If not found, add it
              this.tickets.unshift(ticket);
            }
          }
          if (change.type === "removed") {
            console.log('🗑️ Removed ticket:', ticket.code);
            this.tickets = this.tickets.filter(t => t.id !== doc.id);
          }
        });

        // Sort tickets by date
        this.tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Update UI
        this.renderTickets();
        this.updateStats();
        
        console.log('✅ Tickets updated in realtime. Total:', this.tickets.length);
        
      }, (error) => {
        console.error('Error in realtime listener:', error);
        this.showError('Failed to get realtime updates');
      });

    } catch (error) {
      console.error('Error setting up realtime listener:', error);
    }
  }

  // Normalize ticket data
  normalizeTicketData(id, data) {
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
      action_by: data.action_by || '',
      note: data.note || '',
      qa: data.qa || '',
      user_phone: data.user_phone || '',
      updates: data.updates || [],
      deleted: data.deleted || false,
      archived: data.archived || false
    };
  }

  // Di bagian method handleStatusUpdate() atau method yang menangani perubahan status
async handleStatusUpdate(ticketId, newStatus, note = '') {
  try {
    const ticketRef = doc(this.db, "tickets", ticketId);
    const ticketDoc = await getDoc(ticketRef);
    
    if (!ticketDoc.exists()) {
      throw new Error('Ticket not found');
    }

    const ticketData = ticketDoc.data();
    
    // VALIDASI: Jika status berubah ke resolved/closed/finished, wajib ada note
    const resolvingStatuses = ['resolved', 'closed', 'completed', 'finished', 'finish'];
    const isResolving = resolvingStatuses.includes(newStatus.toLowerCase());
    
    if (isResolving && (!note || note.trim() === '')) {
      throw new Error('Note is required when resolving a ticket. Please describe the solution or reason for closure.');
    }

    const updateData = {
      status: newStatus,
      last_updated: serverTimestamp(),
      action_by: this.currentUser.full_name || 'Admin'
    };

    // Jika ada note, tambahkan ke updateData
    if (note && note.trim() !== '') {
      updateData.note = note.trim();
      
      // Tambahkan ke history updates
      const newUpdate = {
        status: newStatus,
        notes: note.trim(),
        timestamp: new Date().toISOString(),
        updatedBy: this.currentUser.full_name || 'Admin'
      };

      const existingUpdates = ticketData.updates || [];
      updateData.updates = [...existingUpdates, newUpdate];
    }

    // Untuk status finish di field qa
    if (newStatus.toLowerCase() === 'finish') {
      updateData.qa = 'Finish';
      
      // Validasi tambahan untuk qa finish
      if (!note || note.trim() === '') {
        throw new Error('Note is required when marking ticket as finished in QA. Please describe the final resolution.');
      }
    }

    await updateDoc(ticketRef, updateData);
    
    return true;
  } catch (error) {
    console.error('Error updating ticket status:', error);
    throw error;
  }
}

// Method untuk menampilkan modal konfirmasi dengan note
async showResolveConfirmation(ticket) {
  const { value: note } = await Swal.fire({
    title: `Resolve Ticket ${ticket.code}`,
    html: `
      <div class="resolve-modal">
        <p><strong>Current Status:</strong> ${ticket.status}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <div class="form-group">
          <label for="resolveNote"><strong>Resolution Notes *</strong></label>
          <textarea 
            id="resolveNote" 
            class="swal2-textarea" 
            placeholder="Please describe the solution, steps taken, or reason for closure. This will be included in reports."
            rows="4"
            required
          >${ticket.note || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="resolveStatus"><strong>Final Status *</strong></label>
          <select id="resolveStatus" class="swal2-select" required>
            <option value="">Select Status</option>
            <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            <option value="Closed" ${ticket.status === 'Closed' ? 'selected' : ''}>Closed</option>
            <option value="Completed" ${ticket.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Finish" ${ticket.qa === 'Finish' ? 'selected' : ''}>Finish (QA)</option>
          </select>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Confirm Resolution',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#6b7280',
    preConfirm: () => {
      const note = document.getElementById('resolveNote').value.trim();
      const status = document.getElementById('resolveStatus').value;
      
      if (!note) {
        Swal.showValidationMessage('Resolution notes are required');
        return false;
      }
      
      if (!status) {
        Swal.showValidationMessage('Please select a status');
        return false;
      }
      
      return { note, status };
    }
  });

  if (note) {
    try {
      await this.handleStatusUpdate(ticket.id, note.status, note.note);
      
      Swal.fire({
        title: 'Success!',
        text: `Ticket ${ticket.code} has been resolved`,
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (error) {
      Swal.fire({
        title: 'Error!',
        text: error.message,
        icon: 'error',
        confirmButtonColor: '#ef4444'
      });
    }
  }
}

  // Debug method untuk melihat status semua ticket
  debugTicketStatus() {
    console.log('🔍 DEBUG TICKET STATUS:');
    
    const activeTickets = this.tickets.filter(ticket => 
      !ticket.deleted && !ticket.archived
    );
    
    console.log('📋 ACTIVE TICKETS (' + activeTickets.length + '):');
    if (activeTickets.length === 0) {
      console.log('   No active tickets found');
    } else {
      activeTickets.forEach((ticket, index) => {
        const isOpen = this.isTicketOpen(ticket);
        const isResolved = this.isTicketResolved(ticket);
        
        console.log(`  ${index + 1}. ${ticket.code}`, {
          status: ticket.status,
          qa: ticket.qa,
          isOpen: isOpen,
          isResolved: isResolved,
          category: isOpen ? 'OPEN' : (isResolved ? 'RESOLVED' : 'OTHER')
        });
      });
    }

    // Tampilkan deleted/archived tickets juga untuk reference
    const inactiveTickets = this.tickets.filter(ticket => 
      ticket.deleted || ticket.archived
    );
    
    if (inactiveTickets.length > 0) {
      console.log('🚫 INACTIVE TICKETS (deleted/archived): ' + inactiveTickets.length);
      inactiveTickets.forEach((ticket, index) => {
        console.log(`  ${index + 1}. ${ticket.code} - status:${ticket.status} deleted:${ticket.deleted} archived:${ticket.archived}`);
      });
    }

    console.log('📊 SUMMARY:');
    console.log('   Total tickets:', this.tickets.length);
    console.log('   Active tickets:', activeTickets.length);
    console.log('   Inactive tickets:', inactiveTickets.length);
  }

// Helper method untuk menentukan apakah ticket open - FIXED VERSION
isTicketOpen(ticket) {
  const status = (ticket.status || '').toLowerCase().trim();
  const qa = (ticket.qa || '').toLowerCase().trim();
  
  console.log(`🔍 STATUS CHECK for ${ticket.code}:`, { status, qa });
  
  // PRIORITIZE STATUS over QA
  // Jika status sudah jelas resolved/closed, abaikan qa
  if (status === 'resolved' || status === 'closed' || status === 'completed' || status === 'finished') {
    console.log(`   ❌ ${ticket.code} - RESOLVED (status is clearly "${status}")`);
    return false;
  }
  
  // Jika status jelas open/in progress
  if (status === 'open' || status === 'in progress' || status === 'pending') {
    console.log(`   ✅ ${ticket.code} - OPEN (status is "${status}")`);
    return true;
  }
  
  // Jika status tidak jelas, check qa sebagai fallback
  if (qa === 'open') {
    console.log(`   ✅ ${ticket.code} - OPEN (qa is "open", status ambiguous: "${status}")`);
    return true;
  }
  
  if (qa === 'finish' || qa === 'finished') {
    console.log(`   ❌ ${ticket.code} - RESOLVED (qa is "${qa}")`);
    return false;
  }
  
  // Default case: jika tidak ada info yang jelas, consider as resolved untuk safety
  console.warn(`❓ ${ticket.code} - AMBIGUOUS (status:"${status}", qa:"${qa}") - defaulting to RESOLVED for safety`);
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
      console.log('🧹 Realtime listener cleaned up');
    }
  }

  redirectToLogin() {
    console.log('Redirecting to login...');
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
      profileModal.style.display = 'flex';
    }
  }

  closeProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (profileModal) profileModal.style.display = 'none';
  }

  async handleProfileUpdate(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    submitBtn.disabled = true;

    try {
      const formData = this.getFormData(form);
      const validation = this.validateProfileForm(formData);
      if (!validation.isValid) throw new Error(validation.message);

      await updateDoc(doc(this.db, "users", this.currentUser.id), formData);
      this.currentUser = { ...this.currentUser, ...formData };
      this.loadUserInfo();

      await Swal.fire({
        title: 'Success!',
        text: 'Profile updated successfully!',
        icon: 'success',
        confirmButtonColor: '#ef070a',
        confirmButtonText: 'OK'
      });
      this.closeProfileModal();
    } catch (error) {
      Swal.fire({
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

  getFormData(form) {
    const data = {};
    for (const [key, value] of new FormData(form)) {
      data[key] = value;
    }
    return data;
  }

  validateProfileForm(formData) {
    const required = ['full_name', 'email', 'department', 'location'];
    for (const field of required) {
      if (!formData[field]?.trim()) return { isValid: false, message: 'Please fill in all required fields' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return { isValid: false, message: 'Please enter a valid email address' };
    }
    return { isValid: true };
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

      console.log('🔍 DEBUG - Firestore ID:', ticketRef.id);
      console.log('🔍 DEBUG - Department:', this.currentUser.department);
      console.log('🔍 DEBUG - Device:', formData.device);
      console.log('🔍 DEBUG - Location:', formData.location);

      // ✅ GENERATE CODE DENGAN FIRESTORE ID (3 karakter terakhir)
      const ticketCode = window.generateTicketId(
        this.currentUser.department, 
        formData.device, 
        formData.location,
        ticketRef.id  // Kirim Firestore ID untuk diambil 3 karakter terakhir
      );

      console.log('🎫 Generated Ticket Code:', ticketCode, 'from ID:', ticketRef.id);

      // ✅ UPDATE TICKET DENGAN CODE YANG SUDAH DIGENERATE
      await updateDoc(ticketRef, {
        code: ticketCode
      });

      this.showSuccess(`Ticket ${ticketCode} created successfully!`);
      form.reset();

    } catch (error) {
      console.error('❌ Error creating ticket:', error);
      this.showError(error.message || 'Failed to create ticket');
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

  // Tambahkan method ini di class Dashboard
getTicketStatusDisplay(ticket) {
  const status = (ticket.status || '').toLowerCase();
  const qa = (ticket.qa || '').toLowerCase();
  
  // Prioritize status over qa
  if (status === 'resolved' || status === 'closed' || status === 'completed' || status === 'finished') {
    return 'Resolved';
  }
  
  if (status === 'in progress' || status === 'pending') {
    return 'In Progress';
  }
  
  // Fallback to qa
  if (qa === 'finish' || qa === 'finished') {
    return 'Resolved';
  }
  
  if (qa === 'open') {
    return 'Open';
  }
  
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Update method renderTickets() - ganti bagian ticket-status
renderTickets() {
  const ticketsList = document.getElementById('ticketsList');
  if (!ticketsList) return;

  const activeTickets = this.tickets.filter(ticket => 
    !ticket.deleted && !ticket.archived
  );

  console.log('🎫 Rendering', activeTickets.length, 'active tickets out of', this.tickets.length, 'total');

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
    
    return `
      <div class="ticket-item ${ticket.id.startsWith('temp-') ? 'ticket-temporary' : ''}">
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
          ${ticket.action_by ? `
            <div class="ticket-assigned">
              <small>Assigned to: ${ticket.action_by}</small>
            </div>
          ` : ''}
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
}

 updateStats() {
  console.log('🔄 UPDATING STATS - Detailed mismatch investigation');
  
  // 1. Filter hanya ticket aktif
  const activeTickets = this.tickets.filter(ticket => 
    !ticket.deleted && !ticket.archived
  );

  console.log('🔍 INVESTIGATING MISMATCH:');
  
  // 2. Temukan ticket mana yang dihitung sebagai OPEN tapi di UI tidak
  const calculatedOpenTickets = [];
  const calculatedResolvedTickets = [];
  
  activeTickets.forEach((ticket) => {
    const isOpen = this.isTicketOpen(ticket);
    if (isOpen) {
      calculatedOpenTickets.push(ticket);
      console.log(`❓ CALCULATED AS OPEN: ${ticket.code}`, {
        status: ticket.status,
        qa: ticket.qa,
        isOpen: true
      });
    } else {
      calculatedResolvedTickets.push(ticket);
    }
  });

  // 3. Periksa UI untuk setiap ticket yang dihitung sebagai OPEN
  console.log('👀 CHECKING UI FOR CALCULATED OPEN TICKETS:');
  calculatedOpenTickets.forEach(openTicket => {
    const ticketElement = Array.from(document.querySelectorAll('.ticket-item')).find(el => {
      const codeEl = el.querySelector('.ticket-code');
      return codeEl && codeEl.textContent === openTicket.code;
    });
    
    if (ticketElement) {
      const statusEl = ticketElement.querySelector('.ticket-status');
      const statusText = statusEl ? statusEl.textContent : 'NO STATUS ELEMENT';
      console.log(`   ${openTicket.code} - UI shows: "${statusText}"`);
      
      // Cek apakah UI menunjukkan sebagai resolved
      const isUIResolved = statusText.toLowerCase().includes('resolved') || 
                          statusText.toLowerCase().includes('closed') ||
                          statusText.toLowerCase().includes('finish') ||
                          statusText.toLowerCase().includes('completed');
      
      if (isUIResolved) {
        console.error(`🚨 CONFLICT FOUND: ${openTicket.code} is calculated as OPEN but UI shows as RESOLVED!`);
        console.error(`   Firestore data: status="${openTicket.status}", qa="${openTicket.qa}"`);
        console.error(`   UI shows: "${statusText}"`);
      }
    } else {
      console.warn(`   ${openTicket.code} - NOT FOUND IN UI (might be filtered out)`);
    }
  });

  // 4. Hitung stats seperti biasa
  const calculatedOpenCount = calculatedOpenTickets.length;
  const calculatedResolvedCount = calculatedResolvedTickets.length;

  // 5. Hitung berdasarkan UI
  const visibleTickets = document.querySelectorAll('.ticket-item');
  let uiOpenCount = 0;
  
  visibleTickets.forEach(ticketEl => {
    const statusEl = ticketEl.querySelector('.ticket-status');
    if (statusEl) {
      const statusText = statusEl.textContent.toLowerCase();
      if (statusText.includes('open') || statusText.includes('progress') || statusText.includes('pending')) {
        uiOpenCount++;
      }
    }
  });

  const uiResolvedCount = visibleTickets.length - uiOpenCount;

  console.log('📊 COMPARISON:');
  console.log('   Calculated - Open:', calculatedOpenCount, 'Resolved:', calculatedResolvedCount);
  console.log('   UI Visible - Open:', uiOpenCount, 'Resolved:', uiResolvedCount);

  // 6. Tampilkan semua ticket untuk reference
  console.log('📋 ALL ACTIVE TICKETS FOR REFERENCE:');
  activeTickets.forEach((ticket, index) => {
    console.log(`   ${index + 1}. ${ticket.code} - status:"${ticket.status}" qa:"${ticket.qa}"`);
  });

  // 7. Gunakan UI-based count (prioritize what user sees)
  const finalOpenCount = uiOpenCount;
  const finalResolvedCount = uiResolvedCount;

  console.warn(`⚠️  USING UI-BASED COUNT: ${finalOpenCount} open, ${finalResolvedCount} resolved`);

  // 8. Update UI
  const openEl = document.getElementById('openTickets');
  const resolvedEl = document.getElementById('resolvedTickets');
  
  if (openEl) openEl.textContent = finalOpenCount;
  if (resolvedEl) resolvedEl.textContent = finalResolvedCount;

  return {
    calculated: { open: calculatedOpenCount, resolved: calculatedResolvedCount },
    ui: { open: uiOpenCount, resolved: uiResolvedCount },
    final: { open: finalOpenCount, resolved: finalResolvedCount },
    problematicTickets: calculatedOpenTickets.filter(ticket => {
      const ticketElement = Array.from(document.querySelectorAll('.ticket-item')).find(el => {
        const codeEl = el.querySelector('.ticket-code');
        return codeEl && codeEl.textContent === ticket.code;
      });
      if (ticketElement) {
        const statusEl = ticketElement.querySelector('.ticket-status');
        const statusText = statusEl ? statusEl.textContent.toLowerCase() : '';
        return !(statusText.includes('open') || statusText.includes('progress') || statusText.includes('pending'));
      }
      return false;
    })
  };
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
  console.log('Initializing Dashboard with Realtime Updates...');
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
  
  .status-in-progress { color: #f59e0b; }
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
`;
document.head.appendChild(style);