import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Firebase configuration (should be from environment variables in production)
const firebaseConfig = {
  apiKey: "AIzaSyDPJNPW_zQ5IPH8Svdl-y7DMx7IW8WHurU",
  authDomain: "smartdorm-465c3.firebaseapp.com",
  projectId: "smartdorm-465c3",
  storageBucket: "smartdorm-465c3.appspot.com",
  messagingSenderId: "849167644629",
  appId: "1:849167644629:web:0fa4c65e47d819f7ec6f5c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Get bill ID from URL
const urlParams = new URLSearchParams(window.location.search);
const billId = urlParams.get('billId');

let currentBill = null;
let selectedPaymentMethod = 'gcash';
let currentUser = null;

// ========== AUTH CHECK ==========
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = ".././Codex-SmartDorm/Tenant/tenant-login.html";
  } else {
    currentUser = user;
    if (billId) {
      loadBillData();
    } else {
      showError("No bill ID provided");
    }
  }
});

// ========== LOAD BILL DATA ==========
async function loadBillData() {
  try {
    const billsSnapshot = await getDocs(collection(db, "Bills"));
    const billDoc = billsSnapshot.docs.find(doc => doc.data().billId === billId);
    
    if (!billDoc) {
      showError("Bill not found");
      return;
    }

    currentBill = { id: billDoc.id, ...billDoc.data() };
    displayBillData(currentBill);
  } catch (error) {
    console.error("Error loading bill:", error);
    showError("Failed to load bill data");
  }
}

// ========== DISPLAY BILL DATA ==========
function displayBillData(bill) {
  document.getElementById('billId').textContent = bill.billId || "—";
  document.getElementById('tenantName').textContent = bill.tenantName || "—";
  document.getElementById('roomNumber').textContent = bill.roomNumber || "—";
  
  const roomRent = bill.roomRent || 0;
  const electric = bill.electric || 0;
  const water = bill.water || 0;
  const total = roomRent + electric + water;
  
  document.getElementById('roomRent').textContent = `₱${roomRent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('electric').textContent = `₱${electric.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('water').textContent = `₱${water.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('totalAmount').textContent = `₱${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  
  const statusBadge = document.getElementById('billStatus');
  statusBadge.textContent = bill.status || "Unpaid";
  if (bill.status === "Paid") {
    statusBadge.classList.add('paid');
  }

  // Pre-fill form with tenant data
  document.getElementById('payerName').value = bill.tenantName || "";
  document.getElementById('payerEmail').value = currentUser.email || "";
}

// ========== PAYMENT METHOD SELECTION ==========
document.querySelectorAll('.payment-method-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedPaymentMethod = btn.dataset.method;
    
    const accountLabel = document.getElementById('accountLabel');
    const accountInput = document.getElementById('accountNumber');
    
    if (selectedPaymentMethod === 'gcash') {
      accountLabel.textContent = 'GCash Number';
      accountInput.placeholder = '09XXXXXXXXX';
    } else {
      accountLabel.textContent = 'Maya Account Number';
      accountInput.placeholder = '09XXXXXXXXX';
    }
  });
});

// ========== FORM VALIDATION ==========
function validateForm() {
  let isValid = true;
  
  // Name validation
  const name = document.getElementById('payerName').value.trim();
  if (name.length < 2) {
    showFieldError('nameError', 'Name must be at least 2 characters');
    isValid = false;
  } else {
    hideFieldError('nameError');
  }
  
  // Email validation
  const email = document.getElementById('payerEmail').value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showFieldError('emailError', 'Please enter a valid email');
    isValid = false;
  } else {
    hideFieldError('emailError');
  }
  
  // Phone validation
  const phone = document.getElementById('payerPhone').value.trim();
  const phoneRegex = /^(09|\+639)\d{9}$/;
  if (!phoneRegex.test(phone.replace(/[\s\-]/g, ''))) {
    showFieldError('phoneError', 'Please enter a valid Philippine phone number');
    isValid = false;
  } else {
    hideFieldError('phoneError');
  }
  
  // Account number validation
  const accountNumber = document.getElementById('accountNumber').value.trim();
  if (!phoneRegex.test(accountNumber.replace(/[\s\-]/g, ''))) {
    showFieldError('accountError', 'Please enter a valid account number');
    isValid = false;
  } else {
    hideFieldError('accountError');
  }
  
  return isValid;
}

function showFieldError(errorId, message) {
  const errorElement = document.getElementById(errorId);
  errorElement.textContent = message;
  errorElement.classList.add('show');
  errorElement.previousElementSibling.classList.add('error');
}

function hideFieldError(errorId) {
  const errorElement = document.getElementById(errorId);
  errorElement.classList.remove('show');
  errorElement.previousElementSibling.classList.remove('error');
}

// ========== PAYMENT PROCESSING ==========
document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }
  
  if (!currentBill) {
    showError("Bill data not loaded");
    return;
  }
  
  if (currentBill.status === "Paid") {
    showError("This bill has already been paid");
    return;
  }
  
  showLoadingModal();
  
  try {
    // Simulate payment processing (In production, integrate with PayMongo API)
    await processPayment();
    
    // Update bill status
    const billRef = doc(db, "Bills", currentBill.id);
    await updateDoc(billRef, {
      status: "Paid",
      updatedAt: serverTimestamp()
    });
    
    // Create transaction record
    const total = (currentBill.roomRent || 0) + (currentBill.electric || 0) + (currentBill.water || 0);
    const transactionId = await generateTransactionId();
    
    await addDoc(collection(db, "Transactions"), {
      transactionId: transactionId,
      tenantName: currentBill.tenantName,
      tenantEmail: currentUser.email,
      amountPaid: total,
      paymentDate: serverTimestamp(),
      method: selectedPaymentMethod === 'gcash' ? 'GCash' : 'Maya',
      billRef: currentBill.billId,
      payerName: document.getElementById('payerName').value.trim(),
      payerPhone: document.getElementById('payerPhone').value.trim(),
      accountNumber: document.getElementById('accountNumber').value.trim(),
      createdAt: serverTimestamp()
    });
    
    hideLoadingModal();
    showSuccessModal();
    
  } catch (error) {
    console.error("Payment error:", error);
    hideLoadingModal();
    showError(error.message || "Payment processing failed");
  }
});

// ========== SIMULATE PAYMENT API CALL ==========
async function processPayment() {
  // DEMO MODE: Simulates payment processing
  // Shows what the user experience will be like
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate successful payment
      console.log('💳 Payment simulated successfully!');
      console.log('Method:', selectedPaymentMethod);
      console.log('Amount:', (currentBill.roomRent || 0) + (currentBill.electric || 0) + (currentBill.water || 0));
      resolve({ success: true, demo: true });
    }, 2500); // 2.5 second delay to simulate processing
  });
  
  /* 
  ==========================================
  PRODUCTION CODE (PayMongo Integration):
  ==========================================
  
  Uncomment this when you're ready to go live with PayMongo:
  
  const PAYMONGO_SECRET_KEY = import.meta.env.VITE_PAYMONGO_SECRET_KEY;
  const total = (currentBill.roomRent || 0) + (currentBill.electric || 0) + (currentBill.water || 0);
  
  const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(PAYMONGO_SECRET_KEY + ':'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: Math.round(total * 100), // Amount in cents
          payment_method_allowed: [selectedPaymentMethod], // 'gcash' or 'paymaya'
          currency: 'PHP',
          description: `Payment for Bill ${currentBill.billId}`,
          statement_descriptor: 'SmartDorm Payment',
          metadata: {
            billId: currentBill.billId,
            tenantName: currentBill.tenantName,
            roomNumber: currentBill.roomNumber
          }
        }
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors[0].detail);
  }
  
  const result = await response.json();
  return result.data;
  */
}

// ========== GENERATE TRANSACTION ID ==========
async function generateTransactionId() {
  const snapshot = await getDocs(collection(db, "Transactions"));
  const count = snapshot.size + 1;
  return `TR${String(count).padStart(3, '0')}`;
}

function showLoadingModal() {
  document.getElementById('loadingModal').classList.remove('hidden');
}

function hideLoadingModal() {
  document.getElementById('loadingModal').classList.add('hidden');
}

function showSuccessModal() {
  document.getElementById('successModal').classList.remove('hidden');
}

function showError(message) {
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorModal').classList.remove('hidden');
}

// ========== NAVIGATION ==========
document.getElementById('backBtn').addEventListener('click', () => {
  window.history.back();
});

document.getElementById('successBtn').addEventListener('click', () => {
  // Redirect to tenant dashboard (update path as needed)
  window.location.href = "../Tenant/index.html";
});

document.getElementById('errorBtn').addEventListener('click', () => {
  document.getElementById('errorModal').classList.add('hidden');
});

// ========== IMPORT getDocs ==========
import { getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";