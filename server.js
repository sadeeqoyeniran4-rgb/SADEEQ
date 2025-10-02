require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");
const cors = require("cors");
const fetch = require("node-fetch"); // npm install node-fetch@2

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// 🔹 PostgreSQL connection (use .env for safety)
const pool = new Pool({
  user: process.env.DB_USER || "myuser",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "myshop",
  password: process.env.DB_PASS || "mypassword",
  port: process.env.DB_PORT || 5432,
});

// ✅ Contact form route
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });
  }
  console.log("📩 New Contact Message:", { name, email, message });
  return res.json({
    success: true,
    message: "Message received! We'll get back to you soon.",
  });
});

// ✅ Fetch all products
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching products:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Add a new product
app.post("/api/products", async (req, res) => {
  const { name, description, price, image_url } = req.body;
  if (!name || !price) {
    return res
      .status(400)
      .json({ success: false, message: "Name and price are required." });
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

// ✅ Checkout route (calculates totals + shipping)
app.post("/api/checkout", (req, res) => {
  const { cart, shipping } = req.body;
  if (!cart || cart.length === 0) {
    return res.json({ success: false, message: "Cart is empty" });
  }

  let total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // shipping costs
  let shippingCost = 0;
  if (shipping === "standard") shippingCost = 2000;
  else if (shipping === "express") shippingCost = 5000;

  const grandTotal = total + shippingCost;

  return res.json({ success: true, total, shippingCost, grandTotal });
});

// ✅ Payment verification (Paystack)
app.post("/api/verify-payment", async (req, res) => {
  const { reference, cart, customer, totals } = req.body;

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        },
      }
    );

    const data = await response.json();

    if (data.data && data.data.status === "success") {
      console.log("✅ Order confirmed:", { cart, customer, totals });

      // 👉 Save order into database
      try {
        const orderResult = await pool.query(
          `INSERT INTO orders (customer_name, customer_email, customer_phone, address, shipping, cart, total, shipping_cost, grand_total, reference, status) 
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            customer.name,
            customer.email,
            customer.phone,
            customer.address,
            customer.shipping,
            JSON.stringify(cart),
            totals.total,
            totals.shippingCost,
            totals.grandTotal,
            reference,
            "paid",
          ]
        );
        console.log("💾 Order saved:", orderResult.rows[0]);
      } catch (dbErr) {
        console.error("❌ Error saving order:", dbErr);
      }

      return res.json({ success: true, message: "Payment verified" });
    } else {
      return res.json({ success: false, message: "Verification failed" });
    }
  } catch (err) {
    console.error("❌ Error verifying payment:", err);
    return res.json({ success: false, message: "Error verifying payment" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
