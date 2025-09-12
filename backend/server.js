const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database initialization
const db = new sqlite3.Database(':memory:'); // Using in-memory database for simplicity

// Initialize database tables
db.serialize(() => {
  // Create products table
  db.run(`CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL
  )`);

  // Create sales table
  db.run(`CREATE TABLE sales (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    customer TEXT NOT NULL,
    total REAL NOT NULL
  )`);

  // Create sale_items table
  db.run(`CREATE TABLE sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`);

  // Insert some sample products
  const sampleProducts = [
    {
      id: '1',
      name: 'Coffee',
      description: 'Hot brewed coffee',
      category: 'Beverage',
      price: 2.99,
      quantity: 50
    },
    {
      id: '2',
      name: 'Sandwich',
      description: 'Fresh deli sandwich',
      category: 'Food',
      price: 5.99,
      quantity: 25
    },
    {
      id: '3',
      name: 'Cake',
      description: 'Chocolate cake slice',
      category: 'Dessert',
      price: 3.99,
      quantity: 15
    }
  ];

  const insertProduct = db.prepare(`INSERT INTO products (id, name, description, category, price, quantity) 
                                   VALUES (?, ?, ?, ?, ?, ?)`);
  
  sampleProducts.forEach(product => {
    insertProduct.run(
      product.id,
      product.name,
      product.description,
      product.category,
      product.price,
      product.quantity
    );
  });
  
  insertProduct.finalize();

  console.log('Database initialized with sample data');
});

// Routes

// Get all products
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get a single product
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(row);
  });
});

// Create a new product
app.post('/api/products', (req, res) => {
  const { name, description, category, price, quantity } = req.body;
  
  if (!name || !category || !price || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const id = Date.now().toString();
  
  db.run(
    'INSERT INTO products (id, name, description, category, price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, description, category, price, quantity],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id,
        name,
        description,
        category,
        price,
        quantity
      });
    }
  );
});

// Update a product
app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, category, price, quantity } = req.body;
  
  db.run(
    'UPDATE products SET name = ?, description = ?, category = ?, price = ?, quantity = ? WHERE id = ?',
    [name, description, category, price, quantity, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ message: 'Product updated successfully' });
    }
  );
});

// Delete a product
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  });
});

// Get all sales with their items
app.get('/api/sales', (req, res) => {
  db.all('SELECT * FROM sales ORDER BY date DESC', (err, sales) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (sales.length === 0) {
      return res.json([]);
    }
    
    // Get all sale items for these sales
    const saleIds = sales.map(sale => sale.id);
    const placeholders = saleIds.map(() => '?').join(',');
    
    db.all(
      `SELECT * FROM sale_items WHERE sale_id IN (${placeholders})`,
      saleIds,
      (err, items) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Group items by sale_id
        const itemsBySale = {};
        items.forEach(item => {
          if (!itemsBySale[item.sale_id]) {
            itemsBySale[item.sale_id] = [];
          }
          itemsBySale[item.sale_id].push({
            productId: item.product_id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          });
        });
        
        // Add items to each sale
        const salesWithItems = sales.map(sale => ({
          id: sale.id,
          date: sale.date,
          customer: sale.customer,
          total: sale.total,
          items: itemsBySale[sale.id] || []
        }));
        
        res.json(salesWithItems);
      }
    );
  });
});

// Create a new sale
app.post('/api/sales', (req, res) => {
  const { customer, items } = req.body;
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Sale must have at least one item' });
  }
  
  const saleId = Date.now().toString();
  const date = new Date().toISOString();
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const customerName = customer || 'Walk-in Customer';
  
  // Start a transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Insert the sale
    db.run(
      'INSERT INTO sales (id, date, customer, total) VALUES (?, ?, ?, ?)',
      [saleId, date, customerName, total],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        
        // Insert sale items and update product quantities
        let itemsProcessed = 0;
        
        items.forEach(item => {
          // Insert sale item
          db.run(
            'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)',
            [saleId, item.productId, item.name, item.price, item.quantity],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }
              
              // Update product quantity
              db.run(
                'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                [item.quantity, item.productId],
                function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                  }
                  
                  itemsProcessed++;
                  if (itemsProcessed === items.length) {
                    db.run('COMMIT');
                    res.status(201).json({
                      id: saleId,
                      date,
                      customer: customerName,
                      items,
                      total
                    });
                  }
                }
              );
            }
          );
        });
      }
    );
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
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});