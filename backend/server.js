// backend/server.js (CommonJS)
const express = require("express");
const cors = require("cors");

const app = express();

// --- middleware ---
app.use(cors({ origin: true }));
app.use(express.json());

// --- health ---
app.get("/health", (req, res) => {
  res.json({ ok: true, status: "ok", time: new Date().toISOString() });
});

// --- demo menu (adjust to real data later) ---
app.get(["/api/menu", "/menu"], (req, res) => {
  res.json({
    categories: [
      {
        id: "coffee",
        name: "Coffee",
        items: [
          { id: "americano", name: "Americano", description: "Double shot", price: 28 },
          { id: "flatwhite", name: "Flat White", description: "Velvety microfoam", price: 34 }
        ]
      },
      {
        id: "bakery",
        name: "Bakery",
        items: [{ id: "croissant", name: "Butter Croissant", description: "Fresh, flaky", price: 30 }]
      }
    ]
  });
});

// --- USERS (in-memory demo store) ---
let USER = { id: "demo", name: "Guest", phone: "", address: "", lat: null, lng: null, deliveryPreference: "delivery", notes: "", payment: {} };

// canonical
app.get("/api/user", (req, res) => res.json(USER));
app.put("/api/user", (req, res) => { USER = { ...USER, ...(req.body || {}) }; res.json(USER); });
app.post("/api/user", (req, res) => { USER = { ...USER, ...(req.body || {}) }; res.status(201).json(USER); });

// aliases to satisfy any fallbacks
app.get(["/api/users/me", "/api/profile", "/api/me", "/user", "/user/me", "/users/me", "/profile"], (r, s) => s.json(USER));
app.put(["/api/users/me", "/api/profile", "/api/me", "/user", "/user/me", "/profile", "/me"], (r, s) => { USER = { ...USER, ...(r.body || {}) }; s.json(USER); });
app.post(["/api/users", "/profile", "/user"], (r, s) => { USER = { ...USER, ...(r.body || {}) }; s.status(201).json(USER); });

// --- ORDERS (demo) ---
app.post(["/api/orders", "/api/order", "/orders", "/order"], (req, res) => {
  const { lines = [], customer = {}, delivery = {}, notes = "" } = req.body || {};
  if (!Array.isArray(lines) || !lines.length) return res.status(400).json({ error: "Empty cart" });
  const orderId = "ord_" + Math.random().toString(36).slice(2, 9);
  console.log("New order", { orderId, lines, customer, delivery, notes });
  res.status(201).json({ orderId });
});

// --- DRIVERS enqueue (no-op) ---
app.post(["/api/drivers/inbox", "/api/drivers/queue", "/api/driver/inbox", "/drivers/inbox", "/drivers/queue", "/driver/inbox", "/api/drivers/demo/enqueue", "/drivers/demo/enqueue"], (req, res) => {
  console.log("Driver enqueue", req.body);
  res.status(204).end();
});

// --- GEO via OpenStreetMap Nominatim ---
async function nominatim(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "CafeFrankApp/1.0 (contact: cafefrank@example.com)",
      "Accept": "application/json"
    }
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status} ${res.statusText}`);
  return await res.json();
}

app.get(["/api/geo/search", "/geo/search"], async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) return res.json({ results: [] });
    const limit = Math.min(Number(req.query.limit || 5), 10);
    const data = await nominatim(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`);
    const results = (Array.isArray(data) ? data : []).map(x => ({ label: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }));
    res.json({ results });
  } catch (e) {
    console.error("geo/search error:", e.message);
    res.json({ results: [] });
  }
});

app.get(["/api/geo/reverse", "/geo/reverse"], async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lng ?? req.query.lon);
    if (!isFinite(lat) || !isFinite(lon)) return res.json({ label: "" });
    const data = await nominatim(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`);
    res.json({ label: data.display_name || "" });
  } catch (e) {
    console.error("geo/reverse error:", e.message);
    res.json({ label: "" });
  }
});

// --- listen on Render port ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Cafe Frank API listening on :${PORT}`));
