import { 
    createUserWithEmailAndPassword,
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    fetchSignInMethodsForEmail
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db } from '../utils/firebase-config.js';

class FirebaseAuthService {
    
    constructor() {
        this.initializeFirstAdmin();
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

    // ========== ADMIN AUTHENTICATION ==========
    
    async loginAdmin(email, password) {
    try {
        console.log('🔐 Attempting admin login for:', email);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('✅ Firebase Auth success, UID:', user.uid);

        // ✅ CEK 1: Cari dengan UID sebagai document ID (standard way)
        const adminDocByUID = await getDoc(doc(db, "admins", user.uid));
        
        // ✅ CEK 2: Cari dengan email query (fallback untuk data lama)
        const adminQuery = await getDocs(
            query(collection(db, "admins"), where("email", "==", email))
        );

        let adminData = null;
        let documentId = null;

        console.log('🔍 Search results:');
        console.log('- UID lookup exists:', adminDocByUID.exists());
        console.log('- Email query results:', adminQuery.size);

        // Priority 1: UID match (standard)
        if (adminDocByUID.exists()) {
            adminData = adminDocByUID.data();
            documentId = user.uid;
            console.log('✅ Admin found with UID match');
        }
        // Priority 2: Email query (fallback - perlu migrasi)
        else if (!adminQuery.empty) {
            const foundDoc = adminQuery.docs[0];
            adminData = foundDoc.data();
            documentId = foundDoc.id;
            console.log('⚠️ Admin found with email query, document ID:', documentId);
            
            // ✅ AUTO-MIGRATE: Pindahkan ke document ID yang benar
            await this.migrateAdminToCorrectUID(user.uid, documentId, adminData);
        }
        // Priority 3: Cek di users collection
        else {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().role !== 'user') {
                adminData = userDoc.data();
                console.log('✅ Admin found in users collection');
                
                // Auto-migrate dari users ke admins
                await this.migrateUserToAdmin(user.uid, adminData);
            } else {
                console.log('❌ No admin access found');
                throw new Error('Admin access not granted. Please contact administrator.');
            }
        }

        // Check active status
        const isActive = adminData.is_active !== undefined ? adminData.is_active : adminData.isActive;
        if (!isActive) {
            throw new Error('Admin account is deactivated.');
        }

        console.log('🎉 Admin login successful');
        
        return {
            success: true,
            user: {
                uid: user.uid,
                ...adminData
            },
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
        console.log('🔄 Migrating admin to correct UID...');
        
        // 1. Buat document baru dengan UID yang benar
        await setDoc(doc(db, "admins", correctUID), {
            ...adminData,
            uid: correctUID, // Tambahkan uid field
            migrated_from: oldDocId,
            last_updated: new Date().toISOString()
        });
        
        // 2. Hapus document lama
        await deleteDoc(doc(db, "admins", oldDocId));
        
        console.log('✅ Admin migrated to correct UID');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        // Jangan throw error, biarkan login tetap berjalan
    }
}

    // Tambahkan method untuk auto-migrate
    async migrateUserToAdmin(uid, userData) {
        try {
            console.log('🔄 Auto-migrating user to admin...');
            
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
            
            console.log('✅ User auto-migrated to admin');
        } catch (error) {
            console.error('❌ Auto-migration failed:', error);
        }
    }

    async logout() {
        try {
            const auth = getAuth();
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

    async updateUserProfile(uid, updates) {
        try {
            await updateDoc(doc(db, 'users', uid), {
                ...updates,
                updated_at: new Date().toISOString()
            });
            return { success: true, message: 'Profile updated successfully!' };
        } catch (error) {
            throw new Error('Failed to update profile: ' + error.message);
        }
    }

    // ========== ADMIN MANAGEMENT ==========

    async createAdmin(adminData) {
        try {
            console.log('🔄 Creating admin account...', { 
                email: adminData.email, 
                name: adminData.name,
                role: adminData.role 
            });
            
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
                console.log('✅ New Firebase Auth user created:', user.uid);
                
            } catch (authError) {
                // If user already exists, try to convert existing user to admin
                if (authError.code === 'auth/email-already-in-use') {
                    console.log('ℹ️ User already exists, converting to admin...');
                    isExistingUser = true;
                    
                    // ❌ JANGAN SIGNIN - INI PENYEBAB SESSION TAKEOVER
                    // Gunakan random ID sebagai fallback
                    user = { uid: doc(collection(db, 'admins')).id };
                    console.log('⚠️ Using random ID for existing auth user:', user.uid);
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

            console.log('✅ Admin data saved to Firestore');

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
        console.log('🔍 Checking if admin already exists...', { email: adminData.email });
        
        // Check if admin exists by email in Firestore
        const adminsQuery = await getDocs(
            query(collection(db, 'admins'), where('email', '==', adminData.email))
        );
        
        if (!adminsQuery.empty) {
            const existingAdmin = adminsQuery.docs[0];
            const existingData = existingAdmin.data();
            console.log('ℹ️ Admin already exists in Firestore:', existingData);
            
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
                console.log('ℹ️ User exists in Authentication');
                isExistingUser = true;
                
                // Buat document dengan random ID
                userId = doc(collection(db, 'admins')).id;
                console.log('⚠️ Using random ID for existing auth user:', userId);
                
                console.warn('⚠️ Existing auth user needs manual admin linking');
            } else {
                // ✅ CREATE NEW AUTH USER
                console.log('🔄 Creating new user in Authentication...');
                
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, adminData.email, adminData.password);
                    userId = userCredential.user.uid;
                    authCreated = true;
                    isExistingUser = false;
                    console.log('✅ New auth user created:', userId);
                } catch (authError) {
                    // ✅ HANDLE AUTH ERROR DENGAN BAIK - JANGAN THROW
                    if (authError.code === 'auth/email-already-in-use') {
                        console.log('ℹ️ Email already in Auth, using random ID');
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
            console.log('🔄 Auth process failed, using fallback...');
            
            // Fallback: use random ID
            userId = doc(collection(db, 'admins')).id;
            isExistingUser = false;
            console.log('🔄 Using fallback ID:', userId);
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

        console.log('✅ Admin created in Firestore:', userId, firestoreData);

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
        console.log('🔄 Creating admin (fixed safe mode)...', adminData);
        
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
                console.log('ℹ️ User exists in Auth, but cannot get UID without login');
                // Untuk existing user, kita perlu approach berbeda
                return {
                    success: false,
                    message: 'User already exists in authentication. Please use different email or contact administrator.'
                };
            } else {
                // 3. Create new user in Firebase Auth
                console.log('👤 Creating new user in Firebase Auth...');
                const userCredential = await createUserWithEmailAndPassword(
                    auth, 
                    adminData.email, 
                    adminData.password || 'TempPassword123!' // Default password
                );
                userUID = userCredential.user.uid;
                authCreated = true;
                console.log('✅ Auth user created, UID:', userUID);
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

        console.log('✅ Admin created successfully, UID:', userUID);

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
        console.log('🗑️ Deleting admin permanently:', adminId);
        
        // Import Firebase Firestore functions
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { db } = await import('../utils/firebase-config.js');
        
        // Delete dari Firestore admins collection
        await deleteDoc(doc(db, 'admins', adminId));
        
        console.log('✅ Admin deleted from Firestore');
        
        return {
            success: true,
            message: 'Admin deleted permanently'
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
        console.log('🔍 Debugging admin status for:', email);
        
        // 1. Cek di Firebase Auth
        const authMethods = await fetchSignInMethodsForEmail(auth, email);
        console.log('🔐 Auth methods:', authMethods);
        
        // 2. Cek di Firestore dengan email query
        const adminsQuery = await getDocs(
            query(collection(db, 'admins'), where('email', '==', email))
        );
        
        console.log('📋 Firestore documents found:', adminsQuery.size);
        adminsQuery.forEach(doc => {
            console.log('📄 Document:', {
                id: doc.id,
                data: doc.data()
            });
        });
        
        // 3. Cek jika ada user dengan UID yang cocok
        if (authMethods.length > 0) {
            console.log('ℹ️ User exists in Auth, but UID unknown without login');
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
                console.log('✅ Admin auto-migrated to Firestore');
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