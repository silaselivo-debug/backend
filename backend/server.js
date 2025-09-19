const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory data storage
let products = [
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

let sales = [];
let saleItems = [];

// Routes

// Get all products
app.get('/api/products', (req, res) => {
  res.json(products.sort((a, b) => a.name.localeCompare(b.name)));
});

// Get a single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// Create a new product
app.post('/api/products', (req, res) => {
  const { name, description, category, price, quantity } = req.body;
  
  if (!name || !category || !price || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const newProduct = {
    id: Date.now().toString(),
    name,
    description: description || '',
    category,
    price,
    quantity
  };
  
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// Update a product
app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, category, price, quantity } = req.body;
  
  const productIndex = products.findIndex(p => p.id === id);
  if (productIndex === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  products[productIndex] = {
    ...products[productIndex],
    name,
    description,
    category,
    price,
    quantity
  };
  
  res.json({ message: 'Product updated successfully' });
});

// Delete a product
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = products.length;
  
  products = products.filter(p => p.id !== id);
  
  if (products.length === initialLength) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json({ message: 'Product deleted successfully' });
});

// Get all sales with their items
app.get('/api/sales', (req, res) => {
  const salesWithItems = sales.map(sale => ({
    ...sale,
    items: saleItems.filter(item => item.sale_id === sale.id)
  }));
  
  res.json(salesWithItems.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// Create a new sale
app.post('/api/sales', (req, res) => {
  try {
    const { customer, items } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Sale must have at least one item' });
    }
    
    const saleId = Date.now().toString();
    const date = new Date().toISOString();
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const customerName = customer || 'Walk-in Customer';
    
    // Process sale items and update product quantities
    for (const item of items) {
      // Support both item.id and item.productId for compatibility
      const productId = item.id || item.productId;
      const product = products.find(p => p.id === productId);
      
      if (!product) {
        return res.status(404).json({ error: `Product ${productId} not found` });
      }
      
      if (product.quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient quantity for ${product.name}` });
      }
      
      // Update product quantity
      product.quantity -= item.quantity;
      
      // Add sale item
      saleItems.push({
        sale_id: saleId,
        product_id: productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      });
    }
    
    // Record the sale
    const newSale = {
      id: saleId,
      date,
      customer: customerName,
      total
    };
    
    sales.push(newSale);
    
    res.status(201).json({
      ...newSale,
      items: saleItems.filter(item => item.sale_id === saleId)
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});