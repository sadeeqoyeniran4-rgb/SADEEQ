require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");
const cors = require("cors");
const fetch = require("node-fetch"); // npm install node-fetch@2
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
const PORT = process.env.PORT || 3000;

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
    transformation: [{ width: 500, height: 500, crop: "fill" }],
  },
});

const upload = multer({ storage });

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ================== DATABASE CONFIG ==================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log("✅ Database connected"))
  .catch(err => console.warn("⚠️ Database not connected:", err.message));

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
    const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json(result.rows);
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
    const { cart, shipping } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Subtotal
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price * (item.quantity || 1),
      0
    );

    // Shipping fees
    let shippingCost = 0;
    if (shipping === "intra-state") shippingCost = 1500;
    else if (shipping === "inter-state") shippingCost = 3000;
    else if (shipping === "pickup") shippingCost = 0;

    // Optional discount logic (remove if not needed)
    const discount = 0.05; // 5%
    const discountAmount = subtotal * discount;

    // Grand total
    const grandTotal = subtotal - discountAmount + shippingCost;

    res.json({
      success: true,
      subtotal,
      shippingCost,
      discountAmount,
      grandTotal,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ================== VERIFY PAYMENT (FIXED) ==================
app.post("/api/verify-payment", async (req, res) => {
  try {
    const { reference, cart, customer, totals } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, message: "Missing payment reference" });
    }

    // ✅ Verify payment with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` },
    });
    const data = await response.json();

    if (!data.status || data.data.status !== "success") {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    // ✅ Save order
    const totalAmount = totals?.grandTotal || data.data.amount / 100;

    const orderResult = await pool.query(
      `INSERT INTO orders (customer_name, email, phone, address, total_amount, payment_reference)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        customer?.name || "N/A",
        customer?.email || "N/A",
        customer?.phone || "N/A",
        customer?.address || "N/A",
        totalAmount,
        reference,
      ]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of cart) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_name, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.name, item.quantity || item.qty || 1, item.price]
      );
    }

    res.json({ success: true, message: "✅ Payment verified and order saved!" });
  } catch (err) {
    console.error("❌ Verify payment error:", err);
    res.status(500).json({ success: false, message: "Server error verifying payment" });
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

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
