import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, orderBy, doc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
let currentTenantEmail = "";
let currentTenantName = "";
let currentPaymentData = null;
let selectedMethod = '';
let countdownInterval = null;
let timeLeft = 900;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBillsBtn = document.getElementById("refreshBillsBtn");

  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "tenant-login.html";
    } catch (error) {
      console.error("Logout error:", error);
      alert("Error logging out");
    }
  });

  refreshBillsBtn.addEventListener("click", async () => {
    refreshBillsBtn.disabled = true;
    refreshBillsBtn.innerHTML = `
      <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Refreshing...
    `;
    
    await loadBills(currentTenantEmail);  
  await loadTransactions(currentTenantName);
    
    setTimeout(() => {
      refreshBillsBtn.disabled = false;
      refreshBillsBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refresh
      `;
    }, 500);
  });

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "tenant-login.html";
    } else {
      loadTenantData(user.email);
    }
  });
});

async function loadTenantData(userEmail) {
  const loadingSpinner = document.getElementById("loadingSpinner");
  const dashboardContent = document.getElementById("dashboardContent");

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
    currentTenantEmail = userEmail;

    // Populate sidebar
    document.getElementById("sidebarTenantName").textContent = tenant.name || "N/A";
    document.getElementById("sidebarTenantId").textContent = tenant.tenantId || "N/A";
    document.getElementById("sidebarRoomNumber").textContent = tenant.roomNumber || "N/A";
    document.getElementById("sidebarEmail").textContent = tenant.email || "N/A";
    document.getElementById("sidebarContact").textContent = tenant.contact || "N/A";
    document.getElementById("sidebarMoveInDate").textContent = tenant.moveInDate || "N/A";
    document.getElementById("sidebarBirthdate").textContent = tenant.birthdate || "N/A";

    await loadAnnouncements();
    await loadBills(currentTenantEmail);
    await loadTransactions(tenant.name);

    loadingSpinner.classList.add("hidden");
    dashboardContent.classList.remove("hidden");

  } catch (error) {
    console.error("Error loading tenant data:", error);
    alert("Error loading your data. Please try again later.");
  }
}

async function loadAnnouncements() {
  const announcementsContainer = document.getElementById("announcementsContainer");
  const noAnnouncements = document.getElementById("noAnnouncements");

  try {
    const announcementsQuery = query(
      collection(db, "Announcements"),
      orderBy("createdAt", "desc")
    );
    const announcementsSnap = await getDocs(announcementsQuery);

    if (announcementsSnap.empty) {
      noAnnouncements.classList.remove("hidden");
      announcementsContainer.classList.add("hidden");
      return;
    }

    noAnnouncements.classList.add("hidden");
    announcementsContainer.classList.remove("hidden");
    announcementsContainer.innerHTML = "";

    announcementsSnap.forEach((docSnap) => {
      const announcement = docSnap.data();
      const date = announcement.createdAt?.toDate?.()
        ? announcement.createdAt.toDate().toLocaleDateString()
        : "Recently";

      const announcementCard = document.createElement("div");
      announcementCard.className = "bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4 border border-white border-opacity-30";
      announcementCard.innerHTML = `
        <div class="flex justify-between items-start mb-2">
          <h4 class="font-bold text-lg">${announcement.title || "Announcement"}</h4>
          <span class="text-xs bg-white bg-opacity-30 px-2 py-1 rounded">${date}</span>
        </div>
        <p class="text-sm text-purple-50">${announcement.message || ""}</p>
      `;
      announcementsContainer.appendChild(announcementCard);
    });

  } catch (error) {
    console.error("Error loading announcements:", error);
  }
}

function calculateDaysUntilDue(dueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getDueDateBadge(dueDate) {
  const daysUntil = calculateDaysUntilDue(dueDate);
  
  if (daysUntil < 0) {
    return `
      <span class="px-2 py-1 bg-red-500 text-white text-xs rounded-full font-semibold flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        OVERDUE (${Math.abs(daysUntil)} days)
      </span>
    `;
  } else if (daysUntil === 0) {
    return `
      <span class="px-2 py-1 bg-orange-500 text-white text-xs rounded-full font-semibold flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        DUE TODAY
      </span>
    `;
  } else if (daysUntil <= 3) {
    return `
      <span class="px-2 py-1 bg-orange-400 text-white text-xs rounded-full font-semibold flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        DUE IN ${daysUntil} DAY${daysUntil > 1 ? 'S' : ''}
      </span>
    `;
  } else {
    return `
      <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
        ${daysUntil} days remaining
      </span>
    `;
  }
}

async function loadBills(tenantEmail) {
  const billsContainer = document.getElementById("billsContainer");
  const noBills = document.getElementById("noBills");

  console.log("Loading bills for tenant name:", currentTenantName);

  try {
    // Query bills by tenantName instead of email
    const billsQuery = query(
      collection(db, "Bills"),
      where("tenantName", "==", currentTenantName)
    );
    const billsSnap = await getDocs(billsQuery);

    console.log("Bills query result:", billsSnap.docs.length, "documents");

    billsContainer.innerHTML = "";

    if (billsSnap.empty) {
      noBills.classList.remove("hidden");
      console.log("No bills found for this tenant.");
      return;
    }

    noBills.classList.add("hidden");

    billsSnap.forEach((doc) => {
      const bill = doc.data();
      console.log("Processing bill:", bill);  // <-- ADD: Debug log

      const billTypes = [
        { 
          type: 'Room Rent', 
          amount: bill.roomRent || 0,
          dueDate: bill.rentDueDate || bill.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isPaid: bill.roomrentPaid === true,
          icon: '🏠',
          color: 'from-blue-100 to-blue-200',
          borderColor: 'border-blue-300',
          buttonColor: 'bg-blue-600 hover:bg-blue-700'
        },
        { 
          type: 'Electricity', 
          amount: bill.electric || 0,
          dueDate: bill.electricDueDate || bill.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isPaid: bill.electricityPaid === true,
          icon: '⚡',
          color: 'from-yellow-100 to-yellow-200',
          borderColor: 'border-yellow-300',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-700'
        },
        { 
          type: 'Water', 
          amount: bill.water || 0,
          dueDate: bill.waterDueDate || bill.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isPaid: bill.waterPaid === true,
          icon: '💧',
          color: 'from-cyan-100 to-cyan-200',
          borderColor: 'border-cyan-300',
          buttonColor: 'bg-cyan-600 hover:bg-cyan-700'
        }
      ];

      billTypes.forEach(billType => {
        if (billType.amount > 0 && !billType.isPaid) {
          const isPending = bill[`${billType.type.toLowerCase().replace(' ', '')}Pending`] === true;
          const statusColor = billType.isPaid
            ? "bg-green-100 text-green-700 border-green-300"
            : isPending 
            ? "bg-yellow-100 text-yellow-700 border-yellow-300"
            : "bg-gray-100 text-gray-700 border-gray-300";
          const statusText = billType.isPaid ? 'Paid' : isPending ? 'Pending Approval' : 'Unpaid';

          const billCard = document.createElement("div");
          billCard.className = `bill-card border-2 ${billType.borderColor} rounded-xl p-5 bg-gradient-to-br ${billType.color}`;
          billCard.innerHTML = `
            <div class="flex justify-between items-start mb-4">
              <div class="flex items-center gap-3">
                <div class="text-3xl">${billType.icon}</div>
                <div>
                  <h4 class="font-bold text-lg">${billType.type}</h4>
                  <p class="text-xs opacity-75">${bill.billId || "N/A"} • Room ${bill.roomNumber || "N/A"}</p>
                </div>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-bold border-2 ${statusColor}">
                ${statusText}
              </span>
            </div>
            
            <div class="bg-white bg-opacity-60 rounded-lg p-4 mb-4">
              <p class="text-xs opacity-75 mb-1">Amount Due</p>
              <p class="font-bold text-3xl text-gray-800">₱${billType.amount.toFixed(2)}</p>
              <p class="text-xs opacity-75 mt-2 flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Due: ${new Date(billType.dueDate).toLocaleDateString()}
              </p>
            </div>
            
            ${billType.isPaid ? `
              <div class="bg-white bg-opacity-70 text-center py-3 rounded-lg font-semibold text-sm text-green-700 border-2 border-green-300">
                ✓ Payment Completed
              </div>
            ` : isPending ? `
              <div class="bg-white bg-opacity-70 text-center py-3 rounded-lg font-semibold text-sm text-yellow-700 border-2 border-yellow-300">
                ⏳ Pending Approval
              </div>
            ` : `
              <button onclick="payIndividualBill('${doc.id}', '${billType.type}', ${billType.amount}, '${bill.billId}', '${bill.tenantName}', '${bill.roomNumber}', '${billType.dueDate}')" 
                 class="block w-full ${billType.buttonColor} text-white text-center py-3 rounded-lg font-bold transition shadow-md hover:shadow-lg">
                Pay ${billType.type}
              </button>
            `}
          `;
          billsContainer.appendChild(billCard);
        }
      });
    });

  } catch (error) {
    console.error("Error loading bills:", error);
  }
}

async function loadTransactions(tenantName) {
  const transactionsContainer = document.getElementById("transactionsContainer");
  const noTransactions = document.getElementById("noTransactions");

  try {
    // Avoid composite index: fetch by tenantName only then sort client-side by createdAt desc
    const transactionsQuery = query(
      collection(db, "Transactions"),
      where("tenantName", "==", tenantName)
    );

    const transactionsSnap = await getDocs(transactionsQuery);

    transactionsContainer.innerHTML = "";

    if (transactionsSnap.empty) {
      noTransactions.classList.remove("hidden");
      return;
    }

    noTransactions.classList.add("hidden");

    // Map and sort documents by createdAt (newest first)
    const txDocs = transactionsSnap.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .sort((a, b) => {
        const aTs = a.data.createdAt?.toDate ? a.data.createdAt.toDate().getTime() : (a.data.createdAt?.seconds ? a.data.createdAt.seconds * 1000 : 0);
        const bTs = b.data.createdAt?.toDate ? b.data.createdAt.toDate().getTime() : (b.data.createdAt?.seconds ? b.data.createdAt.seconds * 1000 : 0);
        return bTs - aTs;
      });

    txDocs.forEach((doc) => {
      const trans = doc.data;
      const payDate = trans.paymentDate?.toDate?.()
        ? trans.paymentDate.toDate().toLocaleDateString('en-PH', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : "N/A";

      const transCard = document.createElement("div");
      transCard.className = "border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition";

      const status = (trans.status || "pending").toLowerCase();
      let statusBadge = "";
      if (status === "confirmed") {
        statusBadge = `<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">Confirmed</span>`;
      } else if (status === "rejected") {
        statusBadge = `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-semibold">Rejected</span>`;
      } else {
        statusBadge = `<span class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-semibold">Pending</span>`;
      }

      transCard.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <div class="bg-gray-50 p-2 rounded-lg">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <p class="font-bold text-gray-800">${trans.transactionId || "N/A"}</p>
                  ${statusBadge}
                </div>
                <p class="text-xs text-gray-500">${payDate}</p>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <p class="text-gray-500 text-xs">Bill Type</p>
                <p class="font-semibold text-gray-700">${trans.billType || "Full Bill"}</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs">Payment Method</p>
                <p class="font-semibold text-gray-700">${trans.method || "N/A"}</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs">Bill Reference</p>
                <p class="font-semibold text-gray-700">${trans.billRef || "N/A"}</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs">Room</p>
                <p class="font-semibold text-gray-700">${trans.roomNumber || "N/A"}</p>
              </div>
            </div>
          </div>
          
          <div class="text-right ml-4">
            <p class="text-xs text-gray-500 mb-1">Amount Paid</p>
            <p class="text-3xl font-bold text-green-600">₱${(trans.amountPaid || 0).toFixed(2)}</p>
          </div>
        </div>
      `;
      transactionsContainer.appendChild(transCard);
    });

  } catch (error) {
    console.error("Error loading transactions:", error);
  }
}

// Payment modal functions
window.payIndividualBill = function(billDocId, billType, amount, billId, tenantName, roomNumber, dueDate) {
  currentPaymentData = {
    billDocId,
    billType,
    amount,
    billId,
    tenantName,
    roomNumber,
    dueDate
  };
  
  showPaymentModal();
     const dueDateObj = new Date(currentPaymentData.dueDate);
     document.getElementById('modalDueDate').textContent = isNaN(dueDateObj) ? 'Not Set' : dueDateObj.toLocaleDateString();
     
};

function showPaymentModal() {
  const modal = document.getElementById('paymentModal');
  const paymentMethodSection = document.getElementById('paymentMethodSection');
  const qrSection = document.getElementById('qrSection');
  const verificationSection = document.getElementById('verificationSection');
  
  // Reset modal state
  paymentMethodSection.classList.remove('hidden');
  qrSection.classList.add('hidden');
  verificationSection.classList.add('hidden');
  
  // Update modal content
  document.getElementById('modalBillType').textContent = currentPaymentData.billType;
  document.getElementById('modalBillId').textContent = currentPaymentData.billId;
  document.getElementById('modalAmount').textContent = `₱${currentPaymentData.amount.toFixed(2)}`;
  document.getElementById('modalRoomNumber').textContent = currentPaymentData.roomNumber;
  document.getElementById('modalDueDate').textContent = new Date(currentPaymentData.dueDate).toLocaleDateString();
  
  modal.classList.remove('hidden');
}

window.closePaymentModal = function() {
  document.getElementById('paymentModal').classList.add('hidden');
  currentPaymentData = null;
  stopCountdown();
};

window.selectPaymentMethod = function(method) {
  selectedMethod = method;
  const methodName = method === 'gcash' ? 'GCash' : 'Maya';
  
  document.getElementById('paymentMethodSection').classList.add('hidden');
  document.getElementById('qrSection').classList.remove('hidden');
  document.getElementById('selectedMethodName').textContent = methodName;
  
  generateQRCode(method);
  startCountdown();
};

function generateQRCode(method) {
  const transactionId = 'TXN-' + Date.now().toString(36).toUpperCase();
  document.getElementById('modalTransactionId').textContent = transactionId;

  const qrData = JSON.stringify({
    merchant: 'SmartDorm',
    method: method,
    amount: currentPaymentData.amount,
    billType: currentPaymentData.billType,
    billId: currentPaymentData.billId,
    transactionId: transactionId,
    timestamp: Date.now()
  });

  const canvas = document.getElementById('modalQrCanvas');
  

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  QRCode.toCanvas(canvas, qrData, {
    width: 200,
    margin: 2,
    color: {
      dark: method === 'gcash' ? '#0066CC' : '#00A651',
      light: '#FFFFFF'
    }
  }, (error) => {
    if (error) console.error('QR Generation Error:', error);
  });
}


function startCountdown() {
  timeLeft = 900;
  updateCountdownDisplay();
  
  countdownInterval = setInterval(() => {
    timeLeft--;
    updateCountdownDisplay();
    
    if (timeLeft <= 0) {
      stopCountdown();
      alert('QR code has expired. Please try again.');
      closePaymentModal();
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function updateCountdownDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  document.getElementById('modalCountdown').textContent = 
    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

window.confirmIndividualPayment = async function() {
  stopCountdown();
  document.getElementById('qrSection').classList.add('hidden');
  document.getElementById('verificationSection').classList.remove('hidden');
  
  // Simulate payment verification (3 seconds)
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    console.log("Processing payment...");
    await processIndividualPayment();
    console.log("Payment submitted successfully");
    
    // Show submitted modal
    document.getElementById('verificationSection').classList.add('hidden');
    document.getElementById('submittedSection').classList.remove('hidden');
    document.getElementById('submittedTransactionId').textContent = document.getElementById('modalTransactionId').textContent;
    
    // Reload data after a short delay
    setTimeout(async () => {
      try {
        await loadBills(currentTenantEmail);
        await loadTransactions(currentTenantName);
        console.log("Data reloaded after submission");
      } catch (reloadError) {
        console.error("Reload error:", reloadError);
        alert("Submission completed, but failed to refresh data. Please refresh the page.");
      }
    }, 2000);
  } catch (error) {
    console.error('Payment submission failed:', error);
    alert('Submission failed: ' + error.message);
    // Revert to QR section for retry
    document.getElementById('verificationSection').classList.add('hidden');
    document.getElementById('qrSection').classList.remove('hidden');
    startCountdown();
  }
};
   

async function processIndividualPayment() {
  console.log("Starting payment processing for:", currentPaymentData);
  
  const transactionId = document.getElementById('modalTransactionId').textContent;
  const methodName = selectedMethod === 'gcash' ? 'GCash' : 'Maya';
  
  // Update the bill to "pending" instead of "paid"
  const billRef = doc(db, "Bills", currentPaymentData.billDocId);
  console.log("Updating bill to pending:", currentPaymentData.billDocId);
  
  let updateData = {};
  const fieldName = currentPaymentData.billType.toLowerCase().replace(' ', ''); // e.g., 'roomrent', 'electricity', 'water'
  updateData[`${fieldName}Pending`] = true;  // New: Mark as pending
  updateData.updatedAt = serverTimestamp();
  
  try {
    await updateDoc(billRef, updateData);
    console.log("Bill updated to pending:", updateData);
  } catch (updateError) {
    console.error("Error updating bill:", updateError);
    throw new Error("Failed to update bill: " + updateError.message);
  }
  
  // Create transaction record with pending status
  console.log("Adding pending transaction record");
  try {
    await addDoc(collection(db, "Transactions"), {
      transactionId: transactionId,
      tenantName: currentPaymentData.tenantName,
      tenantEmail: auth.currentUser.email,
      billType: currentPaymentData.billType,
      amountPaid: currentPaymentData.amount,
      paymentDate: serverTimestamp(),
      method: methodName,
      billRef: currentPaymentData.billId,
      roomNumber: currentPaymentData.roomNumber,
      status: "pending",  // New: Mark transaction as pending
      createdAt: serverTimestamp()
    });
    console.log("Pending transaction added successfully");
  } catch (transactionError) {
    console.error("Error adding transaction:", transactionError);
    throw new Error("Failed to record transaction: " + transactionError.message);
  }
}
function showSuccessNotification() {
  const notification = document.getElementById('successNotification');
  document.getElementById('successNotificationText').textContent = 
    `${currentPaymentData.billType} payment of ₱${currentPaymentData.amount.toFixed(2)} completed!`;
  notification.classList.remove('hidden');
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 5000);
}

window.confirmSubmittedPayment = function() {
  closePaymentModal();
}
