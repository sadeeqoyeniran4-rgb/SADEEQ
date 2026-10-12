"use strict";

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const app = require("../server");

class FakeDatabase {
  constructor() {
    this.reset();
  }

  reset() {
    this.products = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      name: index === 0 ? "Amber fragrance" : `Fragrance ${index + 1}`,
      description: index < 3 ? "Designer perfume" : "Arabian fragrance",
      price: index === 0 ? "10000" : "2500",
      image_url: "",
    }));
    this.orders = [];
    this.orderItems = [];
    this.nextOrderId = 1;
    this.failReadiness = false;
    this.clientReleased = false;
  }

  filterProducts(sql, params) {
    let matches = this.products;
    if (sql.includes("name ILIKE")) {
      const term = String(params[0]).replace(/%/g, "").toLocaleLowerCase();
      matches = matches.filter(product =>
        `${product.name} ${product.description}`.toLocaleLowerCase().includes(term)
      );
    }
    const categoryParameter = sql.match(/regexp_replace\(lower\(coalesce\(description, ''\)\), '\[\^a-z0-9\]\+', '-', 'g'\) LIKE \$(\d+)/);
    if (categoryParameter) {
      const term = String(params[Number(categoryParameter[1]) - 1])
        .replace(/%/g, "")
        .toLocaleLowerCase();
      matches = matches.filter(product =>
        product.description.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").includes(term)
      );
    }
    return matches;
  }

  async query(sql, params = []) {
    if (sql === "SELECT 1") {
      if (this.failReadiness) throw new Error("database unavailable");
      return { rows: [{ "?column?": 1 }], rowCount: 1 };
    }
    if (sql.includes("SELECT COUNT(*) AS total_count FROM products")) {
      return { rows: [{ total_count: this.filterProducts(sql, params).length }], rowCount: 1 };
    }
    if (sql.includes("SELECT * FROM products") && sql.includes("LIMIT")) {
      const filtered = this.filterProducts(sql, params);
      const limit = params[params.length - 2];
      const offset = params[params.length - 1];
      return { rows: filtered.slice(offset, offset + limit), rowCount: Math.min(limit, filtered.length - offset) };
    }
    if (sql === "SELECT * FROM products ORDER BY id DESC") {
      return { rows: [...this.products].sort((a, b) => b.id - a.id), rowCount: this.products.length };
    }
    if (sql.includes("WHERE id = ANY($1::int[])")) {
      const ids = new Set(params[0]);
      return { rows: this.products.filter(product => ids.has(product.id)), rowCount: ids.size };
    }
    if (sql.includes("SELECT id FROM orders WHERE payment_reference = $1")) {
      const order = this.orders.find(item => item.payment_reference === params[0]);
      return { rows: order ? [{ id: order.id }] : [], rowCount: order ? 1 : 0 };
    }
    if (sql.includes("INSERT INTO orders")) {
      const order = {
        id: this.nextOrderId++,
        customer_name: params[0],
        email: params[1],
        phone: params[2],
        address: params[3],
        total_amount: params[4],
        payment_reference: params[5],
      };
      this.orders.push(order);
      return { rows: [{ id: order.id }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO order_items")) {
      this.orderItems.push({
        order_id: params[0],
        product_name: params[1],
        quantity: params[2],
        price: params[3],
      });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  async connect() {
    return {
      query: (sql, params) => this.query(sql, params),
      release: () => {
        this.clientReleased = true;
      },
    };
  }
}

const database = new FakeDatabase();
let server;
let baseUrl;
let paymentPayload;

before(async () => {
  app.locals.db = database;
  app.locals.paystackSecret = "test-secret";
  app.locals.paystackFetch = async () => ({
    ok: true,
    json: async () => paymentPayload,
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  database.reset();
  paymentPayload = {
    status: true,
    data: { status: "success", reference: "LOFINDA-123456", amount: 2100000, currency: "NGN" },
  };
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

async function request(path, options) {
  const response = await globalThis.fetch(`${baseUrl}${path}`, options);
  return { response, data: await response.json() };
}

const validCart = [{ id: 1, quantity: 2 }];
const validCustomer = {
  name: "Customer",
  email: "customer@example.com",
  phone: "+2348000000000",
  address: "Lagos",
};

test("liveness stays available when the database is unavailable and readiness reports it", async () => {
  database.failReadiness = true;
  const live = await request("/health/live");
  const ready = await request("/health/ready");

  assert.equal(live.response.status, 200);
  assert.deepEqual(live.data, { status: "ok" });
  assert.equal(ready.response.status, 503);
  assert.deepEqual(ready.data, { status: "not_ready", database: "unavailable" });
});

test("checkout uses database prices and rejects invalid shipping and quantities", async () => {
  const checkout = await request("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cart: [{ id: 1, quantity: 2, price: 1, name: "Forged price" }],
      shipping: "intra-state",
      frontendDiscountApplied: true,
    }),
  });
  const invalidShipping = await request("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cart: validCart, shipping: "free" }),
  });
  const invalidQuantity = await request("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cart: [{ id: 1, quantity: 100 }], shipping: "pickup" }),
  });

  assert.equal(checkout.response.status, 200);
  assert.equal(checkout.data.subtotal, 20000);
  assert.equal(checkout.data.shippingCost, 1000);
  assert.equal(checkout.data.discount, 0);
  assert.equal(checkout.data.grandTotal, 21000);
  assert.equal(checkout.data.items[0].name, "Amber fragrance");
  assert.equal(invalidShipping.response.status, 400);
  assert.equal(invalidQuantity.response.status, 400);
});

test("catalog supports bounded pagination and keeps the legacy admin response", async () => {
  const page = await request("/api/products?page=2&limit=12");
  const filtered = await request("/api/products?page=1&limit=12&category=designer-perfume&q=amber");
  const invalid = await request("/api/products?page=1&limit=100");
  const legacy = await request("/api/products");

  assert.equal(page.response.status, 200);
  assert.equal(page.data.products.length, 12);
  assert.deepEqual(page.data.pagination, { page: 2, limit: 12, total: 25, pageCount: 3 });
  assert.equal(filtered.data.pagination.total, 1);
  assert.equal(filtered.data.products[0].name, "Amber fragrance");
  assert.equal(invalid.response.status, 400);
  assert.ok(Array.isArray(legacy.data));
  assert.equal(legacy.data.length, 25);
});

test("payment verification rejects incorrect amount or currency without saving an order", async () => {
  paymentPayload.data.amount = 1;
  const invalid = await request("/api/verify-payment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reference: "LOFINDA-123456",
      cart: validCart,
      customer: validCustomer,
      shipping: "intra-state",
    }),
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(database.orders.length, 0);

  paymentPayload.data.amount = 2100000;
  paymentPayload.data.currency = "USD";
  const wrongCurrency = await request("/api/verify-payment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reference: "LOFINDA-123456",
      cart: validCart,
      customer: validCustomer,
      shipping: "intra-state",
    }),
  });
  assert.equal(wrongCurrency.response.status, 400);
  assert.equal(database.orders.length, 0);
});

test("verified payments save database-priced items once and release the transaction client", async () => {
  const payload = {
    reference: "LOFINDA-123456",
    cart: validCart,
    customer: validCustomer,
    shipping: "intra-state",
  };
  const first = await request("/api/verify-payment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const retry = await request("/api/verify-payment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(first.response.status, 200);
  assert.equal(first.data.totals.grandTotal, 21000);
  assert.equal(first.data.items[0].price, 10000);
  assert.equal(retry.response.status, 200);
  assert.equal(retry.data.alreadySaved, true);
  assert.equal(database.orders.length, 1);
  assert.equal(database.orderItems.length, 1);
  assert.equal(database.orders[0].total_amount, 21000);
  assert.equal(database.orderItems[0].product_name, "Amber fragrance");
  assert.equal(database.orderItems[0].quantity, 2);
  assert.equal(database.clientReleased, true);
});
