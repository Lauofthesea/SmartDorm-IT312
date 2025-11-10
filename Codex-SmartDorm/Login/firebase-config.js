// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPJNPW_zQ5IPH8Svdl-y7DMx7IW8WHurU",
  authDomain: "smartdorm-465c3.firebaseapp.com",
  projectId: "smartdorm-465c3",
  storageBucket: "smartdorm-465c3.firebasestorage.app",
  messagingSenderId: "849167644629",
  appId: "1:849167644629:web:0fa4c65e47d819f7ec6f5c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { app, auth, db, provider, signInWithPopup, signOut };
