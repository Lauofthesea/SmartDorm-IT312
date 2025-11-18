import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { 
  getAuth, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

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

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../Login/index.html";
  }
});

async function generateId(prefix, collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  return `${prefix}${String(snap.size + 1).padStart(3, "0")}`;
}

// Calculate age from birthdate
function calculateAge(birthdate) {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

document.addEventListener("DOMContentLoaded", () => {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("bg-indigo-500", "text-white"));
      tabBtns.forEach((b) => b.classList.add("bg-gray-200", "text-gray-700"));
      btn.classList.add("bg-indigo-500", "text-white");
      const target = btn.dataset.tab;
      tabContents.forEach((c) => c.classList.toggle("hidden", c.id !== target));
    });
  });
  document.querySelector("[data-tab='tenants']")?.click();
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  });

  const tenantModal = document.getElementById("tenantModal");
  const addTenantBtn = document.getElementById("addTenantBtn");
  const saveTenantBtn = document.getElementById("saveTenant");
  const cancelTenantBtn = document.getElementById("cancelTenant");
  const tenantTable = document.getElementById("tenantTable");
  const tenantRoomSelect = document.getElementById("tenantRoom");

  const roomModal = document.getElementById("roomModal");
  const addRoomBtn = document.getElementById("addRoomBtn");
  const saveRoomBtn = document.getElementById("saveRoom");
  const cancelRoomBtn = document.getElementById("cancelRoom");
  const roomTable = document.getElementById("roomTable");

  const billTable = document.getElementById("billTable");
  const billModal = document.getElementById("billModal");
  const saveBillBtn = document.getElementById("saveBill");
  const cancelBillBtn = document.getElementById("cancelBill");

  const transactionTable = document.getElementById("transactionTable");

  let editingTenantId = null;
  let editingTenantEmail = null;

  async function loadTenants() {
    if (!tenantTable) return;
    tenantTable.innerHTML = "";
    try {
      const snap = await getDocs(query(collection(db, "Tenants"), orderBy("createdAt")));
      snap.forEach((docSnap) => {
        const t = docSnap.data() || {};
        const age = t.birthdate ? calculateAge(t.birthdate) : "—";
        const tr = document.createElement("tr");
        tr.className = "border-b border-gray-200 hover:bg-gray-50";
        tr.innerHTML = `
          <td class="p-3 col-center text-sm font-medium text-gray-700">${t.tenantId || "—"}</td>
          <td class="p-3 col-left text-sm text-gray-700">${t.name || "—"}</td>
          <td class="p-3 col-center text-sm text-gray-600">${t.roomNumber || "—"}</td>
          <td class="p-3 col-center text-sm text-gray-600">${age}</td>
          <td class="p-3 col-center text-sm text-gray-600">${t.contact || "—"}</td>
          <td class="p-3 col-left text-sm text-gray-600">${t.email || "—"}</td>
          <td class="p-3 col-center text-sm text-gray-600">${t.moveInDate || "—"}</td>
          <td class="p-3 col-center text-sm text-gray-600">${t.birthdate || "—"}</td>
          <td class="p-3 col-center text-sm">
            <div class="flex justify-center items-center gap-2">
              <button class="editTenant bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded" data-id="${docSnap.id}">Edit</button>
              <button class="deleteTenant bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded" data-id="${docSnap.id}">Delete</button>
            </div>
          </td>
        `;
        tenantTable.appendChild(tr);
      });

      document.querySelectorAll(".deleteTenant").forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm("Delete this tenant?")) return;
          const id = btn.dataset.id;
          try {
            const tenantRef = doc(db, "Tenants", id);
            const snap = await getDoc(tenantRef);
            if (!snap.exists()) {
              alert("Tenant not found");
              return;
            }
            const tenant = snap.data();
            
            // Free up the room
            if (tenant.roomNumber) {
              const roomsSnap = await getDocs(collection(db, "Rooms"));
              const matched = roomsSnap.docs.find((r) => r.data().roomNumber === tenant.roomNumber);
              if (matched) {
                await updateDoc(doc(db, "Rooms", matched.id), {
                  status: "Available",
                  occupant: "",
                  startDate: null,
                  endDate: null,
                  updatedAt: serverTimestamp(),
                });
              }
            }
            
            // Delete tenant
            await deleteDoc(tenantRef);
            
            // Delete user auth record (if exists in Users collection)
            if (tenant.email) {
              try {
                await deleteDoc(doc(db, "Users", tenant.email));
              } catch (err) {
                console.log("User document not found or already deleted");
              }
            }
            
            await loadTenants();
            await loadRooms();
            await loadAvailableRooms();
          } catch (err) {
            console.error("deleteTenant error:", err);
            alert("Error deleting tenant (check console).");
          }
        };
      });

      document.querySelectorAll(".editTenant").forEach((btn) => {
        btn.onclick = async () => {
          editingTenantId = btn.dataset.id;
          try {
            const docRef = doc(db, "Tenants", editingTenantId);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
              alert("Tenant not found");
              return;
            }
            const t = docSnap.data() || {};
            editingTenantEmail = t.email;
            
            document.getElementById("tenantName").value = t.name || "";
            document.getElementById("tenantBirthdate").value = t.birthdate || "";
            document.getElementById("tenantContact").value = t.contact || "";
            document.getElementById("tenantEmail").value = t.email || "";
            document.getElementById("tenantEmail").disabled = true; // Can't change email
            document.getElementById("tenantPassword").value = "";
            document.getElementById("tenantPassword").placeholder = "Leave blank to keep current password";
            document.getElementById("tenantMoveIn").value = t.moveInDate || "";
            
            await loadAvailableRooms();
            document.getElementById("tenantRoom").value = t.roomNumber || "";
            tenantModal?.classList.remove("hidden");
          } catch (err) {
            console.error("editTenant error:", err);
            alert("Error loading tenant for edit (check console).");
          }
        };
      });
    } catch (err) {
      console.error("loadTenants error:", err);
    }
  }

  async function loadAvailableRooms() {
    if (!tenantRoomSelect) return;
    tenantRoomSelect.innerHTML = "";
    try {
      const roomsSnap = await getDocs(collection(db, "Rooms"));
      const available = roomsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.status === "Available" || !r.status);

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.textContent = available.length ? "Select room" : "No available rooms";
      tenantRoomSelect.appendChild(placeholder);

      available.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.roomNumber || "";
        const rate = typeof r.rate === "number" ? `₱${r.rate.toLocaleString()}` : "";
        opt.textContent = `${r.roomNumber || ""} ${r.type ? "- " + r.type : ""} ${rate}`.trim();
        tenantRoomSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("loadAvailableRooms error:", err);
    }
  }

  addTenantBtn?.addEventListener("click", async () => {
    editingTenantId = null;
    editingTenantEmail = null;
    tenantModal?.querySelectorAll("input").forEach((i) => {
      i.value = "";
      i.disabled = false;
    });
    document.getElementById("tenantPassword").placeholder = "Create password for tenant";
    await loadAvailableRooms();
    tenantModal?.classList.remove("hidden");
  });

  cancelTenantBtn?.addEventListener("click", () => {
    editingTenantId = null;
    editingTenantEmail = null;
    tenantModal?.classList.add("hidden");
  });

  saveTenantBtn?.addEventListener("click", async () => {
    const name = document.getElementById("tenantName").value.trim();
    const birthdate = document.getElementById("tenantBirthdate").value;
    const contact = document.getElementById("tenantContact").value.trim();
    const email = document.getElementById("tenantEmail").value.trim();
    const password = document.getElementById("tenantPassword").value;
    const moveInDate = document.getElementById("tenantMoveIn").value;
    const roomNumber = document.getElementById("tenantRoom").value;

    if (!name || !birthdate || !contact || !email || !moveInDate || !roomNumber) {
      alert("Please fill all required fields and select an available room.");
      return;
    }

    if (!editingTenantId && !password) {
      alert("Please create a password for the new tenant.");
      return;
    }

    if (password && password.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    // Store admin credentials to re-login after creating tenant
    const adminEmail = auth.currentUser?.email;
    
    // Prompt admin for their password to re-authenticate later
    let adminPassword = null;
    if (!editingTenantId && password) {
      adminPassword = prompt("Please enter YOUR admin password to continue creating the tenant account:");
      if (!adminPassword) {
        alert("Admin password required to create tenant accounts.");
        return;
      }
    }

    try {
      const roomsSnap = await getDocs(collection(db, "Rooms"));
      const matchedRoomDoc = roomsSnap.docs.find((r) => r.data().roomNumber === roomNumber);
      if (!matchedRoomDoc) {
        alert("Selected room not found.");
        return;
      }
      const roomData = matchedRoomDoc.data();
      if (!(roomData.status === "Available" || !roomData.status)) {
        alert("Selected room is no longer available.");
        await loadAvailableRooms();
        return;
      }

      if (editingTenantId) {
        // Update existing tenant
        const tenantRef = doc(db, "Tenants", editingTenantId);
        const prevSnap = await getDoc(tenantRef);
        const prev = prevSnap.exists() ? prevSnap.data() : null;
        
        await updateDoc(tenantRef, {
          name,
          birthdate,
          contact,
          email,
          moveInDate,
          roomNumber,
          updatedAt: serverTimestamp(),
        });

        // Update Users collection
        const userRef = doc(db, "Users", email);
        await setDoc(userRef, {
          email,
          role: "tenant",
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Free up previous room if changed
        if (prev && prev.roomNumber && prev.roomNumber !== roomNumber) {
          const prevRoomDoc = roomsSnap.docs.find((r) => r.data().roomNumber === prev.roomNumber);
          if (prevRoomDoc) {
            await updateDoc(doc(db, "Rooms", prevRoomDoc.id), {
              status: "Available",
              occupant: "",
              startDate: null,
              endDate: null,
              updatedAt: serverTimestamp(),
            });
          }
        }
        
        // Update room status
        const startDate = new Date(moveInDate);
        await updateDoc(doc(db, "Rooms", matchedRoomDoc.id), {
          status: "Occupied",
          occupant: name,
          startDate: Timestamp.fromDate(startDate),
          endDate: null,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new tenant - Do all Firestore operations first
        const tenantId = await generateId("T", "Tenants");
        
        console.log("Creating tenant with email:", email);
        
        // Create tenant document
        await addDoc(collection(db, "Tenants"), {
          tenantId,
          name,
          birthdate,
          contact,
          email,
          moveInDate,
          roomNumber,
          createdAt: serverTimestamp(),
        });
        console.log("Tenant document created");

        // Create Users collection document  
        await setDoc(doc(db, "Users", email), {
          email,
          role: "tenant",
          createdAt: serverTimestamp(),
        });
        console.log("Users document created");

        // Update room status
        const startDate = new Date(moveInDate);
        await updateDoc(doc(db, "Rooms", matchedRoomDoc.id), {
          status: "Occupied",
          occupant: name,
          startDate: Timestamp.fromDate(startDate),
          endDate: null,
          updatedAt: serverTimestamp(),
        });
        console.log("Room updated");

        // Create initial bill
        const billId = await generateId("B", "Bills");
        const rentAmount = typeof roomData.rate === "number" ? roomData.rate : parseFloat(roomData.rate || 0);
        await addDoc(collection(db, "Bills"), {
          billId,
          tenantName: name,
          roomNumber,
          electric: 0,
          water: 0,
          roomRent: rentAmount,
          status: "Unpaid",
          createdAt: serverTimestamp(),
        });
        console.log("Bill created");

        // Now create Firebase Auth account (this will switch users)
        console.log("Creating Firebase Auth account...");
        try {
          const tenantCredential = await createUserWithEmailAndPassword(auth, email, password);
          console.log("✓ Tenant auth account created:", tenantCredential.user.uid);
          
          // Sign out the tenant immediately
          await signOut(auth);
          console.log("✓ Tenant signed out");
          
          // Sign back in as admin
          console.log("Re-authenticating admin with email:", adminEmail);
          await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
          console.log("✓ Admin re-authenticated successfully");
          
        } catch (authError) {
          console.error("Auth error details:", authError);
          if (authError.code === "auth/email-already-in-use") {
            alert("This email is already registered in Firebase Authentication.\n\nTenant records created in Firestore, but authentication account already exists.\n\nThe tenant may already be able to login with their existing password.");
          } else if (authError.code === "auth/wrong-password" || authError.code === "auth/invalid-credential") {
            alert("Incorrect admin password entered.\n\nTenant created successfully but you need to log in again as admin.");
            window.location.href = "../Login/index.html";
            return;
          } else if (authError.code === "auth/invalid-email") {
            alert("Invalid email format. Tenant records created but auth account failed.");
          } else {
            console.error("Auth error:", authError);
            alert("Tenant records created in Firestore.\n\nHowever, authentication account creation failed:\n" + authError.message + "\n\nYou may need to create the auth account manually in Firebase Console.");
          }
        }
      }

      editingTenantId = null;
      editingTenantEmail = null;
      tenantModal?.classList.add("hidden");
      await loadTenants();
      await loadRooms();
      await loadBills();
      await loadAvailableRooms();
      alert("Tenant saved successfully!\n\nCredentials:\nEmail: " + email + "\nPassword: " + password + "\n\nPlease share these with the tenant.");
    } catch (err) {
      console.error("saveTenant error:", err);
      alert("Error saving tenant: " + err.message);
    }
  });

  async function loadRooms() {
    if (!roomTable) return;
    roomTable.innerHTML = "";
    try {
      const roomsSnap = await getDocs(query(collection(db, "Rooms"), orderBy("roomNumber")));
      roomsSnap.forEach((docSnap) => {
        const r = docSnap.data() || {};
        const color =
          r.status === "Available"
            ? "bg-green-100 text-green-700"
            : r.status === "Occupied"
            ? "bg-blue-100 text-blue-700"
            : "bg-red-100 text-red-700";
        const start = r.startDate?.toDate?.() ? r.startDate.toDate().toLocaleDateString() : "—";
        const end = r.endDate?.toDate?.() ? r.endDate.toDate().toLocaleDateString() : "—";
        const tr = document.createElement("tr");
        tr.className = "border-b border-gray-200 hover:bg-gray-50";
        tr.innerHTML = `
          <td class="p-3 col-center text-sm font-medium">${r.roomNumber || "—"}</td>
          <td class="p-3 col-left text-sm text-gray-600">${r.type || "—"}</td>
          <td class="p-3 col-center text-sm">₱${(r.rate || 0).toLocaleString()}</td>
          <td class="p-3 col-center text-sm text-gray-600">${start}</td>
          <td class="p-3 col-center text-sm text-gray-600">${end}</td>
          <td class="p-3 col-center text-sm"><span class="px-3 py-1 rounded-full text-xs font-semibold ${color}">${r.status || "—"}</span></td>
          <td class="p-3 col-center text-sm text-gray-600">${r.occupant || "—"}</td>
        `;
        roomTable.appendChild(tr);
      });
    } catch (err) {
      console.error("loadRooms error:", err);
    }
  }

  addRoomBtn?.addEventListener("click", () => {
    roomModal?.classList.remove("hidden");
    roomModal?.querySelectorAll("input").forEach((i) => (i.value = ""));
    document.getElementById("roomStatus").value = "Available";
  });
  cancelRoomBtn?.addEventListener("click", () => roomModal?.classList.add("hidden"));

  saveRoomBtn?.addEventListener("click", async () => {
    try {
      const roomNumber = document.getElementById("roomNumber").value.trim();
      const type = document.getElementById("roomType").value.trim();
      const rate = parseFloat(document.getElementById("roomRate").value) || 0;
      const status = document.getElementById("roomStatus").value;

      if (!roomNumber || !type) {
        alert("Please fill required fields.");
        return;
      }

      const existing = await getDocs(collection(db, "Rooms"));
      if (existing.docs.find((d) => d.data().roomNumber === roomNumber)) {
        alert("Room number already exists.");
        return;
      }

      await addDoc(collection(db, "Rooms"), {
        roomNumber,
        type,
        rate,
        status,
        occupant: "",
        startDate: null,
        endDate: null,
        createdAt: serverTimestamp(),
      });

      roomModal?.classList.add("hidden");
      await loadRooms();
      await loadAvailableRooms();
    } catch (err) {
      console.error("saveRoom error:", err);
      alert("Error saving room (see console).");
    }
  });

  async function loadBills() {
    if (!billTable) return;
    billTable.innerHTML = "";
    try {
      const billsSnap = await getDocs(query(collection(db, "Bills"), orderBy("createdAt")));
      billsSnap.forEach((docSnap) => {
        const b = docSnap.data() || {};
        const total = (b.electric || 0) + (b.water || 0) + (b.roomRent || 0);
        const color =
          b.status === "Paid"
            ? "bg-green-100 text-green-700"
            : "bg-yellow-100 text-yellow-700";

        const tr = document.createElement("tr");
        tr.className = "border-b border-gray-200 hover:bg-gray-50";
        tr.innerHTML = `
          <td class="p-3 text-center text-sm font-medium text-gray-700">${b.billId || "—"}</td>
          <td class="p-3 text-left text-sm text-gray-700">${b.tenantName || "—"}</td>
          <td class="p-3 text-center text-sm text-gray-600">${b.roomNumber || "—"}</td>
          <td class="p-3 text-center text-sm text-gray-600">₱${(b.electric || 0).toFixed(2)}</td>
          <td class="p-3 text-center text-sm text-gray-600">₱${(b.water || 0).toFixed(2)}</td>
          <td class="p-3 text-center text-sm text-gray-600">₱${(b.roomRent || 0).toFixed(2)}</td>
          <td class="p-3 text-center text-sm font-semibold text-gray-800">₱${total.toFixed(2)}</td>
          <td class="p-3 text-center text-sm">
            <span class="px-3 py-1 rounded-full text-xs font-semibold ${color}">
              ${b.status || "—"}
            </span>
          </td>
          <td class="p-3 text-center text-sm">
            <div class="flex justify-center items-center gap-2">
              <button class="editBill bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded" data-id="${docSnap.id}">
                Edit
              </button>
            </div>
          </td>
        `;
        billTable.appendChild(tr);
      });

      document.querySelectorAll(".editBill").forEach((btn) => {
        btn.onclick = async () => {
          const billRef = doc(db, "Bills", btn.dataset.id);
          const snap = await getDoc(billRef);
          if (!snap.exists()) return alert("Bill not found.");
          const b = snap.data();
          const originalStatus = b.status || "Unpaid";

          document.getElementById("billTenantName").value = b.tenantName || "";
          document.getElementById("billRoomNumber").value = b.roomNumber || "";
          document.getElementById("billElectric").value = b.electric || 0;
          document.getElementById("billWater").value = b.water || 0;
          document.getElementById("billRoomRent").value = b.roomRent || 0;
          document.getElementById("billStatus").value = b.status || "Unpaid";
          billModal?.classList.remove("hidden");

          saveBillBtn.onclick = async () => {
            const newElectric = parseFloat(document.getElementById("billElectric").value) || 0;
            const newWater = parseFloat(document.getElementById("billWater").value) || 0;
            const newStatus = document.getElementById("billStatus").value;

            await updateDoc(billRef, {
              electric: newElectric,
              water: newWater,
              status: newStatus,
              updatedAt: serverTimestamp(),
            });

            if (originalStatus !== "Paid" && newStatus === "Paid") {
              const totalAmount = newElectric + newWater + (b.roomRent || 0);
              const trId = await generateId("TR", "Transactions");
              await addDoc(collection(db, "Transactions"), {
                transactionId: trId,
                tenantName: b.tenantName || "",
                amountPaid: totalAmount,
                paymentDate: serverTimestamp(),
                method: "Manual",
                billRef: b.billId || "",
                createdAt: serverTimestamp(),
              });
              await deleteDoc(billRef);
            }

            billModal?.classList.add("hidden");
            await loadBills();
            await loadTransactions();
          };
        };
      });
    } catch (err) {
      console.error("loadBills error:", err);
    }
  }

  async function loadTransactions() {
    if (!transactionTable) return;
    transactionTable.innerHTML = "";

    try {
      const snaps = await getDocs(
        query(collection(db, "Transactions"), orderBy("createdAt", "desc"))
      );

      snaps.forEach((docSnap) => {
        const t = docSnap.data() || {};
        const payDate = t.paymentDate?.toDate
          ? t.paymentDate.toDate().toLocaleDateString()
          : "—";

        const tr = document.createElement("tr");
        tr.className =
          "border-b border-gray-200 hover:bg-gray-50 transition duration-150 ease-in-out";

        tr.innerHTML = `
          <td class="p-3 text-center text-sm font-medium text-gray-700">${t.transactionId || "—"}</td>
          <td class="p-3 text-left text-sm text-gray-700">${t.tenantName || "—"}</td>
          <td class="p-3 text-center text-sm font-semibold text-gray-800">
            ₱${(t.amountPaid || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </td>
          <td class="p-3 text-center text-sm text-gray-700">${payDate}</td>
          <td class="p-3 text-center text-sm text-gray-700">${t.method || "—"}</td>
          <td class="p-3 text-center text-sm text-gray-700">${t.billRef || "—"}</td>
          <td class="p-3 text-center text-sm">
            <button class="deleteTransaction bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded" data-id="${docSnap.id}">
              Delete
            </button>
          </td>
        `;
        transactionTable.appendChild(tr);
      });

      document.querySelectorAll(".deleteTransaction").forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm("Delete this transaction?")) return;
          const id = btn.dataset.id;
          try {
            await deleteDoc(doc(db, "Transactions", id));
            await loadTransactions();
          } catch (err) {
            console.error("deleteTransaction error:", err);
            alert("Error deleting transaction (check console).");
          }
        };
      });
    } catch (err) {
      console.error("Error loading transactions:", err);
    }
  }

  cancelBillBtn?.addEventListener("click", () => billModal?.classList.add("hidden"));

  (async () => {
    await loadTenants();
    await loadRooms();
    await loadBills();
    await loadTransactions();
  })();
});