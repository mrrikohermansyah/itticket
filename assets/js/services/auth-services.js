import { 
  getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Auth Service dengan Firebase + Role Management
// Auth Service dengan Firebase + Role Management
class AuthService {
  constructor() {
    this.auth = null;
    this.db = null;
    this.initialized = false;
  }

  // Initialize dengan Firebase app - FIXED VERSION
  initialize(firebaseApp) {
    if (this.initialized) return;
    
    try {
      // Di browser, kita langsung assign tanpa require
      this.auth = getAuth(firebaseApp);
      this.db = getFirestore(firebaseApp);
      this.initialized = true;
      
      console.log('AuthService initialized with Firebase');
    } catch (error) {
      console.warn('Firebase auth not available, falling back to localStorage:', error);
      this.auth = null;
      this.db = null;
    }
  }

  async register(userData) {
    // Jika Firebase tersedia, gunakan Firebase Auth
    if (this.auth && this.db) {
      try {        
        // Create user di Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          this.auth, 
          userData.email, 
          userData.password
        );
        
        const user = userCredential.user;
        
        // Simpan data tambahan di Firestore
        await setDoc(doc(this.db, "users", user.uid), {
          employee_id: userData.employee_id,
          full_name: userData.full_name,
          email: userData.email,
          phone: userData.phone,
          department: userData.department,
          location: userData.location,
          role: 'user', // Default role
          is_active: true,
          created_at: new Date().toISOString()
        });
        
        return {
          success: true,
          user: { id: user.uid, ...userData },
          message: 'Registration successful!'
        };
        
      } catch (error) {
        throw new Error(this.getFirebaseError(error.code));
      }
    } else {
      // Fallback ke localStorage untuk development
      return await this.registerWithLocalStorage(userData);
    }
  }

  async login(email, password) {
    // Jika Firebase tersedia, gunakan Firebase Auth
    if (this.auth && this.db) {
      try {
        const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
        const user = userCredential.user;
        
        // Ambil data user dari Firestore
        const userDoc = await getDoc(doc(this.db, "users", user.uid));
        if (!userDoc.exists()) {
          throw new Error('User data not found');
        }
        
        const userData = userDoc.data();
        
        // Simpan session
        const userSession = {
          id: user.uid,
          ...userData,
          lastLogin: new Date().toISOString()
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userSession));
        
        return {
          success: true,
          user: userSession,
          message: 'Login successful!'
        };
        
      } catch (error) {
        throw new Error(this.getFirebaseError(error.code));
      }
    } else {
      // Fallback ke localStorage untuk development
      return await this.loginWithLocalStorage(email, password);
    }
  }

  async logout() {
    try {
      // Logout dari Firebase jika ada
      if (this.auth) {
        await signOut(this.auth);
      }
      
      // Hapus session lokal
      localStorage.removeItem('currentUser');
      return { success: true, message: 'Logout successful!' };
    } catch (error) {
      throw new Error('Logout failed: ' + error.message);
    }
  }

  // Check if user is logged in dan handle role-based redirect
  async getCurrentUser() {
    return new Promise((resolve, reject) => {
      // Jika Firebase tersedia
      if (this.auth) {
        onAuthStateChanged(this.auth, async (user) => {
          if (user) {
            try {
              const userDoc = await getDoc(doc(this.db, "users", user.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                resolve({ id: user.uid, ...userData });
              } else {
                reject(new Error('User data not found'));
              }
            } catch (error) {
              reject(error);
            }
          } else {
            resolve(null);
          }
        });
      } else {
        // Fallback ke localStorage
        const user = JSON.parse(localStorage.getItem('currentUser'));
        resolve(user);
      }
    });
  }

  // Redirect berdasarkan role
  async redirectBasedOnRole() {
    try {
      const user = await this.getCurrentUser();
      
      if (!user) {
        window.location.href = '../auth/login.html';
        return null;
      }

      const currentPath = window.location.pathname;
      const isAdminPath = currentPath.includes('/admin/');
      const isUserPath = currentPath.includes('/dashboard/');
      
      console.log('Current path:', currentPath);
      console.log('User role:', user.role);
      console.log('Is admin path:', isAdminPath);
      console.log('Is user path:', isUserPath);
      
      // Jika admin mencoba akses user dashboard
      if (user.role === 'admin' && isUserPath) {
        console.log('Admin accessing user dashboard, redirecting to admin panel...');
        window.location.href = '../admin/dashboard.html';
        return null;
      }
      
      // Jika user biasa mencoba akses admin dashboard
      if (user.role !== 'admin' && isAdminPath) {
        console.log('Regular user accessing admin dashboard, redirecting to user dashboard...');
        window.location.href = '../dashboard/dashboard.html';
        return null;
      }

      console.log('Access granted for:', user.role);
      return user;
      
    } catch (error) {
      console.error('Auth redirect error:', error);
      window.location.href = '../auth/login.html';
      return null;
    }
  }

  // Fallback methods untuk localStorage
  async registerWithLocalStorage(userData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const users = JSON.parse(localStorage.getItem('it_ticket_users') || '[]');
      const userExists = users.find(user => 
        user.email === userData.email || user.employee_id === userData.employee_id
      );
      
      if (userExists) {
        throw new Error('User with this email or employee ID already exists');
      }
      
      const newUser = {
        id: Date.now().toString(),
        ...userData,
        created_at: new Date().toISOString(),
        role: 'user',
        is_active: true
      };
      
      users.push(newUser);
      localStorage.setItem('it_ticket_users', JSON.stringify(users));
      
      return {
        success: true,
        user: newUser,
        message: 'Registration successful!'
      };
      
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async loginWithLocalStorage(email, password) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const users = JSON.parse(localStorage.getItem('it_ticket_users') || '[]');
      const user = users.find(u => 
        u.email === email && u.password === password
      );
      
      if (!user) {
        throw new Error('Invalid email or password');
      }
      
      if (!user.is_active) {
        throw new Error('Account is deactivated. Please contact administrator.');
      }
      
      // Simpan session
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      return {
        success: true,
        user: user,
        message: 'Login successful!'
      };
      
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Helper untuk Firebase error messages
  getFirebaseError(errorCode) {
    const errorMessages = {
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'Email already registered',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/network-request-failed': 'Network error. Please check your connection'
    };
    
    return errorMessages[errorCode] || 'Authentication failed';
  }

  // Get user profile data
  async getUserProfile(userId) {
    try {
      if (this.db) {
        const userDoc = await getDoc(doc(this.db, "users", userId));
        return userDoc.exists() ? userDoc.data() : null;
      } else {
        const users = JSON.parse(localStorage.getItem('it_ticket_users') || '[]');
        return users.find(u => u.id === userId || u.employee_id === userId) || null;
      }
    } catch (error) {
      throw new Error('Failed to get user profile: ' + error.message);
    }
  }
}

// Create singleton instance
const authService = new AuthService();
export default authService;