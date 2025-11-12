// Firebase Authentication for User
import firebaseAuthService from '../services/firebase-auth-service.js';

document.addEventListener('DOMContentLoaded', function () {
    initializeAuthForms();
});

function initializeAuthForms() {
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');

    if (registerForm) {
        initializeRegisterForm(registerForm);
    }

    if (loginForm) {
        initializeLoginForm(loginForm);
    }
}

function initializeRegisterForm(form) {
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Reset messages
        hideMessages();

        // Validate form
        const validation = validateRegisterForm(form);
        if (!validation.isValid) {
            showError(validation.message);
            return;
        }

        // Show loading state
        setLoadingState(submitBtn, true, 'Creating Account...');

        try {
            const formData = getFormData(form);

            // VALIDASI: Cek apakah email admin
            if (isAdminEmail(formData.email)) {
                throw new Error('Admin email detected. Please use user registration.');
            }

            // Register user dengan Firebase
            const result = await firebaseAuthService.registerUser(formData);

            if (!result.success) {
                throw new Error(result.message);
            }

            showSuccess('Registration successful! Redirecting to login...');

            // Redirect to login page after success
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (error) {
            showError(error.message);
        } finally {
            setLoadingState(submitBtn, false, 'Create Account');
        }
    });

    // Real-time password confirmation validation
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');

    if (passwordInput && confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function () {
            if (passwordInput.value !== confirmPasswordInput.value && confirmPasswordInput.value.length > 0) {
                confirmPasswordInput.style.borderColor = 'var(--primary)';
            } else {
                confirmPasswordInput.style.borderColor = 'var(--gray-200)';
            }
        });
    }
}

function initializeLoginForm(form) {
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Reset messages
        hideMessages();

        // Validate form
        const validation = validateLoginForm(form);
        if (!validation.isValid) {
            showError(validation.message);
            return;
        }

        // Show loading state
        setLoadingState(submitBtn, true, 'Signing In...');

        try {
            const formData = getFormData(form);

            // VALIDASI: Cek apakah email admin
            if (isAdminEmail(formData.email)) {
                throw new Error('Admin detected. Please use admin login page.');
            }

            // Login user dengan Firebase
            const result = await firebaseAuthService.loginUser(formData.email, formData.password);

            if (!result.success) {
                throw new Error(result.message);
            }

            // Session disimpan oleh Firebase Auth, tidak perlu localStorage
            showSuccess('Login successful! Redirecting...');

            // Redirect to dashboard after success
            setTimeout(() => {
                window.location.href = '../user/dashboard.html';
            }, 1000);

        } catch (error) {
            showError(error.message);
        } finally {
            setLoadingState(submitBtn, false, 'Login');
        }
    });
}

// ✅ Gunakan ini untuk deteksi admin yang lebih baik
function detectUserType(email) {
    const emailLower = email.toLowerCase();

    // Cek berdasarkan domain atau pattern
    if (emailLower.includes('admin') ||
        emailLower.includes('administrator') ||
        emailLower.includes('it.') ||
        emailLower.endsWith('@meitech-ekabintan.com')) { // sesuaikan dengan domain Anda
        return 'admin';
    }

    return 'user';
}

// Validasi functions (TETAP SAMA)
function validateRegisterForm(form) {
    const formData = getFormData(form);

    // Required fields validation
    const requiredFields = ['employee_id', 'full_name', 'email', 'department', 'location', 'password', 'confirm_password'];
    for (const field of requiredFields) {
        if (!formData[field]?.trim()) {
            return {
                isValid: false,
                message: `Please fill in all required fields`
            };
        }
    }

    // Email validation
    const email = formData.email;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return {
            isValid: false,
            message: 'Please enter a valid email address'
        };
    }

    // Password validation
    const password = formData.password;
    if (password.length < 6) {
        return {
            isValid: false,
            message: 'Password must be at least 6 characters long'
        };
    }

    // Password confirmation
    if (password !== formData.confirm_password) {
        return {
            isValid: false,
            message: 'Passwords do not match'
        };
    }

    return { isValid: true };
}

function validateLoginForm(form) {
    const formData = getFormData(form);

    // Required fields validation
    if (!formData.email?.trim() || !formData.password?.trim()) {
        return {
            isValid: false,
            message: 'Please enter both email and password'
        };
    }

    return { isValid: true };
}

// Utility functions (TETAP SAMA)
function getFormData(form) {
    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
        data[key] = value;
    }

    return data;
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function showSuccess(message) {
    const successElement = document.getElementById('successMessage');
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
    }
}

function hideMessages() {
    const errorElement = document.getElementById('errorMessage');
    const successElement = document.getElementById('successMessage');

    if (errorElement) errorElement.style.display = 'none';
    if (successElement) successElement.style.display = 'none';
}

function setLoadingState(button, isLoading, loadingText = 'Processing...') {
    if (!button) return;

    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = loadingText;
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = button.getAttribute('data-original-text') || button.textContent;
    }
}