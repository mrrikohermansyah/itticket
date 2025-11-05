// pages/admin/assets/js/manage-team.js
import firebaseAuthService from '../../../../../assets/js/services/firebase-auth-service.js';
import { 
    doc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '../../../../../assets/js/utils/firebase-config.js';

class TeamManagement {
    constructor() {
        this.adminUser = null;
        this.itTeam = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.initializeEventListeners();
        await this.loadTeamData();
    }

    async checkAuth() {
        try {
            console.log('🔐 Checking authentication...');
            
            // Check if user is authenticated
            const currentUser = await firebaseAuthService.getCurrentUser();
            console.log('👤 Current user:', currentUser);
            
            if (!currentUser) {
                console.log('❌ No user found, redirecting to login...');
                window.location.href = 'login.html';
                return;
            }

            // Check admin access by directly querying Firestore
            const isAdmin = await this.checkAdminAccess(currentUser.uid);
            
            if (!isAdmin) {
                console.log('❌ User is not admin, redirecting...');
                window.location.href = 'login.html';
                return;
            }

            console.log('✅ Admin auth successful');
            
            // Set admin user data
            this.adminUser = {
                uid: currentUser.uid,
                email: currentUser.email,
                ...isAdmin
            };

        } catch (error) {
            console.error('❌ Auth check failed:', error);
            window.location.href = 'login.html';
        }
    }

    async checkAdminAccess(uid) {
        try {
            console.log('🔍 Checking admin access for UID:', uid);
            
            // Check in admins collection first
            const adminDoc = await getDoc(doc(db, 'admins', uid));
            if (adminDoc.exists()) {
                const adminData = adminDoc.data();
                console.log('✅ Found in admins collection:', adminData);
                return adminData;
            }

            // Check in users collection with admin role
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('📋 User data:', userData);
                
                // Check if user has admin role
                if (userData.role && userData.role !== 'user') {
                    console.log('✅ User has admin role:', userData.role);
                    return userData;
                }
            }

            console.log('❌ No admin access found');
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
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
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

        // Password confirmation validation
        const passwordField = document.getElementById('it_password');
        const confirmPasswordField = document.getElementById('it_confirm_password');
        
        if (passwordField && confirmPasswordField) {
            passwordField.addEventListener('input', () => this.validatePassword());
            confirmPasswordField.addEventListener('input', () => this.validatePassword());
        }

        console.log('✅ Event listeners initialized');
    }

    async loadTeamData() {
        try {
            console.log('🔄 Loading team data...');
            
            const teamGrid = document.getElementById('teamGrid');
            if (teamGrid) {
                teamGrid.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading team members...</p>
                    </div>
                `;
            }

            this.itTeam = await firebaseAuthService.getITSupportTeam();
            console.log('✅ Team data loaded:', this.itTeam);
            this.renderTeam();
            
        } catch (error) {
            console.error('❌ Error loading team data:', error);
            this.showError('Failed to load team data: ' + error.message);
            // Fallback to empty array
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

        const teamHtml = this.itTeam.map(member => {
            const memberId = member.id || member.uid;
            return `
                <div class="team-member-card">
                    <div class="team-member-header">
                        <div class="team-member-avatar">
                            ${member.name ? member.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'IT'}
                        </div>
                        <div class="team-member-info">
                            <h3>${member.name || 'Unnamed User'}</h3>
                            <span class="team-member-role role-${member.role}">
                                ${this.getRoleDisplayName(member.role)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="team-member-details">
                        <div class="team-member-detail">
                            <label>Email:</label>
                            <span>${member.email}</span>
                        </div>
                        <div class="team-member-detail">
                            <label>Status:</label>
                            <span class="${member.is_active ? 'status-active' : 'status-inactive'}">
                                ${member.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div class="team-member-detail">
                            <label>Member Since:</label>
                            <span>${member.created_at ? new Date(member.created_at).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                    
                    ${member.specialization && member.specialization.length > 0 ? `
                    <div class="team-member-specialization">
                        <label>Specialization:</label>
                        <div class="specialization-tags">
                            ${member.specialization.map(spec => 
                                `<span class="specialization-tag">${spec}</span>`
                            ).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="team-member-actions">
                        <button class="btn-action btn-edit" onclick="teamManagement.editMember('${memberId}')">
                            <i class="fas fa-edit"></i>
                            Edit
                        </button>
                        ${memberId !== this.adminUser?.uid ? `
                        <button class="btn-action ${member.is_active ? 'btn-deactivate' : 'btn-activate'}" 
                                onclick="teamManagement.toggleMemberStatus('${memberId}', ${!member.is_active})">
                            <i class="fas ${member.is_active ? 'fa-user-slash' : 'fa-user-check'}"></i>
                            ${member.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        teamGrid.innerHTML = teamHtml;
        console.log('✅ Team rendered successfully');
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
            const validation = this.validateForm(formData);
            
            if (!validation.isValid) {
                throw new Error(validation.message);
            }

            // Prepare admin data
            const adminData = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                department: formData.department,
                specialization: formData.specialization || [],
                password: formData.password
            };

            console.log('🔄 Creating admin with data:', adminData);

            // Create admin using your existing service
           const result = await firebaseAuthService.createAdminIfNotExists(adminData);

            if (!result.success) {
                throw new Error(result.message || 'Failed to create admin account');
            }

            // Show success message
            await Swal.fire({
                title: 'Success!',
                text: `IT Support account created for ${formData.name}`,
                icon: 'success',
                confirmButtonColor: '#ef070a'
            });

            // Reset form and reload team
            form.reset();
            await this.loadTeamData();

        } catch (error) {
            console.error('❌ Error creating IT support:', error);
            this.showError(error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    getFormData(form) {
        const formData = new FormData(form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            if (key === 'specialization') {
                if (!data.specialization) data.specialization = [];
                data.specialization.push(value);
            } else {
                data[key] = value;
            }
        }
        
        return data;
    }

    validateForm(formData) {
        // Required fields
        const requiredFields = ['name', 'email', 'role', 'department', 'password', 'confirm_password'];
        for (const field of requiredFields) {
            if (!formData[field]?.trim()) {
                return {
                    isValid: false,
                    message: `Please fill in all required fields`
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
        if (member) {
            // Show edit modal or redirect to edit page
            Swal.fire({
                title: 'Edit Member',
                text: `Edit functionality for ${member.name} would open here.`,
                icon: 'info',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    async toggleMemberStatus(memberId, newStatus) {
        const member = this.itTeam.find(m => (m.id === memberId) || (m.uid === memberId));
        if (!member) return;

        const result = await Swal.fire({
            title: `${newStatus ? 'Activate' : 'Deactivate'} Member?`,
            text: `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} ${member.name}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: newStatus ? '#22c55e' : '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: `Yes, ${newStatus ? 'Activate' : 'Deactivate'}`,
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                // Check if methods exist, if not use fallback
                if (newStatus && firebaseAuthService.activateAdmin) {
                    await firebaseAuthService.activateAdmin(memberId);
                } else if (!newStatus && firebaseAuthService.deactivateAdmin) {
                    await firebaseAuthService.deactivateAdmin(memberId);
                } else {
                    // Fallback: update using updateAdmin method
                    await firebaseAuthService.updateAdmin(memberId, { is_active: newStatus });
                }
                
                // Reload team data
                await this.loadTeamData();
                
                await Swal.fire({
                    title: 'Success!',
                    text: `Member ${newStatus ? 'activated' : 'deactivated'} successfully`,
                    icon: 'success',
                    confirmButtonColor: '#ef070a'
                });

            } catch (error) {
                console.error('❌ Error toggling member status:', error);
                Swal.fire({
                    title: 'Error!',
                    text: error.message,
                    icon: 'error',
                    confirmButtonColor: '#ef070a'
                });
            }
        }
    }

    getRoleDisplayName(role) {
        const roleNames = {
            'superadmin': 'Super Administrator',
            'manager': 'IT Manager',
            'senior_support': 'Senior IT Support',
            'junior_support': 'Junior IT Support',
            'technician': 'IT Technician',
            'support': 'IT Support'
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
}

// Initialize team management
const teamManagement = new TeamManagement();
console.log('🚀 Team Management initialized');