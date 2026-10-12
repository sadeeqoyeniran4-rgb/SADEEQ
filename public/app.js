document.addEventListener("DOMContentLoaded", () => {
  if (!document.body.classList.contains("storefront")) return;

  const API_BASE = String(window.API_BASE || window.location.origin).replace(/\/$/, "");
  const pageSize = 12;
  const currency = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });
  const productGrid = document.getElementById("product-grid");
  const resultsCount = document.getElementById("results-count");
  const pagination = document.getElementById("pagination");
  const spinner = document.getElementById("spinner-overlay");
  const categoryButtons = [...document.querySelectorAll(".filter-btn")];
  let products = [];
  let category = "all";
  let query = "";
  let currentPage = 1;
  let pageCount = 0;
  let totalProducts = 0;
  let catalogRequestId = 0;
  let catalogTimer;
  let checkoutTotals = null;
  let checkoutRequestId = 0;
  let activeDialog = null;
  let dialogTrigger = null;
  let toastTimer;

  const elements = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const setStatus = (element, message, isError = false) => {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", isError);
  };

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || "The request could not be completed.");
    }
    return data;
  }

  function getSavedCart() {
    try {
      const stored = JSON.parse(localStorage.getItem("cart") || "[]");
      if (!Array.isArray(stored)) return [];
      return stored
        .filter(item => item && item.id !== undefined && typeof item.name === "string")
        .map(item => ({
          id: item.id,
          name: item.name,
          price: Number(item.price),
          qty: Math.min(99, Math.max(1, Math.floor(Number(item.qty) || 1))),
        }))
        .filter(item => Number.isFinite(item.price) && item.price >= 0);
    } catch (error) {
      console.warn("Could not restore the saved shopping bag.", error);
      return [];
    }
  }

  let cart = getSavedCart();

  function saveCart() {
    try {
      localStorage.setItem("cart", JSON.stringify(cart));
    } catch (error) {
      console.warn("Could not save the shopping bag on this device.", error);
    }
  }

  function updateCart() {
    const cartItems = document.getElementById("cart-items");
    const cartTotal = document.getElementById("cart-total");
    const cartCount = document.getElementById("cart-count");
    const cartButton = document.getElementById("cartBtn");
    const checkoutButton = document.getElementById("checkout-btn");
    const itemLabel = document.getElementById("cart-item-label");
    const quantity = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    cartItems.replaceChildren();
    if (!cart.length) {
      const empty = document.createElement("p");
      empty.className = "empty-cart";
      empty.textContent = "Your bag is waiting for something lovely.";
      cartItems.append(empty);
    }

    cart.forEach((item, index) => {
      const row = document.createElement("article");
      row.className = "cart-item";
      const details = document.createElement("div");
      const name = document.createElement("h3");
      name.textContent = item.name;
      const price = document.createElement("p");
      price.textContent = currency.format(item.price);
      details.append(name, price);

      const controls = document.createElement("div");
      controls.className = "quantity-controls";
      controls.setAttribute("aria-label", `${item.name} quantity`);
      const decrease = document.createElement("button");
      decrease.type = "button";
      decrease.textContent = "−";
      decrease.setAttribute("aria-label", `Decrease ${item.name} quantity`);
      decrease.dataset.action = "decrease";
      decrease.dataset.index = String(index);
      decrease.disabled = item.qty <= 1;
      const quantityLabel = document.createElement("span");
      quantityLabel.textContent = String(item.qty);
      const increase = document.createElement("button");
      increase.type = "button";
      increase.textContent = "+";
      increase.setAttribute("aria-label", `Increase ${item.name} quantity`);
      increase.dataset.action = "increase";
      increase.dataset.index = String(index);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-item";
      remove.textContent = "Remove";
      remove.dataset.action = "remove";
      remove.dataset.index = String(index);
      controls.append(decrease, quantityLabel, increase, remove);
      row.append(details, controls);
      cartItems.append(row);
    });

    cartCount.textContent = String(quantity);
    cartButton.setAttribute("aria-label", `Open shopping bag, ${quantity} ${quantity === 1 ? "item" : "items"}`);
    itemLabel.textContent = quantity ? `(${quantity})` : "";
    cartTotal.textContent = currency.format(subtotal);
    checkoutButton.disabled = cart.length === 0;
    saveCart();
  }

  function showToast(message) {
    const toast = document.getElementById("cartToast");
    toast.querySelector(".toast-message").textContent = message;
    toast.classList.add("show");
    toast.setAttribute("aria-hidden", "false");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("show");
      toast.setAttribute("aria-hidden", "true");
    }, 3200);
  }

  function addToCart(product) {
    const existing = cart.find(item => String(item.id) === String(product.id));
    if (existing && existing.qty < 99) {
      existing.qty += 1;
    } else if (existing) {
      showToast("You can add up to 99 of the same product.");
    } else {
      cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
    }
    updateCart();
    showToast(`${product.name} added to your bag.`);
  }

  function showDialog(dialog, trigger) {
    if (!dialog) return;
    if (activeDialog) closeDialog(activeDialog);
    activeDialog = dialog;
    dialogTrigger = trigger;
    dialog.setAttribute("aria-hidden", "false");
    const firstControl = dialog.querySelector("button, input, select, textarea, a[href]");
    firstControl?.focus();
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    dialog.setAttribute("aria-hidden", "true");
    if (activeDialog === dialog) {
      activeDialog = null;
      dialogTrigger?.focus();
      dialogTrigger = null;
    }
  }

  function renderPagination(pageCount) {
    pagination.replaceChildren();
    if (pageCount <= 1) return;

    const addPageButton = (label, page, text, disabled = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "page-button";
      button.textContent = text;
      button.disabled = disabled;
      if (page === currentPage) button.setAttribute("aria-current", "page");
      button.setAttribute("aria-label", label);
      button.addEventListener("click", () => {
        currentPage = page;
        loadProducts();
        document.getElementById("shop-title").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      pagination.append(button);
    };

    addPageButton("Previous page", Math.max(1, currentPage - 1), "Previous", currentPage === 1);
    const pages = new Set([1, pageCount]);
    for (let page = Math.max(1, currentPage - 2); page <= Math.min(pageCount, currentPage + 2); page += 1) {
      pages.add(page);
    }
    let previousPage = 0;
    [...pages].sort((left, right) => left - right).forEach(page => {
      if (previousPage && page - previousPage > 1) {
        const gap = document.createElement("span");
        gap.className = "page-gap";
        gap.setAttribute("aria-hidden", "true");
        gap.textContent = "…";
        pagination.append(gap);
      }
      addPageButton(`Page ${page}`, page, String(page));
      previousPage = page;
    });
    addPageButton("Next page", Math.min(pageCount, currentPage + 1), "Next", currentPage === pageCount);
  }

  function renderProducts() {
    productGrid.replaceChildren();
    resultsCount.textContent = `${totalProducts} ${totalProducts === 1 ? "fragrance" : "fragrances"}`;
    if (!products.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const heading = document.createElement("h3");
      const hasFilters = category !== "all" || Boolean(query);
      heading.textContent = hasFilters ? "No scents found this time." : "Our collection is being refreshed.";
      const message = document.createElement("p");
      message.textContent = hasFilters
        ? "Try another search or choose a different fragrance type."
        : "Please check back shortly, or get in touch and we will be happy to help.";
      empty.append(heading, message);
      productGrid.append(empty);
    }

    products.forEach(product => {
      const card = document.createElement("article");
      card.className = "product-card";
      const imageWrap = document.createElement("div");
      imageWrap.className = "product-image-wrap";
      const image = document.createElement("img");
      image.src = product.image_url || "lofinda2.png";
      image.alt = product.name;
      image.width = 500;
      image.height = 500;
      image.sizes = "(max-width: 680px) 46vw, (max-width: 1000px) 30vw, 260px";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        image.src = "lofinda2.png";
        image.classList.add("image-fallback");
      }, { once: true });
      imageWrap.append(image);

      const copy = document.createElement("div");
      copy.className = "product-copy";
      const name = document.createElement("h3");
      name.textContent = product.name;
      const description = document.createElement("p");
      description.className = "product-description";
      description.textContent = product.description || "A fragrance to make your own.";
      const price = document.createElement("p");
      price.className = "product-price";
      price.textContent = currency.format(product.price);
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "button button-outline add-to-cart";
      addButton.textContent = "Add to bag";
      addButton.addEventListener("click", () => addToCart(product));
      copy.append(name, description, price, addButton);
      card.append(imageWrap, copy);
      productGrid.append(card);
    });

    productGrid.setAttribute("aria-busy", "false");
    renderPagination(pageCount);
  }

  async function loadProducts() {
    window.clearTimeout(catalogTimer);
    const requestId = ++catalogRequestId;
    spinner.setAttribute("aria-hidden", "false");
    productGrid.setAttribute("aria-busy", "true");
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        category,
      });
      if (query) params.set("q", query);
      const data = await requestJson(`${API_BASE}/api/products?${params}`);
      if (requestId !== catalogRequestId) return;
      if (!data || !Array.isArray(data.products) || !data.pagination) {
        throw new Error("The collection is temporarily unavailable.");
      }
      products = data.products
        .map(product => ({
          id: product.id,
          name: String(product.name || "").trim(),
          description: String(product.description || ""),
          image_url: typeof product.image_url === "string" ? product.image_url : "",
          price: Number(product.price),
        }))
        .filter(product => product.id !== undefined && product.name && Number.isFinite(product.price) && product.price >= 0);
      currentPage = Number(data.pagination.page) || 1;
      pageCount = Number(data.pagination.pageCount) || 0;
      totalProducts = Number(data.pagination.total) || 0;
      renderProducts();
    } catch (error) {
      if (requestId !== catalogRequestId) return;
      console.error("Could not load the fragrance collection.", error);
      productGrid.replaceChildren();
      const message = document.createElement("p");
      message.className = "error-message";
      message.textContent = "We could not load the collection right now. Please refresh or try again in a moment.";
      productGrid.append(message);
      productGrid.setAttribute("aria-busy", "false");
      resultsCount.textContent = "";
      pagination.replaceChildren();
    } finally {
      if (requestId === catalogRequestId) spinner.setAttribute("aria-hidden", "true");
    }
  }

  function scheduleCatalogLoad() {
    window.clearTimeout(catalogTimer);
    catalogTimer = window.setTimeout(() => loadProducts(), 250);
  }

  function openCheckout() {
    if (!cart.length) return;
    checkoutRequestId += 1;
    const response = document.getElementById("checkoutResponse");
    const submit = document.getElementById("proceed-payment");
    checkoutTotals = null;
    document.getElementById("shipping").value = "";
    document.getElementById("checkout-total").textContent = "Choose a delivery method to see your total.";
    setStatus(response, "");
    submit.disabled = true;
    document.getElementById("cart-modal").setAttribute("aria-hidden", "true");
    activeDialog = null;
    dialogTrigger = document.getElementById("checkout-btn");
    showDialog(document.getElementById("checkout-modal"), dialogTrigger);
  }

  async function updateCheckoutTotal() {
    const requestId = ++checkoutRequestId;
    const shipping = document.getElementById("shipping").value;
    const totalBox = document.getElementById("checkout-total");
    const submit = document.getElementById("proceed-payment");
    const response = document.getElementById("checkoutResponse");
    checkoutTotals = null;
    submit.disabled = true;
    if (!shipping) {
      totalBox.textContent = "Choose a delivery method to see your total.";
      return;
    }

    totalBox.textContent = "Calculating your total…";
    try {
      const data = await requestJson(`${API_BASE}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart: cart.map(item => ({ id: item.id, quantity: item.qty })),
          shipping,
        }),
      });
      if (requestId !== checkoutRequestId) return;
      if (!data.success || !Number.isFinite(Number(data.grandTotal))) {
        throw new Error("We could not calculate your total. Please try again.");
      }
      checkoutTotals = data;
      totalBox.replaceChildren();
      [
        ["Items", data.subtotal],
        ["Delivery", data.shippingCost],
        ...(Number(data.discount) > 0 ? [["Discount", -Number(data.discount)]] : []),
        ["Total", data.grandTotal],
      ].forEach(([label, amount], index, rows) => {
        const row = document.createElement("p");
        row.className = index === rows.length - 1 ? "checkout-grand-total" : "";
        const rowLabel = document.createElement("span");
        rowLabel.textContent = label;
        const value = document.createElement("strong");
        value.textContent = currency.format(Number(amount));
        row.append(rowLabel, value);
        totalBox.append(row);
      });
      setStatus(response, "");
      submit.disabled = false;
    } catch (error) {
      if (requestId !== checkoutRequestId) return;
      totalBox.textContent = "Your total is not available yet.";
      setStatus(response, error.message, true);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    const response = document.getElementById("checkoutResponse");
    const submit = document.getElementById("proceed-payment");
    if (!checkoutTotals || !document.getElementById("shipping").value) {
      setStatus(response, "Choose a delivery method and wait for the total before continuing.", true);
      return;
    }
    if (!window.PaystackPop || !window.PAYSTACK_KEY) {
      setStatus(response, "Secure checkout is temporarily unavailable. Please contact us on WhatsApp to place your order.", true);
      return;
    }

    const customer = {
      name: document.getElementById("checkout-name").value.trim(),
      email: document.getElementById("checkout-email").value.trim(),
      phone: document.getElementById("checkout-phone").value.trim(),
      address: document.getElementById("address").value.trim(),
      shipping: document.getElementById("shipping").value,
    };
    submit.disabled = true;
    setStatus(response, "Opening secure payment…");
    let paymentCallbackReceived = false;
    try {
      const handler = window.PaystackPop.setup({
        key: window.PAYSTACK_KEY,
        email: customer.email,
        amount: Math.round(Number(checkoutTotals.grandTotal) * 100),
        currency: "NGN",
        ref: `LOFINDA-${Date.now()}`,
        callback: async payment => {
          paymentCallbackReceived = true;
          setStatus(response, "Confirming your payment…");
          try {
            const data = await requestJson(`${API_BASE}/api/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reference: payment.reference,
                cart: cart.map(item => ({ id: item.id, quantity: item.qty })),
                customer,
                shipping: customer.shipping,
              }),
            });
            if (!data.success) throw new Error(data.message || "Payment confirmation failed.");
            localStorage.setItem("lastOrder", JSON.stringify({
              reference: payment.reference,
              cart: data.items.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                qty: item.quantity,
              })),
              customer,
              totals: data.totals,
            }));
            localStorage.removeItem("cart");
            window.location.assign("thankyou.html");
          } catch (error) {
            setStatus(response, `${error.message} Please contact us with your payment reference: ${payment.reference}`, true);
          }
        },
        onClose: () => {
          if (paymentCallbackReceived) return;
          setStatus(response, "Payment was not completed. Your bag is saved; you can try again when ready.");
          submit.disabled = false;
        },
      });
      handler.openIframe();
    } catch (error) {
      setStatus(response, error.message || "Secure checkout could not be opened. Please try again.", true);
      submit.disabled = false;
    }
  }

  async function loadReviews() {
    const reviewCards = document.getElementById("review-cards");
    reviewCards.setAttribute("aria-busy", "true");
    try {
      const data = await requestJson(`${API_BASE}/api/reviews`);
      if (!Array.isArray(data)) throw new Error("Customer reviews are temporarily unavailable.");
      reviewCards.replaceChildren();
      if (!data.length) {
        const empty = document.createElement("p");
        empty.className = "reviews-empty";
        empty.textContent = "Be the first to share a kind word.";
        reviewCards.append(empty);
      }
      data.slice(0, 6).forEach(review => {
        const card = document.createElement("article");
        card.className = "review-card";
        const stars = document.createElement("p");
        stars.className = "review-stars";
        const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
        stars.textContent = `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
        stars.setAttribute("aria-label", `${rating} out of 5 stars`);
        const message = document.createElement("blockquote");
        message.textContent = `“${String(review.message || "")}”`;
        const author = document.createElement("p");
        author.className = "review-author";
        author.textContent = `— ${String(review.name || "Customer")}${review.location ? `, ${review.location}` : ""}`;
        card.append(stars, message, author);
        reviewCards.append(card);
      });
    } catch (error) {
      console.error("Could not load customer reviews.", error);
      const message = document.createElement("p");
      message.className = "reviews-empty";
      message.textContent = "Customer reviews are unavailable right now.";
      reviewCards.replaceChildren(message);
    } finally {
      reviewCards.setAttribute("aria-busy", "false");
    }
  }

  updateCart();
  loadProducts();
  loadReviews();
  document.getElementById("current-year").textContent = String(new Date().getFullYear());

  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
    navLinks.classList.toggle("open", !isOpen);
  });
  elements("a", navLinks).forEach(link => link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
  }));

  const searchBar = document.getElementById("search-bar");
  const searchToggle = document.getElementById("search-icon");
  const searchInput = document.getElementById("search-input");
  const searchClear = document.getElementById("search-btn");
  searchToggle.addEventListener("click", () => {
    const isOpen = !searchBar.hidden;
    searchBar.hidden = isOpen;
    searchToggle.setAttribute("aria-expanded", String(!isOpen));
    if (!isOpen) searchInput.focus();
    else {
      searchInput.value = "";
      query = "";
      currentPage = 1;
      searchClear.hidden = true;
      loadProducts();
    }
  });
  searchInput.addEventListener("input", () => {
    query = searchInput.value.trim();
    currentPage = 1;
    searchClear.hidden = !searchInput.value;
    scheduleCatalogLoad();
  });
  searchBar.addEventListener("submit", event => event.preventDefault());
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    query = "";
    currentPage = 1;
    searchClear.hidden = true;
    loadProducts();
    searchInput.focus();
  });

  categoryButtons.forEach(button => button.addEventListener("click", () => {
    category = button.dataset.category;
    currentPage = 1;
    categoryButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    loadProducts();
  }));

  document.getElementById("cartBtn").addEventListener("click", event => showDialog(document.getElementById("cart-modal"), event.currentTarget));
  document.getElementById("close-cart").addEventListener("click", () => closeDialog(document.getElementById("cart-modal")));
  document.getElementById("cart-modal").addEventListener("click", event => {
    if (event.target.id === "cart-modal") closeDialog(event.currentTarget);
  });
  document.getElementById("cart-items").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const item = cart[Number(button.dataset.index)];
    if (!item) return;
    if (button.dataset.action === "increase") item.qty = Math.min(99, item.qty + 1);
    if (button.dataset.action === "decrease") item.qty = Math.max(1, item.qty - 1);
    if (button.dataset.action === "remove") cart.splice(Number(button.dataset.index), 1);
    updateCart();
  });

  document.getElementById("checkout-btn").addEventListener("click", openCheckout);
  document.getElementById("checkout-close").addEventListener("click", () => closeDialog(document.getElementById("checkout-modal")));
  document.getElementById("shipping").addEventListener("change", updateCheckoutTotal);
  document.getElementById("checkout-form").addEventListener("submit", submitPayment);

  const aboutModal = document.getElementById("about-modal");
  const contactModal = document.getElementById("contact-modal");
  const openContentDialog = dialog => event => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    const trigger = window.matchMedia("(max-width: 680px)").matches
      ? menuToggle
      : event.currentTarget;
    showDialog(dialog, trigger);
  };
  document.getElementById("aboutBtn").addEventListener("click", openContentDialog(aboutModal));
  document.getElementById("contactBtn").addEventListener("click", openContentDialog(contactModal));
  document.getElementById("close-about").addEventListener("click", () => closeDialog(aboutModal));
  document.getElementById("close-contact").addEventListener("click", () => closeDialog(contactModal));
  [aboutModal, contactModal, document.getElementById("checkout-modal")].forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });
  document.addEventListener("keydown", event => {
    if (!activeDialog) return;
    if (event.key === "Escape") {
      closeDialog(activeDialog);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = elements("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]", activeDialog)
      .filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.getElementById("reviewForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const response = document.getElementById("reviewResponse");
    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    setStatus(response, "Sending your review…");
    try {
      const data = await requestJson(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.getElementById("review-name").value.trim(),
          location: document.getElementById("review-location").value.trim(),
          message: document.getElementById("review-message").value.trim(),
          rating: Number(document.getElementById("review-rating").value),
        }),
      });
      if (!data.success) throw new Error(data.message || "Your review could not be sent.");
      form.reset();
      setStatus(response, data.message || "Thank you for sharing your review.");
      await loadReviews();
    } catch (error) {
      setStatus(response, error.message || "Your review could not be sent. Please try again.", true);
    } finally {
      submit.disabled = false;
    }
  });

  document.querySelector("#cartToast .toast-close").addEventListener("click", () => {
    const toast = document.getElementById("cartToast");
    toast.classList.remove("show");
    toast.setAttribute("aria-hidden", "true");
    window.clearTimeout(toastTimer);
  });
});
