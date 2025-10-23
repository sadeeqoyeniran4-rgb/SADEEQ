// ===============================
// ✅ CONFIG
// ===============================
const API_BASE = window.API_BASE || "https://lofinda.onrender.com";
const ADMIN_PASSWORD = "sadeeq123"; // change to your password

// Elements
const adminLoginForm = document.getElementById("adminLoginForm");
const loginResponse = document.getElementById("loginResponse");
const adminModal = document.getElementById("admin-login-modal");

// ===============================
// 🧑 ADMIN LOGIN
// ===============================
window.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("isAdmin") === "true") {
    showAdminPanel();
  }
});

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const password = document.getElementById("admin-password").value;

    if (password === ADMIN_PASSWORD) {
      loginResponse.textContent = "✅ Login successful!";
      loginResponse.style.color = "green";
      localStorage.setItem("isAdmin", "true");
      showAdminPanel();
    } else {
      loginResponse.textContent = "❌ Invalid password";
      loginResponse.style.color = "red";
    }
  });
}

function showAdminPanel() {
  adminModal.style.display = "none";
  document.querySelectorAll(".container").forEach(c => c.style.display = "block");
  loadProducts();
  fetchOrders();
}

// ===============================
// 🛍️ ADD PRODUCT
// ===============================
const addProductForm = document.getElementById("addProductForm");
const productResponse = document.getElementById("productResponse");

if (addProductForm) {
  addProductForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("prod-name").value;
    const description = document.getElementById("prod-desc").value;
    const price = document.getElementById("prod-price").value;
    const imageFile = document.getElementById("prod-image-file").files[0];

    if (!name || !price || !imageFile) {
      productResponse.textContent = "⚠️ All required fields must be filled";
      productResponse.style.color = "red";
      return;
    }

    try {
      // Upload image first
      const imgData = new FormData();
      imgData.append("image", imageFile);
      const imgRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: imgData,
      });
      if (!imgRes.ok) throw new Error("Image upload failed");
      const imgJson = await imgRes.json();
      const imageUrl = imgJson.url;

      // Add product to DB
      const productRes = await fetch(`${API_BASE}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, price, image_url: imageUrl }),
      });

      if (!productRes.ok) throw new Error("Product upload failed");
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
// 🛒 FETCH & DISPLAY PRODUCTS
// ===============================
const productTableBody = document.getElementById("productTableBody");

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) throw new Error("Failed to load products");
    const products = await res.json();

    productTableBody.innerHTML = "";
    products.forEach(prod => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${prod.id}</td>
        <td><img src="${prod.image_url}" alt="${prod.name}" width="80" height="80" style="object-fit:cover; border-radius:8px;"></td>
        <td>${prod.name}</td>
        <td>₦${prod.price}</td>
        <td>
          <button class="edit-btn" onclick="openEditModal(${prod.id}, '${prod.name}', '${prod.description}', ${prod.price})">Edit</button>
          <button class="delete-btn" onclick="deleteProduct(${prod.id})">Delete</button>
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
    const res = await fetch(`${API_BASE}/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
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
      const res = await fetch(`${API_BASE}/api/products/${id}`, {
        method: "PUT",
        body: formData
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
// 📦 FETCH ORDERS
// ===============================
const ordersBody = document.getElementById("ordersBody");

async function fetchOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    if (!res.ok) throw new Error("Failed to fetch orders");
    const orders = await res.json();

    ordersBody.innerHTML = "";
    orders.forEach(order => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.id}</td>
        <td>${order.customer_name || "N/A"}</td>
        <td>${order.email || "N/A"}</td>
        <td>${order.address || "N/A"}</td>
        <td>${order.items || "N/A"}</td>
        <td>₦${order.total_amount || 0}</td>
        <td>${order.status || "pending"}</td>
        <td>${new Date(order.created_at).toLocaleString()}</td>
      `;
      ordersBody.appendChild(row);
    });
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
  }
}

// ===============================
// 🍔 HAMBURGER MENU TOGGLE
// ===============================
const hamburger = document.getElementById("hamburger-admin");
const navLinks = document.getElementById("nav-links-admin");

if (hamburger && navLinks) {
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });
}

// ===============================
// 🏃 LOGOUT FUNCTION
// ===============================
window.logoutAdmin = () => {
  localStorage.removeItem("isAdmin");
  location.reload();
};
