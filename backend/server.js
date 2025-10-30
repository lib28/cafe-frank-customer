// File: backend/server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { nanoid } = require('nanoid');

// ------------------ Setup ------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ------------------ Helpers ----------------
const ok = (res, data) => res.json({ ok: true, ...data });
const err = (res, code, message) => res.status(code).json({ ok: false, error: message });
const nowIso = () => new Date().toISOString();

// ------------------ In-memory state ----------------
let PROFILE = {
  name: 'Guest',
  phone: '',
  address: '',
  lat: null,
  lng: null,
  deliveryPreference: 'delivery',
  payment: {},
};

const ORDERS = new Map();        // id -> order object
const ORDER_STATUS = new Map();  // id -> status (pending/paid/on_the_way)
const DRIVERS = [];              // array of driver objects

// ------------------ Health ------------------
app.get('/health', (_req, res) => ok(res, { status: 'ok', time: nowIso() }));

// ------------------ User Profile ------------------
app.get('/user', (_req, res) => ok(res, { user: PROFILE }));

app.post('/user', (req, res) => {
  try {
    const b = req.body || {};
    PROFILE = {
      ...PROFILE,
      name: typeof b.name === 'string' ? b.name : PROFILE.name,
      phone: typeof b.phone === 'string' ? b.phone : PROFILE.phone,
      address: typeof b.address === 'string' ? b.address : PROFILE.address,
      lat: typeof b.lat === 'number' ? b.lat : PROFILE.lat,
      lng: typeof b.lng === 'number' ? b.lng : PROFILE.lng,
      deliveryPreference: b.deliveryPreference || PROFILE.deliveryPreference,
      payment: { ...(PROFILE.payment || {}), ...(b.payment || {}) },
    };
    ok(res, { profile: PROFILE });
  } catch {
    err(res, 400, 'invalid profile payload');
  }
});

// ------------------ Menu ------------------
const STATIC_MENU = {
  categories: [
    {
      id: 'breakfast',
      name: 'Breakfast',
      items: [
        { id: 'br1', name: 'Croissant & Coffee', desc: 'Butter croissant + flat white', price: 55 },
        { id: 'br2', name: 'Avocado Toast', desc: 'Sourdough, avo, lemon, chilli', price: 65 },
      ],
    },
    {
      id: 'lunch',
      name: 'Lunch',
      items: [
        { id: 'ln1', name: 'Grilled Chicken Bowl', desc: 'Char-grilled chicken, rice, greens', price: 95 },
        { id: 'ln2', name: 'Beef Brisket Roll', desc: 'Slow-cooked beef, pickles, mustard', price: 98 },
      ],
    },
    {
      id: 'sandwiches',
      name: 'Sandwiches',
      items: [
        { id: 'sw1', name: 'Frank’s Club', desc: 'Chicken, bacon, tomato, mayo', price: 89 },
        { id: 'sw2', name: 'Caprese', desc: 'Tomato, mozzarella, basil', price: 79 },
      ],
    },
    {
      id: 'beverages',
      name: 'Beverages',
      items: [
        { id: 'bv1', name: 'Flat White', desc: 'Double shot', price: 34 },
        { id: 'bv2', name: 'Fresh OJ', desc: 'Pressed orange juice', price: 45 },
      ],
    },
    {
      id: 'desserts',
      name: 'Desserts',
      items: [
        { id: 'ds1', name: 'Chocolate Brownie', desc: 'Rich & fudgy', price: 48 },
        { id: 'ds2', name: 'Cheesecake', desc: 'NY style', price: 58 },
      ],
    },
  ],
};

app.get('/menu', (_req, res) => ok(res, STATIC_MENU));
app.get('/menu/live', (_req, res) => ok(res, STATIC_MENU));

// ------------------ Orders ------------------
// Create order
app.post('/orders', (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.lines) || b.lines.length === 0)
    return err(res, 400, 'lines required');

  const orderId = 'ord_' + nanoid(8);
  const order = {
    id: orderId,
    createdAt: nowIso(),
    status: 'pending',
    customer: b.customer || { name: 'Guest' },
    lines: b.lines.map((l) => ({
      id: l.id,
      name: l.name,
      price: Number(l.price || 0),
      qty: Number(l.qty || 1),
    })),
    delivery: b.delivery || { mode: 'collect', address: null },
    notes: b.notes || '',
    amount: b.lines.reduce((s, l) => s + Number(l.price || 0) * Number(l.qty || 1), 0),
    assignedDriverId: null,
    timeline: [{ at: nowIso(), event: 'order_created' }],
  };

  ORDERS.set(orderId, order);
  ORDER_STATUS.set(orderId, 'pending');
  ok(res, { orderId, order });
});

// Get one
app.get('/orders/:id', (req, res) => {
  const order = ORDERS.get(req.params.id);
  if (!order) return err(res, 404, 'order not found');
  ok(res, { order: { ...order, status: ORDER_STATUS.get(order.id) || order.status } });
});

// List (optionally filter by status)
app.get('/orders', (req, res) => {
  const statusFilter = (req.query.status || '').toLowerCase();
  let arr = Array.from(ORDERS.values()).map((o) => ({
    ...o,
    status: ORDER_STATUS.get(o.id) || o.status,
  }));
  if (statusFilter) {
    arr = arr.filter(o => (ORDER_STATUS.get(o.id) || o.status) === statusFilter);
  }
  ok(res, { orders: arr });
});

// Mark paid
app.post('/orders/:id/paid', (req, res) => {
  const order = ORDERS.get(req.params.id);
  if (!order) return err(res, 404, 'order not found');
  ORDER_STATUS.set(order.id, 'paid');
  order.timeline.push({ at: nowIso(), event: 'payment_confirmed' });
  ok(res, { orderId: order.id, status: 'paid' });
});

// (Optional) Delete order directly
app.delete('/orders/:id', (req, res) => {
  const order = ORDERS.get(req.params.id);
  if (!order) return err(res, 404, 'order not found');
  // unassign driver if any
  if (order.assignedDriverId) {
    const d = DRIVERS.find(x => x.id === order.assignedDriverId);
    if (d) {
      d.assignedOrderId = null;
      d.status = d.available ? 'idle' : 'offline';
      d.lastUpdate = nowIso();
    }
  }
  ORDERS.delete(req.params.id);
  ORDER_STATUS.delete(req.params.id);
  ok(res, { orderId: req.params.id, removed: true });
});

// ------------------ Drivers ------------------
// List drivers (with lightweight stats)
app.get('/drivers', (_req, res) => {
  const drivers = DRIVERS.map(d => ({
    ...d,
    deliveriesCount: (d.deliveryLog || []).length,
  }));
  ok(res, { drivers });
});

// Create driver
app.post('/drivers', (req, res) => {
  const { name, phone, vehicle, plate } = req.body || {};
  if (!name || !phone) return err(res, 400, 'name and phone required');

  const driver = {
    id: 'drv_' + nanoid(6),
    name,
    phone,
    vehicle: vehicle || '',
    plate: plate || '',
    status: 'offline',          // offline | idle | on_delivery
    available: false,
    assignedOrderId: null,
    lastUpdate: nowIso(),
    loc: null,
    deliveryLog: [],            // <-- NEW: past deliveries for this driver
  };

  DRIVERS.push(driver);
  ok(res, { driver });
});

// Set availability
app.post('/drivers/:id/availability', (req, res) => {
  const d = DRIVERS.find((x) => x.id === req.params.id);
  if (!d) return err(res, 404, 'driver not found');
  d.available = !!req.body.available;
  d.status = d.available ? 'idle' : (d.assignedOrderId ? 'on_delivery' : 'offline');
  d.lastUpdate = nowIso();
  ok(res, { driver: d });
});

// Assign order to driver
app.post('/drivers/:id/assign', (req, res) => {
  const d = DRIVERS.find((x) => x.id === req.params.id);
  if (!d) return err(res, 404, 'driver not found');
  const { orderId } = req.body || {};
  const order = ORDERS.get(orderId);
  if (!order) return err(res, 404, 'order not found');

  d.assignedOrderId = orderId;
  d.status = 'on_delivery';
  d.lastUpdate = nowIso();
  order.assignedDriverId = d.id;
  ORDER_STATUS.set(orderId, 'on_the_way');
  order.timeline.push({ at: nowIso(), event: `driver_assigned:${d.id}` });

  ok(res, { driver: d, order });
});

// Live location update
app.post('/drivers/:id/location', (req, res) => {
  const d = DRIVERS.find((x) => x.id === req.params.id);
  if (!d) return err(res, 404, 'driver not found');
  const { lat, lng } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number')
    return err(res, 400, 'lat/lng required');
  d.loc = { lat, lng, at: nowIso() };
  ok(res, { driver: d });
});

// ---- NEW: Delivery log + mark delivered ----

// Get a driver's delivery log
app.get('/drivers/:id/logs', (req, res) => {
  const d = DRIVERS.find((x) => x.id === req.params.id);
  if (!d) return err(res, 404, 'driver not found');
  ok(res, { driverId: d.id, logs: d.deliveryLog || [] });
});

// Driver marks current order as delivered
app.post('/drivers/:id/delivered', (req, res) => {
  const d = DRIVERS.find((x) => x.id === req.params.id);
  if (!d) return err(res, 404, 'driver not found');

  const orderId = req.body?.orderId || d.assignedOrderId;
  if (!orderId) return err(res, 400, 'no order assigned to driver');

  const order = ORDERS.get(orderId);
  if (!order) return err(res, 404, 'order not found');

  // append to driver’s delivery log
  d.deliveryLog = d.deliveryLog || [];
  d.deliveryLog.push({
    orderId,
    deliveredAt: nowIso(),
    amount: order.amount,
    customer: order.customer?.name || 'Guest',
    destination: order.delivery?.address?.label || null,
    lines: order.lines?.map(l => ({ id: l.id, name: l.name, qty: l.qty, price: l.price })) || [],
  });

  // release driver
  d.assignedOrderId = null;
  d.status = d.available ? 'idle' : 'offline';
  d.lastUpdate = nowIso();

  // update order status and remove from active map
  ORDER_STATUS.set(orderId, 'delivered');
  order.timeline.push({ at: nowIso(), event: 'delivered' });

  // remove active order
  ORDERS.delete(orderId);
  ORDER_STATUS.delete(orderId);

  ok(res, { delivered: true, driver: d, removedOrderId: orderId });
});

// ------------------ Geo ------------------
app.get('/geo/search', (req, res) => {
  const q = req.query.q || '';
  ok(res, {
    results: [
      { label: q || 'Café Frank, 160 Bree St, Cape Town', lat: -33.9249, lng: 18.4241 },
    ],
  });
});

app.get('/geo/reverse', (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) return err(res, 400, 'lat/lng required');
  ok(res, { label: `Pinned near (${lat.toFixed(5)}, ${lng.toFixed(5)})` });
});

// ------------------ Start Server ------------------
app.listen(PORT, HOST, () => {
  console.log(`🚀 cf-backend running at http://${HOST}:${PORT}`);
  console.log(`   Health:  http://${HOST}:${PORT}/health`);
  console.log(`   Menu:    http://${HOST}:${PORT}/menu`);
  console.log(`   Drivers: http://${HOST}:${PORT}/drivers`);
  console.log(`   Orders:  http://${HOST}:${PORT}/orders`);
});
