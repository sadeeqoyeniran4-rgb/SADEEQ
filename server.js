require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");
const cors = require("cors");
const fetch = require("node-fetch"); // npm install node-fetch@2
const jwt = require("jsonwebtoken");
const multer = require("multer");

const app = express();
const API_BASE = "https://sadeeq-backend.onrender.com";
const PORT = process.env.PORT || 3000;

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ================== DATABASE ==================
// Initialize Postgres pool. Prefer DATABASE_URL (Heroku/Render style). Falls back to individual env vars.
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' }
    : {
        user: process.env.DB_USER || 'myuser',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'myshop',
        password: process.env.DB_PASS || 'mypassword',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
      }
);

// Quick DB connectivity check (non-blocking). Logs success or a helpful warning.
pool
  .connect()
  .then((client) => {
    client.release();
    console.log('✅ Database connected');
  })
  .catch((err) => {
    console.warn('⚠️  Database not connected — check your DATABASE_URL or DB_* env vars');
    console.warn(err && err.message ? err.message : err);
  });

// ================== ADMIN AUTH ==================
function verifyAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(403).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET || "jwtsecretkey", (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.admin = decoded;
    next();
  });
}

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  const ADMIN_PASS = process.env.ADMIN_PASS || "sadeeq123";

  if (password === ADMIN_PASS) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET || "jwtsecretkey", {
      expiresIn: "2h",
    });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: "Invalid password" });
});

// ================== IMAGE UPLOAD ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "public/uploads")),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.post("/api/upload", verifyAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
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
    const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching products:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/products", verifyAdmin, async (req, res) => {
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

app.delete("/api/products/:id", verifyAdmin, async (req, res) => {
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

app.put("/api/products/:id", verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, image_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products SET name = $1, description = $2, price = $3, image_url = $4 WHERE id = $5 RETURNING *`,
      [name, description, price, image_url, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Product not found" });

    res.json({ success: true, message: "Product updated", product: result.rows[0] });
  } catch (err) {
    console.error("❌ Error updating product:", err);
    res.status(500).json({ success: false, message: "Update failed" });
  }
});

// ================== CHECKOUT ==================
app.post("/api/checkout", async (req, res) => {
  try {
    const { cart, shipping } = req.body;
    if (!cart || cart.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    let shippingCost = 0;
    if (shipping === "intra-state") shippingCost = 3000;
    else if (shipping === "inter-state") shippingCost = 5000;
    else if (shipping === "pickup") shippingCost = 0;

    const grandTotal = total + shippingCost;

    res.json({ success: true, total, shippingCost, grandTotal });
  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ success: false, message: "Server error during checkout" });
  }
});

// ================== VERIFY PAYMENT & SAVE ORDER ==================
app.post("/api/verify-payment", async (req, res) => {
  const { reference, name, email, phone, address, cart, total_amount } = req.body;

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` },
    });
    const data = await response.json();

    if (data.status && data.data.status === "success") {
      // ✅ Save order
      const orderResult = await pool.query(
        `INSERT INTO orders (customer_name, email, phone, address, total_amount, payment_reference)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, email, phone, address, total_amount, reference]
      );

      const orderId = orderResult.rows[0].id;

      for (const item of cart) {
        await pool.query(
          `INSERT INTO order_items (order_id, product_name, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [orderId, item.name, item.quantity, item.price]
        );
      }

      return res.json({ success: true, message: "Order saved successfully" });
    } else {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }
  } catch (err) {
    console.error("❌ Error saving order:", err);
    res.status(500).json({ success: false, message: "Server error saving order" });
  }
});

// ================== FETCH ORDERS WITH ITEMS ==================
app.get("/api/orders", async (req, res) => {
  try {
    // Step 1: Get all orders
    const ordersResult = await pool.query(`
      SELECT id, customer_name, email, address, total_amount, status, created_at
      FROM orders
      ORDER BY created_at DESC
    `);

    const orders = ordersResult.rows;

    if (orders.length === 0) {
      return res.json([]);
    }

    // Step 2: Get order items (use product_name stored in order_items to avoid join errors)
    const orderIds = orders.map(o => o.id);
    const orderItemsResult = await pool.query(
      `SELECT order_id, product_name, quantity, price FROM order_items WHERE order_id = ANY($1)`,
      [orderIds]
    );

    const orderItems = orderItemsResult.rows;

    // Step 3: Group items by order
    const ordersWithItems = orders.map(order => {
      const itemsForOrder = orderItems.filter(item => item.order_id === order.id);
      return { ...order, items: itemsForOrder };
    });

    res.json(ordersWithItems);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ================== DELETE ORDER ==================
app.delete("/api/orders/:id", verifyAdmin, async (req, res) => {
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

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
