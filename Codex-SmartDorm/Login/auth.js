import { auth, provider, db } from "./firebase-config.js";
import {
  signInWithPopup,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const loginBtn = document.getElementById("loginBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");

loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please fill in all fields!");
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await handleRedirect(user);
  } catch (error) {
    alert("Login failed: " + error.message);
  }
});

googleLoginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, "Users", user.email);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        role: "tenant",
        createdAt: new Date().toISOString()
      });
    }

    await handleRedirect(user);
  } catch (error) {
    alert("Google login failed: " + error.message);
  }
});

async function handleRedirect(user) {
  try {
    const adminRef = doc(db, "Admin", user.email);
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists() && adminSnap.data().role === "admin") {
      window.location.href = "./Admin_Dashboard/index.html";
    } else {
      window.location.href = "../Tenant/index.html";
    }
  } catch (error) {
    alert("Redirect failed: " + error.message);
  }
}
