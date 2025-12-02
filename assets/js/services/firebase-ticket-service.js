import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    getDoc,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../utils/firebase-config.js';
import '../utils/config.js';

class FirebaseTicketService {
    
    // ========== TICKET MANAGEMENT ==========
    
    async createTicket(ticketData) {
        try {
            const ticketRef = await addDoc(collection(db, 'tickets'), {
                ...ticketData,
                status: 'Open',
                created_at: Timestamp.now(),
                updated_at: Timestamp.now()
            });
            
            const dept = ticketData.user_department || ticketData.department || 'Lainlain';
            const device = ticketData.device || 'Others';
            const location = ticketData.location || 'Lainlain';
            const gen = (typeof window !== 'undefined') ? window.generateTicketId : undefined;
            const ticketCode = gen ? gen(dept, device, location, ticketRef.id) : `${dept}-${location}-${device}`;
            await updateDoc(ticketRef, { code: ticketCode });
            
            return {
                success: true,
                ticket: {
                    id: ticketRef.id,
                    code: ticketCode,
                    ...ticketData,
                    status: 'Open',
                    created_at: new Date().toISOString()
                },
                message: 'Ticket created successfully!'
            };
            
        } catch (error) {
            throw new Error('Failed to create ticket: ' + error.message);
        }
    }

    async getUserTickets(userId) {
        try {
            const ticketsQuery = query(
                collection(db, 'tickets'),
                where('user_id', '==', userId),
                limit(50)
            );
            
            const querySnapshot = await getDocs(ticketsQuery);
            const tickets = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                tickets.push({
                    id: doc.id,
                    ...data,
                    created_at: data.created_at?.toDate().toISOString(),
                    updated_at: data.updated_at?.toDate().toISOString()
                });
            });
            
            tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return tickets;
            
        } catch (error) {
            throw new Error('Failed to get user tickets: ' + error.message);
        }
    }

    async getAllTickets(filters = {}) {
        try {
            let ticketsQuery = query(
                collection(db, 'tickets')
            );
            
            // Apply filters
            const conditions = [];
            if (filters.status && filters.status !== 'all') {
                conditions.push(where('status', '==', filters.status));
            }
            if (filters.priority && filters.priority !== 'all') {
                conditions.push(where('priority', '==', filters.priority));
            }
            if (filters.assignedTo && filters.assignedTo !== 'all') {
                if (filters.assignedTo === 'unassigned') {
                    conditions.push(where('assigned_to', '==', null));
                } else {
                    conditions.push(where('assigned_to', '==', filters.assignedTo));
                }
            }
            
            // Add conditions to query
            conditions.forEach(condition => {
                ticketsQuery = query(ticketsQuery, condition);
            });
            
            const querySnapshot = await getDocs(ticketsQuery);
            const tickets = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                tickets.push({
                    id: doc.id,
                    ...data,
                    created_at: data.created_at?.toDate().toISOString(),
                    updated_at: data.updated_at?.toDate().toISOString()
                });
            });
            
            tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return tickets;
            
        } catch (error) {
            throw new Error('Failed to get tickets: ' + error.message);
        }
    }

    async getTicketById(ticketId) {
        try {
            const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
            
            if (!ticketDoc.exists()) {
                throw new Error('Ticket not found');
            }
            
            const data = ticketDoc.data();
            return {
                id: ticketDoc.id,
                ...data,
                created_at: data.created_at?.toDate().toISOString(),
                updated_at: data.updated_at?.toDate().toISOString()
            };
            
        } catch (error) {
            throw new Error('Failed to get ticket: ' + error.message);
        }
    }

    async updateTicketStatus(ticketId, newStatus, updateData) {
        try {
            const ticketRef = doc(db, 'tickets', ticketId);
            
            const updateFields = {
                status: newStatus,
                updated_at: Timestamp.now()
            };
            
            if (newStatus === 'In Progress' && !updateData.assigned_to) {
                updateFields.assigned_to = updateData.assigned_to;
                updateFields.assigned_at = Timestamp.now();
                updateFields.assigned_by = updateData.assigned_by;
            }
            
            await updateDoc(ticketRef, updateFields);
            
            // Add to update history
            await this.addTicketUpdate(ticketId, {
                status: newStatus,
                notes: updateData.notes,
                updated_by: updateData.updated_by,
                type: 'status_change'
            });
            
            return { success: true, message: 'Ticket status updated successfully!' };
            
        } catch (error) {
            throw new Error('Failed to update ticket status: ' + error.message);
        }
    }

    async assignTicket(ticketId, assignmentData) {
        try {
            const ticketRef = doc(db, 'tickets', ticketId);
            
            await updateDoc(ticketRef, {
                assigned_to: assignmentData.assigned_to,
                assigned_at: Timestamp.now(),
                assigned_by: assignmentData.assigned_by,
                updated_at: Timestamp.now()
            });
            
            // Add to update history
            await this.addTicketUpdate(ticketId, {
                status: assignmentData.current_status,
                notes: `Assigned to ${assignmentData.assignee_name}` + 
                       (assignmentData.notes ? `: ${assignmentData.notes}` : ''),
                updated_by: assignmentData.assigned_by,
                type: 'assignment'
            });
            
            return { success: true, message: 'Ticket assigned successfully!' };
            
        } catch (error) {
            throw new Error('Failed to assign ticket: ' + error.message);
        }
    }

    async addTicketUpdate(ticketId, updateData) {
        try {
            const updatesRef = collection(db, 'tickets', ticketId, 'updates');
            
            await addDoc(updatesRef, {
                ...updateData,
                timestamp: Timestamp.now()
            });
            
        } catch (error) {
            console.error('Failed to add ticket update:', error);
        }
    }

    async getTicketUpdates(ticketId) {
        try {
            const updatesQuery = query(
                collection(db, 'tickets', ticketId, 'updates'),
                orderBy('timestamp', 'desc')
            );
            
            const querySnapshot = await getDocs(updatesQuery);
            const updates = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                updates.push({
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate().toISOString()
                });
            });
            
            return updates;
            
        } catch (error) {
            console.error('Failed to get ticket updates:', error);
            return [];
        }
    }

    // ========== STATISTICS ==========
    
    async getTicketStatistics() {
        try {
            const ticketsQuery = query(collection(db, 'tickets'));
            const querySnapshot = await getDocs(ticketsQuery);
            
            let totalOpen = 0;
            let totalInProgress = 0;
            let totalResolved = 0;
            let totalHighPriority = 0;
            let totalUnassigned = 0;
            
            querySnapshot.forEach((doc) => {
                const ticket = doc.data();
                
                switch (ticket.status) {
                    case 'Open':
                        totalOpen++;
                        break;
                    case 'In Progress':
                        totalInProgress++;
                        break;
                    case 'Resolved':
                        totalResolved++;
                        break;
                }
                
                if (ticket.priority === 'High') {
                    totalHighPriority++;
                }
                
                if (!ticket.assigned_to && ticket.status !== 'Resolved') {
                    totalUnassigned++;
                }
            });
            
            return {
                totalOpen,
                totalInProgress,
                totalResolved,
                totalHighPriority,
                totalUnassigned,
                totalTickets: querySnapshot.size
            };
            
        } catch (error) {
            throw new Error('Failed to get ticket statistics: ' + error.message);
        }
    }
    async normalizeTicketCodes() {
        try {
            const snapshot = await getDocs(query(collection(db, 'tickets')));
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                if (typeof data.code === 'string' && (data.code.startsWith('TKT-') || data.code.indexOf('-') === -1 || data.code.length <= 3)) {
                    const dept = data.user_department || data.department || 'Lainlain';
                    const device = data.device || 'Others';
                    const location = data.location || 'Lainlain';
                    const ts = (data.created_at?.toDate ? data.created_at.toDate() : (data.createdAt?.toDate ? data.createdAt.toDate() : new Date()));
                    const gen = (typeof window !== 'undefined') ? window.generateTicketId : undefined;
                    const newCode = gen ? gen(dept, device, location, docSnap.id, ts) : `${dept}-${location}-${device}`;
                    await updateDoc(doc(db, 'tickets', docSnap.id), { code: newCode });
                }
            }
            return true;
        } catch (e) {
            throw new Error('Failed to normalize ticket codes: ' + e.message);
        }
    }

    async normalizeTicketStatusAndCode() {
        try {
            const snapshot = await getDocs(query(collection(db, 'tickets')));
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();

                const dept = data.user_department || data.department || 'Lainlain';
                const device = data.device || 'Others';
                const location = data.location || 'Lainlain';
                const ts = (data.created_at?.toDate ? data.created_at.toDate() : (data.createdAt?.toDate ? data.createdAt.toDate() : new Date()));

                const gen = (typeof window !== 'undefined') ? window.generateTicketId : undefined;
                const needsCodeFix = typeof data.code === 'string' && (data.code.startsWith('TKT-') || data.code.indexOf('-') === -1 || data.code.length <= 3);
                const newCode = needsCodeFix && gen ? gen(dept, device, location, docSnap.id, ts) : (needsCodeFix ? `${dept}-${location}-${device}` : data.code);

                let newStatus = data.status || data.status_ticket || (data.qa === 'Finish' ? 'Resolved' : (data.qa || 'Open'));
                if (newStatus === 'Closed') newStatus = 'Resolved';

                const updatePayload = {};
                if (needsCodeFix) updatePayload.code = newCode;
                if (newStatus && newStatus !== data.status) updatePayload.status = newStatus;

                const hasCreatedAt = !!data.created_at;
                const hasUpdatedAt = !!data.updated_at || !!data.last_updated;
                if (!hasCreatedAt && ts) updatePayload.created_at = Timestamp.fromDate(ts);
                const upd = (data.last_updated?.toDate ? data.last_updated.toDate() : (data.updatedAt?.toDate ? data.updatedAt.toDate() : null));
                if (!hasUpdatedAt && upd) updatePayload.updated_at = Timestamp.fromDate(upd);

                if (Object.keys(updatePayload).length > 0) {
                    await updateDoc(doc(db, 'tickets', docSnap.id), updatePayload);
                }
            }
            return true;
        } catch (e) {
            throw new Error('Failed to normalize ticket status and code: ' + e.message);
        }
    }
}

// Create singleton instance
const firebaseTicketService = new FirebaseTicketService();
export default firebaseTicketService;
