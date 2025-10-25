// ===============================
// ✅ CONFIG
// ===============================
const API_BASE = "https://lofinda.onrender.com";
const ADMIN_PASSWORD = "sadeeq123"; // ⚠️ Change this to a secure password

// ===============================
// 🔐 ADMIN LOGIN HANDLING
// ===============================
const adminLoginForm = document.getElementById("adminLoginForm");
const loginResponse = document.getElementById("loginResponse");
const adminModal = document.getElementById("admin-login-modal");
const adminSection = document.getElementById("admin-section");
const loadingIndicator = document.getElementById("loading-indicator");

// Hide admin section by default
window.addEventListener("DOMContentLoaded", () => {
  adminModal.style.display = "flex";
  adminSection.style.display = "none";
  loadingIndicator.style.display = "none";
});

// Handle login
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const password = document.getElementById("admin-password").value.trim();

    if (password === ADMIN_PASSWORD) {
      loginResponse.textContent = "✅ Login successful!";
      loginResponse.style.color = "green";
      localStorage.setItem("isAdmin", "true");

      setTimeout(() => {
        adminModal.style.display = "none";
        adminSection.style.display = "block";
        document.getElementById("product-list").style.display = "block";
        document.getElementById("order-list").style.display = "block";
        initializeDashboard();
      }, 600);
    } else {
      loginResponse.textContent = "❌ Invalid password";
      loginResponse.style.color = "red";
    }
  });
}

// Auto-login if already logged in
if (localStorage.getItem("isAdmin") === "true") {
  adminModal.style.display = "none";
  adminSection.style.display = "block";
  document.getElementById("product-list").style.display = "block";
  document.getElementById("order-list").style.display = "block";
  initializeDashboard();
}

// ===============================
// 🧭 INITIAL DASHBOARD SETUP
// ===============================
async function initializeDashboard() {
  try {
    loadingIndicator.style.display = "flex";
    await Promise.all([loadProducts(), loadOrders()]);
  } catch (err) {
    console.error("❌ Dashboard initialization error:", err);
  } finally {
    loadingIndicator.style.display = "none";
  }
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
      productResponse.textContent = "⚠️ Please fill in all required fields.";
      productResponse.style.color = "red";
      return;
    }

    try {
      loadingIndicator.style.display = "flex";

      const formData = new FormData();
      formData.append("image", imageFile);

      const imgRes = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
      if (!imgRes.ok) throw new Error("Image upload failed");
      const imgData = await imgRes.json();

      const newProduct = { name, description, price, image_url: imgData.url };

      const res = await fetch(`${API_BASE}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });

      if (!res.ok) throw new Error("Product upload failed");
      productResponse.textContent = "✅ Product added successfully!";
      productResponse.style.color = "green";
      addProductForm.reset();
      loadProducts();
    } catch (err) {
      console.error("❌ Product upload error:", err);
      productResponse.textContent = "❌ Error adding product.";
      productResponse.style.color = "red";
    } finally {
      loadingIndicator.style.display = "none";
    }
  });
}

// ===============================
// 🛒 LOAD PRODUCTS
// ===============================
const productTableBody = document.getElementById("productTableBody");

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) throw new Error("Failed to load products");
    const products = await res.json();

    productTableBody.innerHTML = products.length
      ? products
          .map(
            (p) => `
        <tr>
          <td>${p.id}</td>
          <td><img src="${p.image_url}" alt="${p.name}" width="80" height="80" style="object-fit:cover;border-radius:8px;"></td>
          <td>${p.name}</td>
          <td>₦${Number(p.price).toLocaleString()}</td>
          <td>
            <button class="edit-btn" onclick="openEditModal(${p.id}, '${p.name}', '${p.description || ""}', ${p.price})">Edit</button>
            <button class="delete-btn" onclick="deleteProduct(${p.id})">Delete</button>
          </td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="5">No products found</td></tr>`;
  } catch (err) {
    console.error("❌ Error loading products:", err);
    productTableBody.innerHTML = `<tr><td colspan="5">Error loading products.</td></tr>`;
  }
}

// ===============================
// 🗑️ DELETE PRODUCT
// ===============================
async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    loadingIndicator.style.display = "flex";
    const res = await fetch(`${API_BASE}/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete product");
    loadProducts();
  } catch (err) {
    console.error("❌ Delete error:", err);
  } finally {
    loadingIndicator.style.display = "none";
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
    const name = document.getElementById("edit-name").value;
    const description = document.getElementById("edit-desc").value;
    const price = document.getElementById("edit-price").value;
    const imageFile = document.getElementById("edit-image-file").files[0];

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", price);
    if (imageFile) formData.append("image", imageFile);

    try {
      loadingIndicator.style.display = "flex";
      const res = await fetch(`${API_BASE}/api/products/${id}`, { method: "PUT", body: formData });
      if (!res.ok) throw new Error("Update failed");
      closeEditModal();
      loadProducts();
    } catch (err) {
      console.error("Edit error:", err);
    } finally {
      loadingIndicator.style.display = "none";
    }
  });
}

// ===============================
// 📦 LOAD ORDERS
// ===============================
async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    if (!res.ok) throw new Error("Failed to fetch orders");
    const orders = await res.json();

    const ordersBody = document.getElementById("ordersBody");
    const totalCount = document.getElementById("totalCount");
    const pendingCount = document.getElementById("pendingCount");
    const confirmedCount = document.getElementById("confirmedCount");
    const deliveredCount = document.getElementById("deliveredCount");

    if (!orders.length) {
      ordersBody.innerHTML = `<tr><td colspan="10">No orders yet</td></tr>`;
      totalCount.textContent = pendingCount.textContent = confirmedCount.textContent = deliveredCount.textContent = 0;
      return;
    }

    totalCount.textContent = orders.length;
    pendingCount.textContent = orders.filter((o) => o.status === "pending").length;
    confirmedCount.textContent = orders.filter((o) => o.status === "confirmed").length;
    deliveredCount.textContent = orders.filter((o) => o.status === "delivered").length;

    ordersBody.innerHTML = orders
      .map((o) => {
        const items = o.items.map((i) => `${i.product_name} (${i.quantity} × ₦${i.price})`).join("<br>");
        return `
          <tr>
            <td>${o.id}</td>
            <td>${o.customer_name}</td>
            <td>${o.phone || "N/A"}</td>
            <td>${o.email || ""}</td>
            <td>${o.address}</td>
            <td>${items}</td>
            <td>₦${Number(o.total_amount).toLocaleString()}</td>
            <td><span class="status ${o.status}">${o.status}</span></td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
            <td>
              ${
                o.status === "pending"
                  ? `<button class="confirm-btn" data-id="${o.id}">Confirm</button>`
                  : `<button class="delete-btn" data-id="${o.id}">Delete</button>`
              }
            </td>
          </tr>`;
      })
      .join("");

    // Add confirm/delete actions
    document.querySelectorAll(".confirm-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await fetch(`${API_BASE}/api/orders/${id}/confirm`, { method: "PUT" });
        loadOrders();
      })
    );

    document.querySelectorAll(".delete-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Delete this order?")) return;
        await fetch(`${API_BASE}/api/orders/${id}`, { method: "DELETE" });
        loadOrders();
      })
    );
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
  }
}

// ===============================
// 🚪 LOGOUT
// ===============================
window.logoutAdmin = () => {
  localStorage.removeItem("isAdmin");
  location.reload();
};
