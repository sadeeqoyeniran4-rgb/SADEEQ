// ===============================
// ✅ CONFIGURATION
// ===============================
const API_BASE = window.API_BASE || "https://lofinda.onrender.com";
const ADMIN_PASSWORD = "Ogunleye1960."; // Change for better security!

// ===============================
// 🔐 ADMIN LOGIN
// ===============================
const adminLoginForm = document.getElementById("adminLoginForm");
const loginResponse = document.getElementById("loginResponse");
const adminModal = document.getElementById("admin-login-modal");
const adminSection = document.getElementById("admin-section");

/* Keep admin logged in after refresh
window.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("isAdmin") === "true") {
    adminModal.style.display = "none";
    adminSection.style.display = "block";
    loadProducts();
    loadOrders();
  }
}); */

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const password = document.getElementById("admin-password").value.trim();
    if (password === ADMIN_PASSWORD) {
      loginResponse.textContent = "✅ Login successful!";
      loginResponse.style.color = "green";
      localStorage.setItem("isAdmin", "true");
      adminModal.style.display = "none";
      adminSection.style.display = "block";
      loadProducts();
      loadOrders();
    } else {
      loginResponse.textContent = "❌ Incorrect password";
      loginResponse.style.color = "red";
    }
  });
}

// Logout
window.logoutAdmin = () => {
  localStorage.removeItem("isAdmin");
  location.reload();
};

// ===============================
// 🍔 NAVBAR TOGGLE
// ===============================
const hamburger = document.getElementById("hamburger-admin");
const navLinks = document.getElementById("nav-links-admin");
if (hamburger && navLinks) {
  hamburger.addEventListener("click", () => navLinks.classList.toggle("active"));
}

// ===============================
// 🛍️ ADD PRODUCT
// ===============================
const addProductForm = document.getElementById("addProductForm");
const productResponse = document.getElementById("productResponse");

if (addProductForm) {
  addProductForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("prod-name").value.trim();
    const description = document.getElementById("prod-desc").value.trim();
    const price = document.getElementById("prod-price").value.trim();
    const imageFile = document.getElementById("prod-image-file").files[0];

    if (!name || !price || !imageFile) {
      productResponse.textContent = "⚠️ All required fields must be filled";
      productResponse.style.color = "red";
      return;
    }

    try {
      const imgData = new FormData();
      imgData.append("image", imageFile);

      const imgRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: imgData,
      });
      if (!imgRes.ok) throw new Error("Image upload failed");
      const imgJson = await imgRes.json();

      const res = await fetch(`${API_BASE}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price,
          image_url: imgJson.url,
        }),
      });

      if (!res.ok) throw new Error("Upload failed");
      productResponse.textContent = "✅ Product added successfully";
      productResponse.style.color = "green";
      addProductForm.reset();
      loadProducts();
    } catch (err) {
      console.error("Upload error:", err);
      productResponse.textContent = "❌ Error uploading product";
      productResponse.style.color = "red";
    }
  });
}

// ===============================
// 📦 LOAD PRODUCTS
// ===============================
async function loadProducts() {
  const productTableBody = document.getElementById("productTableBody");
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    const products = await res.json();

    productTableBody.innerHTML = "";
    products.forEach((prod) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${prod.id}</td>
        <td><img src="${prod.image_url}" alt="${prod.name}" width="80" height="80" style="object-fit:cover;border-radius:8px;"></td>
        <td>${prod.name}</td>
        <td>₦${prod.price}</td>
        <td>
          <button onclick="openEditModal(${prod.id}, '${prod.name}', '${prod.description || ""}', ${prod.price})">✏️ Edit</button>
          <button class="delete-btn" onclick="deleteProduct(${prod.id})">🗑️ Delete</button>
        </td>
      `;
      productTableBody.appendChild(row);
    });
  } catch (err) {
    console.error("❌ Error loading products:", err);
  }
}

// ===============================
// 🗑️ DELETE PRODUCT
// ===============================
async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  try {
    const res = await fetch(`${API_BASE}/api/products/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete product");
    loadProducts();
  } catch (err) {
    console.error("Delete error:", err);
  }
}

// ===============================
// ✏️ EDIT PRODUCT
// ===============================
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("editProductForm");

function openEditModal(id, name, desc, price) {
  document.getElementById("edit-id").value = id;
  document.getElementById("edit-name").value = name;
  document.getElementById("edit-desc").value = desc;
  document.getElementById("edit-price").value = price;
  editModal.style.display = "flex";
}

function closeEditModal() {
  editModal.style.display = "none";
}

if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-id").value;
    const name = document.getElementById("edit-name").value.trim();
    const description = document.getElementById("edit-desc").value.trim();
    const price = document.getElementById("edit-price").value.trim();
    const imageFile = document.getElementById("edit-image-file").files[0];

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", price);
    if (imageFile) formData.append("image", imageFile);

    try {
      const res = await fetch(`${API_BASE}/api/products/${id}`, {
        method: "PUT",
        body: formData,
      });
      if (!res.ok) throw new Error("Update failed");
      closeEditModal();
      loadProducts();
    } catch (err) {
      console.error("Edit error:", err);
    }
  });
}

// ===============================
// 📦 LOAD ORDERS
// ===============================
async function loadOrders() {
  const ordersBody = document.getElementById("ordersBody");
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    const orders = await res.json();
    ordersBody.innerHTML = "";

    if (!orders.length) {
      ordersBody.innerHTML = `<tr><td colspan="8">No orders yet</td></tr>`;
      return;
    }

    orders.forEach((order) => {
      const itemsList = Array.isArray(order.items)
        ? order.items.map(i => `${i.product_name || i.name} (${i.quantity})`).join("<br>")
        : order.items;

      const row = `
        <tr>
          <td>${order.customer_name}</td>
          <td>${order.phone || "—"}</td>
          <td>${order.email}</td>
          <td>${order.address}</td>
          <td>${itemsList}</td>
          <td>₦${order.total_amount}</td>
          <td>
            <span class="status ${order.status.toLowerCase()}">${order.status}</span>
          </td>
          <td>
            ${
              order.status === "pending"
                ? `<button class="confirm-btn" data-id="${order.id}">Confirm</button>`
                : `<button class="delete-btn" data-id="${order.id}">Delete</button>`
            }
          </td>
        </tr>
      `;
      ordersBody.insertAdjacentHTML("beforeend", row);
    });

    // Handle Confirm/Delete buttons
    document.querySelectorAll(".confirm-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await fetch(`${API_BASE}/api/orders/${id}/confirm`, { method: "PUT" });
        loadOrders();
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Delete this order?")) return;
        await fetch(`${API_BASE}/api/orders/${id}`, { method: "DELETE" });
        loadOrders();
      });
    });
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
  }
}

// ===============================
// 🔍 SEARCH ORDERS
// ===============================
const searchOrders = document.getElementById("searchOrders");
if (searchOrders) {
  searchOrders.addEventListener("input", function () {
    const filter = this.value.toLowerCase();
    const rows = document.querySelectorAll("#ordersBody tr");
    rows.forEach((r) => {
      r.style.display = r.textContent.toLowerCase().includes(filter) ? "" : "none";
    });
  });
}
