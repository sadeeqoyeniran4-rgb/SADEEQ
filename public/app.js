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
    cartModal.classList.add("open"); // ✅ changed from cartSidebar
  });

if (closeCart)
  closeCart.addEventListener("click", (e) => {
    e.preventDefault();
    cartModal.classList.remove("open"); // ✅ changed from cartSidebar
  });

  window.addToCart = addToCart;
  updateCartUI();

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

  // ---------------- CHECKOUT MODAL ----------------
  const checkoutModal = document.getElementById("checkout-modal");
  const checkoutBtn = document.getElementById("checkout-btn");
  const checkoutClose = document.getElementById("checkout-close");
  const shippingSelect = document.getElementById("shipping");
  const checkoutForm = document.getElementById("checkout-form");

  let checkoutTotals = {};

  if (checkoutBtn) {
  checkoutBtn.addEventListener("click", async () => {
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
        cartModal.classList.remove("open"); // ✅ changed from cartSidebar
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

  if (checkoutClose)
    checkoutClose.addEventListener("click", () => (checkoutModal.style.display = "none"));
  window.addEventListener("click", (e) => {
    if (e.target === checkoutModal) checkoutModal.style.display = "none";
  });

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

 const searchIcon = document.getElementById("search-icon");
const searchBar = document.getElementById("search-bar");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const searchIconInner = searchBtn.querySelector("i");

// Toggle search bar visibility
searchIcon.addEventListener("click", () => {
  searchBar.classList.toggle("show");
  if (searchBar.classList.contains("show")) searchInput.focus();
});

// Change button between 🔍 and ❌ depending on input
searchInput.addEventListener("input", () => {
  if (searchInput.value.trim()) {
    searchBtn.classList.add("clear");
    searchIconInner.className = "bi bi-x";
  } else {
    searchBtn.classList.remove("clear");
    searchIconInner.className = "bi bi-search";
  }
});

// Handle button click
searchBtn.addEventListener("click", () => {
  if (searchBtn.classList.contains("clear")) {
    // Clear mode
    searchInput.value = "";
    searchBtn.classList.remove("clear");
    searchIconInner.className = "bi bi-search";
    document.querySelectorAll(".product-card").forEach(c => (c.style.display = "block"));
  } else {
    // Search mode
    let q = searchInput.value.toLowerCase();
    document.querySelectorAll(".product-card").forEach(c => {
      c.style.display = c.querySelector("h3").textContent.toLowerCase().includes(q)
        ? "block"
        : "none";
    });
  }
});

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