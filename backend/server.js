const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*"  // allow frontend
}));
app.use(bodyParser.json());

// Persistent SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize DB
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
    FOREIGN KEY (sale_id) REFERENCES sales (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`);

  // Insert sample data if empty
  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (row.count === 0) {
      const sampleProducts = [
        { id: '1', name: 'Coffee', description: 'Hot brewed coffee', category: 'Beverage', price: 2.99, quantity: 50 },
        { id: '2', name: 'Sandwich', description: 'Fresh deli sandwich', category: 'Food', price: 5.99, quantity: 25 },
        { id: '3', name: 'Cake', description: 'Chocolate cake slice', category: 'Dessert', price: 3.99, quantity: 15 }
      ];

      const insertProduct = db.prepare(`INSERT INTO products (id, name, description, category, price, quantity) VALUES (?, ?, ?, ?, ?, ?)`);
      sampleProducts.forEach(product => {
        insertProduct.run(product.id, product.name, product.description, product.category, product.price, product.quantity);
      });
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
    items.forEach(item => {
      insertItem.run(id, item.product_id, item.name, item.price, item.quantity);
    });
    insertItem.finalize();

    res.json({ success: true, id });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  db.close((err) => {
    if (err) console.error(err.message);
    console.log('Database connection closed.');
    process.exit(0);
  });
});
