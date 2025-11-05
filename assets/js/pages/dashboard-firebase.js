import FirebaseAuthService from '../services/firebase-auth-service.js';
import FirebaseTicketService from '../services/firebase-ticket-service.js';

class DashboardFirebase {
    constructor() {
        this.currentUser = null;
        this.tickets = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.loadUserInfo();
        this.initializeEventListeners();
        this.loadTickets();
    }

    async checkAuth() {
        try {
            const firebaseUser = await FirebaseAuthService.getCurrentUser();
            
            if (!firebaseUser) {
                window.location.href = '../auth/login.html';
                return;
            }

            // Get user data from Firestore
            this.currentUser = await FirebaseAuthService.getUserProfile(firebaseUser.uid);
            
            if (!this.currentUser) {
                throw new Error('User data not found');
            }

            // Set user data in hidden fields
            if (document.getElementById('user_id')) {
                document.getElementById('user_id').value = this.currentUser.employee_id;
                document.getElementById('user_name').value = this.currentUser.full_name;
                document.getElementById('user_email').value = this.currentUser.email;
                document.getElementById('user_department').value = this.currentUser.department;
                document.getElementById('created_at').value = new Date().toISOString();
            }

        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '../auth/login.html';
        }
    }

    async loadTickets() {
        try {
            const firebaseUser = await FirebaseAuthService.getCurrentUser();
            this.tickets = await FirebaseTicketService.getUserTickets(firebaseUser.uid);
            this.renderTickets();
            this.updateStats();
        } catch (error) {
            console.error('Error loading tickets:', error);
        }
    }

    async handleTicketSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = document.getElementById('submitTicketBtn');
        
        if (!submitBtn) {
            console.error('Submit button not found');
            return;
        }

        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');

        // Show loading state
        submitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'flex';

        this.hideMessages();

        try {
            const formData = this.getFormData(form);
            const validation = this.validateTicketForm(formData);
            
            if (!validation.isValid) {
                throw new Error(validation.message);
            }

            const firebaseUser = await FirebaseAuthService.getCurrentUser();
            
            // Create ticket object for Firebase
            const ticketData = {
                ...formData,
                user_id: firebaseUser.uid,
                user_name: this.currentUser.full_name,
                user_email: this.currentUser.email,
                user_department: this.currentUser.department,
                user_location: this.currentUser.location
            };

            // Save ticket to Firebase
            const result = await FirebaseTicketService.createTicket(ticketData);
            
            // Show success message
            this.showSuccess(result.message);
            
            // Reset form
            form.reset();
            
            // Reload tickets list
            this.loadTickets();

        } catch (error) {
            this.showError(error.message);
        } finally {
            // Hide loading state
            submitBtn.disabled = false;
            if (btnText) btnText.style.display = 'block';
            if (btnLoading) btnLoading.style.display = 'none';
        }
    }

    // ... (method lainnya tetap sama, tapi panggil Firebase services)
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DashboardFirebase();
});