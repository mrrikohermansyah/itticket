// pages/admin/assets/js/admin-auth.js
import firebaseAuthService from '../../../../../assets/js/services/firebase-auth-service.js';
import { auth } from '../../../../../assets/js/utils/firebase-config.js';
import { setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

document.addEventListener('DOMContentLoaded', function() {
    const adminLoginForm = document.getElementById('adminLoginForm');
    const errorMessage = document.getElementById('errorMessage');

    if (!adminLoginForm) {
        // console.log('❌ Admin login form not found');
        return;
    }

    // console.log('✅ Admin auth script loaded');

    adminLoginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    hideMessages();

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

    // Show loading
    const submitBtn = adminLoginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
    submitBtn.disabled = true;

    try {
        
        await setPersistence(auth, browserSessionPersistence);

        const result = await firebaseAuthService.loginAdmin(email, password);

        if (!result.success) {
            throw new Error(result.message);
        }

        // Store admin session
        localStorage.setItem('adminUser', JSON.stringify({
            ...result.user,
            loginTime: new Date().toISOString()
        }));

        
        
        // Redirect to admin dashboard
        window.location.href = 'index.html';

    } catch (error) {
        console.error('❌ Login failed:', error);
        
        // ✅ TAMPILKAN ERROR YANG USER-FRIENDLY, sembunyikan detail teknis
        let userFriendlyError = 'Login failed. Please check your credentials.';
        
        if (error.message.includes('Admin access not granted')) {
            userFriendlyError = 'Admin access not available. Please contact system administrator.';
        } else if (error.message.includes('wrong-password') || error.message.includes('user-not-found')) {
            userFriendlyError = 'Invalid email or password.';
        } else if (error.message.includes('invalid-email')) {
            userFriendlyError = 'Please enter a valid email address.';
        }
        
        showError(userFriendlyError);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

    function showError(message) {
        console.error('Login error:', message);
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        } else {
            // Fallback: alert if error element not found
            alert('Login Error: ' + message);
        }
    }

    function hideMessages() {
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    }

    // Check if already logged in
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser && window.location.pathname.includes('login.html')) {
        try {
            const userData = JSON.parse(adminUser);
            // console.log('👤 Found existing admin user:', userData.email);
            // You might want to verify the token is still valid here
        } catch (e) {
            localStorage.removeItem('adminUser');
        }
    }
});
