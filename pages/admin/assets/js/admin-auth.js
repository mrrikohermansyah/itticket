// pages/admin/assets/js/admin-auth.js
import firebaseAuthService from '../../../../assets/js/services/firebase-auth-service.js';
import { auth } from '../../../../assets/js/utils/firebase-config.js';
import { setPersistence, browserSessionPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

function initAdminAuth() {
    const adminLoginForm = document.getElementById('adminLoginForm');
    const errorMessage = document.getElementById('errorMessage');

    if (!adminLoginForm) {
        return;
    }

    adminLoginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (errorMessage) errorMessage.style.display = 'none';

        const emailInput = document.getElementById('admin_email') || document.getElementById('admin_username');
        const passwordInput = document.getElementById('admin_password');
        if (!emailInput || !passwordInput) {
            showError('Login form elements not found');
            return;
        }

        const email = emailInput.value;
        const password = passwordInput.value;
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        const submitBtn = adminLoginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
            submitBtn.disabled = true;
        }

        try {
            await setPersistence(auth, browserSessionPersistence);
            const result = await firebaseAuthService.loginAdmin(email, password);
            if (!result?.success) throw new Error(result?.message || 'Admin login failed');
            window.location.href = 'index.html';
        } catch (error) {
            let userFriendlyError = 'Login failed. Please check your credentials.';
            if (error.code === 'auth/wrong-password') userFriendlyError = 'Invalid email or password.';
            else if (error.code === 'auth/user-not-found') {
                userFriendlyError = 'Account not found. Please contact system administrator to be added as admin.';
            } else if (error.code === 'auth/invalid-email') userFriendlyError = 'Please enter a valid email address.';
            else if (error.code === 'auth/unauthorized-domain') userFriendlyError = 'Domain ini belum diizinkan. Gunakan http://localhost:5501 atau tambahkan domain ke Firebase.';
            else if (error.code === 'auth/network-request-failed') userFriendlyError = 'Jaringan bermasalah. Periksa koneksi internet Anda.';
            else if ((error.message || '').toLowerCase().includes('deactivated')) userFriendlyError = 'Akun admin dinonaktifkan. Hubungi administrator.';
            showError(userFriendlyError);
        } finally {
            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    });

    function showError(message) {
        const errorBox = document.getElementById('errorMessage');
        if (errorBox) {
            errorBox.textContent = message;
            errorBox.style.display = 'block';
        } else {
            alert('Login Error: ' + message);
        }
    }

    // Tidak menggunakan localStorage untuk adminUser
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminAuth);
} else {
    initAdminAuth();
}
