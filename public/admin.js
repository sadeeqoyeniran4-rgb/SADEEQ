// ===============================
// ✅ CONFIG
// ===============================
const API_BASE = "https://lofinda.onrender.com";
const ADMIN_PASSWORD = "sadeeq123"; // ⚠️ Change this to a secure password
let loadedOrders = [];

// ===============================
// 🔐 ADMIN LOGIN HANDLING
// ===============================
const adminLoginForm = document.getElementById("adminLoginForm");
const loginResponse = document.getElementById("loginResponse");
const adminModal = document.getElementById("admin-login-modal");
const adminSection = document.getElementById("admin-section");
const loadingIndicator = document.getElementById("loading-indicator");

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
} else {
  adminModal.style.display = "flex";
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

    productTableBody.replaceChildren();
    if (!products.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "No products found";
      row.append(cell);
      productTableBody.append(row);
      return;
    }

    products.forEach(product => {
      const row = document.createElement("tr");
      const idCell = document.createElement("td");
      idCell.textContent = product.id;
      const imageCell = document.createElement("td");
      const image = document.createElement("img");
      image.src = product.image_url || "lofinda2.png";
      image.alt = product.name || "Product";
      image.loading = "lazy";
      imageCell.append(image);
      const nameCell = document.createElement("td");
      nameCell.textContent = product.name || "";
      const priceCell = document.createElement("td");
      priceCell.textContent = `₦${Number(product.price).toLocaleString()}`;
      const actionCell = document.createElement("td");
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "edit-btn";
      editButton.textContent = "Edit";
      editButton.dataset.product = JSON.stringify(product);
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-btn";
      deleteButton.textContent = "Delete";
      deleteButton.dataset.id = product.id;
      actionCell.append(editButton, deleteButton);
      row.append(idCell, imageCell, nameCell, priceCell, actionCell);
      productTableBody.append(row);
    });
  } catch (err) {
    console.error("❌ Error loading products:", err);
    productTableBody.innerHTML = `<tr><td colspan="5">Error loading products.</td></tr>`;
  }
}

productTableBody.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.classList.contains("edit-btn")) {
    try {
      const product = JSON.parse(button.dataset.product);
      openEditModal(product.id, product.name, product.description || "", product.price);
    } catch (err) {
      console.error("Could not open the selected product for editing:", err);
    }
  } else if (button.classList.contains("delete-btn")) {
    deleteProduct(button.dataset.id);
  }
});

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
// ================= EDIT PRODUCT =================
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("editProductForm");

if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("edit-id").value;
    const name = document.getElementById("edit-name").value.trim();
    const description = document.getElementById("edit-desc").value.trim();
    const price = parseFloat(document.getElementById("edit-price").value);
    const imageFile = document.getElementById("edit-image-file").files[0];

    if (!name || !price) {
      alert("Please fill in all required fields");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", price);
    if (imageFile) formData.append("image", imageFile);

    try {
      const res = await fetch(`${window.API_BASE}/api/products/${id}`, {
        method: "PUT",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ Product updated successfully!");
        editModal.style.display = "none";
        loadProducts(); // refresh product list
      } else {
        alert("❌ Failed to update product.");
      }
    } catch (err) {
      console.error("Error updating product:", err);
      alert("Something went wrong. Please try again.");
    }
  });
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
}
function openEditModal(id, name, description, price) {
  document.getElementById("edit-id").value = id;
  document.getElementById("edit-name").value = name;
  document.getElementById("edit-desc").value = description;
  document.getElementById("edit-price").value = price;
  editModal.style.display = "flex";
}

// ===============================
// 📦 LOAD ORDERS
// ===============================
async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    if (!res.ok) throw new Error("Failed to fetch orders");

    const data = await res.json();
    const orders = Array.isArray(data.orders) ? data.orders : [];
    loadedOrders = orders;

    const ordersBody = document.getElementById("ordersBody");
    const totalCount = document.getElementById("totalCount");
    const pendingCount = document.getElementById("pendingCount");
    const confirmedCount = document.getElementById("confirmedCount");
    const deliveredCount = document.getElementById("deliveredCount");

    // ✅ Update stats
    totalCount.textContent = orders.length;
    pendingCount.textContent = orders.filter(o => o.status === "pending").length;
    confirmedCount.textContent = orders.filter(o => o.status === "confirmed").length;
    deliveredCount.textContent = orders.filter(o => o.status === "delivered").length;

    renderOrders(orders);

  } catch (err) {
    console.error("❌ Error fetching orders:", err);
  }
}

function renderOrders(orders) {
  const ordersBody = document.getElementById("ordersBody");
  const searchTerm = document.getElementById("searchOrders").value.trim().toLocaleLowerCase();
  const visibleOrders = orders.filter(order => {
    const searchable = [
      order.id,
      order.customer_name,
      order.phone,
      order.email,
      order.address,
      ...(order.items || []).map(item => item.product_name),
    ].join(" ").toLocaleLowerCase();
    return searchable.includes(searchTerm);
  });
  ordersBody.replaceChildren();

  if (!visibleOrders.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 10;
    cell.textContent = orders.length ? "No orders match your search." : "No orders yet";
    row.append(cell);
    ordersBody.append(row);
    return;
  }

  const addCell = (row, value) => {
    const cell = document.createElement("td");
    cell.textContent = value === null || value === undefined ? "" : String(value);
    row.append(cell);
  };

  visibleOrders.forEach(order => {
    const row = document.createElement("tr");
    addCell(row, `#${order.id}`);
    addCell(row, order.customer_name || "N/A");
    addCell(row, order.phone || "N/A");
    addCell(row, order.email || "N/A");
    addCell(row, order.address || "N/A");
    addCell(row, (order.items || []).map(item => `${item.product_name} (${item.quantity} × ₦${Number(item.price).toLocaleString()})`).join(", "));
    addCell(row, `₦${Number(order.total_amount).toLocaleString()}`);

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `status ${["pending", "confirmed", "delivered"].includes(order.status) ? order.status : ""}`;
    status.textContent = order.status || "unknown";
    statusCell.append(status);
    row.append(statusCell);

    const date = new Date(order.created_at);
    addCell(row, Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString());
    const actionCell = document.createElement("td");
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.dataset.id = order.id;
    if (order.status === "pending") {
      actionButton.className = "confirm-btn";
      actionButton.textContent = "Confirm";
    } else if (order.status === "confirmed") {
      actionButton.className = "deliver-btn";
      actionButton.textContent = "Mark delivered";
    } else {
      actionButton.className = "delete-btn";
      actionButton.textContent = "Delete";
    }
    actionCell.append(actionButton);
    row.append(actionCell);
    ordersBody.append(row);
  });
}

document.getElementById("searchOrders").addEventListener("input", () => {
  renderOrders(loadedOrders);
});

document.getElementById("ordersBody").addEventListener("click", async event => {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.id;
  if (button.classList.contains("confirm-btn")) {
    await updateOrderStatus(id, "confirmed");
  } else if (button.classList.contains("deliver-btn")) {
    await updateOrderStatus(id, "delivered");
  } else if (button.classList.contains("delete-btn") && confirm("Delete this order?")) {
    try {
      const response = await fetch(`${API_BASE}/api/orders/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete order");
      await loadOrders();
    } catch (err) {
      console.error("❌ Error deleting order:", err);
    }
  }
});

async function updateOrderStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) throw new Error("Failed to update order");
    loadOrders();
  } catch (err) {
    console.error("❌ Error updating order:", err);
  }
}

const adminSidebar = document.querySelector(".admin-sidebar");
const adminMenuToggle = document.getElementById("hamburger-admin");
const adminNavigation = document.getElementById("nav-links-admin");

adminMenuToggle.addEventListener("click", () => {
  const isOpen = adminMenuToggle.getAttribute("aria-expanded") === "true";
  adminMenuToggle.setAttribute("aria-expanded", String(!isOpen));
  adminMenuToggle.setAttribute("aria-label", isOpen ? "Open dashboard navigation" : "Close dashboard navigation");
  adminSidebar.classList.toggle("is-open", !isOpen);
});

adminNavigation.addEventListener("click", event => {
  if (event.target.closest("a")) {
    adminSidebar.classList.remove("is-open");
    adminMenuToggle.setAttribute("aria-expanded", "false");
    adminMenuToggle.setAttribute("aria-label", "Open dashboard navigation");
  }
});

document.getElementById("admin-year").textContent = String(new Date().getFullYear());

// ===============================
// 🚪 LOGOUT
// ===============================
window.logoutAdmin = () => {
  localStorage.removeItem("isAdmin");
  location.reload();
};
