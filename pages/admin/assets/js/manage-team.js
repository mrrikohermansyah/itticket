// pages/admin/assets/js/manage-team.js
import firebaseAuthService from '../../../../assets/js/services/firebase-auth-service.js';
import { 
    doc, 
    getDoc,
    deleteDoc,
    setDoc,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../../../../assets/js/utils/firebase-config.js';

class TeamManagement {
    constructor() {
    this.adminUser = null;
    this.itTeam = [];
    
    // ✅ Binding methods untuk event handlers
    this.handleTeamClick = this.handleTeamClick.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
    this.showPermissionError = this.showPermissionError.bind(this);
        this.showCannotModifySelfError = this.showCannotModifySelfError.bind(this);
        this.cacheTTL = 60000;
    
    this.init();
}

    async getDB() {
        try { if (db) return db; } catch (_) {}
        try { if (window.db) return window.db; } catch (_) {}
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { getApp, initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        let app;
        try { app = getApp(); } catch (_) { const cfg = window.CONFIG?.FIREBASE_CONFIG || {}; app = initializeApp(cfg); }
        return getFirestore(app);
    }

    async init() {
        await this.checkAuth();
        await this.testServiceMethods();
        this.initializeEventListeners();
        this.toggleAddFormVisibility();
        let usedCache = false;
        try {
            const key = `adminsCache:${this.adminUser?.uid || 'global'}`;
            const cached = JSON.parse(localStorage.getItem(key) || 'null');
            const now = Date.now();
            if (cached && Array.isArray(cached.items) && cached.items.length && cached.ts && (now - cached.ts) < this.cacheTTL) {
                this.itTeam = cached.items;
                this.renderTeam();
                usedCache = true;
            }
        } catch (_) {}
        if (!usedCache) {
            await this.loadTeamData();
        }
    }
    // ✅ TEST METHOD - Tambahkan di class
// ✅ TEST METHOD - Tambahkan di testServiceMethods()
// ✅ TAMBAHKAN DI testServiceMethods()
async testServiceMethods() {
    try {
        // console.log('🧪 Testing service methods...');
        
        // Test getITSupportTeam
        const team = await firebaseAuthService.getITSupportTeam();
        // console.log('👥 getITSupportTeam ALL result:', team);
        
        // Check active vs inactive
        const activeMembers = team.filter(member => member.is_active);
        const inactiveMembers = team.filter(member => !member.is_active);
        
        // console.log('📊 Active members:', activeMembers.length, activeMembers);
        // console.log('📊 Inactive members:', inactiveMembers.length, inactiveMembers);
        
        // Check total admins in Firestore
        // console.log('🔍 Total team members loaded:', team.length);
        
    } catch (error) {
        console.error('❌ Service test failed:', error);
    }
}

// ✅ PANGGIL DI init() SETELAH checkAuth()
async init() {
    await this.checkAuth();
    
    // ✅ TEST SERVICE METHODS
    await this.testServiceMethods();
    
    this.initializeEventListeners();
    this.toggleAddFormVisibility();
    await this.loadTeamData();
}

    updateCurrentUserInfo() {
    if (this.adminUser) {
        const userNameElement = document.getElementById('currentUserName');
        const userRoleElement = document.getElementById('currentUserRole');
        
        if (userNameElement) {
            userNameElement.textContent = this.adminUser.name || this.adminUser.email || 'Unknown User';
        }
        
        if (userRoleElement) {
            userRoleElement.textContent = this.adminUser.role || 'Admin';
        }
        
        // console.log('✅ Current user info updated:', {
        //     name: this.adminUser.name,
        //     role: this.adminUser.role
        // });
    }
}

// ✅ BUAT METHOD BARU DI TeamManagement UNTUK LOAD SEMUA ADMIN
async loadAllAdmins() {
    try {
        // console.log('🔄 Loading ALL admins (including inactive)...');
        
        let allAdmins = [];
        
        // ✅ COBA BERBAGAI METHOD DENGAN FALLBACK
        if (firebaseAuthService.getAllAdmins) {
            allAdmins = await firebaseAuthService.getAllAdmins();
            // console.log('✅ Used getAllAdmins method');
        } 
        else if (firebaseAuthService.getITSupportTeam) {
            // Coba tanpa parameter dulu
            allAdmins = await firebaseAuthService.getITSupportTeam();
            // console.log('✅ Used getITSupportTeam method');
            
            // Jika hanya return active, coba manual filter
            const inactiveCount = allAdmins.filter(a => !a.is_active).length;
            if (inactiveCount === 0) {
                console.warn('⚠️ getITSupportTeam mungkin hanya return active users');
            }
        }
        else {
            // Fallback: Query Firestore langsung
            // console.log('🔄 Falling back to direct Firestore query...');
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
            const database = await this.getDB();
            const querySnapshot = await getDocs(collection(database, 'admins'));
            allAdmins = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // console.log('✅ Used direct Firestore query');
        }
        
            // console.log('📋 All admins loaded:', allAdmins.length);
            try {
                const key = `adminsCache:${this.adminUser?.uid || 'global'}`;
                const cache = { ts: Date.now(), items: allAdmins };
                localStorage.setItem(key, JSON.stringify(cache));
            } catch (_) {}
        // console.log('📊 Breakdown:', {
        //     total: allAdmins.length,
        //     active: allAdmins.filter(a => a.is_active).length,
        //     inactive: allAdmins.filter(a => !a.is_active).length
        // });
        
        this.itTeam = allAdmins;
        this.renderTeam();
        
    } catch (error) {
        console.error('❌ Error loading all admins:', error);
        this.showError('Failed to load admin list: ' + error.message);
    }
}

    async checkAuth() {
        try {
            // console.log('🔐 Checking authentication...');
            
            // Check if user is authenticated
            const currentUser = await firebaseAuthService.getCurrentUser();
            // console.log('👤 Current user:', currentUser);
            
            if (!currentUser) {
                // console.log('❌ No user found, redirecting to login...');
                window.location.href = 'login.html';
                return;
            }

            // Check admin access by directly querying Firestore
            const isAdmin = await this.checkAdminAccess(currentUser.uid);
            
            if (!isAdmin) {
                // console.log('❌ User is not admin, redirecting...');
                window.location.href = 'login.html';
                return;
            }

            // console.log('✅ Admin auth successful');
            
            // Set admin user data
            this.adminUser = {
                uid: currentUser.uid,
                email: currentUser.email,
                ...isAdmin
            };

            // ✅ UPDATE CURRENT USER INFO
        this.updateCurrentUserInfo();

        // console.log('✅ Admin auth successful');

        } catch (error) {
            console.error('❌ Auth check failed:', error);
            window.location.href = 'login.html';
        }
    }

    async checkAdminAccess(uid) {
        try {
            // console.log('🔍 Checking admin access for UID:', uid);
            
            // Check in admins collection first
            const database = await this.getDB();
            const adminDoc = await getDoc(doc(database, 'admins', uid));
            if (adminDoc.exists()) {
                const adminData = adminDoc.data();
                // console.log('✅ Found in admins collection:', adminData);
                return adminData;
            }

            // Check in users collection with admin role
            const userDoc = await getDoc(doc(database, 'users', uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // console.log('📋 User data:', userData);
                
                // Check if user has admin role
                if (userData.role && userData.role !== 'user') {
                    // console.log('✅ User has admin role:', userData.role);
                    return userData;
                }
            }

            // console.log('❌ No admin access found');
            return null;
            
        } catch (error) {
            console.error('❌ Error checking admin access:', error);
            return null;
        }
    }

    initializeEventListeners() {
        // Logout
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout);
        }

        // Refresh Team Button
        const refreshBtn = document.getElementById('refreshTeamBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadTeamData();
            });
        }

        // Add IT Support Form
        const addForm = document.getElementById('addITForm');
        if (addForm) {
            addForm.addEventListener('submit', (e) => {
                this.handleAddITSupport(e);
            });
        }

        // ✅ EVENT DELEGATION UNTUK TEAM MEMBER ACTIONS
        const teamGrid = document.getElementById('teamGrid');
        if (teamGrid) {
            teamGrid.addEventListener('click', this.handleTeamClick);
        }

        // Password confirmation validation
        const passwordField = document.getElementById('it_password');
        const confirmPasswordField = document.getElementById('it_confirm_password');
        
        if (passwordField && confirmPasswordField) {
            passwordField.addEventListener('input', () => this.validatePassword());
            confirmPasswordField.addEventListener('input', () => this.validatePassword());
        }

        // console.log('✅ Event listeners initialized');
    }

    // ✅ EVENT DELEGATION HANDLER
// ✅ EVENT DELEGATION HANDLER
// ✅ EVENT DELEGATION HANDLER
handleTeamClick(e) {
    const button = e.target.closest('.btn-action');
    if (!button) return;

    const memberCard = e.target.closest('.team-member-card');
    if (!memberCard) return;

    // Get member ID dari data attribute atau cara lain
    const memberId = this.getMemberIdFromCard(memberCard);
    if (!memberId) return;

    const action = button.classList.contains('btn-edit') ? 'edit' : 
                  button.classList.contains('btn-deactivate') ? 'deactivate' :
                  button.classList.contains('btn-activate') ? 'activate' : 
                  button.classList.contains('btn-delete') ? 'delete' : null;

    // console.log('🔄 Team action:', { action, memberId });

    // ✅ CHECK PERMISSION UNTUK SETIAP ACTION
    switch (action) {
        case 'edit':
            // ✅ EDIT: Super Admin bisa edit semua, user lain hanya edit diri sendiri
            if (this.adminUser?.role !== 'Super Admin' && memberId !== this.adminUser?.uid) {
                this.showPermissionError('edit other members');
                return;
            }
            this.editMember(memberId);
            break;
            
        case 'deactivate':
        case 'activate':
            // ✅ ACTIVATE/DEACTIVATE: HANYA Super Admin yang bisa, dan BUKAN diri sendiri
            if (this.adminUser?.role !== 'Super Admin') {
                this.showPermissionError('change member status');
                return;
            }
            if (memberId === this.adminUser?.uid) {
                this.showCannotModifySelfError('activate/deactivate');
                return;
            }
            const newStatus = action === 'activate';
            this.toggleMemberStatus(memberId, newStatus);
            break;
            
        case 'delete':
            // ✅ DELETE: Hanya Super Admin yang bisa (dan bukan diri sendiri)
            if (this.adminUser?.role !== 'Super Admin') {
                this.showPermissionError('delete members');
                return;
            }
            if (memberId === this.adminUser?.uid) {
                this.showCannotModifySelfError('delete');
                return;
            }
            this.deleteMemberPermanently(memberId);
            break;
            
        default:
            // console.log('❌ Unknown action:', action);
    }
}

// ✅ METHOD UNTUK SHOW PERMISSION ERROR
// ✅ METHOD UNTUK SHOW PERMISSION ERROR
showPermissionError(action) {
    Swal.fire({
        title: 'Permission Denied!',
        html: `
            <div style="text-align: left;">
                <p>You don't have permission to ${action}.</p>
                <p><strong>Required role:</strong> Super Admin</p>
                <p><strong>Your role:</strong> ${this.adminUser?.role}</p>
            </div>
        `,
        icon: 'error',
        confirmButtonColor: '#ef070a'
    });
}

// ✅ METHOD UNTUK SHOW SELF-MODIFICATION ERROR
// ✅ METHOD UNTUK SHOW SELF-MODIFICATION ERROR
showCannotModifySelfError(action = 'perform this action') {
    Swal.fire({
        title: 'Action Not Allowed!',
        html: `
            <div style="text-align: left;">
                <p>You cannot ${action} on your own account.</p>
                <p><strong>Security Policy:</strong> Super Admin cannot modify their own status for security reasons.</p>
                <p>Please contact another Super Admin if you need to make changes to your account.</p>
            </div>
        `,
        icon: 'warning',
        confirmButtonColor: '#ef070a'
    });
}

    // ✅ METHOD UNTUK MENDAPATKAN MEMBER ID DARI CARD
    // ✅ METHOD UNTUK MENDAPATKAN MEMBER ID DARI CARD
getMemberIdFromCard(card) {
    // Cara lebih reliable: gunakan data attribute
    const memberId = card.getAttribute('data-member-id');
    if (memberId) return memberId;
    
    // Fallback: cari berdasarkan nama
    const memberName = card.querySelector('h3')?.textContent;
    const member = this.itTeam.find(m => m.name === memberName);
    return member ? (member.id || member.uid) : null;
}

 async loadTeamData() {
    try {
        // console.log('🔄 Loading team data...');
        
        const teamGrid = document.getElementById('teamGrid');
        if (teamGrid) {
            teamGrid.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading team members...</p>
                </div>
            `;
        }

        // ✅ GUNAKAN loadAllAdmins() UNTUK DAPATKAN SEMUA ADMIN
        await this.loadAllAdmins();
        
    } catch (error) {
        console.error('❌ Error loading team data:', error);
        this.showError('Failed to load team data: ' + error.message);
        this.itTeam = [];
        this.renderTeam();
    }
}

renderTeam() {
    const teamGrid = document.getElementById('teamGrid');
    if (!teamGrid) return;
    
    if (this.itTeam.length === 0) {
        teamGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users-slash"></i>
                <h3>No Team Members Found</h3>
                <p>Add your first IT support member to get started.</p>
            </div>
        `;
        return;
    }

    // ✅ TAMPILKAN SEMUA ADMIN, URUTKAN: ACTIVE -> INACTIVE
    const sortedTeam = [...this.itTeam].sort((a, b) => {
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return 1;
        return 0;
    });

    

    // ✅ CHECK JIKA CURRENT USER ADALAH SUPER ADMIN
    const isSuperAdmin = this.adminUser?.role === 'Super Admin';

    const teamHtml = sortedTeam.map(member => {
        const memberId = member.id || member.uid;
        const isInactive = !member.is_active;
        
        // ✅ TENTUKAN APAKAH BISA EDIT:
        // - Super Admin bisa edit semua member
        // - Non-Super Admin hanya bisa edit dirinya sendiri
        const canEdit = isSuperAdmin || memberId === this.adminUser?.uid;
        
        // ✅ TENTUKAN APAKAH BISA ACTIVATE/DEACTIVATE:
        // - Hanya Super Admin yang bisa, dan bukan diri sendiri
        const canToggleStatus = isSuperAdmin && memberId !== this.adminUser?.uid;
        
        // Format created_at date
        const memberSince = member.created_at ? 
            new Date(member.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'N/A';
        
        // Generate avatar initials
        const avatarInitials = member.name ? 
            member.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'IT';
        
        // Generate specialization HTML jika ada
        const specializationHtml = member.specialization && member.specialization.length > 0 ? `
            <div class="team-member-specialization">
                <label>Specialization:</label>
                <div class="specialization-tags">
                    ${member.specialization.map(spec => 
                        `<span class="specialization-tag">${spec}</span>`
                    ).join('')}
                </div>
            </div>
        ` : '';

        return `
            <div class="team-member-card ${isInactive ? 'inactive-member' : ''}" data-member-id="${memberId}">
                ${isInactive ? `
                <div class="inactive-banner">
                    <i class="fas fa-user-slash"></i>
                    INACTIVE ACCOUNT
                </div>
                ` : ''}
                
                <div class="team-member-header">
                    <div class="team-member-avatar ${isInactive ? 'inactive-avatar' : ''}">
                        ${avatarInitials}
                    </div>
                    <div class="team-member-info">
                        <h3>${this.escapeHtml(member.name || 'Unnamed User')}</h3>
                        <span class="team-member-role role-${member.role ? this.escapeHtml(member.role).replace(/\s+/g, '-') : 'unknown'}">
                            ${this.getRoleDisplayName(member.role)}
                        </span>
                    </div>
                </div>
                
                <div class="team-member-details">
                    <div class="team-member-detail">
                        <label>Email:</label>
                        <span class="member-email">${this.escapeHtml(member.email || 'N/A')}</span>
                    </div>
                    <div class="team-member-detail">
                        <label>Status:</label>
                        <span class="status-badge ${member.is_active ? 'status-active' : 'status-inactive'}">
                            <i class="fas ${member.is_active ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                            ${member.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="team-member-detail">
                        <label>Member Since:</label>
                        <span class="member-since">${memberSince}</span>
                    </div>
                </div>
                
                ${specializationHtml}
                
                <div class="team-member-actions">
                    ${canEdit ? `
                    <button class="btn-action btn-edit" data-member-id="${memberId}">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    ` : ''}
                    
                    ${canToggleStatus ? `
                    <button class="btn-action ${member.is_active ? 'btn-deactivate' : 'btn-activate'}" data-member-id="${memberId}">
                        <i class="fas ${member.is_active ? 'fa-user-slash' : 'fa-user-check'}"></i>
                        ${member.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    ` : ''}
                    
                    ${isSuperAdmin && memberId !== this.adminUser?.uid ? `
                    <button class="btn-action btn-delete" data-member-id="${memberId}">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    teamGrid.innerHTML = teamHtml;
    
    // ✅ RE-ATTACH EVENT LISTENERS SETELAH RENDER
    this.attachEventListenersToCards();
    
    // console.log('✅ Team rendered - Total members:', this.itTeam.length, 
    //             '- Active:', this.itTeam.filter(m => m.is_active).length,
    //             '- Inactive:', this.itTeam.filter(m => !m.is_active).length);
}

// ✅ METHOD BARU: Attach event listeners ke cards setelah render
attachEventListenersToCards() {
    const teamGrid = document.getElementById('teamGrid');
    if (!teamGrid) return;

    // Gunakan event delegation untuk semua buttons
    teamGrid.addEventListener('click', (e) => {
        const button = e.target.closest('.btn-action');
        if (!button) return;

        const memberCard = e.target.closest('.team-member-card');
        if (!memberCard) return;

        const memberId = memberCard.getAttribute('data-member-id');
        if (!memberId) return;

        const actionClass = Array.from(button.classList).find(cls => 
            cls.startsWith('btn-') && cls !== 'btn-action'
        );

        if (!actionClass) return;

        // Handle different actions
        switch (actionClass) {
            case 'btn-edit':
                this.editMember(memberId);
                break;
            case 'btn-deactivate':
                this.toggleMemberStatus(memberId, false);
                break;
            case 'btn-activate':
                this.toggleMemberStatus(memberId, true);
                break;
            case 'btn-delete':
                this.deleteMemberPermanently(memberId);
                break;
        }
    });
}

// ✅ METHOD BARU: Escape HTML untuk prevent XSS
escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ✅ METHOD UNTUK GET ROLE DISPLAY NAME (pastikan ada)
getRoleDisplayName(role) {
    const roleNames = {
        'Super Admin': 'Super Admin',
        'IT Engineer': 'IT Engineer', 
        'IT Tech Support': 'IT Tech Support',
        'IT Visual': 'IT Visual'
    };
    return roleNames[role] || role || 'Unknown Role';
}

// ✅ METHOD UNTUK DELETE PERMANEN (HANYA SUPER ADMIN)
// ✅ METHOD UNTUK DELETE PERMANEN (HANYA SUPER ADMIN)
async deleteMemberPermanently(memberId) {
    // ✅ DOUBLE CHECK: Pastikan hanya Super Admin yang bisa delete
    if (this.adminUser?.role !== 'Super Admin') {
        await Swal.fire({
            title: 'Access Denied!',
            text: 'Only Super Admin can permanently delete team members.',
            icon: 'error',
            confirmButtonColor: '#ef070a'
        });
        return;
    }

    const member = this.itTeam.find(m => (m.id === memberId) || (m.uid === memberId));
    if (!member) {
        this.showError('Member not found');
        return;
    }

    // ✅ JANGAN BOLEH DELETE DIRI SENDIRI
    if (memberId === this.adminUser?.uid) {
        await Swal.fire({
            title: 'Cannot Delete Yourself!',
            text: 'You cannot delete your own account.',
            icon: 'warning',
            confirmButtonColor: '#ef070a'
        });
        return;
    }

    // ✅ KONFIRMASI DELETE PERMANEN
    const result = await Swal.fire({
        title: 'Permanent Delete!',
        html: `
            <div style="text-align: left;">
                <p>Are you sure you want to <strong>permanently delete</strong> this team member?</p>
                <div style="background: #fee; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Name:</strong> ${member.name}</p>
                    <p><strong>Email:</strong> ${member.email}</p>
                    <p><strong>Role:</strong> ${member.role}</p>
                </div>
                <p class="warning-text">⚠️ This action cannot be undone! All data will be permanently lost.</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, Delete Permanently',
        cancelButtonText: 'Cancel',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        try {
            // Show loading
            Swal.fire({
                title: 'Deleting...',
                text: 'Please wait while we delete the member',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // ✅ GUNAKAN METHOD DELETE DARI SERVICE DENGAN FALLBACK
            let deleteResult;
            
            if (firebaseAuthService.deleteAdminPermanently) {
                // console.log('🔄 Using deleteAdminPermanently method');
                deleteResult = await firebaseAuthService.deleteAdminPermanently(memberId);
            } else if (firebaseAuthService.deleteAdmin) {
                // console.log('🔄 Using deleteAdmin method');
                deleteResult = await firebaseAuthService.deleteAdmin(memberId);
            } else {
                // Fallback: Direct Firestore delete
                // console.log('🔄 Using direct Firestore delete');
                deleteResult = await this.deleteAdminDirectly(memberId);
            }

            if (!deleteResult.success) {
                throw new Error(deleteResult.message || 'Failed to delete member');
            }

            // Success message
            await Swal.fire({
                title: 'Deleted!',
                text: `${member.name} has been permanently deleted`,
                icon: 'success',
                confirmButtonColor: '#ef070a'
            });

            // Reload team data
            await this.loadTeamData();

        } catch (error) {
            console.error('❌ Error deleting member:', error);
            await Swal.fire({
                title: 'Delete Failed!',
                html: `
                    <div style="text-align: left;">
                        <p>Failed to delete member: ${error.message}</p>
                        <details style="margin-top: 10px;">
                            <summary>Technical Details</summary>
                            <pre style="text-align: left; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; max-height: 200px;">${error.stack}</pre>
                        </details>
                    </div>
                `,
                icon: 'error',
                confirmButtonColor: '#ef070a',
                width: 600
            });
        }
    }
}

// ✅ FALLBACK METHOD: Soft delete (block login) tanpa menghapus dokumen
async deleteAdminDirectly(adminId) {
    try {
        const database = await this.getDB();
        const tombstone = {
            is_active: false,
            deleted_at: new Date().toISOString(),
            deleted_by: this.adminUser?.uid || 'system'
        };
        await setDoc(doc(database, 'admins', adminId), tombstone, { merge: true });
        try {
            await updateDoc(doc(database, 'users', adminId), {
                role: 'user',
                updated_at: new Date().toISOString()
            });
        } catch (_) {}
        // Attempt hard delete after soft delete
        try {
            await deleteDoc(doc(database, 'admins', adminId));
        } catch (_) {}
        return {
            success: true,
            message: 'Admin soft-deleted and demoted; hard delete attempted'
        };
    } catch (error) {
        console.error('❌ Error in direct Firestore delete:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

 async handleAddITSupport(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Show loading
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    submitBtn.disabled = true;

    this.hideMessages();

    try {
        const formData = this.getFormData(form);
        // console.log('📋 Form data collected:', formData);
        
        const validation = this.validateForm(formData);
        
        if (!validation.isValid) {
            throw new Error(validation.message);
        }

        const adminData = {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            department: formData.department,
            specialization: formData.specialization || [],
            password: formData.password,
            is_active: true,
            created_at: new Date().toISOString()
        };

        // console.log('🔄 Creating admin with data:', adminData);
        // console.log('👤 Current admin (BEFORE):', this.adminUser?.email);

        // ✅ GUNAKAN METHOD YANG AMAN (TANPA AUTO-SIGNIN)
        let result;
        
        if (firebaseAuthService.createAdminInFirestoreOnly) {
            result = await firebaseAuthService.createAdminInFirestoreOnly(adminData, this.adminUser?.uid);
        } else {
            // Fallback ke method existing dengan currentAdminId
            result = await firebaseAuthService.createAdminIfNotExists(adminData, this.adminUser?.uid);
        }

        // console.log('📨 Creation result:', result);

        // ✅ VERIFY SESSION (sekarang seharusnya tidak berubah)
        const currentUserAfter = await firebaseAuthService.getCurrentUser();
        // console.log('🔐 Session check:', {
        //     before: this.adminUser?.email,
        //     after: currentUserAfter?.email,
        //     same: this.adminUser?.email === currentUserAfter?.email
        // });

        // ✅ JIKA MASIH ADA SESSION TAKEOVER
        if (this.adminUser?.email !== currentUserAfter?.email) {
            console.error('❌ SESSION TAKEOVER STILL HAPPENING!');
            await this.handleSessionTakeover();
            return;
        }

        // ✅ CHECK JIKA ADMIN SUDAH ADA
        if (result && (result.exists === true || result.isExisting === true)) {
            await Swal.fire({
                title: 'Admin Already Exists!',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Email:</strong> ${adminData.email}</p>
                        <p><strong>Name:</strong> ${result.user?.name || adminData.name}</p>
                        <p class="warning-text">This admin account already exists in the system.</p>
                    </div>
                `,
                icon: 'warning',
                confirmButtonColor: '#ef070a'
            });
            return;
        }

        // ✅ JIKA BERHASIL DIBUAT
        if (result && result.success === true) {
            await Swal.fire({
                title: 'Success!',
                text: `IT Support account created for ${formData.name}`,
                icon: 'success',
                confirmButtonColor: '#ef070a'
            });

            form.reset();
            await this.loadTeamData();
        } else {
            throw new Error(result?.message || 'Failed to create admin account');
        }

    } catch (error) {
        console.error('❌ Error creating IT support:', error);
        this.handleCreateError(error, formData);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// ✅ HANDLE SESSION TAKEOVER
async handleSessionTakeover() {
    try {
        // Show warning
        await Swal.fire({
            title: 'Session Interrupted',
            html: `
                <div style="text-align: left;">
                    <p>Your session was interrupted during admin creation.</p>
                    <p class="warning-text">You have been logged out for security reasons.</p>
                    <p>Please login again with your original admin account.</p>
                </div>
            `,
            icon: 'warning',
            confirmButtonColor: '#ef070a'
        });

        // Logout dan redirect ke login
        await firebaseAuthService.logout();
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('❌ Error handling session takeover:', error);
        window.location.href = 'login.html';
    }
}


// ✅ BETTER ERROR HANDLING
handleCreateError(error, formData) {
    console.error('🔍 Error details:', {
        code: error.code,
        message: error.message,
        formData: formData
    });

    let errorMessage = error.message;

    // ✅ SPECIFIC FIREBASE ERROR CODES
    if (error.code === 'auth/email-already-in-use') {
        errorMessage = `Email ${formData.email} is already registered.`;
    } 
    else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
    }
    else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
    }
    else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled. Please check Firebase Authentication settings.';
    }
    else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
    }
    else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
    }

    this.showError(errorMessage);
    
    // Show detailed error in Swal untuk debugging
    Swal.fire({
        title: 'Creation Failed',
        html: `
            <div style="text-align: left;">
                <p><strong>Error:</strong> ${errorMessage}</p>
                <p><strong>Code:</strong> ${error.code || 'N/A'}</p>
                <p><strong>Email:</strong> ${formData.email}</p>
                <details style="margin-top: 10px;">
                    <summary>Technical Details</summary>
                    <pre style="text-align: left; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; max-height: 200px;">${error.stack}</pre>
                </details>
            </div>
        `,
        icon: 'error',
        confirmButtonColor: '#ef070a',
        width: 600
    });
}

    getFormData(form) {
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
        if (key === 'specialization') {
            if (!data.specialization) data.specialization = [];
            // ✅ Hanya tambah jika checkbox checked
            const checkbox = form.querySelector(`input[value="${value}"]`);
            if (checkbox && checkbox.checked) {
                data.specialization.push(value);
            }
        } else {
            data[key] = value;
        }
    }
    
    // ✅ Alternatif: Ambil specialization dari checkbox yang checked
    const specializationCheckboxes = form.querySelectorAll('input[name="specialization"]:checked');
    if (specializationCheckboxes.length > 0) {
        data.specialization = Array.from(specializationCheckboxes).map(cb => cb.value);
    } else {
        data.specialization = [];
    }
    
    // console.log('📦 Processed form data:', data);
    return data;
}

    validateForm(formData) {
    // console.log('🔍 Validating form data:', formData);
    
    // Required fields
    const requiredFields = ['name', 'email', 'role', 'department', 'password', 'confirm_password'];
    const missingFields = requiredFields.filter(field => !formData[field]?.trim());
    
    if (missingFields.length > 0) {
        return {
            isValid: false,
            message: `Please fill in all required fields: ${missingFields.join(', ')}`
        };
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        return {
            isValid: false,
            message: 'Please enter a valid email address'
        };
    }

    // Password validation
    if (formData.password.length < 6) {
        return {
            isValid: false,
            message: 'Password must be at least 6 characters long'
        };
    }

    // Password confirmation
    if (formData.password !== formData.confirm_password) {
        return {
            isValid: false,
            message: 'Passwords do not match'
        };
    }

    // Role validation - pastikan role valid
    const validRoles = ['Super Admin', 'IT Engineer', 'IT Tech Support', 'IT Visual'];
    if (!validRoles.includes(formData.role)) {
        return {
            isValid: false,
            message: 'Please select a valid role'
        };
    }

    // console.log('✅ Form validation passed');
    return { isValid: true };
}

    validatePassword() {
        const password = document.getElementById('it_password');
        const confirmPassword = document.getElementById('it_confirm_password');
        const messageElement = document.getElementById('formMessage');

        if (!password || !confirmPassword || !messageElement) return;

        if (confirmPassword.value && password.value !== confirmPassword.value) {
            messageElement.textContent = 'Passwords do not match';
            messageElement.style.display = 'block';
            messageElement.className = 'error-message';
        } else {
            messageElement.style.display = 'none';
        }
    }

    editMember(memberId) {
    const member = this.itTeam.find(m => (m.id === memberId) || (m.uid === memberId));
    if (!member) {
        this.showError('Member not found');
        return;
    }

    // ✅ TENTUKAN APAKAH EDITING DIRI SENDIRI ATAU ORANG LAIN
    const isEditingSelf = memberId === this.adminUser?.uid;
    const isSuperAdmin = this.adminUser?.role === 'Super Admin';

    // ✅ JIKA BUKAN SUPER ADMIN DAN MENCUBA EDIT ORANG LAIN, BLOCK
    if (!isSuperAdmin && !isEditingSelf) {
        this.showPermissionError('edit other members');
        return;
    }

    // ✅ TENTUKAN FIELD YANG BISA DIEDIT:
    // - Super Admin editing others: semua field
    // - Super Admin editing self: semua field kecuali role (optional)
    // - Non-Super Admin editing self: field terbatas
    const canEditRole = isSuperAdmin && !isEditingSelf;
    const canEditStatus = isSuperAdmin && !isEditingSelf;
    const canEditAllFields = isSuperAdmin;

    // ✅ SWAL FORM UNTUK EDIT MEMBER
    Swal.fire({
        title: `Edit ${member.name}`,
        html: `
            <div class="edit-member-form">
                <div class="form-group">
                    <label for="edit_name">Full Name</label>
                    <input type="text" id="edit_name" class="swal2-input" placeholder="Full Name" value="${member.name || ''}">
                </div>
                
                <div class="form-group">
                    <label for="edit_email">Email</label>
                    <input type="email" id="edit_email" class="swal2-input" placeholder="Email" value="${member.email || ''}">
                </div>
                
                ${canEditRole ? `
                <div class="form-group">
                    <label for="edit_role">Role</label>
                    <select id="edit_role" class="swal2-input">
                        <option value="Super Admin" ${member.role === 'Super Admin' ? 'selected' : ''}>Super Admin</option>
                        <option value="IT Engineer" ${member.role === 'IT Engineer' ? 'selected' : ''}>IT Engineer</option>
                        <option value="IT Tech Support" ${member.role === 'IT Tech Support' ? 'selected' : ''}>IT Tech Support</option>
                        <option value="IT Visual" ${member.role === 'IT Visual' ? 'selected' : ''}>IT Visual</option>
                    </select>
                </div>
                ` : `
                <div class="form-group">
                    <label>Role</label>
                    <input type="text" class="swal2-input" value="${this.getRoleDisplayName(member.role)}" disabled style="background-color: #f5f5f5;">
                </div>
                `}
                
                <div class="form-group">
                    <label for="edit_department">Department</label>
                    <input type="text" id="edit_department" class="swal2-input" placeholder="Department" value="${member.department || ''}" ${!canEditAllFields ? 'disabled' : ''}>
                </div>
                
                <div class="form-group">
                    <label for="edit_specialization">Specialization (comma separated)</label>
                    <input type="text" id="edit_specialization" class="swal2-input" placeholder="e.g., Networking, Hardware" value="${member.specialization ? member.specialization.join(', ') : ''}" ${!canEditAllFields ? 'disabled' : ''}>
                </div>
                
                ${canEditStatus ? `
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="edit_is_active" ${member.is_active ? 'checked' : ''}>
                        Active Member
                    </label>
                </div>
                ` : ''}
                
                ${isEditingSelf ? `
                <div class="info-banner">
                    <i class="fas fa-info-circle"></i>
                    You are editing your own profile
                </div>
                ` : ''}
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Update Member',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#ef070a',
        preConfirm: () => {
            const name = document.getElementById('edit_name').value.trim();
            const email = document.getElementById('edit_email').value.trim();
            const role = canEditRole ? document.getElementById('edit_role').value : member.role;
            const department = document.getElementById('edit_department').value.trim();
            const specialization = document.getElementById('edit_specialization').value.split(',').map(s => s.trim()).filter(s => s);
            const is_active = canEditStatus ? document.getElementById('edit_is_active').checked : member.is_active;

            // Validasi
            if (!name) {
                Swal.showValidationMessage('Please enter full name');
                return false;
            }
            if (!email) {
                Swal.showValidationMessage('Please enter email');
                return false;
            }
            if (!this.isValidEmail(email)) {
                Swal.showValidationMessage('Please enter a valid email');
                return false;
            }

            return {
                name,
                email,
                role,
                department,
                specialization,
                is_active
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            await this.updateMember(memberId, result.value);
        }
    });
}

// ✅ METHOD UNTUK VALIDASI EMAIL
isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ✅ METHOD UNTUK CHECK SUPER ADMIN STATUS
isSuperAdmin() {
    return this.adminUser?.role === 'Super Admin';
}

// ✅ METHOD UNTUK TOGGLE VISIBILITY ADD FORM
toggleAddFormVisibility() {
    const addFormSection = document.getElementById('addITFormSection'); // Anda perlu tambahkan ID ini di HTML
    const addForm = document.getElementById('addITForm');
    
    if (!this.isSuperAdmin()) {
        // Jika bukan Super Admin, sembunyikan form
        if (addFormSection) {
            addFormSection.style.display = 'none';
        }
        if (addForm) {
            addForm.style.display = 'none';
        }
        
        // Tambahkan pesan informasi
        this.showNonSuperAdminMessage();
    } else {
        // Jika Super Admin, tampilkan form
        if (addFormSection) {
            addFormSection.style.display = 'block';
        }
        if (addForm) {
            addForm.style.display = 'block';
        }
    }
}

// ✅ METHOD UNTUK SHOW MESSAGE UNTUK NON-SUPER ADMIN
showNonSuperAdminMessage() {
    // Cari atau buat element untuk menampilkan pesan
    let messageElement = document.getElementById('nonSuperAdminMessage');
    
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.id = 'nonSuperAdminMessage';
        messageElement.className = 'non-super-admin-message';
        
        // Tempatkan pesan di tempat yang sesuai (misalnya sebelum form)
        const addFormSection = document.getElementById('addITFormSection');
        if (addFormSection) {
            addFormSection.parentNode.insertBefore(messageElement, addFormSection);
        }
    }
    
    messageElement.innerHTML = `
        <div class="info-banner">
            <i class="fas fa-info-circle"></i>
            <div class="message-content">
                <h4>Admin Creation Restricted</h4>
                <p>Only <strong>Super Admin</strong> can create new admin accounts.</p>
                <p><strong>Your role:</strong> ${this.adminUser?.role || 'Unknown'}</p>
                <p>Please contact a Super Admin if you need to add new team members.</p>
            </div>
        </div>
    `;
}

// ✅ METHOD UNTUK UPDATE MEMBER
async updateMember(memberId, updateData) {
    try {
        // console.log('🔄 Updating member:', memberId, updateData);

        // Show loading
        Swal.fire({
            title: 'Updating...',
            text: 'Please wait while we update member information',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Update member data
        const result = await firebaseAuthService.updateAdmin(memberId, updateData);

        if (!result.success) {
            throw new Error(result.message || 'Failed to update member');
        }

        // Success message
        await Swal.fire({
            title: 'Success!',
            text: `${updateData.name} has been updated successfully`,
            icon: 'success',
            confirmButtonColor: '#ef070a'
        });

        // Reload team data
        await this.loadTeamData();

    } catch (error) {
        console.error('❌ Error updating member:', error);
        await Swal.fire({
            title: 'Update Failed',
            text: error.message,
            icon: 'error',
            confirmButtonColor: '#ef070a'
        });
    }
}

    async toggleMemberStatus(memberId, newStatus) {
    // ✅ DOUBLE CHECK PERMISSION: Hanya Super Admin yang bisa
    if (this.adminUser?.role !== 'Super Admin') {
        await Swal.fire({
            title: 'Access Denied!',
            text: 'Only Super Admin can change member status.',
            icon: 'error',
            confirmButtonColor: '#ef070a'
        });
        return;
    }

    // ✅ DOUBLE CHECK: Tidak boleh melakukan action pada diri sendiri
    if (memberId === this.adminUser?.uid) {
        await Swal.fire({
            title: 'Action Not Allowed!',
            html: `
                <div style="text-align: left;">
                    <p>You cannot ${newStatus ? 'activate' : 'deactivate'} your own account.</p>
                    <p><strong>Security Policy:</strong> Super Admin cannot modify their own status.</p>
                    <p>Please contact another Super Admin if you need to make changes to your account.</p>
                </div>
            `,
            icon: 'warning',
            confirmButtonColor: '#ef070a'
        });
        return;
    }

    const member = this.itTeam.find(m => (m.id === memberId) || (m.uid === memberId));
    if (!member) {
        this.showError('Member not found');
        return;
    }

    const result = await Swal.fire({
        title: `${newStatus ? 'Activate' : 'Deactivate'} Member?`,
        html: `
            <div style="text-align: left;">
                <p>Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this team member?</p>
                <div style="background: ${newStatus ? '#f0fdf4' : '#fef2f2'}; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Name:</strong> ${member.name}</p>
                    <p><strong>Email:</strong> ${member.email}</p>
                    <p><strong>Role:</strong> ${member.role}</p>
                    <p><strong>Current Status:</strong> ${member.is_active ? 'Active' : 'Inactive'}</p>
                    <p><strong>New Status:</strong> ${newStatus ? 'Active' : 'Inactive'}</p>
                </div>
                ${!newStatus ? '<p class="warning-text">⚠️ Deactivated members cannot access the system.</p>' : ''}
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: newStatus ? '#22c55e' : '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: `Yes, ${newStatus ? 'Activate' : 'Deactivate'}`,
        cancelButtonText: 'Cancel',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        try {
            // Show loading
            Swal.fire({
                title: `${newStatus ? 'Activating' : 'Deactivating'}...`,
                text: `Please wait while we ${newStatus ? 'activate' : 'deactivate'} the member`,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Check if methods exist, if not use fallback
            let updateResult;
            if (newStatus && firebaseAuthService.activateAdmin) {
                updateResult = await firebaseAuthService.activateAdmin(memberId);
            } else if (!newStatus && firebaseAuthService.deactivateAdmin) {
                updateResult = await firebaseAuthService.deactivateAdmin(memberId);
            } else {
                // Fallback: update using updateAdmin method
                updateResult = await firebaseAuthService.updateAdmin(memberId, { is_active: newStatus });
            }
            
            if (!updateResult || !updateResult.success) {
                throw new Error(updateResult?.message || `Failed to ${newStatus ? 'activate' : 'deactivate'} member`);
            }

            // Reload team data
            await this.loadTeamData();
            
            await Swal.fire({
                title: 'Success!',
                text: `${member.name} has been ${newStatus ? 'activated' : 'deactivated'} successfully`,
                icon: 'success',
                confirmButtonColor: '#ef070a'
            });

        } catch (error) {
            console.error('❌ Error toggling member status:', error);
            Swal.fire({
                title: 'Error!',
                html: `
                    <div style="text-align: left;">
                        <p>Failed to ${newStatus ? 'activate' : 'deactivate'} member: ${error.message}</p>
                        <details style="margin-top: 10px;">
                            <summary>Technical Details</summary>
                            <pre style="text-align: left; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; max-height: 200px;">${error.stack}</pre>
                        </details>
                    </div>
                `,
                icon: 'error',
                confirmButtonColor: '#ef070a',
                width: 600
            });
        }
    }
}

    getRoleDisplayName(role) {
    // ✅ HANYA 4 ROLE IT YANG DITAMPILKAN
    const roleNames = {
        'Super Admin': 'Super Admin',
        'IT Engineer': 'IT Engineer', 
        'IT Tech Support': 'IT Tech Support',
        'IT Visual': 'IT Visual'
    };
        return roleNames[role] || role;
    }

    showError(message) {
        const messageElement = document.getElementById('formMessage');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.style.display = 'block';
            messageElement.className = 'error-message';
        }
    }

    hideMessages() {
        const messageElement = document.getElementById('formMessage');
        if (messageElement) {
            messageElement.style.display = 'none';
        }
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
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = 'login.html';
            }
        }
    }

    // Cleanup method
    destroy() {
        const teamGrid = document.getElementById('teamGrid');
        if (teamGrid) {
            teamGrid.removeEventListener('click', this.handleTeamClick);
        }
        
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.removeEventListener('click', this.handleLogout);
        }
    }
}

// ✅ Initialize dan export instance
const teamManagement = new TeamManagement();
window.teamManagement = teamManagement; // Export ke global scope

// console.log('🚀 Team Management initialized');

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (teamManagement) {
        teamManagement.destroy();
    }
});

export default teamManagement;
