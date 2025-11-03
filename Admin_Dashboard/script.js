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
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";


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

document.addEventListener("DOMContentLoaded", () => {
  // Tabs
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

  // Logout
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

  // ----------------- TENANTS -----------------
  async function loadTenants() {
    if (!tenantTable) return;
    tenantTable.innerHTML = "";
    try {
      const snap = await getDocs(query(collection(db, "Tenants"), orderBy("createdAt")));
      snap.forEach((docSnap) => {
        const t = docSnap.data() || {};
        const tr = document.createElement("tr");
        tr.className = "border-b border-gray-200 hover:bg-gray-50";
        tr.innerHTML = `
          <td class="p-3 col-center text-sm font-medium text-gray-700">${t.tenantId || "—"}</td>
          <td class="p-3 col-left text-sm text-gray-700">${t.name || "—"}</td>
          <td class="p-3 col-center text-sm text-gray-600">${t.roomNumber || "—"}</td>
          <td class="p-3 col-center text-sm text-gray-600">${t.age || "—"}</td>
          <td class="p-3 col-center text-sm text-gray-600">${t.contact || "—"}</td>
          <td class="p-3 col-left text-sm text-gray-600">${t.email || "—"}</td>
          <td class="p-3 col-center text-sm text-gray-600">${t.moveInDate || "—"}</td>
          <td class="p-3 col-center text-sm text-gray-600">${t.duration || "—"}</td>
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
            await deleteDoc(tenantRef);
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
            document.getElementById("tenantName").value = t.name || "";
            document.getElementById("tenantAge").value = t.age || "";
            document.getElementById("tenantContact").value = t.contact || "";
            document.getElementById("tenantEmail").value = t.email || "";
            document.getElementById("tenantMoveIn").value = t.moveInDate || "";
            document.getElementById("tenantDuration").value = t.duration || "";
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

  // ----------------- AVAILABLE ROOMS -----------------
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

  // Add tenant (open modal)
  addTenantBtn?.addEventListener("click", async () => {
    editingTenantId = null;
    tenantModal?.querySelectorAll("input").forEach((i) => (i.value = ""));
    await loadAvailableRooms();
    tenantModal?.classList.remove("hidden");
  });

  cancelTenantBtn?.addEventListener("click", () => {
    editingTenantId = null;
    tenantModal?.classList.add("hidden");
  });

  // Save / Update tenant
  saveTenantBtn?.addEventListener("click", async () => {
    const name = document.getElementById("tenantName").value.trim();
    const age = document.getElementById("tenantAge").value.trim();
    const contact = document.getElementById("tenantContact").value.trim();
    const email = document.getElementById("tenantEmail").value.trim();
    const moveInDate = document.getElementById("tenantMoveIn").value;
    const duration = parseInt(document.getElementById("tenantDuration").value, 10);
    const roomNumber = document.getElementById("tenantRoom").value;

    if (!name || !moveInDate || !duration || !roomNumber) {
      alert("Please fill all required fields and select an available room.");
      return;
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
        const tenantRef = doc(db, "Tenants", editingTenantId);

        const prevSnap = await getDoc(tenantRef);
        const prev = prevSnap.exists() ? prevSnap.data() : null;
        await updateDoc(tenantRef, {
          name,
          age,
          contact,
          email,
          moveInDate,
          duration,
          roomNumber,
          updatedAt: serverTimestamp(),
        });

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
      } else {
        // create new tenant
        const tenantId = await generateId("T", "Tenants");
        await addDoc(collection(db, "Tenants"), {
          tenantId,
          name,
          age,
          contact,
          email,
          moveInDate,
          duration,
          roomNumber,
          createdAt: serverTimestamp(),
        });
      }

      const startDate = new Date(moveInDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + (isNaN(duration) ? 0 : duration));
      await updateDoc(doc(db, "Rooms", matchedRoomDoc.id), {
        status: "Occupied",
        occupant: name,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        updatedAt: serverTimestamp(),
      });

      if (!editingTenantId) {
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
      }

      editingTenantId = null;
      tenantModal?.classList.add("hidden");
      await loadTenants();
      await loadRooms();
      await loadBills();
      await loadAvailableRooms();
    } catch (err) {
      console.error("saveTenant error:", err);
      alert("Error saving tenant (see console).");
    }
  });

  // ----------------- ROOMS -----------------
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

// ----------------- BILLS -----------------
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

// ----------------- TRANSACTIONS -----------------
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

  // ----------------- INITIAL LOAD -----------------
  (async () => {
    await loadTenants();
    await loadRooms();
    await loadBills();
    await loadTransactions();
  })();
});
