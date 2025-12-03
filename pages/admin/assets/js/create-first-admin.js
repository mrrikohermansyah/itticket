import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  getDoc,
  collection,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

class FirstAdminSetup {
  constructor() {
    this.isSubmitting = false;
    this.form = null;
    this.firebaseInitialized = false;
    this.db = null;
    this.isAccessGranted = false;
    this.init();
  }

  init() {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      this.initialize();
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        this.initialize();
      });
    }
  }

  async initialize() {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.form = document.getElementById("setupAdminForm");

      if (!this.form) {
        this.form = document.querySelector("form");
      }

      if (!this.form) {
        const allForms = document.querySelectorAll("form");
        throw new Error("Form element not found");
      }

      this.messageContainer = document.getElementById("message");

      this.lockFormElements();
      await this.initializeFirebase();
      await this.requireAccessPassword();
      this.enableAllFormElements();
      this.setupFormListener();
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      this.showErrorAlert("System initialization failed", error.message);
    }
  }

  lockFormElements() {
    if (!this.form) return;
    const allFormElements = this.form.querySelectorAll(
      "input, select, textarea, button"
    );
    allFormElements.forEach((element) => {
      element.disabled = true;
      element.readOnly = true;
    });
  }

  enableAllFormElements() {
    if (!this.form) return;

    const allFormElements = this.form.querySelectorAll(
      "input, select, textarea, button"
    );
    allFormElements.forEach((element) => {
      element.disabled = false;
      element.readOnly = false;
    });
  }

  async initializeFirebase() {
    const firebaseConfig = {
      apiKey: "AIzaSyCQR--hn0RDvDduCjA2Opa9HLzyYn_GFIs",
      authDomain: "itticketing-f926e.firebaseapp.com",
      projectId: "itticketing-f926e",
      storageBucket: "itticketing-f926e.firebasestorage.app",
      messagingSenderId: "10687213121",
      appId: "1:10687213121:web:af3b530a7c45d3ca2d8a7e",
      measurementId: "G-8H0EP72PC2",
    };

    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
    this.auth = getAuth(this.app);
    this.firebaseInitialized = true;
  }

  async requireAccessPassword() {
    try {
      if (!this.firebaseInitialized || !this.db) {
        throw new Error("Database not initialized");
      }

      const settingsDocRef = doc(this.db, "secure_settings", "access_gates");
      const settingsSnap = await getDoc(settingsDocRef);

      if (!settingsSnap.exists()) {
        await Swal.fire({
          title: "Access Restricted",
          text: "Access password is not configured. Please contact the system administrator.",
          icon: "error",
          confirmButtonColor: "#ef070a",
        });
        window.location.href = "login.html";
        return;
      }

      const data = settingsSnap.data();
      const expectedHash = data?.create_first_admin_sha256;

      if (!expectedHash || typeof expectedHash !== "string") {
        await Swal.fire({
          title: "Access Restricted",
          text: "Access password is misconfigured. Please contact the system administrator.",
          icon: "error",
          confirmButtonColor: "#ef070a",
        });
        window.location.href = "login.html";
        return;
      }

      let granted = false;
      const attemptsKey = "first_admin_pin_attempts";
      const lockKey = "first_admin_pin_lock_until";
      const now = Date.now();
      const lockUntil = parseInt(localStorage.getItem(lockKey) || "0", 10);
      if (lockUntil && now < lockUntil) {
        const remaining = Math.max(0, Math.ceil((lockUntil - now) / 1000));
        await Swal.fire({
          title: "Too Many Attempts",
          text: `Please wait ${remaining}s before trying again.`,
          icon: "warning",
          confirmButtonColor: "#ef070a",
        });
        window.location.href = "login.html";
        return;
      }
      let attempts = parseInt(localStorage.getItem(attemptsKey) || "0", 10);
      while (!granted) {
        const result = await Swal.fire({
          title: "Masukkan PIN Akses",
          input: "text",
          inputAttributes: {
            autocapitalize: "off",
            autocorrect: "off",
            autocomplete: "off",
            name: "one-time-code",
            inputmode: "numeric",
            maxlength: "4",
            pattern: "\\d*",
            "data-lpignore": "true",
            "data-1p-ignore": "true",
            "aria-label": "PIN 4 digit",
            enterkeyhint: "done",
          },
          inputPlaceholder: "PIN 4 digit",
          confirmButtonText: "Access",
          confirmButtonColor: "#ef070a",
          showCancelButton: true,
          cancelButtonText: "Cancel",
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => {
            const inp = Swal.getInput();
            if (inp) {
              inp.type = "text";
              inp.style.webkitTextSecurity = "disc";
              inp.style.textSecurity = "disc";
              inp.setAttribute("autocomplete", "off");
              inp.setAttribute("autocorrect", "off");
              inp.setAttribute("autocapitalize", "off");
              inp.setAttribute("inputmode", "numeric");
              inp.setAttribute("pattern", "\\d*");
              inp.setAttribute("maxlength", "4");
              inp.addEventListener("input", () => {
                inp.value = (inp.value || "").replace(/\D/g, "").slice(0, 4);
              });
            }
          },
        });

        if (!result.isConfirmed) {
          window.location.href = "login.html";
          return;
        }

        const passwordInput = (result.value || "").trim();
        if (!passwordInput || !/^\d{4}$/.test(passwordInput)) {
          await Swal.fire({
            title: "PIN Tidak Valid",
            text: "Masukkan PIN 4 digit.",
            icon: "warning",
            confirmButtonColor: "#ef070a",
          });
          continue;
        }

        const hash = await this.hashSHA256(passwordInput);
        if (hash === expectedHash) {
          granted = true;
          this.isAccessGranted = true;
          localStorage.removeItem(attemptsKey);
          localStorage.removeItem(lockKey);
          await Swal.fire({
            title: "Access Granted",
            icon: "success",
            confirmButtonColor: "#10b981",
            timer: 1200,
            showConfirmButton: false,
          });
        } else {
          attempts += 1;
          localStorage.setItem(attemptsKey, String(attempts));
          if (attempts >= 5) {
            const lockUntilTime = Date.now() + 60 * 1000;
            localStorage.setItem(lockKey, String(lockUntilTime));
            await Swal.fire({
              title: "Too Many Attempts",
              text: "Try again in 60 seconds.",
              icon: "error",
              confirmButtonColor: "#ef070a",
            });
            window.location.href = "login.html";
            return;
          } else {
            await Swal.fire({
              title: "PIN Salah",
              text: `Percobaan ke-${attempts}.`,
              icon: "error",
              confirmButtonColor: "#ef070a",
            });
          }
        }
      }
    } catch (error) {
      console.error("❌ Access gate error:", error);
      await Swal.fire({
        title: "Access Error",
        text: error.message || "Failed to validate access password.",
        icon: "error",
        confirmButtonColor: "#ef070a",
      });
      window.location.href = "login.html";
    }
  }

  async hashSHA256(text) {
    try {
      if (
        window.crypto &&
        window.crypto.subtle &&
        typeof window.crypto.subtle.digest === "function" &&
        typeof window.TextEncoder === "function"
      ) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        return hashHex;
      }
    } catch (e) {}
    return this.sha256Fallback(text);
  }

  sha256Fallback(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow,
      maxWord = mathPow(2, 32);
    var lengthProperty = "length";
    var i, j;
    var result = "";
    var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;
    var hash = [];
    var k = [];
    var primeCounter = 0;
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += "\x80";
    while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;
    for (j = 0; j < words[lengthProperty]; ) {
      var w = words.slice(j, (j += 16));
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15],
          w2 = w[i - 2];
        var a = hash[0],
          e = hash[4];
        var temp1 =
          (hash[7] +
            (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
            ((e & hash[5]) ^ (~e & hash[6])) +
            k[i] +
            (w[i] =
              i < 16
                ? w[i]
                : w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)))) |
          0;
        var temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (a & hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? 0 : "") + b.toString(16);
      }
    }
    return result;
  }

  setupFormListener() {
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  async handleSubmit() {
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    this.clearMessages();
    this.clearFieldErrors();

    const submitBtn = this.form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML =
      '<i class="fas fa-spinner loading-spinner"></i> Creating Account...';
    submitBtn.disabled = true;

    try {
      const formData = new FormData(this.form);

      const adminData = {
        name: formData.get("name")?.trim() || "",
        email: formData.get("email")?.trim() || "",
        password: formData.get("password") || "",
        role: formData.get("role") || "",
        department: formData.get("department")?.trim() || "IT Department",
      };

      if (!this.validateForm(adminData)) {
        throw new Error("Please fill all required fields correctly");
      }

      await this.createAdminAccount(adminData);
    } catch (error) {
      console.error("❌ Admin creation error:", error);
      this.showErrorAlert("Registration Failed", error.message);
    } finally {
      submitBtn.innerHTML =
        '<i class="fas fa-user-shield"></i> Create Administrator Account';
      submitBtn.disabled = false;
      this.isSubmitting = false;
    }
  }

  validateForm(data) {
    let isValid = true;
    this.clearFieldErrors();

    if (!data.name || data.name.trim() === "") {
      this.showFieldError("name", "Full name is required");
      isValid = false;
    }

    if (!data.email || data.email.trim() === "") {
      this.showFieldError("email", "Email is required");
      isValid = false;
    } else if (!this.isValidEmail(data.email)) {
      this.showFieldError("email", "Please enter a valid email address");
      isValid = false;
    }

    if (!data.password) {
      this.showFieldError("password", "Password is required");
      isValid = false;
    } else if (data.password.length < 6) {
      this.showFieldError("password", "Password must be at least 6 characters");
      isValid = false;
    }

    if (!data.role || data.role === "") {
      this.showFieldError("role", "Please select a role");
      isValid = false;
    }

    return isValid;
  }

  async createAdminAccount(adminData) {
    try {
      // Show loading state di button
      const submitBtn = this.form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner loading-spinner"></i> Creating Account...';
      submitBtn.disabled = true;

      // ✅ ADD TIMEOUT FOR FIREBASE AUTH
      const authPromise = createUserWithEmailAndPassword(
        this.auth,
        adminData.email,
        adminData.password
      );

      // Timeout after 30 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Firebase Auth timeout after 30 seconds")),
          30000
        );
      });

      const userCredential = await Promise.race([authPromise, timeoutPromise]);
      const user = userCredential.user;

      const adminDocData = {
        name: adminData.name,
        email: adminData.email,
        role: adminData.role,
        department: adminData.department,
        created_at: new Date().toISOString(),
        is_active: true,
        permissions: this.getPermissionsByRole(adminData.role),
        uid: user.uid,
      };

      await setDoc(doc(this.db, "admins", user.uid), adminDocData);

      // Reset button first
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;

      // Show success alert
      await Swal.fire({
        title: "🎉 Success!",
        html: `
                <div style="text-align: left;">
                    <p style="font-size: 1.1rem; font-weight: 600; color: #1f2937; margin-bottom: 1rem;">
                        Administrator Account Created Successfully!
                    </p>
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; border: 1px solid #bbf7d0; margin: 1rem 0;">
                        <p style="margin: 0.5rem 0;"><strong>👤 Name:</strong> ${
                          adminData.name
                        }</p>
                        <p style="margin: 0.5rem 0;"><strong>🎯 Role:</strong> ${this.formatRole(
                          adminData.role
                        )}</p>
                        <p style="margin: 0.5rem 0;"><strong>📧 Email:</strong> ${
                          adminData.email
                        }</p>
                        <p style="margin: 0.5rem 0;"><strong>🔑 User ID:</strong> ${
                          user.uid
                        }</p>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 1rem;">
                        Redirecting to login page...
                    </p>
                </div>
            `,
        icon: "success",
        iconColor: "#10b981",
        confirmButtonColor: "#ef070a",
        confirmButtonText: "Go to Login",
        timer: 5000,
        timerProgressBar: true,
        willClose: () => {
          window.location.href = "login.html";
        },
      });

      // Auto redirect
      setTimeout(() => {
        window.location.href = "login.html";
      }, 5000);
    } catch (error) {
      console.error("❌ Account creation failed:", error);

      // Reset button on error
      const submitBtn = this.form.querySelector('button[type="submit"]');
      submitBtn.innerHTML =
        '<i class="fas fa-user-shield"></i> Create Administrator Account';
      submitBtn.disabled = false;

      let errorMessage = "Failed to create admin account: ";

      if (error.code === "auth/email-already-in-use") {
        errorMessage =
          "Email already registered! Please use a different email.";
      } else if (error.code === "auth/weak-password") {
        errorMessage =
          "Password is too weak. Please use at least 6 characters.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.code === "auth/operation-not-allowed") {
        errorMessage =
          "Email/password accounts are not enabled. Please check Firebase Console.";
      } else if (error.message.includes("timeout")) {
        errorMessage =
          "Request timeout. Please check your internet connection and try again.";
      } else {
        errorMessage += error.message;
      }

      // Show error alert
      await Swal.fire({
        title: "❌ Registration Failed",
        text: errorMessage,
        icon: "error",
        confirmButtonColor: "#ef070a",
        confirmButtonText: "OK",
      });

      throw new Error(errorMessage);
    }
  }

  // ✅ SWEETALERT FOR ERRORS
  async showErrorAlert(title, message) {
    await Swal.fire({
      title: title,
      text: message,
      icon: "error",
      confirmButtonColor: "#ef070a",
      confirmButtonText: "OK",
    });
  }

  // ✅ SWEETALERT FOR SUCCESS (alternative)
  async showSuccessAlert(title, message) {
    await Swal.fire({
      title: title,
      text: message,
      icon: "success",
      confirmButtonColor: "#ef070a",
      confirmButtonText: "OK",
    });
  }

  showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
      field.classList.add("field-error");
      const errorElement = document.createElement("span");
      errorElement.className = "error-text";
      errorElement.textContent = message;
      field.parentNode.appendChild(errorElement);
    }
  }

  clearFieldErrors() {
    const fields = this.form.querySelectorAll(".field-error");
    fields.forEach((field) => field.classList.remove("field-error"));
    const errorTexts = this.form.querySelectorAll(".error-text");
    errorTexts.forEach((error) => error.remove());
  }

  clearMessages() {
    if (this.messageContainer) {
      this.messageContainer.innerHTML = "";
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getPermissionsByRole(role) {
    const permissions = {
      super_admin: ["all"],
      system_administrator: ["all"],
      it_manager: ["all"],
      senior_technician: [
        "read_tickets",
        "update_tickets",
        "assign_tickets",
        "resolve_tickets",
        "reopen_tickets",
      ],
      it_technician: ["read_tickets", "update_tickets", "resolve_tickets"],
      support_specialist: ["read_tickets", "update_tickets", "resolve_tickets"],
      network_administrator: [
        "read_tickets",
        "update_tickets",
        "resolve_tickets",
      ],
      helpdesk_supervisor: [
        "read_tickets",
        "update_tickets",
        "assign_tickets",
        "resolve_tickets",
      ],
      helpdesk_agent: ["read_tickets", "update_tickets"],
      service_desk_analyst: ["read_tickets", "update_tickets"],
      department_head: [
        "read_tickets",
        "update_tickets",
        "assign_tickets",
        "resolve_tickets",
      ],
      team_lead: ["read_tickets", "update_tickets", "resolve_tickets"],
      system_analyst: ["read_tickets", "update_tickets"],
    };
    return permissions[role] || ["read_tickets", "update_tickets"];
  }

  formatRole(role) {
    const roleMap = {
      super_admin: "Super Administrator",
      system_administrator: "System Administrator",
      it_manager: "IT Manager",
      senior_technician: "Senior IT Technician",
      it_technician: "IT Technician",
      support_specialist: "Support Specialist",
      network_administrator: "Network Administrator",
      helpdesk_supervisor: "Helpdesk Supervisor",
      helpdesk_agent: "Helpdesk Agent",
      service_desk_analyst: "Service Desk Analyst",
      department_head: "Department IT Head",
      team_lead: "IT Team Lead",
      system_analyst: "System Analyst",
    };
    return roleMap[role] || role;
  }
}

window.addEventListener("load", function () {
  new FirstAdminSetup();
});
