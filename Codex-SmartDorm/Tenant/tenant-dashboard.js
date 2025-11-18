import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

const logoutBtn = document.getElementById("logoutBtn");
const loadingSpinner = document.getElementById("loadingSpinner");
const dashboardContent = document.getElementById("dashboardContent");
const paymentModal = document.getElementById("paymentModal");
const closePaymentModalBtn = document.getElementById("closePaymentModal");

let currentBillData = null;
let currentBillDocId = null;
let currentTenantName = "";

// Generate transaction ID
async function generateTransactionId() {
  const snap = await getDocs(collection(db, "Transactions"));
  return `TR${String(snap.size + 1).padStart(3, "0")}`;
}

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "tenant-login.html";
  } catch (error) {
    console.error("Logout error:", error);
    alert("Error logging out");
  }
});

closePaymentModalBtn.addEventListener("click", () => {
  paymentModal.classList.add("hidden");
  document.getElementById("qrCodeSection").classList.add("hidden");
  document.getElementById("refNumber").value = "";
});

async function loadTenantData(userEmail) {
  try {
    const tenantsQuery = query(collection(db, "Tenants"), where("email", "==", userEmail));
    const tenantsSnap = await getDocs(tenantsQuery);

    if (tenantsSnap.empty) {
      alert("Tenant record not found. Please contact your administrator.");
      await signOut(auth);
      return;
    }

    const tenantDoc = tenantsSnap.docs[0];
    const tenant = tenantDoc.data();
    currentTenantName = tenant.name;

    document.getElementById("tenantName").textContent = tenant.name || "N/A";
    document.getElementById("tenantId").textContent = tenant.tenantId || "N/A";
    document.getElementById("roomNumber").textContent = tenant.roomNumber || "N/A";
    document.getElementById("tenantEmail").textContent = tenant.email || "N/A";
    document.getElementById("tenantContact").textContent = tenant.contact || "N/A";
    document.getElementById("moveInDate").textContent = tenant.moveInDate || "N/A";
    document.getElementById("birthdate").textContent = tenant.birthdate || "N/A";

    await loadBills(tenant.name, tenant.roomNumber);
    await loadTransactions(tenant.name);

    loadingSpinner.classList.add("hidden");
    dashboardContent.classList.remove("hidden");

  } catch (error) {
    console.error("Error loading tenant data:", error);
    alert("Error loading your data. Please try again later.");
  }
}

async function loadBills(tenantName, roomNumber) {
  const billsContainer = document.getElementById("billsContainer");
  const noBills = document.getElementById("noBills");

  try {
    const billsQuery = query(
      collection(db, "Bills"),
      where("tenantName", "==", tenantName)
    );
    const billsSnap = await getDocs(billsQuery);

    if (billsSnap.empty) {
      noBills.classList.remove("hidden");
      return;
    }

    billsContainer.innerHTML = "";

    billsSnap.forEach((docSnap) => {
      const bill = docSnap.data();
      const total = (bill.electric || 0) + (bill.water || 0) + (bill.roomRent || 0);
      const statusColor = bill.status === "Paid" 
        ? "bg-green-100 text-green-700 border-green-200"
        : "bg-yellow-100 text-yellow-700 border-yellow-200";

      const billCard = document.createElement("div");
      billCard.className = `border-2 rounded-lg p-4 ${statusColor}`;
      billCard.innerHTML = `
        <div class="flex justify-between items-start mb-3">
          <div>
            <h4 class="font-bold text-lg">${bill.billId || "N/A"}</h4>
            <p class="text-sm opacity-75">Room ${bill.roomNumber || "N/A"}</p>
          </div>
          <span class="px-3 py-1 rounded-full text-sm font-semibold ${statusColor}">
            ${bill.status || "Unknown"}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <p class="opacity-75">Electric Bill</p>
            <p class="font-semibold">₱${(bill.electric || 0).toFixed(2)}</p>
          </div>
          <div>
            <p class="opacity-75">Water Bill</p>
            <p class="font-semibold">₱${(bill.water || 0).toFixed(2)}</p>
          </div>
          <div>
            <p class="opacity-75">Room Rent</p>
            <p class="font-semibold">₱${(bill.roomRent || 0).toFixed(2)}</p>
          </div>
          <div>
            <p class="opacity-75 font-bold">Total Amount</p>
            <p class="font-bold text-lg">₱${total.toFixed(2)}</p>
          </div>
        </div>
        ${bill.status === "Unpaid" ? `
          <button class="payBillBtn w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-semibold transition mt-2" 
            data-bill-id="${docSnap.id}"
            data-bill='${JSON.stringify(bill)}'>
            Pay Now
          </button>
        ` : ''}
      `;
      billsContainer.appendChild(billCard);
    });

    // Attach event listeners to Pay Now buttons
    document.querySelectorAll(".payBillBtn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const billData = JSON.parse(e.target.getAttribute("data-bill"));
        const billDocId = e.target.getAttribute("data-bill-id");
        openPaymentModal(billData, billDocId);
      });
    });

  } catch (error) {
    console.error("Error loading bills:", error);
  }
}

function openPaymentModal(billData, billDocId) {
  currentBillData = billData;
  currentBillDocId = billDocId;

  const total = (billData.electric || 0) + (billData.water || 0) + (billData.roomRent || 0);

  document.getElementById("payBillId").textContent = billData.billId || "N/A";
  document.getElementById("payRoomNumber").textContent = billData.roomNumber || "N/A";
  document.getElementById("payElectric").textContent = `₱${(billData.electric || 0).toFixed(2)}`;
  document.getElementById("payWater").textContent = `₱${(billData.water || 0).toFixed(2)}`;
  document.getElementById("payRent").textContent = `₱${(billData.roomRent || 0).toFixed(2)}`;
  document.getElementById("payTotal").textContent = `₱${total.toFixed(2)}`;

  paymentModal.classList.remove("hidden");
}

// Payment method selection
document.getElementById("selectGCash").addEventListener("click", () => {
  generateQRCode("GCash");
});

document.getElementById("selectMaya").addEventListener("click", () => {
  generateQRCode("Maya");
});

function generateQRCode(method) {
  const total = (currentBillData.electric || 0) + (currentBillData.water || 0) + (currentBillData.roomRent || 0);
  
  // Generate QR code data
  // In real implementation, this would be the actual GCash/Maya payment link
  const qrData = `smartdorm-payment://${method.toLowerCase()}?bill=${currentBillData.billId}&amount=${total.toFixed(2)}&tenant=${currentTenantName}`;
  
  document.getElementById("selectedMethod").textContent = method;
  document.getElementById("methodName").textContent = method;
  document.getElementById("qrCodeSection").classList.remove("hidden");

  const canvas = document.getElementById("qrCanvas");
  QRCode.toCanvas(canvas, qrData, {
    width: 250,
    margin: 2,
    color: {
      dark: method === "GCash" ? "#0066CC" : "#00A651",
      light: "#FFFFFF"
    }
  }, function (error) {
    if (error) console.error(error);
  });
}

// Confirm payment
document.getElementById("confirmPayment").addEventListener("click", async () => {
  const refNumber = document.getElementById("refNumber").value.trim();
  
  if (!refNumber) {
    alert("Please enter your payment reference number.");
    return;
  }

  if (refNumber.length < 6) {
    alert("Please enter a valid reference number (at least 6 characters).");
    return;
  }

  const confirmBtn = document.getElementById("confirmPayment");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Processing...";

  try {
    const total = (currentBillData.electric || 0) + (currentBillData.water || 0) + (currentBillData.roomRent || 0);
    const method = document.getElementById("selectedMethod").textContent;
    
    // Create transaction record
    const transactionId = await generateTransactionId();
    await addDoc(collection(db, "Transactions"), {
      transactionId,
      tenantName: currentTenantName,
      amountPaid: total,
      paymentDate: serverTimestamp(),
      method: method,
      billRef: currentBillData.billId,
      referenceNumber: refNumber,
      createdAt: serverTimestamp(),
    });

    // Delete the bill (mark as paid by removing)
    await deleteDoc(doc(db, "Bills", currentBillDocId));

    alert(`Payment successful!\n\nTransaction ID: ${transactionId}\nReference: ${refNumber}\n\nThank you for your payment!`);
    
    // Close modal and reload data
    paymentModal.classList.add("hidden");
    document.getElementById("qrCodeSection").classList.add("hidden");
    document.getElementById("refNumber").value = "";
    
    // Reload bills and transactions
    const userEmail = auth.currentUser.email;
    const tenantsQuery = query(collection(db, "Tenants"), where("email", "==", userEmail));
    const tenantsSnap = await getDocs(tenantsQuery);
    const tenant = tenantsSnap.docs[0].data();
    
    await loadBills(tenant.name, tenant.roomNumber);
    await loadTransactions(tenant.name);
    
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Confirm Payment";
    
  } catch (error) {
    console.error("Payment error:", error);
    alert("Error processing payment: " + error.message);
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Confirm Payment";
  }
});

async function loadTransactions(tenantName) {
  const transactionsContainer = document.getElementById("transactionsContainer");
  const noTransactions = document.getElementById("noTransactions");

  try {
    const transactionsQuery = query(
      collection(db, "Transactions"),
      where("tenantName", "==", tenantName),
      orderBy("createdAt", "desc")
    );
    const transactionsSnap = await getDocs(transactionsQuery);

    if (transactionsSnap.empty) {
      noTransactions.classList.remove("hidden");
      return;
    }

    transactionsContainer.innerHTML = "";

    transactionsSnap.forEach((docSnap) => {
      const trans = docSnap.data();
      const payDate = trans.paymentDate?.toDate?.()
        ? trans.paymentDate.toDate().toLocaleDateString()
        : "N/A";

      const transCard = document.createElement("div");
      transCard.className = "border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition";
      transCard.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <p class="font-semibold text-gray-800">${trans.transactionId || "N/A"}</p>
            <p class="text-sm text-gray-600">Payment Date: ${payDate}</p>
            <p class="text-sm text-gray-600">Method: ${trans.method || "N/A"}</p>
            <p class="text-sm text-gray-600">Bill Ref: ${trans.billRef || "N/A"}</p>
            ${trans.referenceNumber ? `<p class="text-sm text-gray-600">Ref #: ${trans.referenceNumber}</p>` : ''}
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-green-600">₱${(trans.amountPaid || 0).toFixed(2)}</p>
            <p class="text-xs text-gray-500">Amount Paid</p>
          </div>
        </div>
      `;
      transactionsContainer.appendChild(transCard);
    });

  } catch (error) {
    console.error("Error loading transactions:", error);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "tenant-login.html";
  } else {
    loadTenantData(user.email);
  }
});