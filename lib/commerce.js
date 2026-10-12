"use strict";

const SHIPPING_COSTS = Object.freeze({
  "intra-state": 1000,
  "inter-state": 3000,
  pickup: 0,
});

class InputError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

function positiveInteger(value) {
  if (typeof value !== "number" &&
      !(typeof value === "string" && /^\d+$/.test(value.trim()))) {
    return NaN;
  }
  return Number(value);
}

function parseCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 30) {
    throw new InputError("Your bag must contain between 1 and 30 products.");
  }

  const seen = new Set();
  return cart.map(item => {
    const id = positiveInteger(item && item.id);
    const quantity = positiveInteger(item && (item.quantity ?? item.qty));
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new InputError("Your bag contains an invalid product.");
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new InputError("Product quantities must be between 1 and 99.");
    }
    if (seen.has(id)) {
      throw new InputError("Remove duplicate products from your bag and try again.");
    }
    seen.add(id);
    return { id, quantity };
  });
}

function calculateCheckout(products, cart, shipping) {
  if (!Object.hasOwn(SHIPPING_COSTS, shipping)) {
    throw new InputError("Choose a valid delivery method.");
  }

  const byId = new Map(products.map(product => [Number(product.id), product]));
  const items = cart.map(({ id, quantity }) => {
    const product = byId.get(id);
    const price = Number(product && product.price);
    if (!product || !Number.isFinite(price) || price < 0) {
      throw new InputError("A product in your bag is no longer available. Refresh the collection and try again.");
    }
    const unitPriceMinor = Math.round(price * 100);
    return {
      id,
      name: String(product.name || ""),
      quantity,
      price: unitPriceMinor / 100,
      lineTotal: (unitPriceMinor * quantity) / 100,
      unitPriceMinor,
    };
  });

  const subtotalMinor = items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);
  const shippingMinor = SHIPPING_COSTS[shipping] * 100;
  const grandTotalMinor = subtotalMinor + shippingMinor;
  if (!Number.isSafeInteger(grandTotalMinor)) {
    throw new InputError("Your total is outside the supported payment range.");
  }

  return {
    items: items.map(({ unitPriceMinor, ...item }) => item),
    subtotal: subtotalMinor / 100,
    shippingCost: shippingMinor / 100,
    discount: 0,
    grandTotal: grandTotalMinor / 100,
    amountMinor: grandTotalMinor,
  };
}

function validateCustomer(customer) {
  const fields = ["name", "email", "phone", "address"];
  if (!customer || fields.some(field => typeof customer[field] !== "string" || !customer[field].trim())) {
    throw new InputError("Please provide your name, email, phone number, and delivery address.");
  }
  if (customer.name.trim().length > 120 ||
      customer.email.trim().length > 254 ||
      customer.phone.trim().length > 40 ||
      customer.address.trim().length > 500 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
    throw new InputError("Please check your contact details and try again.");
  }
  return Object.fromEntries(fields.map(field => [field, customer[field].trim()]));
}

function isValidReference(reference) {
  return typeof reference === "string" &&
    reference.length >= 6 &&
    reference.length <= 100 &&
    /^[A-Za-z0-9._=-]+$/.test(reference);
}

module.exports = {
  calculateCheckout,
  InputError,
  isValidReference,
  parseCart,
  validateCustomer,
};
