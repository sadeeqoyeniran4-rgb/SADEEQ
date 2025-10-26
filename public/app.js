document.addEventListener("DOMContentLoaded", () => {

  // ---------------- CONTACT FORM ----------------
  const form = document.getElementById("contactForm");
  const formResponse = document.getElementById("formResponse");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = {
        name: document.getElementById("contact-name").value,
        email: document.getElementById("contact-email").value,
        message: document.getElementById("message").value,
      };

      try {
        const res = await fetch(`${window.API_BASE}/api/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        formResponse.textContent = data.message;
        formResponse.style.color = data.success ? "green" : "red";
        if (data.success) form.reset();
      } catch {
        formResponse.textContent = "Something went wrong. Please try again.";
        formResponse.style.color = "red";
      }
    });
  }

  // ---------------- CART SYSTEM ----------------
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartItemsEl = document.getElementById("cart-items");
  const cartTotalEl = document.getElementById("cart-total");
  const cartCountEl = document.getElementById("cart-count");
  const cartBtn = document.getElementById("cartBtn");
  const cartModal = document.getElementById("cart-modal");
  const closeCart = document.getElementById("close-cart");
  const checkoutBtn = document.getElementById("checkout-btn");
  const checkoutTotalEl = document.getElementById("checkout-total");

  const saveCart = () => localStorage.setItem("cart", JSON.stringify(cart));

  function updateCartUI() {
    if (!cartItemsEl) return;
    cartItemsEl.innerHTML = "";
    let total = 0, count = 0;

    cart.forEach((item, i) => {
      total += item.price * item.qty;
      count += item.qty;
      const div = document.createElement("div");
      div.className = "cart-item";
      div.innerHTML = `
        <span>${item.name} × ${item.qty} — ₦${(item.price * item.qty).toLocaleString()}</span>
        <button class="remove" data-i="${i}">×</button>`;
      cartItemsEl.appendChild(div);
    });

    cartTotalEl.textContent = `₦${total.toLocaleString()}`;
    if (checkoutTotalEl) checkoutTotalEl.textContent = `₦${total.toLocaleString()}`;
    if (cartCountEl) cartCountEl.textContent = count;
    saveCart();
  }

  function addToCart(product) {
    const found = cart.find((i) => i.id === product.id);
    found ? found.qty++ : cart.push({ ...product, qty: 1 });
    updateCartUI();
  }

  // Remove item
  if (cartItemsEl) {
    cartItemsEl.addEventListener("click", (e) => {
      if (e.target.classList.contains("remove")) {
        cart.splice(e.target.dataset.i, 1);
        updateCartUI();
      }
    });
  }

  // Toggle cart modal
  if (cartBtn)
    cartBtn.addEventListener("click", (e) => {
      e.preventDefault();
      cartModal.classList.add("open");
    });

  if (closeCart)
    closeCart.addEventListener("click", (e) => {
      e.preventDefault();
      cartModal.classList.remove("open");
    });

  window.addEventListener("click", (e) => {
    if (e.target === cartModal) cartModal.classList.remove("open");
  });

  // Proceed to Checkout
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (cart.length === 0) return alert("Your cart is empty!");
      cartModal.classList.remove("open");
      window.location.href = "checkout.html";
    });
  }

  updateCartUI();
  window.addToCart = addToCart;

  // ---------------- PRODUCTS ----------------
  const productsContainer = document.getElementById("product-grid");
  const categoryButtons = document.querySelectorAll(".filter-btn");

  async function loadProducts() {
    if (!productsContainer) return;
    try {
      const res = await fetch(`${window.API_BASE}/api/products`);
      const products = await res.json();
      productsContainer.innerHTML = "";
      products.forEach((p) => {
        const category = (p.description || "uncategorized").toLowerCase().replace(/\s+|\/+/g, "-");
        const card = document.createElement("div");
        card.className = "product-card";
        card.dataset.category = category;
        card.innerHTML = `
          <img src="${p.image_url || "default.jpg"}" alt="${p.name}" loading="lazy">
          <h3>${p.name}</h3>
          <p>${p.description || ""}</p>
          <p class="price">₦${Number(p.price).toLocaleString()}</p>
          <button class="add-to-cart" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">Add to Cart</button>`;
        productsContainer.appendChild(card);
      });
      document.querySelectorAll(".add-to-cart").forEach((btn) =>
        btn.addEventListener("click", () => {
          addToCart({
            id: +btn.dataset.id,
            name: btn.dataset.name,
            price: +btn.dataset.price,
          });
        })
      );
    } catch (err) {
      console.error("❌ Error loading products:", err);
      productsContainer.innerHTML = "<p class='error-msg'>Unable to load products at the moment.</p>";
    }
  }

  loadProducts();

  // ---------------- CATEGORY FILTER ----------------
  categoryButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      const selected = btn.dataset.category;
      categoryButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".product-card").forEach((card) => {
        card.style.display =
          selected === "all" || card.dataset.category.includes(selected)
            ? "block"
            : "none";
      });
    })
  );

});

loadProducts();

// 🔐 ADMIN LOGIN
// ============================
/*const adminLoginForm = document.getElementById("adminLoginForm");
const loginResponse = document.getElementById("loginResponse");
const adminSection = document.getElementById("admin-section");
const adminLoginModal = document.getElementById("admin-login-modal");

// If token exists, show admin section automatically
const savedToken = localStorage.getItem("adminToken");
if (savedToken) {
  adminSection.style.display = "block";
  adminLoginModal.style.display = "none";
}

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("admin-password").value;

    try {
      const res = await fetch(`${window.API_BASE}/api/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem("adminToken", data.token);
        loginResponse.textContent = "Login successful!";
        loginResponse.style.color = "green";
        adminSection.style.display = "block";
        adminLoginModal.style.display = "none";
      } else {
        loginResponse.textContent = data.error || "Invalid password";
        loginResponse.style.color = "red";
      }
    } catch (err) {
      console.error("Login failed:", err);
      loginResponse.textContent = "Error connecting to server";
      loginResponse.style.color = "red";
    }
  });
}


  // ---------------- ADMIN ADD PRODUCT ----------------
  // ============================
// 🛍️ PRODUCT UPLOAD
// ============================
const productForm = document.getElementById("productForm");

if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("adminToken");
    if (!token) {
      alert("You must log in first.");
      return;
    }

    // 1️⃣ Upload Image First
    const imageFile = document.getElementById("productImage").files[0];
    if (!imageFile) {
      alert("Please select an image.");
      return;
    }

    const uploadData = new FormData();
    uploadData.append("image", imageFile);

    try {
      const uploadRes = await fetch(`${window.API_BASE}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: uploadData,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error("Image upload failed:", errText);
        alert("❌ Image upload failed");
        return;
      }

      const uploadResult = await uploadRes.json();
      const imageUrl = uploadResult.imageUrl;

      // 2️⃣ Upload Product Info
      const name = document.getElementById("productName").value;
      const price = document.getElementById("productPrice").value;
      const description = document.getElementById("productDescription").value;

      const productData = { name, price, description, image: imageUrl };

      const res = await fetch(`${window.API_BASE}/api/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productData),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Product creation failed:", errorText);
        alert("❌ Failed to create product.");
        return;
      }

      alert("✅ Product created successfully!");
      productForm.reset();
      loadProducts(); // refresh product list
    } catch (err) {
      console.error("Error uploading product:", err);
      alert("❌ Error uploading product.");
    }
  });
}
*/
// ---------------- CHECKOUT MODAL ----------------
document.addEventListener("DOMContentLoaded", () => {
  const checkoutBtn = document.getElementById("checkout-btn"),
    checkoutModal = document.getElementById("checkout-modal"),
    checkoutClose = document.getElementById("checkout-close"),
    shippingSelect = document.getElementById("shipping"),
    checkoutForm = document.getElementById("checkout-form"),
    checkoutTotalEl = document.getElementById("checkout-total"),
    cartSidebar = document.getElementById("cart-sidebar");

  let checkoutTotals = {};
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  // ✅ Proceed to Checkout (open modal)
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
      }

      try {
        const res = await fetch(`${window.API_BASE}/api/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart }),
        });
        const data = await res.json();

        if (data.success) {
          checkoutTotals = data;
          checkoutTotalEl.textContent = `₦${data.grandTotal.toLocaleString()}`;
          cartSidebar.classList.remove("open");
          checkoutModal.style.display = "flex";
        } else {
          alert("Error calculating total");
        }
      } catch (err) {
        console.error("Checkout error:", err);
        alert("Checkout error — please try again.");
      }
    });
  }

  // ✅ Close modal
  if (checkoutClose) {
    checkoutClose.addEventListener("click", () => {
      checkoutModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === checkoutModal) checkoutModal.style.display = "none";
  });

  // ✅ Update total on shipping change
  if (shippingSelect) {
    shippingSelect.addEventListener("change", async (e) => {
      try {
        const res = await fetch(`${window.API_BASE}/api/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart, shipping: e.target.value }),
        });
        const { success, grandTotal, total, shippingCost } = await res.json();

        if (success) {
          checkoutTotals = { grandTotal, total, shippingCost, success: true };
          checkoutTotalEl.textContent = `₦${grandTotal.toLocaleString()}`;
        }
      } catch (err) {
        console.error("Error updating total with shipping:", err);
      }
    });
  }
  // ---------------- ERROR MODAL ----------------
  function showErrorModal(message) {
    let modal = document.createElement("div");
    modal.id = "errorModal";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgba(0,0,0,0.5)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "9999";

    modal.innerHTML = `
      <div style="background:white; padding:20px; border-radius:12px; max-width:400px; text-align:center; box-shadow:0 5px 15px rgba(0,0,0,0.3);">
        <h2 style="color:#d9534f; margin-bottom:15px;">Transaction Failed</h2>
        <p>${message}</p>
        <button id="closeErrorModal" style="margin-top:15px; padding:10px 20px; background:#d9534f; color:white; border:none; border-radius:6px; cursor:pointer;">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("closeErrorModal").addEventListener("click", () => {
      modal.remove();
    });
  }

  // ---------------- PAYSTACK + VERIFY PAYMENT ----------------
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("checkout-name").value.trim(),
        email = document.getElementById("checkout-email").value.trim(),
        phone = document.getElementById("checkout-phone").value.trim(),
        address = document.getElementById("address").value.trim(),
        shipping = document.getElementById("shipping").value || "pickup";

      if (!checkoutTotals.success || checkoutTotals.grandTotal <= 0) {
        return showErrorModal("Your cart is empty or totals not calculated!");
      }

      if (!name || !email || !phone || !address) {
        return showErrorModal("Please fill in all required fields!");
      }

      if (typeof PaystackPop === "undefined") {
        return showErrorModal("Payment system not loaded. Please refresh and try again.");
      }

        let handler = PaystackPop.setup({
          key: window.PAYSTACK_KEY,
        email,
        amount: checkoutTotals.grandTotal * 100,
        currency: "NGN",
        ref: "LOFINDA-" + Date.now(),
        callback: function (res) {
          // ✅ Call our backend to verify and save the order
            fetch(`${window.API_BASE}/api/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reference: res.reference,
              cart,
              customer: { name, email, phone, address, shipping },
              totals: checkoutTotals,
            }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.success) {
                localStorage.setItem(
                  "lastOrder",
                  JSON.stringify({
                    reference: res.reference,
                    cart,
                    customer: { name, email, phone, address, shipping },
                    totals: checkoutTotals,
                  })
                );
                cart = [];
                localStorage.removeItem("cart");
                window.location.href = "thankyou.html";
              } else {
                showErrorModal("❌ Payment verification failed.");
              }
            })
            .catch((err) => {
              console.error("Error verifying payment:", err);
              showErrorModal("❌ Error verifying payment.");
            });
        },
        onClose: function () {
          showErrorModal("Transaction was not completed. Please try again.");
        },
      });

      handler.openIframe();
    });
  }

  // ---------------- SEARCH ----------------
  const searchBar = document.getElementById("search-input"),
    searchBtn = document.getElementById("search-btn"),
    clearSearch = document.getElementById("clear-search");

  if (searchBar) {
    searchBar.addEventListener("input", () => {
      clearSearch.style.display = searchBar.value ? "block" : "none";
    });
  }
  if (clearSearch) {
    clearSearch.addEventListener("click", () => {
      searchBar.value = "";
      clearSearch.style.display = "none";
      document
        .querySelectorAll(".product-card")
        .forEach((c) => (c.style.display = "block"));
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      let q = searchBar.value.toLowerCase();
      document.querySelectorAll(".product-card").forEach((c) => {
        c.style.display = c
          .querySelector("h3")
          .textContent.toLowerCase()
          .includes(q)
          ? "block"
          : "none";
      });
    });
  }

  // ---------------- ABOUT MODAL ----------------
  const aboutModal = document.getElementById("about-modal"),
    openAbout = document.getElementById("aboutBtn"),
    closeAbout = document.getElementById("close-about");

  if (openAbout) {
    openAbout.addEventListener("click", (e) => {
      e.preventDefault();
      aboutModal.style.display = "flex";
    });
    closeAbout.addEventListener(
      "click",
      () => (aboutModal.style.display = "none")
    );
    window.addEventListener("click", (e) => {
      if (e.target === aboutModal) aboutModal.style.display = "none";
    });
  }

  // ---------------- CONTACT MODAL ----------------
  const contactModal = document.getElementById("contact-modal"),
    openContact = document.getElementById("contactBtn"),
    closeContact = document.getElementById("close-contact");

  if (openContact) {
    openContact.addEventListener("click", (e) => {
      e.preventDefault();
      contactModal.style.display = "flex";
    });
    closeContact.addEventListener(
      "click",
      () => (contactModal.style.display = "none")
    );
    window.addEventListener("click", (e) => {
      if (e.target === contactModal) contactModal.style.display = "none";
    });
  }
});
