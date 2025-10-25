// ====== CONFIG ======
const API_BASE = "https://lofinda.onrender.com"; // Your backend API base URL

// ====== LOGIN FUNCTIONALITY ======
document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("admin-password").value.trim();
  const responseText = document.getElementById("loginResponse");

  if (password === "admin123") {
    responseText.textContent = "✅ Login successful!";
    document.getElementById("admin-login-modal").style.display = "none";

    // Show dashboard sections
    document.getElementById("admin-section").style.display = "block";
    document.getElementById("product-list").style.display = "block";
    document.getElementById("order-list").style.display = "block";

    fetchProducts();
    fetchOrders();
  } else {
    responseText.textContent = "❌ Incorrect password!";
  }
});

// ====== ADD NEW PRODUCT ======
document.getElementById("addProductForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("prod-name").value.trim();
  const desc = document.getElementById("prod-desc").value.trim();
  const price = document.getElementById("prod-price").value;
  const imageFile = document.getElementById("prod-image-file").files[0];
  const responseText = document.getElementById("productResponse");

  if (!imageFile) {
    responseText.textContent = "❌ Please select an image.";
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", desc);
  formData.append("price", price);
  formData.append("image", imageFile);

  try {
    responseText.textContent = "⏳ Uploading product...";
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      responseText.textContent = "✅ Product added successfully!";
      document.getElementById("addProductForm").reset();
      fetchProducts();
    } else {
      responseText.textContent = "❌ Failed to add product. Check API.";
    }
  } catch (err) {
    console.error("Error adding product:", err);
    responseText.textContent = "⚠️ Network or server error.";
  }
});

// ====== FETCH PRODUCTS ======
async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();

    const tbody = document.getElementById("productTableBody");
    tbody.innerHTML = "";

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">No products found</td></tr>`;
      return;
    }

    products.forEach(prod => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${prod.id}</td>
        <td><img src="${prod.image_url || 'placeholder.jpg'}" alt="${prod.name}" /></td>
        <td>${prod.name}</td>
        <td>₦${prod.price}</td>
        <td>
          <button class="confirm-btn" onclick="openEditModal(${prod.id})">Edit</button>
          <button class="delete-btn" onclick="deleteProduct(${prod.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error fetching products:", err);
  }
}

// ====== FETCH ORDERS ======
async function fetchOrders() {
  try {
    const res = await fetch(`${API_BASE}/orders`);
    const orders = await res.json();

    const tbody = document.getElementById("ordersBody");
    tbody.innerHTML = "";

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10">No orders yet</td></tr>`;
      return;
    }

    // Count stats
    let pending = 0, confirmed = 0, delivered = 0;
    orders.forEach(order => {
      if (order.status === "pending") pending++;
      if (order.status === "confirmed") confirmed++;
      if (order.status === "delivered") delivered++;
    });

    document.getElementById("totalCount").textContent = orders.length;
    document.getElementById("pendingCount").textContent = pending;
    document.getElementById("confirmedCount").textContent = confirmed;
    document.getElementById("deliveredCount").textContent = delivered;

    // Display orders
    orders.forEach(order => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${order.id}</td>
        <td>${order.customer_name}</td>
        <td>${order.phone}</td>
        <td>${order.email || "-"}</td>
        <td>${order.address}</td>
        <td>${order.items || "-"}</td>
        <td>₦${order.total}</td>
        <td class="status ${order.status}">${order.status}</td>
        <td>${new Date(order.created_at).toLocaleString()}</td>
        <td>
          <button class="confirm-btn" onclick="updateOrderStatus(${order.id}, 'confirmed')">Confirm</button>
          <button class="delete-btn" onclick="deleteOrder(${order.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error fetching orders:", err);
  }
}

// ====== PRODUCT ACTIONS ======
async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  try {
    await fetch(`${API_BASE}/products/${id}`, { method: "DELETE" });
    alert("Product deleted successfully!");
    fetchProducts();
  } catch (err) {
    console.error("Error deleting product:", err);
  }
}

// ====== ORDER ACTIONS ======
async function updateOrderStatus(id, status) {
  try {
    await fetch(`${API_BASE}/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    alert(`Order marked as ${status}`);
    fetchOrders();
  } catch (err) {
    console.error("Error updating order:", err);
  }
}

async function deleteOrder(id) {
  if (!confirm("Are you sure you want to delete this order?")) return;
  try {
    await fetch(`${API_BASE}/orders/${id}`, { method: "DELETE" });
    alert("Order deleted successfully!");
    fetchOrders();
  } catch (err) {
    console.error("Error deleting order:", err);
  }
}

// ====== NAVBAR TOGGLE ======
document.getElementById("hamburger-admin").addEventListener("click", () => {
  document.getElementById("nav-links-admin").classList.toggle("active");
});
