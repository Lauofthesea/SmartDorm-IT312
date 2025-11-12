import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

let currentUser = null;
let tenantInfo = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../Login/index.html";
    return;
  }
  
  currentUser = user;
  await loadTenantInfo();
  await loadBills();
});

async function loadTenantInfo() {
  try {
    // First, try to find tenant in Users collection (for new sign-ups)
    let userQuery = query(
      collection(db, "Users"),
      where("email", "==", currentUser.email)
    );
    let querySnapshot = await getDocs(userQuery);

    // If not found in Users, search Tenants collection (for admin-added tenants)
    if (querySnapshot.empty) {
      userQuery = query(
        collection(db, "Tenants"),
        where("email", "==", currentUser.email)
      );
      querySnapshot = await getDocs(userQuery);
    }

    if (querySnapshot.empty) {
      console.error("Tenant record not found");
      document.getElementById("tenantName").textContent = "Tenant";
      document.getElementById("tenantNameDisplay").textContent = "Guest";
      return;
    }

    tenantInfo = querySnapshot.docs[0].data();
    
    // Update header and welcome
    document.getElementById("tenantName").textContent = tenantInfo.name || "Tenant";
    document.getElementById("tenantNameDisplay").textContent = tenantInfo.name || "Guest";

    // Update stats
    document.getElementById("roomNumberStat").textContent = tenantInfo.roomNumber || "—";

    // Update profile tab
    document.getElementById("profileName").textContent = tenantInfo.name || "—";
    document.getElementById("profileEmail").textContent = tenantInfo.email || "—";
    document.getElementById("profileContact").textContent = tenantInfo.contact || "—";
    document.getElementById("profileAge").textContent = tenantInfo.age || "—";
    document.getElementById("profileRoom").textContent = tenantInfo.roomNumber || "—";
    document.getElementById("profileMoveIn").textContent = tenantInfo.moveInDate || "—";
    document.getElementById("profileDuration").textContent = (tenantInfo.duration || "—") + " days";
  } catch (error) {
    console.error("Error loading tenant info:", error);
  }
}

async function loadBills() {
  try {
    if (!tenantInfo) return;

    const billsQuery = query(
      collection(db, "Bills"),
      where("tenantName", "==", tenantInfo.name)
    );
    const querySnapshot = await getDocs(billsQuery);

    const billsTable = document.getElementById("billsTable");
    const noBillsMsg = document.getElementById("noBillsMsg");
    billsTable.innerHTML = "";

    if (querySnapshot.empty) {
      noBillsMsg.style.display = "block";
      document.getElementById("totalOutstanding").textContent = "₱0.00";
      document.getElementById("paymentStatus").textContent = "No bills";
      return;
    }

    noBillsMsg.style.display = "none";

    let totalAmount = 0;
    let unpaidCount = 0;

    querySnapshot.forEach((doc) => {
      const bill = doc.data();
      const total = (bill.electric || 0) + (bill.water || 0) + (bill.roomRent || 0);
      totalAmount += bill.status === "Unpaid" ? total : 0;
      if (bill.status === "Unpaid") unpaidCount++;

      const statusClass = bill.status === "Paid" ? "badge-paid" : "badge-unpaid";
      
      const row = document.createElement("tr");
      row.className = "border-b border-gray-200 hover:bg-gray-50";
      row.innerHTML = `
        <td class="p-3 text-left font-medium">${bill.billId || "—"}</td>
        <td class="p-3 text-center">₱${(bill.electric || 0).toFixed(2)}</td>
        <td class="p-3 text-center">₱${(bill.water || 0).toFixed(2)}</td>
        <td class="p-3 text-center">₱${(bill.roomRent || 0).toFixed(2)}</td>
        <td class="p-3 text-center font-semibold">₱${total.toFixed(2)}</td>
        <td class="p-3 text-center">
          <span class="badge-status ${statusClass}">${bill.status || "—"}</span>
        </td>
        <td class="p-3 text-center">
          ${bill.status === "Unpaid" ? `<a href="../Payment/index.html?billId=${doc.id}" class="text-indigo-600 hover:text-indigo-800 font-medium">Pay Now</a>` : "—"}
        </td>
      `;
      billsTable.appendChild(row);
    });

    document.getElementById("totalOutstanding").textContent = `₱${totalAmount.toFixed(2)}`;
    document.getElementById("paymentStatus").textContent = unpaidCount === 0 ? "Up to date" : `${unpaidCount} bill(s) unpaid`;
  } catch (error) {
    console.error("Error loading bills:", error);
  }
}

// Tab switching
document.getElementById("billsTab").addEventListener("click", () => {
  document.getElementById("billsContent").classList.remove("hidden");
  document.getElementById("profileContent").classList.add("hidden");
  
  document.getElementById("billsTab").classList.add("bg-indigo-500", "text-white");
  document.getElementById("billsTab").classList.remove("bg-gray-200", "text-gray-700");
  
  document.getElementById("profileTab").classList.add("bg-gray-200", "text-gray-700");
  document.getElementById("profileTab").classList.remove("bg-indigo-500", "text-white");
});

document.getElementById("profileTab").addEventListener("click", () => {
  document.getElementById("profileContent").classList.remove("hidden");
  document.getElementById("billsContent").classList.add("hidden");
  
  document.getElementById("profileTab").classList.add("bg-indigo-500", "text-white");
  document.getElementById("profileTab").classList.remove("bg-gray-200", "text-gray-700");
  
  document.getElementById("billsTab").classList.add("bg-gray-200", "text-gray-700");
  document.getElementById("billsTab").classList.remove("bg-indigo-500", "text-white");
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "../Login/index.html";
  } catch (error) {
    console.error("Logout error:", error);
    alert("Error logging out");
  }
});
