import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
const googleProvider = new GoogleAuthProvider();

// Check if user is already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "index.html";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const adminLoginForm = document.getElementById("adminLoginForm");
  const adminEmail = document.getElementById("adminEmail");
  const adminPassword = document.getElementById("adminPassword");
  const loginBtn = document.getElementById("adminLoginBtn");
  const loginBtnText = document.getElementById("loginBtnText");
  const googleAdminLoginBtn = document.getElementById("googleAdminLoginBtn");

  // Email/Password Login
  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = adminEmail.value.trim();
    const password = adminPassword.value.trim();

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    // Disable button during login
    loginBtn.disabled = true;
    loginBtnText.textContent = "Logging in...";

    try {
      // Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if user is an admin in Firestore
      const adminQuery = query(
        collection(db, "Admins"),
        where("email", "==", user.email)
      );
      const adminSnapshot = await getDocs(adminQuery);

      if (adminSnapshot.empty) {
        // User is not an admin, sign them out
        await auth.signOut();
        alert("Access denied. You are not registered as an admin.");
        loginBtn.disabled = false;
        loginBtnText.textContent = "Login as Admin";
        return;
      }

      // User is an admin, redirect to dashboard
      window.location.href = "index.html";
    } catch (error) {
      loginBtn.disabled = false;
      loginBtnText.textContent = "Login as Admin";
      
      let errorMessage = "Login failed. ";
      switch (error.code) {
        case "auth/user-not-found":
          errorMessage += "Admin account not found.";
          break;
        case "auth/wrong-password":
          errorMessage += "Incorrect password.";
          break;
        case "auth/invalid-email":
          errorMessage += "Invalid email address.";
          break;
        case "auth/user-disabled":
          errorMessage += "This account has been disabled.";
          break;
        default:
          errorMessage += error.message;
      }
      alert(errorMessage);
      console.error("Login error:", error);
    }
  });

  // Google Login
  googleAdminLoginBtn.addEventListener("click", async () => {
    googleAdminLoginBtn.disabled = true;

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user is an admin in Firestore
      const adminQuery = query(
        collection(db, "Admins"),
        where("email", "==", user.email)
      );
      const adminSnapshot = await getDocs(adminQuery);

      if (adminSnapshot.empty) {
        // User is not an admin, sign them out
        await auth.signOut();
        alert("Access denied. You are not registered as an admin.");
        googleAdminLoginBtn.disabled = false;
        return;
      }

      // User is an admin, redirect to dashboard
      window.location.href = "index.html";
    } catch (error) {
      googleAdminLoginBtn.disabled = false;
      
      if (error.code !== "auth/popup-closed-by-user") {
        alert("Google login failed. " + error.message);
        console.error("Google login error:", error);
      }
    }
  });
});
