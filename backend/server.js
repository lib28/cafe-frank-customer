// backend/server.js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ---- Health ----
app.get('/', (_req, res) => res.json({ ok: true, service: 'Cafe Frank API' }));
app.get('/health', (_req, res) => res.json({ ok: true, status: 'ok', time: new Date().toISOString() }));

// ---- Demo data ----
let user = { name: 'Guest', phone: '', address: '', lat: null, lng: null, deliveryPreference: 'delivery', payment: {} };

const menu = {
  categories: [
    { id: 'coffee', name: 'Coffee', items: [
      { id: 'americano', name: 'Americano', description: 'Double shot', price: 28 },
      { id: 'flatwhite', name: 'Flat White', description: 'Velvety microfoam', price: 34 }
    ]},
    { id: 'bakery', name: 'Bakery', items: [
      { id: 'croissant', name: 'Butter Croissant', description: 'Fresh, flaky', price: 30 }
    ]}
  ]
};

let drivers = [
  { id: 'drv_1', name: 'Sam',  phone: '+27 82 000 0001', vehicle: 'Scooter',  status: 'available',  lat: -33.9245, lng: 18.4203, etaMins: null },
  { id: 'drv_2', name: 'Lebo', phone: '+27 83 000 0002', vehicle: 'Bike',     status: 'delivering', lat: -33.9221, lng: 18.4162, etaMins: 8 }
];

// ---- Public endpoints (no prefix) ----
app.get('/menu', (_req, res) => res.json(menu));

// Geo stubs (for Profile screen address search/reverse)
app.get('/geo/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const results = [
    { label: 'Café Frank, Bree St, Cape Town', lat: -33.9206, lng: 18.4174 },
    { label: 'Greenmarket Square, Cape Town',  lat: -33.9243, lng: 18.4196 }
  ].filter(r => r.label.toLowerCase().includes(q));
  res.json({ results });
});
app.get('/geo/reverse', (req, res) => {
  const { lat, lng } = req.query;
  res.json({ label: `Pinned @ ${lat}, ${lng}` });
});

// Profile (support many paths your app tries)
const getMe  = (_req, res) => res.json(user);
const putMe  = (req, res) => { user = { ...user, ...(req.body || {}) }; res.json(user); };
const postMe = (req, res) => { user = { ...user, ...(req.body || {}) }; res.status(201).json(user); };

app.get(['/user', '/users/me', '/user/me', '/profile', '/me'], getMe);
app.put(['/users/me', '/user/me', '/profile', '/me'], putMe);
app.post(['/users', '/user', '/profile'], postMe);

// Orders
app.post('/orders', (req, res) => {
  const orderId = 'ord_' + Date.now();
  res.status(201).json({ id: orderId, orderId, ...req.body });
});

// ---- Drivers (root) ----
app.get('/drivers', (_req, res) => res.json(drivers));
app.post(['/drivers/inbox', '/drivers/queue', '/driver/inbox', '/drivers/demo/enqueue'], (req, res) => {
  const job = req.body || {};
  const free = drivers.find(d => d.status === 'available');
  if (free) { free.status = 'delivering'; free.etaMins = Math.max(5, Math.round((job.total || 0) / 50) + 5); }
  console.log('Driver enqueue:', job);
  res.json({ ok: true });
});

// ---- Optional /api mirror ----
const api = express.Router();
api.get('/health', (_req, res) => res.json({ ok: true, tag: 'api', time: new Date().toISOString() }));
api.get('/menu', (_req, res) => res.json(menu));
api.get('/user', getMe);
api.put('/user', putMe);
api.post('/user', postMe);
api.get('/drivers', (_req, res) => res.json(drivers));
api.post('/orders', (req, res) => res.status(201).json({ id: 'ord_' + Date.now(), ...req.body }));
app.use('/api', api);

// Optional: list routes for quick debugging
app.get('/__routes', (_req, res) => {
  const routes = [];
  app._router.stack.forEach(layer => {
    if (layer.route && layer.route.path) {
      routes.push({ methods: Object.keys(layer.route.methods), path: layer.route.path });
    }
  });
  res.json({ routes });
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Cafe Frank API listening on :${PORT}`));
