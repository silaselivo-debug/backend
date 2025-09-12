// server.js
import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Fix __dirname for ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CORS Setup with Allowed Origins ---
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://iwb-liard.vercel.app',
  'https://iwb-server.onrender.com',
  'http://localhost:5174',
  'http://localhost:5173',
  'https://iwb-server.onrender.com/auth/google'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow requests with no origin
    if (!allowedOrigins.includes(origin)) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(bodyParser.json());

// --- SQLite Database Setup ---
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    customer TEXT NOT NULL,
    total REAL NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  // Insert sample products if empty
  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (err) return console.error(err.message);
    if (row.count === 0) {
      const sampleProducts = [
        { id: '1', name: 'Coffee', description: 'Hot brewed coffee', category: 'Beverage', price: 2.99, quantity: 50 },
        { id: '2', name: 'Sandwich', description: 'Fresh deli sandwich', category: 'Food', price: 5.99, quantity: 25 },
        { id: '3', name: 'Cake', description: 'Chocolate cake slice', category: 'Dessert', price: 3.99, quantity: 15 }
      ];

      const insertProduct = db.prepare(`INSERT INTO products (id, name, description, category, price, quantity) VALUES (?, ?, ?, ?, ?, ?)`);
      sampleProducts.forEach(p => insertProduct.run(p.id, p.name, p.description, p.category, p.price, p.quantity));
      insertProduct.finalize();
      console.log('Database initialized with sample data');
    }
  });
});

// --- API Routes ---

// Get all products
app.get('/api/products', (req, res) => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add new product
app.post('/api/products', (req, res) => {
  const { id, name, description, category, price, quantity } = req.body;
  const sql = `INSERT INTO products (id, name, description, category, price, quantity) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, name, description, category, price, quantity], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id });
  });
});

// Get all sales
app.get('/api/sales', (req, res) => {
  db.all("SELECT * FROM sales", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Record new sale
app.post('/api/sales', (req, res) => {
  const { id, date, customer, total, items } = req.body;
  db.run(`INSERT INTO sales (id, date, customer, total) VALUES (?, ?, ?, ?)`, [id, date, customer, total], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    const insertItem = db.prepare(`INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)`);
    items.forEach(item => insertItem.run(id, item.product_id, item.name, item.price, item.quantity));
    insertItem.finalize();

    res.json({ success: true, id });
  });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  db.close(err => {
    if (err) console.error(err.message);
    console.log('Database connection closed.');
    process.exit(0);
  });
});
