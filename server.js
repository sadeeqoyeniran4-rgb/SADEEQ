require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");
const cors = require("cors");
const nodeFetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { calculateCheckout, isValidReference, parseCart, validateCustomer } = require("./lib/commerce");

const app = express();
const PORT = process.env.PORT || 3000;
app.locals.db = null;
app.locals.paystackSecret = process.env.PAYSTACK_SECRET_KEY;
app.locals.paystackFetch = (url, options = {}) => nodeFetch(url, {
  ...options,
  headers: {
    ...options.headers,
    Authorization: `Bearer ${app.locals.paystackSecret || ""}`,
  },
});
const fetch = (url, options) => app.locals.paystackFetch(url, options);

// ================== CLOUDINARY CONFIG ==================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,  // e.g. "lofinda"
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "lofinda_products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ width: 500, height: 500, crop: "fill", quality: "auto", fetch_format: "auto" }],
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(bodyParser.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ================== DATABASE CONFIG ==================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: 5432,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

app.locals.db = pool;
pool.on("error", err => console.error("Unexpected database pool error:", err.message));

app.get("/health/live", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/health/ready", async (req, res) => {
  try {
    await app.locals.db.query("SELECT 1");
    res.status(200).json({ status: "ready", database: "connected" });
  } catch (err) {
    console.error("Database readiness check failed:", err.message);
    res.status(503).json({ status: "not_ready", database: "unavailable" });
  }
});

// ================== ADMIN AUTH ==================
app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET || "jwtsecretkey", {
      expiresIn: "1h",
    });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: "Invalid password" });
});

// ================== IMAGE UPLOAD (CLOUDINARY) ==================
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ success: false, message: "No image uploaded" });
  }
  res.json({ success: true, url: req.file.path });
});

// ================== CONTACT FORM ==================
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }
  console.log("📩 New Contact Message:", { name, email, message });
  res.json({ success: true, message: "Message received! We'll get back to you soon." });
});

// ================== PRODUCTS ==================
app.get("/api/products", async (req, res) => {
  try {
    const db = app.locals.db;
    const paginated = req.query.page !== undefined || req.query.limit !== undefined ||
      req.query.category !== undefined || req.query.q !== undefined;
    if (!paginated) {
      const result = await db.query("SELECT * FROM products ORDER BY id DESC");
      return res.json(result.rows);
    }

    const requestedPage = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 12 : Number(req.query.limit);
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 48) {
      return res.status(400).json({ error: "Page must be positive and limit must be between 1 and 48." });
    }

    const conditions = [];
    const values = [];
    const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 60) : "";
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }
    if (category && category !== "all") {
      values.push(`%${category}%`);
      conditions.push(
        `regexp_replace(lower(coalesce(description, '')), '[^a-z0-9]+', '-', 'g') LIKE $${values.length}`
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await db.query(
      `SELECT COUNT(*) AS total_count FROM products ${where}`,
      values
    );
    const total = Number(countResult.rows[0].total_count);
    const pageCount = Math.ceil(total / limit);
    const page = Math.min(requestedPage, Math.max(1, pageCount));
    const pageValues = [...values, limit, (page - 1) * limit];
    const result = await db.query(
      `SELECT * FROM products ${where} ORDER BY id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      pageValues
    );
    res.json({
      products: result.rows,
      pagination: { page, limit, total, pageCount },
    });
  } catch (err) {
    console.error("❌ Error fetching products:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/products", async (req, res) => {
  const { name, description, price, image_url } = req.body;
  if (!name || !price) {
    return res.status(400).json({ success: false, message: "Name and price are required." });
  }
  try {
    const result = await pool.query(
      "INSERT INTO products (name, description, price, image_url) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, description || "", price, image_url || ""]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error inserting product:", err);
    res.status(500).json({ error: "Insert failed" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    if (check.rowCount === 0) return res.status(404).json({ error: "Product not found" });

    await pool.query("DELETE FROM products WHERE id = $1", [id]);
    res.status(200).json({ success: true, message: "Product deleted" });
  } catch (err) {
    console.error("❌ Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

app.put("/api/products/:id", upload.single("image"), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    const image = req.file ? req.file.path : null;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    // 🧠 Check if product exists
    const existing = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // 🖼 Use existing image if no new one uploaded
    const newImage = image || existing.rows[0].image_url;

    // ✅ Update product
    await pool.query(
      "UPDATE products SET name=$1, description=$2, price=$3, image_url=$4 WHERE id=$5",
      [name, description, price, newImage, req.params.id]
    );

    res.json({ success: true, message: "Product updated successfully!" });
  } catch (err) {
    console.error("❌ Error updating product:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ================== CHECKOUT CALCULATION ==================
app.post("/api/checkout", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const cart = parseCart(body.cart);
    const ids = cart.map(item => item.id);
    const result = await app.locals.db.query(
      "SELECT id, name, price FROM products WHERE id = ANY($1::int[])",
      [ids]
    );
    const totals = calculateCheckout(result.rows, cart, body.shipping);
    res.json({ success: true, ...totals });
  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : "Server error calculating checkout",
    });
  }
});


// ================== VERIFY PAYMENT (FIXED) ==================
app.post("/api/verify-payment", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { reference, cart, customer, shipping } = body;
    if (!isValidReference(reference)) {
      return res.status(400).json({ success: false, message: "A valid payment reference is required." });
    }
    if (!app.locals.paystackSecret) {
      return res.status(503).json({ success: false, message: "Secure payment verification is not configured." });
    }

    const parsedCart = parseCart(cart);
    const customerDetails = validateCustomer(customer);
    const ids = parsedCart.map(item => item.id);
    const productsResult = await app.locals.db.query(
      "SELECT id, name, price FROM products WHERE id = ANY($1::int[])",
      [ids]
    );
    const totals = calculateCheckout(productsResult.rows, parsedCart, shipping);

    // ✅ Verify payment with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` },
    });
    const data = await response.json();
    if (!response.ok || !data.status || data.data?.status !== "success" ||
        data.data.reference !== reference) {
      return res.status(400).json({ success: false, message: "Payment verification failed." });
    }
    if (Number(data.data.amount) !== totals.amountMinor || data.data.currency !== "NGN") {
      return res.status(400).json({
        success: false,
        message: "The verified payment amount does not match this order. Please contact us with your payment reference.",
      });
    }

    const client = await app.locals.db.connect();
    let orderId;
    let alreadySaved = false;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [reference]);
      const existing = await client.query(
        "SELECT id FROM orders WHERE payment_reference = $1 LIMIT 1",
        [reference]
      );
      if (existing.rowCount) {
        orderId = existing.rows[0].id;
        alreadySaved = true;
      } else {
        const orderResult = await client.query(
          `INSERT INTO orders (customer_name, email, phone, address, total_amount, payment_reference)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [
            customerDetails.name,
            customerDetails.email,
            customerDetails.phone,
            customerDetails.address,
            totals.grandTotal,
            reference,
          ]
        );
        orderId = orderResult.rows[0].id;

        for (const item of totals.items) {
          await client.query(
            `INSERT INTO order_items (order_id, product_name, quantity, price)
             VALUES ($1, $2, $3, $4)`,
            [orderId, item.name, item.quantity, item.price]
          );
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: alreadySaved ? "Payment was already confirmed." : "Payment verified and order saved.",
      orderId,
      alreadySaved,
      items: totals.items,
      totals: {
        subtotal: totals.subtotal,
        shippingCost: totals.shippingCost,
        discount: totals.discount,
        grandTotal: totals.grandTotal,
      },
    });
  } catch (err) {
    console.error("❌ Verify payment error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : "Server error verifying payment",
    });
  }
});

// ================== FETCH ORDERS ==================
// ✅ Get all orders with items
app.get("/api/orders", async (req, res) => {
  try {
    const ordersResult = await pool.query("SELECT * FROM orders ORDER BY id DESC");

    const ordersWithItems = [];
    for (const order of ordersResult.rows) {
      const itemsResult = await pool.query(
        "SELECT product_name, quantity, price FROM order_items WHERE order_id = $1",
        [order.id]
      );

      ordersWithItems.push({
        ...order,
        items: itemsResult.rows,
      });
    }

    res.json({ success: true, orders: ordersWithItems });
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ success: false, message: "Error fetching orders" });
  }
});

// ================== DELETE ORDER ==================
app.delete("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (check.rowCount === 0) return res.status(404).json({ error: "Order not found" });

    await pool.query("DELETE FROM orders WHERE id = $1", [id]);
    res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

// ✅ Update order status (Confirm / Delivered)
app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// ================== REVIEWS ==================

// Get all reviews
app.get("/api/reviews", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM reviews ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching reviews:", err);
    res.status(500).json({ success: false, message: "Error fetching reviews" });
  }
});

// Submit a review
app.post("/api/reviews", async (req, res) => {
  const { name, message, rating, location } = req.body;

  if (!name || !message || !rating) {
    return res.status(400).json({ success: false, message: "Please fill in all required fields." });
  }

  try {
    const result = await pool.query(
      "INSERT INTO reviews (name, message, rating, location) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, message, rating, location || ""]
    );
    res.json({ success: true, message: "Thank you for your review!", review: result.rows[0] });
  } catch (err) {
    console.error("❌ Error saving review:", err);
    res.status(500).json({ success: false, message: "Error saving review." });
  }
});


// ================== START SERVER ==================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
