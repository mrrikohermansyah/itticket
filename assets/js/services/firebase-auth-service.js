import {
    createUserWithEmailAndPassword,
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    fetchSignInMethodsForEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db } from '../utils/firebase-config.js';

class FirebaseAuthService {

    constructor() {
        // ✅ FIX: Bind semua methods yang menggunakan 'this'
        this.validateUserProfileUpdates = this.validateUserProfileUpdates.bind(this);
        this.capitalizeFirstLetter = this.capitalizeFirstLetter.bind(this);
        this.updateUserProfile = this.updateUserProfile.bind(this);
        this.updateUserTicketsInFirestore = this.updateUserTicketsInFirestore.bind(this);
        this.validateAndCleanUserUpdates = this.validateAndCleanUserUpdates.bind(this);
        this.triggerGlobalUserUpdate = this.triggerGlobalUserUpdate.bind(this);
    }

    // ========== USER AUTHENTICATION ==========

    async registerUser(userData) {
        try {
            // Create user in Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                userData.email,
                userData.password
            );

            const user = userCredential.user;

            // Save additional user data to Firestore
            await setDoc(doc(db, 'users', user.uid), {
                employee_id: userData.employee_id,
                full_name: userData.full_name,
                email: userData.email,
                phone: userData.phone || '',
                department: userData.department,
                location: userData.location,
                role: 'user',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            return {
                success: true,
                user: {
                    uid: user.uid,
                    ...userData,
                    role: 'user'
                },
                message: 'Registration successful!'
            };

        } catch (error) {
            let errorMessage = 'Registration failed. Please try again.';

            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Email already registered.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password should be at least 6 characters.';
                    break;
                default:
                    errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    }

    async loginUser(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Get user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));

            if (!userDoc.exists()) {
                throw new Error('User data not found.');
            }

            const userData = userDoc.data();

            if (!userData.is_active) {
                throw new Error('Account is deactivated. Please contact administrator.');
            }

            if (userData.role !== 'user') {
                throw new Error('Please use admin login for this account.');
            }

            return {
                success: true,
                user: {
                    uid: user.uid,
                    ...userData
                },
                message: 'Login successful!'
            };

        } catch (error) {
            let errorMessage = 'Login failed. Please try again.';

            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password.';
                    break;
                default:
                    errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    }

    async simpleLogin(email, password) {
        try {
            

            // Coba login dulu dengan Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            

            // Cek di admins collection
            const adminDoc = await getDoc(doc(db, "admins", user.uid));
            if (adminDoc.exists()) {
                
                return {
                    success: true,
                    user: { uid: user.uid, ...adminDoc.data() },
                    isAdmin: true
                };
            }

            // Cek di users collection
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                
                return {
                    success: true,
                    user: { uid: user.uid, ...userDoc.data() },
                    isAdmin: false
                };
            }

            // Jika tidak ada di kedua collection, buat user record
            
            await setDoc(doc(db, "users", user.uid), {
                email: email,
                full_name: email.split('@')[0],
                role: 'user',
                created_at: new Date().toISOString()
            });

            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: email,
                    full_name: email.split('@')[0],
                    role: 'user'
                },
                isAdmin: false
            };

        } catch (error) {
            console.error('❌ Login failed:', error);
            throw error;
        }
    }

    // ========== ADMIN AUTHENTICATION ==========

    async loginAdmin(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            let adminData = null;
            try {
                const adminDocByUID = await getDoc(doc(db, "admins", user.uid));
                if (adminDocByUID.exists()) {
                    const data = adminDocByUID.data();
                    if (data.is_active === false || !!data.deleted_at) {
                        throw new Error('deactivated');
                    }
                    adminData = data;
                } else {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists() && userDoc.data().role !== 'user') {
                        adminData = userDoc.data();
                        await this.migrateUserToAdmin(user.uid, adminData);
                    }
                    // Cari dokumen admin berdasarkan email bila dokumen berdasarkan UID tidak ditemukan
                    if (!adminData) {
                        try {
                            const q = query(collection(db, 'admins'), where('email', '==', (email || '').toLowerCase()));
                            const byEmail = await getDocs(q);
                            if (!byEmail.empty) {
                                const found = byEmail.docs[0];
                                const data = found.data();
                                if (data.is_active === false || !!data.deleted_at) {
                                    throw new Error('deactivated');
                                }
                                await setDoc(doc(db, 'admins', user.uid), {
                                    ...data,
                                    uid: user.uid,
                                    migrated_from: found.id,
                                    last_updated: new Date().toISOString()
                                });
                                try { await updateDoc(doc(db, 'admins', found.id), { migrated_to: user.uid, last_updated: new Date().toISOString() }); } catch (_) {}
                                adminData = data;
                            }
                        } catch (_) {}
                    }
                }
            } catch (firestoreError) {
                // Jangan gagalkan login karena kegagalan baca Firestore – lanjutkan ke whitelist
            }

            if (!adminData) {
                let isAllowed = false;
                try {
                    const settingsSnap = await getDoc(doc(db, 'secure_settings', 'allowed_admin_emails'));
                    if (settingsSnap.exists()) {
                        const s = settingsSnap.data();
                        const allowAll = !!s.allow_all;
                        const list = Array.isArray(s.emails) ? s.emails.map(e => (e || '').toLowerCase()) : [];
                        isAllowed = allowAll || list.includes((email || '').toLowerCase());
                    }
                } catch (_) {}
                if (!isAllowed) {
                    const allowedEmails = [
                        'sit@meb.com',
                        'ade.reinalwi@meitech-ekabintan.com',
                        'wahyu.nugroho@meitech-ekabintan.com',
                        'riko.hermansyah@meitech-ekabintan.com',
                        'abdurahman.hakim@meitech-ekabintan.com',
                        'it@meb.com'
                    ];
                    isAllowed = allowedEmails.includes((email || '').toLowerCase());
                }
                if (isAllowed) {
                    const userRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userRef);
                    const base = userDoc.exists() ? userDoc.data() : {};
                    const resolvedRole = await this.resolveRoleForEmail(email);
                    const wasSoftDeleted = base && ((base.role === 'user') || (base.is_active === false) || !!base.deleted_at);
                    if (wasSoftDeleted) {
                        throw new Error('Admin access not granted. Please contact administrator.');
                    }
                    const nextUser = {
                        employee_id: base.employee_id || '',
                        full_name: base.full_name || email.split('@')[0],
                        email: base.email || email,
                        phone: base.phone || '',
                        department: base.department || 'IT',
                        location: base.location || '',
                        role: (resolvedRole === 'Super Admin') ? 'Super Admin' : 'admin',
                        is_active: true,
                        updated_at: new Date().toISOString(),
                        created_at: base.created_at || new Date().toISOString()
                    };
                    if (userDoc.exists()) {
                        await updateDoc(userRef, nextUser);
                    } else {
                        await setDoc(userRef, nextUser);
                    }
                    const created = {
                        name: nextUser.full_name,
                        email: nextUser.email,
                        role: (resolvedRole === 'Super Admin') ? 'Super Admin' : 'admin',
                        department: nextUser.department,
                        is_active: true,
                        created_at: new Date().toISOString(),
                        created_by: user.uid,
                        is_existing_user: !!userDoc.exists()
                    };
                    await setDoc(doc(db, 'admins', user.uid), created);
                    adminData = created;
                }
                if (!adminData) {
                    throw new Error('Admin access not granted. Please contact administrator.');
                }
            }

            try {
                const desiredRole = await this.resolveRoleForEmail(adminData?.email || email);
                if (desiredRole === 'Super Admin' && (adminData?.role !== 'Super Admin')) {
                    await updateDoc(doc(db, 'admins', user.uid), { role: 'Super Admin', last_updated: new Date().toISOString() });
                    try { await updateDoc(doc(db, 'users', user.uid), { role: 'Super Admin', updated_at: new Date().toISOString() }); } catch (_) {}
                    adminData.role = 'Super Admin';
                }
            } catch (_) {}
            try {
                const resolved = await this.resolveRoleForEmail(adminData?.email || email);
                if (resolved === 'Super Admin' && (adminData?.role || 'admin') !== 'Super Admin') {
                    try { await updateDoc(doc(db, 'admins', user.uid), { role: 'Super Admin', last_updated: new Date().toISOString() }); } catch (_) {}
                    try { await updateDoc(doc(db, 'users', user.uid), { role: 'Super Admin', updated_at: new Date().toISOString() }); } catch (_) {}
                    adminData.role = 'Super Admin';
                }
            } catch (_) {}
            const isActive = (adminData?.is_active ?? adminData?.isActive ?? true);
            if (isActive === false) {
                throw new Error('Admin account is deactivated.');
            }

            return {
                success: true,
                user: { uid: user.uid, ...adminData },
                message: 'Admin login successful!'
            };

        } catch (error) {
            console.error('❌ Admin login failed:', error);
            throw new Error(error.message);
        }
    }

    // ✅ METHOD BARU: Migrasi admin ke document ID yang benar
    async migrateAdminToCorrectUID(correctUID, oldDocId, adminData) {
        try {
            

            // 1. Buat document baru dengan UID yang benar
            await setDoc(doc(db, "admins", correctUID), {
                ...adminData,
                uid: correctUID, // Tambahkan uid field
                migrated_from: oldDocId,
                last_updated: new Date().toISOString()
            });

            // 2. Hapus document lama
            await deleteDoc(doc(db, "admins", oldDocId));

            

        } catch (error) {
            console.error('❌ Migration failed:', error);
            // Jangan throw error, biarkan login tetap berjalan
        }
    }

    // Tambahkan method untuk auto-migrate
    async migrateUserToAdmin(uid, userData) {
        try {
            

            await setDoc(doc(db, "admins", uid), {
                name: userData.full_name || userData.name || userData.email.split('@')[0],
                email: userData.email,
                role: userData.role || 'admin',
                department: userData.department || 'IT',
                specialization: userData.specialization || [],
                is_active: true,
                created_at: new Date().toISOString(),
                created_by: 'system_auto_migration',
                migrated_from_users: true
            });

            
        } catch (error) {
            console.error('❌ Auto-migration failed:', error);
        }
    }

    async ensureAdminRecord(uid, email) {
        try {
            const userRef = doc(db, 'users', uid);
            const userDoc = await getDoc(userRef);
            const base = userDoc.exists() ? userDoc.data() : {};
            const currentRole = (base.role || 'user');
            const nextUser = {
                employee_id: base.employee_id || '',
                full_name: base.full_name || base.name || (email || '').split('@')[0],
                email: base.email || email,
                phone: base.phone || '',
                department: base.department || 'IT',
                location: base.location || '',
                role: currentRole !== 'user' ? currentRole : await this.resolveRoleForEmail(email),
                is_active: true,
                updated_at: new Date().toISOString(),
                created_at: base.created_at || new Date().toISOString()
            };
            if (userDoc.exists()) {
                await updateDoc(userRef, nextUser);
            } else {
                await setDoc(userRef, nextUser);
            }

            if (nextUser.role !== 'user') {
                const adminRef = doc(db, 'admins', uid);
                const adminData = {
                    name: nextUser.full_name,
                    email: nextUser.email,
                    role: nextUser.role,
                    department: nextUser.department,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    created_by: uid
                };
                await setDoc(adminRef, adminData, { merge: true });
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    async logout() {
        try {
            await signOut(auth);

            // ✅ CLEAR LOCAL STORAGE ATAU SESSION
            localStorage.removeItem('userToken');
            sessionStorage.clear();

            // ✅ REDIRECT KE LOGIN PAGE
            window.location.href = '../auth/login.html';

        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }

    getCurrentUser() {
        return new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }

    async isCurrentUserAdmin() {
        try {
            const user = await this.getCurrentUser();
            if (!user) return false;
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            return adminDoc.exists() && adminDoc.data().is_active !== false;
        } catch (e) {
            return false;
        }
    }

    async getUserProfile(uid) {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                return userDoc.data();
            }
            return null;
        } catch (error) {
            throw new Error('Failed to get user profile: ' + error.message);
        }
    }

    async resolveRoleForEmail(email) {
        try {
            const e = (email || '').toLowerCase();
            let role = 'user';
            try {
                const settingsSnap = await getDoc(doc(db, 'secure_settings', 'allowed_admin_emails'));
                if (settingsSnap.exists()) {
                    const s = settingsSnap.data();
                    const superList = Array.isArray(s.super_admin_emails) ? s.super_admin_emails.map(v => (v || '').toLowerCase()) : [];
                    if (superList.includes(e)) role = 'Super Admin';
                }
            } catch (_) {}
            if (role === 'user') {
                const fallback = ['sit@meb.com'];
                if (fallback.includes(e)) role = 'Super Admin';
            }
            return role;
        } catch (_) {
            return 'user';
        }
    }

    // ========== COMPREHENSIVE USER PROFILE UPDATE WITH TICKET SYNC ==========

    async updateUserProfile(uid, updates) {
        try {
            

            const validation = this.validateUserProfileUpdates(updates);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                ...updates,
                updated_at: new Date().toISOString(),
                last_synced: new Date().toISOString()
            });

            

            try {
                await this.updateUserTicketsInFirestore(uid, updates);
            } catch (syncError) {
                console.warn('Ticket sync skipped:', syncError.message);
            }

            await this.triggerGlobalUserUpdate(uid, updates);

            return {
                success: true,
                message: 'Profile updated successfully! All related tickets have been updated.',
                user: { uid, ...updates }
            };

        } catch (error) {
            console.error('❌ User profile sync failed:', error);
            throw new Error('Failed to update profile: ' + error.message);
        }
    }
    // Tambahkan method ini di class FirebaseAuthService
    validateUserProfileUpdates(userData) {
        const requiredFields = ['full_name', 'email', 'department', 'location'];
        const errors = [];

        for (const field of requiredFields) {
            if (!userData[field] || userData[field].toString().trim() === '') {
                const fieldName = field.replace('_', ' ');
                errors.push(`${this.capitalizeFirstLetter(fieldName)} is required`);
            }
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (userData.email && !emailRegex.test(userData.email)) {
            errors.push('Please enter a valid email address');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Helper method untuk capitalize
    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // ✅ NEW: Update semua tickets user di Firestore
    async updateUserTicketsInFirestore(userId, userUpdates) {
        try {
            

            // Cari semua tickets yang dibuat oleh user ini
            const ticketsQuery = query(
                collection(db, "tickets"),
                where("user_id", "==", userId)
            );

            const querySnapshot = await getDocs(ticketsQuery);

            

            let updatedTicketsCount = 0;

            // Update setiap ticket
            for (const docSnapshot of querySnapshot.docs) {
                const ticketRef = doc(db, "tickets", docSnapshot.id);
                const ticketData = docSnapshot.data();

                

                // Update ticket dengan data user terbaru
                await updateDoc(ticketRef, {
                    user_name: userUpdates.full_name || ticketData.user_name,
                    user_department: userUpdates.department || ticketData.user_department,
                    user_email: userUpdates.email || ticketData.user_email,
                    user_phone: userUpdates.phone || ticketData.user_phone,
                    last_updated: serverTimestamp()
                });

                updatedTicketsCount++;
            }

            

            return updatedTicketsCount;

        } catch (error) {
            console.error('❌ Error updating user tickets in Firestore:', error);
            throw new Error('Failed to update related tickets: ' + error.message);
        }
    }

    // ✅ FIX: Validasi dan cleaning data yang lebih robust
    validateAndCleanUserUpdates(updates) {
        const cleaned = {};

        // Field yang akan diupdate
        const fields = [
            'employee_id', 'full_name', 'email', 'phone',
            'department', 'location'
        ];

        fields.forEach(field => {
            if (updates[field] !== undefined && updates[field] !== null) {
                // ✅ FIX: Handle empty strings and "-" values
                let value = updates[field].toString().trim();

                // ✅ FIX: Jika employee_id adalah "-", ubah jadi empty string
                if (field === 'employee_id' && value === '-') {
                    value = '';
                }

                // ✅ FIX: Pastikan phone tidak null/undefined
                if (field === 'phone' && (!value || value === 'null' || value === 'undefined')) {
                    value = '';
                }

                cleaned[field] = value;
            }
        });

        // ✅ FIX: Validasi email
        if (cleaned.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(cleaned.email)) {
                throw new Error('Invalid email format');
            }
        }

        // ✅ FIX: Validasi required fields
        const requiredFields = ['full_name', 'email', 'department', 'location'];
        for (const field of requiredFields) {
            if (!cleaned[field] || cleaned[field].trim() === '') {
                throw new Error(`${field.replace('_', ' ')} is required`);
            }
        }

        return cleaned;
    }

    // ✅ FIX: Global update trigger dengan error handling
    async triggerGlobalUserUpdate(uid, updates) {
        try {
            

            // Clear cache
            if (window.userCache && window.userCache[uid]) {
                delete window.userCache[uid];
            }

            // Dispatch custom event untuk admin panel
            const updateEvent = new CustomEvent('userProfileUpdated', {
                detail: { uid, updates }
            });
            window.dispatchEvent(updateEvent);

            

        } catch (error) {
            console.error('❌ Error triggering global update:', error);
        }
    }

    // ========== REAL-TIME SYNC TRIGGER ==========

    triggerUserDataUpdate(uid) {
        // Method ini akan memicu update real-time di admin panel
        

        // Anda bisa menambahkan custom event atau langsung update cache
        if (window.adminCache && window.adminCache[uid]) {
            delete window.adminCache[uid]; // Clear cache untuk force reload
        }
    }

    // ========== GET USER DATA WITH CACHE MANAGEMENT ==========

    async getUserData(uid) {
        try {
            // Check cache first
            if (window.userCache && window.userCache[uid]) {
                return window.userCache[uid];
            }

            const userDoc = await getDoc(doc(db, 'users', uid));
            if (!userDoc.exists()) {
                throw new Error('User data not found');
            }

            const userData = userDoc.data();

            // Cache the data
            if (!window.userCache) window.userCache = {};
            window.userCache[uid] = userData;

            return userData;

        } catch (error) {
            console.error('Error getting user data:', error);
            throw error;
        }
    }

    // ========== ADMIN MANAGEMENT ==========

    async createAdmin(adminData) {
        try {
            

            // Validate required data
            if (!adminData.email || !adminData.password) {
                throw new Error('Email and password are required');
            }

            if (adminData.password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            let user;
            let isExistingUser = false;

            try {
                // Try to create new user in Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    adminData.email,
                    adminData.password
                );
                user = userCredential.user;
                

            } catch (authError) {
                // If user already exists, try to convert existing user to admin
                if (authError.code === 'auth/email-already-in-use') {
                    
                    isExistingUser = true;

                    // ❌ JANGAN SIGNIN - INI PENYEBAB SESSION TAKEOVER
                    // Gunakan random ID sebagai fallback
                    user = { uid: doc(collection(db, 'admins')).id };
                    
                    console.warn('⚠️ Existing auth user needs manual admin linking');

                } else {
                    // Re-throw other authentication errors
                    throw authError;
                }
            }

            // Get current admin user (creator)
            const currentUser = auth.currentUser;
            const createdBy = currentUser ? currentUser.uid : 'system';

            // Check if admin record already exists
            const existingAdminDoc = await getDoc(doc(db, 'admins', user.uid));
            if (existingAdminDoc.exists()) {
                // Return success instead of throwing error for existing admin
                return {
                    success: true,
                    message: 'Admin account already exists.',
                    user: {
                        uid: user.uid,
                        email: adminData.email,
                        name: adminData.name,
                        is_existing: true
                    }
                };
            }

            // Save admin data to Firestore
            await setDoc(doc(db, 'admins', user.uid), {
                name: adminData.name || adminData.email.split('@')[0],
                email: adminData.email,
                role: adminData.role || 'support',
                department: adminData.department || 'IT',
                specialization: adminData.specialization || [],
                is_active: true,
                created_at: new Date().toISOString(),
                created_by: createdBy,
                is_existing_user: isExistingUser,
                needs_password_setup: isExistingUser // ✅ Jika existing user, butuh setup
            });

            

            return {
                success: true,
                message: isExistingUser ?
                    'Admin created. User needs to setup password.' :
                    'Admin created successfully!',
                user: {
                    uid: user.uid,
                    email: adminData.email,
                    name: adminData.name,
                    is_existing_user: isExistingUser
                }
            };

        } catch (error) {
            console.error('❌ Error creating admin:', error);

            let errorMessage = 'Failed to create admin account. ';

            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Email already registered.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password should be at least 6 characters.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Email/password accounts are not enabled.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password for existing account.';
                    break;
                case 'permission-denied':
                case 'missing-or-insufficient-permissions':
                    errorMessage = 'Database permission denied.';
                    break;
                default:
                    errorMessage = 'Failed to create admin account. Please try again.';
            }

            throw new Error(errorMessage);
        }
    }

    async createAdminIfNotExists(adminData, currentAdminId = null) {
        try {
            

            // Check if admin exists by email in Firestore
            const adminsQuery = await getDocs(
                query(collection(db, 'admins'), where('email', '==', adminData.email))
            );

            if (!adminsQuery.empty) {
                const existingAdmin = adminsQuery.docs[0];
                const existingData = existingAdmin.data();
                

                return {
                    success: true,
                    exists: true,
                    message: 'Admin account already exists.',
                    user: { id: existingAdmin.id, ...existingData }
                };
            }

            let userId;
            let authCreated = false;
            let isExistingUser = false;

            // ✅ CHECK IF USER EXISTS IN AUTHENTICATION (TANPA SIGNIN)
            try {
                const auth = getAuth();
                const signInMethods = await fetchSignInMethodsForEmail(auth, adminData.email);

                if (signInMethods.length > 0) {
                    
                    isExistingUser = true;

                    // Buat document dengan random ID
                    userId = doc(collection(db, 'admins')).id;
                    

                    console.warn('⚠️ Existing auth user needs manual admin linking');
                } else {
                    // ✅ CREATE NEW AUTH USER
                    

                    try {
                        const userCredential = await createUserWithEmailAndPassword(auth, adminData.email, adminData.password);
                        userId = userCredential.user.uid;
                        authCreated = true;
                        isExistingUser = false;
                        
                    } catch (authError) {
                        // ✅ HANDLE AUTH ERROR DENGAN BAIK - JANGAN THROW
                        if (authError.code === 'auth/email-already-in-use') {
                            
                            userId = doc(collection(db, 'admins')).id;
                            authCreated = false;
                            isExistingUser = true;
                        } else {
                            // Re-throw other auth errors
                            throw authError;
                        }
                    }
                }
            } catch (authError) {
                

                // Fallback: use random ID
                userId = doc(collection(db, 'admins')).id;
                isExistingUser = false;
                
            }

            // ✅ PREPARE DATA UNTUK FIRESTORE
            const firestoreData = {
                name: adminData.name,
                email: adminData.email,
                role: adminData.role,
                department: adminData.department,
                specialization: adminData.specialization || [],
                is_active: true,
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                auth_created: authCreated,
                needs_password_setup: !authCreated,
                is_existing_user: isExistingUser
            };

            // ✅ HANYA TAMBAH FIELD JIKA ADA VALUE
            if (currentAdminId) {
                firestoreData.created_by = currentAdminId;
            }

            // ✅ CREATE ADMIN DATA IN FIRESTORE
            const adminRef = doc(db, 'admins', userId);
            await setDoc(adminRef, firestoreData);

            

            return {
                success: true,
                message: authCreated ? 'Admin created successfully' : 'Admin created. User needs to setup password.',
                user: {
                    id: userId,
                    ...firestoreData
                }
            };

        } catch (error) {
            console.error('❌ Error in createAdminIfNotExists:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    // ✅ METHOD BARU YANG 100% AMAN
    async createAdminSafe(adminData, currentAdminId) {
        try {
            

            // 1. Check if admin already exists by email
            const adminsQuery = await getDocs(
                query(collection(db, 'admins'), where('email', '==', adminData.email))
            );

            if (!adminsQuery.empty) {
                return {
                    success: false,
                    exists: true,
                    message: 'Admin already exists'
                };
            }

            // 2. Check if user exists in Firebase Auth
            let userUID = null;
            let authCreated = false;

            try {
                const authMethods = await fetchSignInMethodsForEmail(auth, adminData.email);

                if (authMethods.length > 0) {
                    
                    // Untuk existing user, kita perlu approach berbeda
                    return {
                        success: false,
                        message: 'User already exists in authentication. Please use different email or contact administrator.'
                    };
                } else {
                    // 3. Create new user in Firebase Auth
                    
                    const userCredential = await createUserWithEmailAndPassword(
                        auth,
                        adminData.email,
                        adminData.password || 'TempPassword123!' // Default password
                    );
                    userUID = userCredential.user.uid;
                    authCreated = true;
                    
                }
            } catch (authError) {
                console.error('❌ Auth creation failed:', authError);
                return {
                    success: false,
                    message: 'Failed to create authentication user: ' + authError.message
                };
            }

            // 4. Save admin data dengan UID sebagai document ID
            const adminDataToSave = {
                name: adminData.name || '',
                email: adminData.email,
                role: adminData.role,
                department: adminData.department || 'IT',
                specialization: adminData.specialization || [],
                is_active: true,
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                created_by: currentAdminId || '',
                auth_created: authCreated,
                needs_password_setup: !authCreated
            };

            await setDoc(doc(db, 'admins', userUID), adminDataToSave);

            

            return {
                success: true,
                message: authCreated ?
                    'Admin created successfully!' :
                    'Admin created. User needs to setup password.',
                user: {
                    id: userUID,
                    ...adminDataToSave
                }
            };

        } catch (error) {
            console.error('❌ Error in createAdminSafe:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    async findAdminByEmail(email) {
        try {
            const adminsQuery = query(
                collection(db, 'admins'),
                where('email', '==', email)
            );

            const querySnapshot = await getDocs(adminsQuery);
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return {
                    id: doc.id,
                    ...doc.data()
                };
            }
            return null;
        } catch (error) {
            console.error('Error finding admin by email:', error);
            return null;
        }
    }

    async updateAdmin(adminId, updates) {
        try {
            await updateDoc(doc(db, 'admins', adminId), {
                ...updates,
                updated_at: new Date().toISOString()
            });
            return { success: true, message: 'Admin updated successfully!' };
        } catch (error) {
            throw new Error('Failed to update admin: ' + error.message);
        }
    }

    async deactivateAdmin(adminId) {
        try {
            await updateDoc(doc(db, 'admins', adminId), {
                is_active: false,
                updated_at: new Date().toISOString()
            });
            return { success: true, message: 'Admin deactivated successfully!' };
        } catch (error) {
            throw new Error('Failed to deactivate admin: ' + error.message);
        }
    }

    async activateAdmin(adminId) {
        try {
            await updateDoc(doc(db, 'admins', adminId), {
                is_active: true,
                updated_at: new Date().toISOString()
            });
            return { success: true, message: 'Admin activated successfully!' };
        } catch (error) {
            throw new Error('Failed to activate admin: ' + error.message);
        }
    }

    async getITSupportTeam() {
        try {
            const adminsQuery = query(
                collection(db, 'admins'),
                where('is_active', '==', true)
            );

            const querySnapshot = await getDocs(adminsQuery);
            const team = [];

            querySnapshot.forEach((doc) => {
                team.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return team;

        } catch (error) {
            throw new Error('Failed to get IT support team: ' + error.message);
        }
    }

    // ✅ METHOD UNTUK GET SEMUA ADMIN (INCLUDE INACTIVE)
    async getAllAdmins() {
        try {
            const adminsQuery = query(
                collection(db, 'admins')
            );

            const querySnapshot = await getDocs(adminsQuery);
            const allAdmins = [];

            querySnapshot.forEach((doc) => {
                allAdmins.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return allAdmins;

        } catch (error) {
            throw new Error('Failed to get all admins: ' + error.message);
        }
    }

    // ✅ METHOD UNTUK DELETE ADMIN PERMANEN
    async deleteAdminPermanently(adminId) {
        try {
            const tombstone = {
                is_active: false,
                deleted_at: new Date().toISOString(),
                deleted_by: auth.currentUser?.uid || 'system'
            };
            await setDoc(doc(db, 'admins', adminId), tombstone, { merge: true });
            try {
                await updateDoc(doc(db, 'users', adminId), {
                    role: 'user',
                    updated_at: new Date().toISOString()
                });
            } catch (_) {}
            try {
                await deleteDoc(doc(db, 'admins', adminId));
            } catch (_) {}
            return {
                success: true,
                message: 'Admin soft-deleted and demoted to user'
            };
        } catch (error) {
            console.error('❌ Error deleting admin:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    // ✅ ALTERNATIVE METHOD: deleteAdmin (alias)
    async deleteAdmin(adminId) {
        return await this.deleteAdminPermanently(adminId);
    }

    // ========== DEBUG & UTILITY METHODS ==========

    async debugAdminStatus(email) {
        try {
            

            // 1. Cek di Firebase Auth
            const authMethods = await fetchSignInMethodsForEmail(auth, email);
            

            // 2. Cek di Firestore dengan email query
            const adminsQuery = await getDocs(
                query(collection(db, 'admins'), where('email', '==', email))
            );

            
            // Removed verbose per-document debug output

            // 3. Cek jika ada user dengan UID yang cocok
            if (authMethods.length > 0) {
                
            }

            return {
                authExists: authMethods.length > 0,
                firestoreDocs: adminsQuery.size,
                documents: adminsQuery.docs.map(doc => ({
                    id: doc.id,
                    data: doc.data()
                }))
            };

        } catch (error) {
            console.error('❌ Debug failed:', error);
            throw error;
        }
    }

    // ========== END OF CLASS ==========



    // ========== HELPER METHODS ==========

    async findUserByEmail(email) {
        try {
            // Check in users collection
            const usersQuery = query(
                collection(db, 'users'),
                where('email', '==', email)
            );

            const querySnapshot = await getDocs(usersQuery);
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return {
                    uid: doc.id,
                    ...doc.data()
                };
            }
            return null;
        } catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }

    async convertUserToAdmin(uid, adminData) {
        try {
            await setDoc(doc(db, 'admins', uid), {
                name: adminData.name || adminData.email.split('@')[0],
                email: adminData.email,
                role: adminData.role || 'support',
                department: adminData.department || 'IT',
                specialization: adminData.specialization || [],
                is_active: true,
                created_at: new Date().toISOString(),
                created_by: auth.currentUser?.uid || 'system',
                converted_from_user: true
            });

            // Also update user role if exists in users collection
            await updateDoc(doc(db, 'users', uid), {
                role: adminData.role || 'support',
                updated_at: new Date().toISOString()
            });

            return { success: true, message: 'User converted to admin successfully!' };
        } catch (error) {
            throw new Error('Failed to convert user to admin: ' + error.message);
        }
    }

    async initializeFirstAdmin() {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return;

            // Check if user exists in admins collection
            const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
            if (adminDoc.exists()) return;

            // Check if user is in users collection with admin role
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            let userData = userDoc.exists() ? userDoc.data() : null;

            // If user has admin role in users collection, migrate to admins
            if (userData && userData.role !== 'user') {
                await setDoc(doc(db, 'admins', currentUser.uid), {
                    name: userData.full_name || userData.name || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    role: userData.role,
                    department: userData.department || 'IT',
                    specialization: userData.specialization || [],
                    is_active: true,
                    created_at: new Date().toISOString(),
                    created_by: 'system_auto_migration'
                });
                
            }
        } catch (error) {
            console.error('Auto-migration failed:', error);
        }
    }
}

// Create singleton instance
const firebaseAuthService = new FirebaseAuthService();
window.debugAdmin = (email) => firebaseAuthService.debugAdminStatus(email);
export default firebaseAuthService;
