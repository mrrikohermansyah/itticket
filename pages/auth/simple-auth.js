// ✅ IMPORT FIREBASE SDK 
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCQR--hn0RDvDduCjA2Opa9HLzyYn_GFIs",
    authDomain: "itticketing-f926e.firebaseapp.com",
    projectId: "itticketing-f926e",
    storageBucket: "itticketing-f926e.firebasestorage.app",
    messagingSenderId: "10687213121",
    appId: "1:10687213121:web:af3b530a7c45d3ca2d8a7e",
    measurementId: "G-8H0EP72PC2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

 

class SimpleAuth {
    constructor() {
        try { setPersistence(auth, browserSessionPersistence); } catch {}
    }

    async login(email, password) {
        try {
            

            // Show loading state
            this.setLoadingState(true);
            this.hideMessages();

            // 1. Firebase Authentication
            try { await setPersistence(auth, browserSessionPersistence); } catch {}
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            

            let userData = null;
            let userType = 'user';

            // 2. Check in admins collection
            try {
                const adminDoc = await getDoc(doc(db, "admins", user.uid));
                if (adminDoc.exists()) {
                    userData = adminDoc.data();
                    userType = 'admin';
                    
                }
            } catch (error) {
                
            }

            // 3. If not admin, check in users collection
            if (!userData) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        userData = userDoc.data();
                        userType = 'user';
                        
                    }
                } catch (error) {
                    
                }
            }

            // 4. If no record exists, create basic user record
            if (!userData) {
                
                userData = {
                    email: email,
                    full_name: email.split('@')[0],
                    role: 'user',
                    created_at: new Date().toISOString()
                };

                await setDoc(doc(db, "users", user.uid), userData);
            }

            // 5. Show success message
            this.showSuccess('Login successful! Redirecting...');

            // 6. Return complete user info
            return {
                success: true,
                user: {
                    uid: user.uid,
                    ...userData
                },
                userType: userType,
                message: 'Login successful!'
            };

        } catch (error) {
            console.error('❌ Login failed:', error);

            let errorMessage = 'Login failed. ';

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
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Try again later.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your internet connection.';
                    break;
                default:
                    errorMessage += error.message;
            }

            this.showError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            this.setLoadingState(false);
        }
    }

    async logout() {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    // Helper methods
    setLoadingState(isLoading) {
        const submitBtn = document.querySelector('.btn-auth');
        if (!submitBtn) return;

        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Login';
        }
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }

        // Juga show SweetAlert untuk error penting
        if (message.includes('Incorrect password') || message.includes('No account found')) {
            Swal.fire({
                title: 'Login Failed',
                text: message,
                icon: 'error',
                confirmButtonColor: '#ef070a'
            });
        }
    }

    showSuccess(message) {
        const successElement = document.getElementById('successMessage');
        if (successElement) {
            successElement.textContent = message;
            successElement.style.display = 'block';
        }
    }

    hideMessages() {
        const errorElement = document.getElementById('errorMessage');
        const successElement = document.getElementById('successMessage');

        if (errorElement) errorElement.style.display = 'none';
        if (successElement) successElement.style.display = 'none';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {

    const simpleAuth = new SimpleAuth();
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(loginForm);
            const email = formData.get('email');
            const password = formData.get('password');

            try {
                const result = await simpleAuth.login(email, password);

                if (result.success) {
                    

                    // Redirect based on user type
                    setTimeout(() => {
                        if (result.userType === 'admin') {
                            window.location.href = '../admin/index.html';
                        } else {
                            window.location.href = '../user/dashboard.html';
                        }
                    }, 400);
                }
            } catch (error) {
                // Error already handled in login method
                console.error('Login process failed:', error);
            }
        });
    } else {
        console.error('❌ Login form not found');
    }
});

// Export for other files if needed
export default SimpleAuth;
