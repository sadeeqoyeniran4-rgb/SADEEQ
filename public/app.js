document.addEventListener("DOMContentLoaded", () => {
 
 let currentPage = 1;
const productsPerPage = 30; // change as needed
let totalPages = 1;
let currentCategory = "all";
let currentSearchQuery = "";

  // ================= GLOBAL DISCOUNT CONFIG =================
const DISCOUNT = {
  active: false,
  percentage: 5, // 💰 20% OFF
  start: new Date("2025-10-28"),
  end: new Date("2025-11-15"),
};

// 🕒 Check if sale period is active
const today = new Date();
if (today >= DISCOUNT.start && today <= DISCOUNT.end) {
  DISCOUNT.active = true;
  console.log("🔥 Sale is active! Applying discount...");
} else {
  console.log("💤 No sale currently.");
}
// ================= SHOW DISCOUNT BANNER =================
const banner = document.getElementById("discount-banner");
const bannerPercent = document.getElementById("discount-percentage");

if (DISCOUNT.active && banner) {
  bannerPercent.textContent = `${DISCOUNT.percentage}%`;
  banner.style.display = "block";
} else if (banner) {
  banner.style.display = "none";
}

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
  const cartToastEl = document.getElementById("cartToast");
  let cartToast;

const toastEl = document.getElementById("cartToast");
if (toastEl) {
  cartToast = bootstrap.Toast.getOrCreateInstance(toastEl);
}

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
  const found = cart.find(i => i.id === product.id);
  found ? found.qty++ : cart.push({ ...product, qty: 1 });

  updateCartUI();

  if (cartToast) {
    cartToastEl.querySelector(".toast-body").textContent =
      `${product.name} added to cart 🎉`;
    cartToast.show();
  }
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

async function loadProducts(page = 1) {
  if (!productsContainer) return;
  showSpinner();

  try {
    const res = await fetch(`${window.API_BASE}/api/products`);
    const products = await res.json();

    // Filter based on category/search if you want (optional)
    let filtered = Array.from(products);

    // Category filter
    if (currentCategory && currentCategory !== "all") {
  filtered = filtered.filter(p =>
    (p.description || "")
      .toLowerCase()
      .replace(/\s+/g, "-") === currentCategory.toLowerCase()
  );
}


    // Search filter
    if (currentSearchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(currentSearchQuery)
      );
    }

    // Pagination logic
    totalPages = Math.ceil(filtered.length / productsPerPage);
    const start = (page - 1) * productsPerPage;
    const end = start + productsPerPage;
    const pageProducts = filtered.slice(start, end);

    productsContainer.innerHTML = "";

    pageProducts.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";

      let finalPrice = Number(p.price);
      if (DISCOUNT.active) finalPrice = p.price - (p.price * DISCOUNT.percentage) / 100;

      card.innerHTML = `
        <img src="${p.image_url || 'default.jpg'}" alt="${p.name}" loading="lazy">
        <h3>${p.name}</h3>
        <p>${p.description || ""}</p>
        ${DISCOUNT.active
          ? `<p class="price"><span class="old-price">₦${p.price.toLocaleString()}</span> <span class="new-price">₦${finalPrice.toLocaleString()}</span></p>
             <span class="discount-badge">-${DISCOUNT.percentage}% OFF</span>`
          : `<p class="price">₦${p.price.toLocaleString()}</p>`}
        <button class="add-to-cart" data-id="${p.id}" data-name="${p.name}" data-price="${finalPrice}">Add to Cart</button>
      `;
      productsContainer.appendChild(card);
    });

    document.querySelectorAll(".add-to-cart").forEach(btn =>
      btn.addEventListener("click", () => addToCart({
        id: +btn.dataset.id,
        name: btn.dataset.name,
        price: +btn.dataset.price
      }))
    );

    renderPagination(); // render page buttons

  } catch (err) {
    console.error("❌ Error loading products:", err);
    productsContainer.innerHTML = "<p class='error-msg'>Unable to load products.</p>";
  } finally {
    hideSpinner();
  }
}

loadProducts();

function renderPagination() {
  const paginationContainer = document.getElementById("pagination");
  if (!paginationContainer || totalPages <= 1) {
    paginationContainer.innerHTML = "";
    return;
  }

  // Bootstrap-like pagination wrapper
  paginationContainer.innerHTML = `<nav aria-label="Product pages">
      <ul class="pagination justify-content-center flex-wrap"></ul>
    </nav>`;

  const ul = paginationContainer.querySelector(".pagination");

  // Previous
  const prev = document.createElement("li");
  prev.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
  prev.innerHTML = `<a class="page-link" href="#">&laquo;</a>`;
  prev.onclick = e => {
    e.preventDefault();
    if (currentPage > 1) {
      currentPage--;
      loadProducts(currentPage);
    }
  };
  ul.appendChild(prev);

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement("li");
    li.className = `page-item ${i === currentPage ? "active" : ""}`;
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    li.onclick = e => {
      e.preventDefault();
      currentPage = i;
      loadProducts(currentPage);
    };
    ul.appendChild(li);
  }

  // Next
  const next = document.createElement("li");
  next.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`;
  next.innerHTML = `<a class="page-link" href="#">&raquo;</a>`;
  next.onclick = e => {
    e.preventDefault();
    if (currentPage < totalPages) {
      currentPage++;
      loadProducts(currentPage);
    }
  };
  ul.appendChild(next);
}


  // ---------------- CATEGORY FILTER ----------------
  categoryButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentCategory = btn.dataset.category; // Set selected category
    currentPage = 1;                        // Reset page
    categoryButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadProducts(currentPage);              // Reload products
  });
});

 // ---------------- CHECKOUT MODAL ----------------
const checkoutBtn = document.getElementById("checkout-btn");
const checkoutModal = document.getElementById("checkout-modal");
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
      // ✅ Single fetch — includes discount info
      const res = await fetch(`${window.API_BASE}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart,
          frontendDiscountApplied: DISCOUNT.active, // 👈 include discount flag
        }),
      });

      const data = await res.json();

      if (data.success) {
        checkoutTotals = data;
        checkoutTotalEl.innerHTML = `
          <div><strong>Subtotal:</strong> ₦${data.subtotal.toLocaleString()}</div>
          <div><strong>Shipping:</strong> ₦${data.shippingCost.toLocaleString()}</div>
          ${
            data.discount > 0
              ? `<div><strong>Discount:</strong> -₦${data.discount.toLocaleString()}</div>`
              : ""
          }
          <hr>
          <div><strong>Total:</strong> ₦${data.grandTotal.toLocaleString()}</div>
        `;
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

// Close modal
if (checkoutClose)
  checkoutClose.addEventListener("click", () => (checkoutModal.style.display = "none"));
window.addEventListener("click", (e) => {
  if (e.target === checkoutModal) checkoutModal.style.display = "none";
});

// Update total when shipping method changes
if (shippingSelect) {
  shippingSelect.addEventListener("change", async (e) => {
    const selected = e.target.value;
    if (!selected) return;

    checkoutTotalEl.style.opacity = "0.5";
    checkoutTotalEl.innerHTML = "<em>Calculating...</em>";

    try {
      const res = await fetch(`${window.API_BASE}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart,
          shipping: selected,
          frontendDiscountApplied: DISCOUNT.active, // 👈 include here too
        }),
      });

      const data = await res.json();

      if (data.success) {
        checkoutTotals = data;
        setTimeout(() => {
          checkoutTotalEl.style.transition = "all 0.4s ease";
          checkoutTotalEl.style.opacity = "1";
          checkoutTotalEl.innerHTML = `
            <div><strong>Subtotal:</strong> ₦${data.subtotal.toLocaleString()}</div>
            <div><strong>Shipping:</strong> ₦${data.shippingCost.toLocaleString()}</div>
            ${
              data.discount > 0
                ? `<div><strong>Discount:</strong> -₦${data.discount.toLocaleString()}</div>`
                : ""
            }
            <hr>
            <div style="font-size:1.1em;"><strong>Total:</strong> ₦${data.grandTotal.toLocaleString()}</div>
          `;
        }, 300);
      } else {
        checkoutTotalEl.innerHTML = "<span style='color:red;'>Error updating total.</span>";
      }
    } catch (err) {
      console.error("❌ Error updating total with shipping:", err);
      checkoutTotalEl.innerHTML = "<span style='color:red;'>Network error. Try again.</span>";
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

// Live search as user types
searchInput.addEventListener("input", () => {
  currentSearchQuery = searchInput.value.toLowerCase().trim();
  currentPage = 1;
  loadProducts(currentPage);

  // Toggle search/clear button
  if (currentSearchQuery) {
    searchBtn.classList.add("clear");
    searchIconInner.className = "bi bi-x"; // ❌
    searchBtn.style.display = "inline-flex";
  } else {
    searchBtn.classList.remove("clear");
    searchIconInner.className = "bi bi-search"; // 🔍
    searchBtn.style.display = "none";
  }
});

// Clear input when button is clicked
searchBtn.addEventListener("click", () => {
  if (searchBtn.classList.contains("clear")) {
    searchInput.value = "";
    currentSearchQuery = "";
    currentPage = 1;
    loadProducts(currentPage);

    searchBtn.classList.remove("clear");
    searchIconInner.className = "bi bi-search";
    searchBtn.style.display = "none";
    searchInput.focus();
  } else {
    // Optional: toggle search bar
    searchBar.classList.toggle("show");
    if (searchBar.classList.contains("show")) searchInput.focus();
  }
});

  
// ---------------- REVIEWS / SOCIAL PROOF ----------------
const reviewForm = document.getElementById("reviewForm");
const reviewResponse = document.getElementById("reviewResponse");
const socialProofEl = document.getElementById("social-proof");
const API_BASE = window.API_BASE; // make sure this is set globally

// Load reviews safely
async function loadSocialProof() {
  const socialProofEl = document.getElementById("review-cards");
  if (!socialProofEl) return;

  try {
    const res = await fetch(`${API_BASE}/api/reviews`);
    const reviews = await res.json();

    socialProofEl.innerHTML = reviews.map(r => `
      <div class="col-md-4">
        <div class="card h-100 shadow-sm">
          <div class="card-body">
            <p class="card-text">“${r.message}”</p>
            <h6 class="card-subtitle mb-2 text-muted">– ${r.name}${r.location ? ", " + r.location : ""}</h6>
            <div class="text-warning">
              ${'<i class="bi bi-star-fill"></i>'.repeat(r.rating)}
              ${'<i class="bi bi-star"></i>'.repeat(5 - r.rating)}
            </div>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error("❌ Error loading reviews:", err);
    socialProofEl.innerHTML = "<p class='text-danger'>Unable to load reviews.</p>";
  }
}

if (reviewForm) {
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = {
      name: document.getElementById("review-name").value,
      location: document.getElementById("review-location").value,
      message: document.getElementById("review-message").value,
      rating: +document.getElementById("review-rating").value
    };
    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (reviewResponse) {
        reviewResponse.textContent = data.message;
        reviewResponse.style.color = data.success ? "green" : "red";
      }
      if (data.success) {
        reviewForm.reset();
        loadSocialProof(); // refresh reviews
      }
    } catch {
      if (reviewResponse) {
        reviewResponse.textContent = "Something went wrong. Try again.";
        reviewResponse.style.color = "red";
      }
    }
  });
}

// Load reviews on page load
loadSocialProof();

// ---------------- RECENT PURCHASE (REAL ORDERS) ----------------
const recentPurchaseEl = document.getElementById("recent-purchase");
let recentOrders = [];

// Fetch recent orders from backend
async function loadRecentOrders() {
  try {
    const res = await fetch(`${window.API_BASE}/api/orders`);
    const data = await res.json();

    if (data.success && data.orders.length > 0) {
      recentOrders = data.orders;
    }
  } catch (err) {
    console.error("❌ Error fetching recent orders:", err);
  }
}

// Show a random recent purchase
function showRecentPurchaseFromOrders() {
  if (!recentPurchaseEl || recentOrders.length === 0) return;

  // Pick a random order
  const order = recentOrders[Math.floor(Math.random() * recentOrders.length)];

  // Pick a random item from that order
  if (!order.items || order.items.length === 0) return;
  const item = order.items[Math.floor(Math.random() * order.items.length)];

  // Display notification
  recentPurchaseEl.textContent = `${order.customer_name} just bought ${item.product_name}! 🎉`;
  recentPurchaseEl.style.display = "block";

  setTimeout(() => (recentPurchaseEl.style.display = "none"), 5000);
}

// Initial fetch
loadRecentOrders();

// Randomize notification every 12 seconds
setInterval(showRecentPurchaseFromOrders, 12000);

// Optional: refresh recent orders every 60 seconds to catch new orders
setInterval(loadRecentOrders, 60000);

const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});


    // Close menu when clicking a link
    document.querySelectorAll("#nav-links a").forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
      });
    });
 
    function showModal(id) {
    document.getElementById(id).style.display = "block";
  }
  function closeModal(id) {
    document.getElementById(id).style.display = "none";
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

  document.addEventListener("click", (e) => {
  if (
    !searchBar?.contains(e.target) &&
    !searchIcon?.contains(e.target) &&
    !cartModal?.contains(e.target) &&
    !cartBtn?.contains(e.target) &&
    !navLinks?.contains(e.target) &&
    !hamburger?.contains(e.target)
  ) {
    searchBar?.classList.remove("show");
    cartModal?.classList.remove("open");
    navLinks?.classList.remove("open");
  }
});

function showSpinner() {
  document.getElementById("spinner-overlay").classList.remove("d-none");
}

function hideSpinner() {
  document.getElementById("spinner-overlay").classList.add("d-none");
}
  
});