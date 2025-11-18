import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPJNPW_zQ5IPH8Svdl-y7DMx7IW8WHurU",
  authDomain: "smartdorm-465c3.firebaseapp.com",
  projectId: "smartdorm-465c3",
  storageBucket: "smartdorm-465c3.appspot.com",
  messagingSenderId: "849167644629",
  appId: "1:849167644629:web:0fa4c65e47d819f7ec6f5c",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ========== EMAIL/PASSWORD SIGNUP ==========
const signupForm = document.getElementById('signupForm');
const signupBtn = document.getElementById('signupBtn');
const signupBtnText = document.getElementById('signupBtnText');

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Validation
  if (!name || name.length < 2) {
    showError("Please enter your full name");
    return;
  }

  if (!email.includes('@')) {
    showError("Please enter a valid email");
    return;
  }

  if (!phone.match(/^(09|\+639)\d{9}$/)) {
    showError("Please enter a valid Philippine phone number");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters");
    return;
  }

  if (password !== confirmPassword) {
    showError("Passwords do not match");
    return;
  }

  setLoading(true);

  try {
    // Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile with name
    await updateProfile(user, {
      displayName: name
    });

    // Create user document in Firestore
    await setDoc(doc(db, "Users", user.email), {
      uid: user.uid,
      email: user.email,
      name: name,
      phone: phone,
      role: "tenant",
      status: "pending", // Admin needs to assign room
      createdAt: serverTimestamp()
    });

    console.log("✅ Account created successfully!");
    showSuccess("Account created! Redirecting...");
    
    // Redirect to tenant dashboard
    setTimeout(() => {
      window.location.href = "../Tenant/index.html";
    }, 2000);

  } catch (error) {
    console.error("Signup error:", error);
    setLoading(false);
    
    if (error.code === 'auth/email-already-in-use') {
      showError("Email already registered. Please login instead.");
    } else if (error.code === 'auth/weak-password') {
      showError("Password is too weak. Use at least 6 characters.");
    } else if (error.code === 'auth/invalid-email') {
      showError("Invalid email address.");
    } else {
      showError("Signup failed: " + error.message);
    }
  }
});

// ========== GOOGLE SIGNUP ==========
const googleSignupBtn = document.getElementById('googleSignupBtn');

googleSignupBtn.addEventListener('click', async () => {
  setLoading(true);
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user already exists
    const userRef = doc(db, "Users", user.email);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // User already registered, just login
      console.log("✅ Existing user, logging in...");
      window.location.href = "../Tenant/index.html";
      return;
    }

    // New user - create document
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      name: user.displayName || "Google User",
      phone: user.phoneNumber || "",
      role: "tenant",
      status: "pending",
      createdAt: serverTimestamp()
    });

    console.log("✅ Google account created!");
    showSuccess("Account created! Redirecting...");
    
    setTimeout(() => {
      window.location.href = "../Tenant/index.html";
    }, 2000);

  } catch (error) {
    console.error("Google signup error:", error);
    setLoading(false);
    
    if (error.code === 'auth/popup-closed-by-user') {
      showError("Signup cancelled.");
    } else {
      showError("Google signup failed: " + error.message);
    }
  }
});

// ========== UI HELPERS ==========
function setLoading(isLoading) {
  if (isLoading) {
    signupBtn.disabled = true;
    googleSignupBtn.disabled = true;
    signupBtnText.innerHTML = `
      <span class="loading-spinner"></span>
      Creating account...
    `;
  } else {
    signupBtn.disabled = false;
    googleSignupBtn.disabled = false;
    signupBtnText.textContent = "Create Account";
  }
}

function showError(message) {
  let errorAlert = document.getElementById('errorAlert');
  
  if (!errorAlert) {
    errorAlert = document.createElement('div');
    errorAlert.id = 'errorAlert';
    errorAlert.className = 'error-alert';
    errorAlert.innerHTML = `
      <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p class="error-text" id="errorText"></p>
    `;
    signupForm.insertBefore(errorAlert, signupForm.firstChild);
  }
  
  document.getElementById('errorText').textContent = message;
  errorAlert.classList.remove('hidden');
  
  setTimeout(() => {
    errorAlert.classList.add('hidden');
  }, 5000);
}

function showSuccess(message) {
  let successAlert = document.getElementById('successAlert');
  
  if (!successAlert) {
    successAlert = document.createElement('div');
    successAlert.id = 'successAlert';
    successAlert.className = 'success-alert';
    successAlert.innerHTML = `
      <svg class="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p class="success-text" id="successText"></p>
    `;
    signupForm.insertBefore(successAlert, signupForm.firstChild);
  }
  
  document.getElementById('successText').textContent = message;
  successAlert.classList.remove('hidden');
}

// ========== REAL-TIME VALIDATION ==========
document.getElementById('confirmPassword').addEventListener('input', (e) => {
  const password = document.getElementById('signupPassword').value;
  const confirm = e.target.value;
  
  if (confirm && password !== confirm) {
    e.target.style.borderColor = '#ef4444';
  } else {
    e.target.style.borderColor = '#e5e7eb';
  }
});

document.getElementById('signupPhone').addEventListener('input', (e) => {
  const phone = e.target.value.replace(/[\s\-]/g, '');
  const isValid = /^(09|\+639)\d{9}$/.test(phone);
  
  if (phone && !isValid) {
    e.target.style.borderColor = '#ef4444';
  } else {
    e.target.style.borderColor = '#e5e7eb';
  }
});