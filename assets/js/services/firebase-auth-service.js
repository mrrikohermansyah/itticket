import { 
    createUserWithEmailAndPassword,getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
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
        
        console.log('✅ Firebase Auth success, checking admin access...');

        // CEK 1: Cari di collection admins
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        
        // CEK 2: Cari di collection users dengan role admin
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        let adminData = null;
        let source = '';

        if (adminDoc.exists()) {
            adminData = adminDoc.data();
            source = 'admins collection';
            console.log('✅ Admin found in admins collection:', adminData);
        } 
        else if (userDoc.exists() && userDoc.data().role !== 'user') {
            adminData = userDoc.data();
            source = 'users collection';
            console.log('✅ Admin found in users collection:', adminData);
            
            // ✅ AUTO-MIGRATE: Pindahkan dari users ke admins
            await this.migrateUserToAdmin(user.uid, adminData);
        }
        else {
            console.log('❌ No admin access found for user:', user.uid);
            throw new Error('Admin access not granted. Please contact administrator.');
        }

        if (!adminData.is_active) {
            throw new Error('Admin account is deactivated.');
        }

        console.log(`✅ Admin login successful (source: ${source})`);
        
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
        
        let errorMessage = 'Admin login failed.';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No admin account found.';
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

    // Di file firebase-auth-service.js - pastikan method logout seperti ini:
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
                    
                    // Try to sign in to get the UID
                    try {
                        const signInResult = await signInWithEmailAndPassword(
                            auth, 
                            adminData.email, 
                            adminData.password
                        );
                        user = signInResult.user;
                        console.log('✅ Signed in to existing user:', user.uid);
                    } catch (signInError) {
                        throw new Error(`Email already registered but cannot access account. Please use a different email.`);
                    }
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
                is_existing_user: isExistingUser
            });

            console.log('✅ Admin data saved to Firestore');

            return { 
                success: true, 
                message: isExistingUser ? 
                    'Existing user converted to admin successfully!' : 
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

    async createAdminIfNotExists(adminData) {
        try {
            console.log('🔍 Checking if admin already exists...', { email: adminData.email });
            
            // Check if admin already exists by email
            const existingAdmin = await this.findAdminByEmail(adminData.email);
            if (existingAdmin) {
                console.log('ℹ️ Admin already exists:', existingAdmin);
                return { 
                    success: true, 
                    message: 'Admin account already exists.',
                    user: existingAdmin,
                    isExisting: true
                };
            }

            console.log('🔄 Admin not found, creating new one...');
            // If not exists, create new admin
            return await this.createAdmin(adminData);
            
        } catch (error) {
            console.error('❌ Error in createAdminIfNotExists:', error);
            throw error;
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
export default firebaseAuthService;