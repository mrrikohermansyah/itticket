import { 
    getFirestore, 
    doc, 
    setDoc,
    getDocs,
    collection
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { 
    getAuth, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

class FirstAdminSetup {
    constructor() {
        console.log('🚀 FirstAdminSetup constructor called');
        this.isSubmitting = false;
        this.form = null;
        this.init();
    }

    init() {
        console.log('📄 Initializing...');
        
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            console.log('📄 DOM ready, initializing...');
            this.initialize();
        } else {
            console.log('📄 Waiting for DOM...');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('📄 DOM Content Loaded');
                this.initialize();
            });
        }
    }

    async initialize() {
        console.log('🔧 Starting initialization...');
        
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('🔍 Looking for form...');
            
            this.form = document.getElementById('setupAdminForm');
            console.log('Form by ID (setupAdminForm):', this.form);
            
            if (!this.form) {
                this.form = document.querySelector('form');
                console.log('Form by query:', this.form);
            }
            
            if (!this.form) {
                const allForms = document.querySelectorAll('form');
                console.log('All forms:', allForms);
                throw new Error('Form element not found');
            }

            console.log('✅ Form found:', this.form.id);
            
            this.messageContainer = document.getElementById('message');

            this.enableAllFormElements();
            await this.initializeFirebase();
            this.setupFormListener();
            
            console.log('✅ FirstAdminSetup initialized successfully');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showErrorAlert('System initialization failed', error.message);
        }
    }

    enableAllFormElements() {
        if (!this.form) return;
        
        const allFormElements = this.form.querySelectorAll('input, select, textarea, button');
        allFormElements.forEach(element => {
            element.disabled = false;
            element.readOnly = false;
        });
        console.log('✅ All form elements enabled');
    }

    async initializeFirebase() {
        console.log('🔥 Initializing Firebase...');
        
        const firebaseConfig = {
            apiKey: "AIzaSyCQR--hn0RDvDduCjA2Opa9HLzyYn_GFIs",
            authDomain: "itticketing-f926e.firebaseapp.com",
            projectId: "itticketing-f926e",
            storageBucket: "itticketing-f926e.firebasestorage.app",
            messagingSenderId: "10687213121",
            appId: "1:10687213121:web:af3b530a7c45d3ca2d8a7e",
            measurementId: "G-8H0EP72PC2"
        };

        this.app = initializeApp(firebaseConfig);
        this.db = getFirestore(this.app);
        this.auth = getAuth(this.app);
        this.firebaseInitialized = true;
        
        console.log('✅ Firebase initialized');
    }

    setupFormListener() {
        console.log('📝 Setting up form listener...');
        
        this.form.addEventListener('submit', (e) => {
            console.log('🎯 Form submit event captured');
            e.preventDefault();
            this.handleSubmit();
        });

        console.log('✅ Form listener setup successfully');
    }

    async handleSubmit() {
        if (this.isSubmitting) return;
        
        this.isSubmitting = true;
        this.clearMessages();
        this.clearFieldErrors();

        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.innerHTML = '<i class="fas fa-spinner loading-spinner"></i> Creating Account...';
        submitBtn.disabled = true;

        try {
            console.log('📝 Getting form data...');
            const formData = new FormData(this.form);
            
            const adminData = {
                name: formData.get('name')?.trim() || '',
                email: formData.get('email')?.trim() || '',
                password: formData.get('password') || '',
                role: formData.get('role') || '',
                department: formData.get('department')?.trim() || 'IT Department'
            };

            console.log('📝 Admin data:', { ...adminData, password: '***' });

            if (!this.validateForm(adminData)) {
                throw new Error('Please fill all required fields correctly');
            }

            await this.createAdminAccount(adminData);

        } catch (error) {
            console.error('❌ Admin creation error:', error);
            this.showErrorAlert('Registration Failed', error.message);
        } finally {
            submitBtn.innerHTML = '<i class="fas fa-user-shield"></i> Create Administrator Account';
            submitBtn.disabled = false;
            this.isSubmitting = false;
        }
    }

    validateForm(data) {
        console.log('🔍 Validating form data:', data);
        
        let isValid = true;
        this.clearFieldErrors();

        if (!data.name || data.name.trim() === '') {
            this.showFieldError('name', 'Full name is required');
            isValid = false;
        }

        if (!data.email || data.email.trim() === '') {
            this.showFieldError('email', 'Email is required');
            isValid = false;
        } else if (!this.isValidEmail(data.email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        }

        if (!data.password) {
            this.showFieldError('password', 'Password is required');
            isValid = false;
        } else if (data.password.length < 6) {
            this.showFieldError('password', 'Password must be at least 6 characters');
            isValid = false;
        }

        if (!data.role || data.role === '') {
            this.showFieldError('role', 'Please select a role');
            isValid = false;
        }

        return isValid;
    }

   async createAdminAccount(adminData) {
    console.log('🔄 Starting account creation process...');
    
    try {
        // Show loading state di button
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner loading-spinner"></i> Creating Account...';
        submitBtn.disabled = true;

        console.log('🔐 Step 1: Creating Firebase Auth user...');
        
        // ✅ ADD TIMEOUT FOR FIREBASE AUTH
        const authPromise = createUserWithEmailAndPassword(
            this.auth, 
            adminData.email, 
            adminData.password
        );

        // Timeout after 30 seconds
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Firebase Auth timeout after 30 seconds')), 30000);
        });

        const userCredential = await Promise.race([authPromise, timeoutPromise]);
        const user = userCredential.user;
        console.log('✅ Step 1: Firebase Auth user created:', user.uid);

        console.log('💾 Step 2: Saving admin data to Firestore...');
        const adminDocData = {
            name: adminData.name,
            email: adminData.email,
            role: adminData.role,
            department: adminData.department,
            created_at: new Date().toISOString(),
            is_active: true,
            permissions: this.getPermissionsByRole(adminData.role),
            uid: user.uid
        };

        await setDoc(doc(this.db, "admins", user.uid), adminDocData);
        console.log('✅ Step 2: Admin data saved to Firestore');

        console.log('🎉 Step 3: Showing success message...');
        
        // Reset button first
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        // Show success alert
        await Swal.fire({
            title: '🎉 Success!',
            html: `
                <div style="text-align: left;">
                    <p style="font-size: 1.1rem; font-weight: 600; color: #1f2937; margin-bottom: 1rem;">
                        Administrator Account Created Successfully!
                    </p>
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; border: 1px solid #bbf7d0; margin: 1rem 0;">
                        <p style="margin: 0.5rem 0;"><strong>👤 Name:</strong> ${adminData.name}</p>
                        <p style="margin: 0.5rem 0;"><strong>🎯 Role:</strong> ${this.formatRole(adminData.role)}</p>
                        <p style="margin: 0.5rem 0;"><strong>📧 Email:</strong> ${adminData.email}</p>
                        <p style="margin: 0.5rem 0;"><strong>🔑 User ID:</strong> ${user.uid}</p>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 1rem;">
                        Redirecting to login page...
                    </p>
                </div>
            `,
            icon: 'success',
            iconColor: '#10b981',
            confirmButtonColor: '#ef070a',
            confirmButtonText: 'Go to Login',
            timer: 5000,
            timerProgressBar: true,
            willClose: () => {
                window.location.href = 'login.html';
            }
        });

        // Auto redirect
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 5000);

    } catch (error) {
        console.error('❌ Account creation failed:', error);
        
        // Reset button on error
        const submitBtn = this.form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-user-shield"></i> Create Administrator Account';
        submitBtn.disabled = false;
        
        let errorMessage = 'Failed to create admin account: ';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Email already registered! Please use a different email.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please use at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address format.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Email/password accounts are not enabled. Please check Firebase Console.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Request timeout. Please check your internet connection and try again.';
        } else {
            errorMessage += error.message;
        }
        
        // Show error alert
        await Swal.fire({
            title: '❌ Registration Failed',
            text: errorMessage,
            icon: 'error',
            confirmButtonColor: '#ef070a',
            confirmButtonText: 'OK'
        });
        
        throw new Error(errorMessage);
    }
}

    // ✅ SWEETALERT FOR ERRORS
    async showErrorAlert(title, message) {
        await Swal.fire({
            title: title,
            text: message,
            icon: 'error',
            confirmButtonColor: '#ef070a',
            confirmButtonText: 'OK'
        });
    }

    // ✅ SWEETALERT FOR SUCCESS (alternative)
    async showSuccessAlert(title, message) {
        await Swal.fire({
            title: title,
            text: message,
            icon: 'success',
            confirmButtonColor: '#ef070a',
            confirmButtonText: 'OK'
        });
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.add('field-error');
            const errorElement = document.createElement('span');
            errorElement.className = 'error-text';
            errorElement.textContent = message;
            field.parentNode.appendChild(errorElement);
        }
    }

    clearFieldErrors() {
        const fields = this.form.querySelectorAll('.field-error');
        fields.forEach(field => field.classList.remove('field-error'));
        const errorTexts = this.form.querySelectorAll('.error-text');
        errorTexts.forEach(error => error.remove());
    }

    clearMessages() {
        if (this.messageContainer) {
            this.messageContainer.innerHTML = '';
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    getPermissionsByRole(role) {
        const permissions = {
            'super_admin': ['all'],
            'system_administrator': ['all'],
            'it_manager': ['all'],
            'senior_technician': ['read_tickets', 'update_tickets', 'assign_tickets', 'resolve_tickets', 'reopen_tickets'],
            'it_technician': ['read_tickets', 'update_tickets', 'resolve_tickets'],
            'support_specialist': ['read_tickets', 'update_tickets', 'resolve_tickets'],
            'network_administrator': ['read_tickets', 'update_tickets', 'resolve_tickets'],
            'helpdesk_supervisor': ['read_tickets', 'update_tickets', 'assign_tickets', 'resolve_tickets'],
            'helpdesk_agent': ['read_tickets', 'update_tickets'],
            'service_desk_analyst': ['read_tickets', 'update_tickets'],
            'department_head': ['read_tickets', 'update_tickets', 'assign_tickets', 'resolve_tickets'],
            'team_lead': ['read_tickets', 'update_tickets', 'resolve_tickets'],
            'system_analyst': ['read_tickets', 'update_tickets']
        };
        return permissions[role] || ['read_tickets', 'update_tickets'];
    }

    formatRole(role) {
        const roleMap = {
            'super_admin': 'Super Administrator',
            'system_administrator': 'System Administrator',
            'it_manager': 'IT Manager',
            'senior_technician': 'Senior IT Technician',
            'it_technician': 'IT Technician',
            'support_specialist': 'Support Specialist',
            'network_administrator': 'Network Administrator',
            'helpdesk_supervisor': 'Helpdesk Supervisor',
            'helpdesk_agent': 'Helpdesk Agent',
            'service_desk_analyst': 'Service Desk Analyst',
            'department_head': 'Department IT Head',
            'team_lead': 'IT Team Lead',
            'system_analyst': 'System Analyst'
        };
        return roleMap[role] || role;
    }
}

console.log('🔄 Loading FirstAdminSetup...');
window.addEventListener('load', function() {
    console.log('🏁 Window fully loaded, initializing FirstAdminSetup...');
    new FirstAdminSetup();
});