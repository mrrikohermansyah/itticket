// ✅ IMPORT FIREBASE SDK
import {
    signInWithEmailAndPassword,
    signOut,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "../../assets/js/utils/firebase-config.js";

// Menggunakan instance bersama dari firebase-config.js

 

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
            } catch (error) {}

            // 3. If not admin, check in users collection
            if (!userData) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        userData = userDoc.data();
                        const role = (userData.role || 'user').toString().toLowerCase();
                        userType = role !== 'user' ? 'admin' : 'user';
                    }
                } catch (error) {}
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

            // 5. Persist lightweight user info for legacy pages
            try {
                const legacyUser = {
                    name: userData.full_name || userData.name || (email.split('@')[0]),
                    email: email,
                    role: userType
                };
                localStorage.setItem('userData', JSON.stringify(legacyUser));
            } catch (_) {}

            // 6. Show success message
            this.showSuccess('Login successful! Redirecting...');

            // 7. Return complete user info
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
            console.error('❌ Login failed:', { code: error?.code, message: error?.message });
            let errorMessage = '';
            switch (error?.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Email tidak valid.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'Akun tidak ditemukan.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Password salah.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Terlalu banyak percobaan. Coba lagi nanti.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Jaringan bermasalah. Periksa koneksi internet.';
                    break;
                case 'auth/unauthorized-domain':
                    errorMessage = 'Domain ini belum diizinkan di Firebase Auth.';
                    break;
                case 'auth/invalid-api-key':
                    errorMessage = 'Konfigurasi API key Firebase tidak valid.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Kredensial tidak valid. Periksa email/password atau domain yang diizinkan.';
                    break;
                default:
                    errorMessage = (error?.message || 'Login gagal');
            }

            this.showError(errorMessage, error?.code);
            throw new Error(`${errorMessage} (code: ${error?.code || 'unknown'})`);
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

    showError(message, code) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = code ? `${message} (code: ${code})` : message;
            errorElement.style.display = 'block';
        }

        // Juga show SweetAlert untuk error penting
        if (message.includes('Password salah') || message.includes('Akun tidak ditemukan')) {
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
    try { if (window.location.search) { history.replaceState(null, '', window.location.pathname); } } catch (_) {}

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
try { window.__simpleAuthLoaded = true; } catch (_) {}
