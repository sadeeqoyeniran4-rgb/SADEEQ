// app.js
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
        const res = await fetch("/api/contact", {
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
  const cartItemsEl = document.getElementById("cart-items"),
    cartTotalEl = document.getElementById("cart-total"),
    cartCountEl = document.getElementById("cart-count"),
    cartBtn = document.getElementById("cartBtn"),
    cartSidebar = document.getElementById("cart-sidebar"),
    closeCart = document.getElementById("close-cart"),
    checkoutTotalEl = document.getElementById("checkout-total");

  const saveCart = () => localStorage.setItem("cart", JSON.stringify(cart));
  const calcTotal = () =>
    cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  function updateCartUI() {
    if (!cartItemsEl) return;
    cartItemsEl.innerHTML = "";
    let total = 0,
      count = 0;

    cart.forEach((item, i) => {
      total += item.price * item.qty;
      count += item.qty;
      const div = document.createElement("div");
      div.className = "cart-item";
      div.innerHTML = `
        <span>${item.name} × ${item.qty} — ₦${(
        item.price * item.qty
      ).toLocaleString()}</span>
        <button class="remove" data-i="${i}">×</button>`;
      cartItemsEl.appendChild(div);
    });

    cartTotalEl.textContent = `₦${total.toLocaleString()}`;
    if (checkoutTotalEl)
      checkoutTotalEl.textContent = `₦${total.toLocaleString()}`;
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

  // Cart toggle
  if (cartBtn)
    cartBtn.addEventListener("click", () =>
      cartSidebar.classList.toggle("open")
    );
  if (closeCart)
    closeCart.addEventListener("click", () =>
      cartSidebar.classList.remove("open")
    );

  updateCartUI();

  // ---------------- FETCH PRODUCTS FROM API ----------------
  const productsContainer = document.getElementById("product-grid");

  async function loadProducts() {
    if (!productsContainer) return;
    try {
      const res = await fetch("/api/products");
      const products = await res.json();

      productsContainer.innerHTML = "";
      products.forEach((p) => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
          <img src="${p.image_url || "default.jpg"}" alt="${p.name}">
          <h3>${p.name}</h3>
          <p>${p.description || ""}</p>
          <p class="price">₦${Number(p.price).toLocaleString()}</p>
          <button class="add-to-cart" 
            data-id="${p.id}" 
            data-name="${p.name}" 
            data-price="${p.price}">Add to Cart</button>
        `;
        productsContainer.appendChild(card);
      });

      document.querySelectorAll(".add-to-cart").forEach((btn) =>
        btn.addEventListener("click", () => {
          const product = {
            id: +btn.dataset.id,
            name: btn.dataset.name,
            price: +btn.dataset.price,
          };
          addToCart(product);
        })
      );
    } catch (err) {
      console.error("❌ Error loading products:", err);
      productsContainer.innerHTML = "<p>Failed to load products.</p>";
    }
  }

  loadProducts();

  // ---------------- CHECKOUT MODAL ----------------
  const checkoutBtn = document.getElementById("checkout-btn"),
    checkoutModal = document.getElementById("checkout-modal"),
    checkoutClose = document.getElementById("checkout-close"),
    shippingSelect = document.getElementById("shipping"),
    checkoutForm = document.getElementById("checkout-form");

  let checkoutTotals = {}; // store backend totals

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", async () => {
      if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
      }
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart }),
        });
        const data = await res.json();
        if (data.success) {
          checkoutTotals = data; // save totals
          checkoutTotalEl.textContent = `₦${data.grandTotal.toLocaleString()}`;
          checkoutModal.style.display = "flex";
        } else {
          alert("Error calculating total");
        }
      } catch {
        alert("Checkout error");
      }
      cartSidebar.classList.remove("open");
    });
  }

  if (checkoutClose)
    checkoutClose.addEventListener(
      "click",
      () => (checkoutModal.style.display = "none")
    );
  window.addEventListener("click", (e) => {
    if (e.target === checkoutModal) checkoutModal.style.display = "none";
  });

  // Update total when shipping option changes
  if (shippingSelect) {
    shippingSelect.addEventListener("change", async (e) => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart, shipping: e.target.value }),
        });
        const { success, grandTotal, total, shippingCost } = await res.json();
        if (success) {
          checkoutTotals = { grandTotal, total, shippingCost, success: true };
          checkoutTotalEl.textContent = `₦${grandTotal.toLocaleString()}`;
        }
      } catch {
        console.error("Error updating total with shipping");
      }
    });
  }

  // ---------------- PAYSTACK CHECKOUT ----------------
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("checkout-name").value.trim(),
        email = document.getElementById("checkout-email").value.trim(),
        phone = document.getElementById("checkout-phone").value.trim(),
        address = document.getElementById("address").value.trim(),
        shipping = document.getElementById("shipping").value || "pickup";

      if (!checkoutTotals.success || checkoutTotals.grandTotal <= 0) {
        return alert("Your cart is empty or totals not calculated!");
      }

      if (!name || !email || !phone || !address) {
        return alert("Please fill in all required fields!");
      }

      if (typeof PaystackPop === "undefined") {
        alert("Payment system not loaded. Please refresh and try again.");
        return;
      }

      let handler = PaystackPop.setup({
        key: "pk_test_94839f29fb96befec516284f4acc28066435c509", // replace with live key in production
        email,
        amount: checkoutTotals.grandTotal * 100,
        currency: "NGN",
        ref: "LOFINDA-" + Date.now(),
        callback: function (res) {
          // ✅ Save order data for thankyou.html
          localStorage.setItem(
            "lastOrder",
            JSON.stringify({
              reference: res.reference,
              cart,
              customer: { name, email, phone, address, shipping },
              totals: checkoutTotals,
            })
          );

          // ✅ Clear cart
          cart = [];
          localStorage.removeItem("cart");

          // Redirect to thank you page
          window.location.href = "thankyou.html";
        },
        onClose: function () {
          alert("Transaction was not completed, payment window closed.");
        },
      });

      handler.openIframe();
    });
  }

  // ---------------- SEARCH BAR ----------------
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
