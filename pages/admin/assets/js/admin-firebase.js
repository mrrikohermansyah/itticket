import FirebaseAuthService from '../../../assets/js/services/firebase-auth-service.js';
import FirebaseTicketService from '../../../assets/js/services/firebase-ticket-service.js';

class AdminDashboardFirebase {
    constructor() {
        this.adminUser = null;
        this.itTeam = [];
        this.tickets = [];
        this.filteredTickets = [];
        this.currentAssignTicketId = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.loadAdminInfo();
        this.initializeEventListeners();
        this.loadTeamData();
        this.loadTickets();
    }

    async checkAuth() {
        try {
            const firebaseUser = await FirebaseAuthService.getCurrentUser();
            
            if (!firebaseUser) {
                window.location.href = 'login.html';
                return;
            }

            // Verify admin access
            this.adminUser = await FirebaseAuthService.getUserProfile(firebaseUser.uid);
            
            if (!this.adminUser || this.adminUser.role === 'user') {
                throw new Error('Admin access required');
            }

        } catch (error) {
            console.error('Admin auth check failed:', error);
            window.location.href = 'login.html';
        }
    }

    async loadTeamData() {
        try {
            this.itTeam = await FirebaseAuthService.getITSupportTeam();
            this.renderTeam();
            this.populateAssigneeFilter();
            this.populateAssignDropdown();
        } catch (error) {
            console.error('Error loading team data:', error);
        }
    }

    async loadTickets() {
        try {
            this.tickets = await FirebaseTicketService.getAllTickets();
            this.filterTickets();
            await this.updateStats();
        } catch (error) {
            console.error('Error loading tickets:', error);
        }
    }

    async updateStats() {
        try {
            const stats = await FirebaseTicketService.getTicketStatistics();
            
            document.getElementById('totalOpenTickets').textContent = stats.totalOpen;
            document.getElementById('totalInProgress').textContent = stats.totalInProgress;
            document.getElementById('totalResolved').textContent = stats.totalResolved;
            document.getElementById('totalHighPriority').textContent = stats.totalHighPriority;
            
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    async handleAssignTicket(e) {
        e.preventDefault();
        
        const form = e.target;
        const assignTo = document.getElementById('assignTo').value;
        const assignNotes = document.getElementById('assignNotes').value;

        if (!this.currentAssignTicketId || !assignTo) return;

        const ticket = this.tickets.find(t => t.id === this.currentAssignTicketId);
        const assignee = this.itTeam.find(member => member.id === assignTo);

        if (!ticket || !assignee) return;

        try {
            await FirebaseTicketService.assignTicket(ticket.id, {
                assigned_to: assignTo,
                assigned_by: this.adminUser.uid,
                assignee_name: assignee.name,
                current_status: ticket.status,
                notes: assignNotes
            });

            // Update UI
            await this.loadTickets();
            this.renderTeam();

            // Show success message
            await Swal.fire({
                title: 'Success!',
                text: `Ticket assigned to ${assignee.name}`,
                icon: 'success',
                confirmButtonColor: '#ef070a'
            });

            this.closeAssignModal();

        } catch (error) {
            Swal.fire({
                title: 'Error!',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    async updateTicketStatus(ticketId, newStatus) {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        const { value: notes } = await Swal.fire({
            title: `Mark as ${newStatus}`,
            input: 'textarea',
            inputLabel: 'Update Notes (Optional)',
            inputPlaceholder: 'Enter any notes about this update...',
            showCancelButton: true,
            confirmButtonColor: '#ef070a',
            cancelButtonColor: '#6b7280',
            confirmButtonText: `Update to ${newStatus}`,
            cancelButtonText: 'Cancel'
        });

        if (notes !== undefined) {
            try {
                await FirebaseTicketService.updateTicketStatus(ticketId, newStatus, {
                    notes: notes,
                    updated_by: this.adminUser.name
                });

                // Update UI
                await this.loadTickets();

                Swal.fire({
                    title: 'Success!',
                    text: `Ticket has been marked as ${newStatus}`,
                    icon: 'success',
                    confirmButtonColor: '#ef070a'
                });
            } catch (error) {
                Swal.fire({
                    title: 'Error!',
                    text: error.message,
                    icon: 'error',
                    confirmButtonColor: '#ef070a'
                });
            }
        }
    }

    // ... (method lainnya)
}

// Initialize admin dashboard
const adminDashboard = new AdminDashboardFirebase();