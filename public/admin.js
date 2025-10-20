// ===============================
// ✅ CONFIG
// ===============================
const API_BASE = window.API_BASE || "https://sadeeq-too1.onrender.com";

// ===============================
// 🧑 ADMIN LOGIN
// ===============================
// admin.js

// ✅ Set your admin password (you can later move to .env)
const ADMIN_PASSWORD = "sadeeq123"; // change to your password

const adminLoginForm = document.getElementById("adminLoginForm");
const loginResponse = document.getElementById("loginResponse");
const adminModal = document.getElementById("admin-login-modal");
const adminSection = document.getElementById("admin-section");

// ✅ Check if already logged in (keeps session after refresh)
window.addEventListener("DOMContentLoaded", () => {
  const isAdmin = localStorage.getItem("isAdmin");
  if (isAdmin === "true") {
    adminModal.style.display = "none";
    adminSection.style.display = "block";
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
      adminModal.style.display = "none";
      adminSection.style.display = "block";
    } else {
      loginResponse.textContent = "❌ Invalid password";
      loginResponse.style.color = "red";
    }
  });
}


// ===============================
// 🛍️ ADD PRODUCT
// ===============================
const addProductForm = document.getElementById("addProductForm");
const productResponse = document.getElementById("productResponse");

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
    // 1️⃣ Upload image first
    const imgData = new FormData();
    imgData.append("image", imageFile);

    const imgRes = await fetch(`${window.API_BASE}/api/upload`, {
      method: "POST",
      body: imgData,
    });

    if (!imgRes.ok) throw new Error("Image upload failed");
    const imgJson = await imgRes.json();
    const imageUrl = imgJson.url;

    // 2️⃣ Then add product to DB
    const productRes = await fetch(`${window.API_BASE}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        price,
        image_url: imageUrl
      }),
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
        <td><img src="${prod.image}" alt="${prod.name}"></td>
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
// 🏃 LOGOUT FUNCTION (optional)
// ===============================
window.logoutAdmin = () => {
  localStorage.removeItem("isAdmin");
  location.reload();
};
