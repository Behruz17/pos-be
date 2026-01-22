const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db');
const authMiddleware = require('./middleware');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Разрешаем только изображения
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены!'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // ограничение 5MB
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Function to get the default warehouse ID
const getDefaultWarehouseId = async (conn) => {
  const [rows] = await conn.execute(
    'SELECT id FROM warehouses WHERE is_default = 1 ORDER BY id LIMIT 1'
  );
  if (rows.length > 0) return rows[0].id;

  const [firstWarehouse] = await conn.execute(
    'SELECT id FROM warehouses ORDER BY id LIMIT 1'
  );
  if (firstWarehouse.length > 0) {
    await conn.execute('UPDATE warehouses SET is_default = 1 WHERE id = ?', [firstWarehouse[0].id]);
    return firstWarehouse[0].id;
  }

  const [ins] = await conn.execute('INSERT INTO warehouses (name) VALUES (?)', ['Main Warehouse']);
  await conn.execute('UPDATE warehouses SET is_default = 1 WHERE id = ?', [ins.insertId]);
  return ins.insertId;
};

// Helper function to generate a random token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// API Routes

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    // Validate input
    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required' });
    }

    // Find user by login
    const [users] = await db.execute('SELECT id, login, name, role, password_hash FROM users WHERE login = ?', [login]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid login or password' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid login or password' });
    }

    // Check if token already exists for this user
    let token;
    const [existingTokens] = await db.execute('SELECT token FROM tokens WHERE user_id = ?', [user.id]);
    
    if (existingTokens.length > 0) {
      // Return existing token (as per requirement: don't change if already exists)
      token = existingTokens[0].token;
    } else {
      // Generate new token
      token = generateToken();
      
      // Save token to database
      await db.execute('INSERT INTO tokens (user_id, token) VALUES (?, ?)', [user.id, token]);
    }

    res.json({
      token,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    // Delete token from database
    await db.execute('DELETE FROM tokens WHERE user_id = ?', [req.user.id]);
    
    res.json({ message: 'ok' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      login: req.user.login,
      name: req.user.name,
      role: req.user.role
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register
app.post('/api/auth/register', authMiddleware, async (req, res) => {
  try {
    // Check if the current user is an admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can create new users' });
    }

    const { login, password, name, role = 'USER' } = req.body;

    // Validate required fields
    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required' });
    }

    // Check if user already exists
    const [existingUsers] = await db.execute('SELECT id FROM users WHERE login = ?', [login]);
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User with this login already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const [result] = await db.execute(
      'INSERT INTO users (login, name, role, password_hash) VALUES (?, ?, ?, ?)',
      [login, name || null, role, hashedPassword]
    );
    
    // Get the newly created user with created_at
    const [newUser] = await db.execute(
      'SELECT id, login, name, role, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      ...newUser[0],
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    // Check if the current user is an admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can view user list' });
    }

    const [rows] = await db.execute('SELECT id, login, name, role, created_at FROM users ORDER BY created_at DESC');
    
    res.json(rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id
app.get('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    // Check if the current user is an admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can view user details' });
    }

    const { id } = req.params;

    const [rows] = await db.execute('SELECT id, login, name, role, created_at FROM users WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id
app.put('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    // Check if the current user is an admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can update users' });
    }

    const { id } = req.params;
    const { login, name, role } = req.body;

    // Prevent changing own role to avoid admin lockout
    if (parseInt(id) === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: 'Administrators cannot change their own role' });
    }

    const [result] = await db.execute(
      'UPDATE users SET login = ?, name = ?, role = ? WHERE id = ?',
      [login, name || null, role, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [updatedUser] = await db.execute('SELECT id, login, name, role, created_at FROM users WHERE id = ?', [id]);
    
    res.json({
      ...updatedUser[0],
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    // Check if the current user is an admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can delete users' });
    }

    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Administrators cannot delete themselves' });
    }

    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Inventory Management Routes

// POST /api/products
app.post('/api/products', upload.single('image'), authMiddleware, async (req, res) => {
  try {
    const { name, manufacturer } = req.body;
    // Обрабатываем изображение - может быть как URL, так и загруженный файл
    let image = null;
    if (req.file) {
      // Если файл загружен, используем путь к файлу
      image = `/uploads/${req.file.filename}`;
    } else if (req.body.image) {
      // Если передан URL в body, используем его
      image = req.body.image;
    }

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO products (name, manufacturer, image) VALUES (?, ?, ?)',
      [name, manufacturer || null, image]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      manufacturer,
      image,
      message: 'Product added successfully'
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products
app.get('/api/products', authMiddleware, async (req, res) => {
  try {
    // Get products with their last unit prices from sales, total stock, and purchase/selling prices
    const [rows] = await db.execute(
      `SELECT p.id, p.name, p.manufacturer, p.image, p.created_at, `
      + `COALESCE(last_sale.last_unit_price, 0) as last_unit_price, `
      + `COALESCE(total_stock.total_quantity, 0) as total_stock, `
      + `COALESCE(prices.purchase_cost, 0) as purchase_cost, `
      + `COALESCE(prices.selling_price, 0) as selling_price `
      + `FROM products p `
      + `LEFT JOIN (`
      +   `SELECT si.product_id, si.unit_price as last_unit_price, `
      +   `ROW_NUMBER() OVER (PARTITION BY si.product_id ORDER BY s.created_at DESC) as rn `
      +   `FROM sale_items si `
      +   `JOIN sales s ON si.sale_id = s.id `
      + `) last_sale ON p.id = last_sale.product_id AND last_sale.rn = 1 `
      + `LEFT JOIN (`
      +   `SELECT product_id, SUM(total_pieces) as total_quantity `
      +   `FROM warehouse_stock `
      +   `GROUP BY product_id `
      + `) total_stock ON p.id = total_stock.product_id `
      + `LEFT JOIN (`
      +   `SELECT sri.product_id, sri.purchase_cost, sri.selling_price, `
      +   `ROW_NUMBER() OVER (PARTITION BY sri.product_id ORDER BY sr.created_at DESC) as rn `
      +   `FROM stock_receipt_items sri `
      +   `JOIN stock_receipts sr ON sri.receipt_id = sr.id `
      + `) prices ON p.id = prices.product_id AND prices.rn = 1 `
      + `ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/products/:id
app.put('/api/products/:id', upload.single('image'), authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, manufacturer } = req.body;
    
    // Обрабатываем изображение - может быть как URL, так и загруженный файл
    let image = null;
    if (req.file) {
      // Если файл загружен, используем путь к файлу
      image = `/uploads/${req.file.filename}`;
    } else if (typeof req.body.image !== 'undefined' && req.body.image !== 'null' && req.body.image !== '') {
      // Если передан URL в body, используем его
      image = req.body.image;
    }
    
    // Получаем текущее изображение, если не передано новое
    if (image === null) {
      const [currentProduct] = await db.execute('SELECT image FROM products WHERE id = ?', [id]);
      if (currentProduct.length > 0) {
        image = currentProduct[0].image;
      }
    }

    const [result] = await db.execute(
      'UPDATE products SET name = ?, manufacturer = ?, image = ? WHERE id = ?',
      [name, manufacturer || null, image, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const [updatedProduct] = await db.execute('SELECT id, name, manufacturer, image, created_at FROM products WHERE id = ?', [id]);
    
    res.json({
      ...updatedProduct[0],
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/products/:id
app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if product exists
    const [existingProduct] = await db.execute('SELECT id FROM products WHERE id = ?', [id]);
    
    if (existingProduct.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Check if product is used in any warehouse stock
    const [stockCheck] = await db.execute('SELECT COUNT(*) as count FROM warehouse_stock WHERE product_id = ?', [id]);
    
    if (stockCheck[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product that is currently in stock. Please remove from all warehouses first.' 
      });
    }
    
    // Check if product is used in any stock receipt items
    const [receiptCheck] = await db.execute('SELECT COUNT(*) as count FROM stock_receipt_items WHERE product_id = ?', [id]);
    
    if (receiptCheck[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product that has been used in inventory receipts.' 
      });
    }
    
    // Check if product is used in any sale items
    const [saleCheck] = await db.execute('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?', [id]);
    
    if (saleCheck[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product that has been sold.' 
      });
    }
    
    // Check if product is used in any return items
    const [returnCheck] = await db.execute('SELECT COUNT(*) as count FROM return_items WHERE product_id = ?', [id]);
    
    if (returnCheck[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product that has been returned.' 
      });
    }
    
    // Delete the product
    await db.execute('DELETE FROM products WHERE id = ?', [id]);
    
    res.json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/warehouses
app.post('/api/warehouses', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Warehouse name is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO warehouses (name) VALUES (?)',
      [name]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      message: 'Warehouse added successfully'
    });
  } catch (error) {
    console.error('Add warehouse error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/warehouses
app.get('/api/warehouses', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, name FROM warehouses ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/warehouses/:id
app.put('/api/warehouses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city, is_default, is_main } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Warehouse name is required' });
    }

    // Check if warehouse exists
    const [existingWarehouse] = await db.execute('SELECT id FROM warehouses WHERE id = ?', [id]);
    
    if (existingWarehouse.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    // If setting as default, unset other defaults
    if (is_default) {
      await db.execute('UPDATE warehouses SET is_default = 0');
    }
    
    // If setting as main, unset other main flags
    if (is_main) {
      await db.execute('UPDATE warehouses SET is_main = 0');
    }

    // Prepare update parameters
    let updateQuery = 'UPDATE warehouses SET name = ?';
    let queryParams = [name];
    
    if (city !== undefined) {
      updateQuery += ', city = ?';
      queryParams.push(city || null);
    }
    
    if (is_default !== undefined) {
      updateQuery += ', is_default = ?';
      queryParams.push(is_default ? 1 : 0);
    }
    
    if (is_main !== undefined) {
      updateQuery += ', is_main = ?';
      queryParams.push(is_main ? 1 : 0);
    }
    
    updateQuery += ' WHERE id = ?';
    queryParams.push(id);

    // Update the warehouse
    const [result] = await db.execute(updateQuery, queryParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const [updatedWarehouse] = await db.execute('SELECT id, name, city, is_default, is_main FROM warehouses WHERE id = ?', [id]);
    
    res.json({
      ...updatedWarehouse[0],
      message: 'Warehouse updated successfully'
    });
  } catch (error) {
    console.error('Update warehouse error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Supplier Management Routes

// POST /api/suppliers
app.post('/api/suppliers', authMiddleware, async (req, res) => {
  try {
    const { name, phone, balance, status } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO suppliers (name, phone, balance, status) VALUES (?, ?, ?, ?)',
      [name, phone || null, balance || 0, status !== undefined ? status : 1]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      phone,
      balance: balance || 0,
      status: status !== undefined ? status : 1,
      message: 'Supplier created successfully'
    });
  } catch (error) {
    console.error('Add supplier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/suppliers
app.get('/api/suppliers', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, phone, balance, status, created_at, updated_at FROM suppliers WHERE status IN (0, 1) ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/suppliers/:id
app.get('/api/suppliers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.execute(
      'SELECT id, name, phone, balance, status, created_at, updated_at FROM suppliers WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/suppliers/:id
app.put('/api/suppliers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, balance, status } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    // Check if supplier exists
    const [existingSupplier] = await db.execute('SELECT id FROM suppliers WHERE id = ?', [id]);
    
    if (existingSupplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const [result] = await db.execute(
      'UPDATE suppliers SET name = ?, phone = ?, balance = ?, status = ? WHERE id = ?',
      [name, phone || null, balance !== undefined ? balance : 0, status !== undefined ? status : 1, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const [updatedSupplier] = await db.execute(
      'SELECT id, name, phone, balance, status, created_at, updated_at FROM suppliers WHERE id = ?',
      [id]
    );
    
    res.json({
      ...updatedSupplier[0],
      message: 'Supplier updated successfully'
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/suppliers/:id (soft delete)
app.delete('/api/suppliers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if supplier exists
    const [existingSupplier] = await db.execute('SELECT id FROM suppliers WHERE id = ?', [id]);
    
    if (existingSupplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Soft delete by setting status to 0
    await db.execute('UPDATE suppliers SET status = 0 WHERE id = ?', [id]);
    
    res.json({
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/warehouses/:id
app.delete('/api/warehouses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if warehouse exists
    const [existingWarehouse] = await db.execute('SELECT id FROM warehouses WHERE id = ?', [id]);
    
    if (existingWarehouse.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    // Check if warehouse has any stock
    const [stockCheck] = await db.execute('SELECT COUNT(*) as count FROM warehouse_stock WHERE warehouse_id = ?', [id]);
    
    if (stockCheck[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete warehouse with existing stock. Please transfer or remove all products first.' 
      });
    }
    
    // Delete the warehouse
    await db.execute('DELETE FROM warehouses WHERE id = ?', [id]);
    
    res.json({
      message: 'Warehouse deleted successfully'
    });
  } catch (error) {
    console.error('Delete warehouse error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Store Management Routes

// POST /api/stores
app.post('/api/stores', authMiddleware, async (req, res) => {
  try {
    const { name, city, warehouse_id } = req.body;

    // Validate required fields
    if (!name || !warehouse_id) {
      return res.status(400).json({ error: 'Store name and warehouse_id are required' });
    }

    // Check if warehouse exists
    const [warehouse] = await db.execute('SELECT id FROM warehouses WHERE id = ?', [warehouse_id]);
    if (warehouse.length === 0) {
      return res.status(400).json({ error: 'Warehouse not found' });
    }

    const [result] = await db.execute(
      'INSERT INTO stores (name, city, warehouse_id) VALUES (?, ?, ?)',
      [name, city || null, warehouse_id]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      city,
      warehouse_id,
      message: 'Store added successfully'
    });
  } catch (error) {
    console.error('Add store error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stores
app.get('/api/stores', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT s.id, s.name, s.city, s.warehouse_id, w.name AS warehouse_name ' +
      'FROM stores s ' +
      'JOIN warehouses w ON w.id = s.warehouse_id ' +
      'WHERE s.is_active = 1 ' +
      'ORDER BY s.id'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/stores/:id
app.put('/api/stores/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city, warehouse_id } = req.body;

    // Validate required fields
    if (!name || !warehouse_id) {
      return res.status(400).json({ error: 'Store name and warehouse_id are required' });
    }

    // Check if store exists
    const [existingStore] = await db.execute('SELECT id FROM stores WHERE id = ?', [id]);
    if (existingStore.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Check if warehouse exists
    const [warehouse] = await db.execute('SELECT id FROM warehouses WHERE id = ?', [warehouse_id]);
    if (warehouse.length === 0) {
      return res.status(400).json({ error: 'Warehouse not found' });
    }

    const [result] = await db.execute(
      'UPDATE stores SET name = ?, city = ?, warehouse_id = ? WHERE id = ?',
      [name, city || null, warehouse_id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const [updatedStore] = await db.execute(
      'SELECT s.id, s.name, s.city, s.warehouse_id, w.name AS warehouse_name ' +
      'FROM stores s ' +
      'JOIN warehouses w ON w.id = s.warehouse_id ' +
      'WHERE s.id = ?',
      [id]
    );
    
    res.json({
      ...updatedStore[0],
      message: 'Store updated successfully'
    });
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/stores/:id
app.delete('/api/stores/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if store exists
    const [existingStore] = await db.execute('SELECT id FROM stores WHERE id = ?', [id]);
    
    if (existingStore.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Soft delete by setting is_active to 0
    await db.execute('UPDATE stores SET is_active = 0 WHERE id = ?', [id]);
    
    res.json({
      message: 'Store deleted successfully'
    });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/warehouses/:id/products
app.get('/api/warehouses/:id/products', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify warehouse exists
    const [warehouse] = await db.execute('SELECT id, name FROM warehouses WHERE id = ?', [id]);
    if (warehouse.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    // Get products in the specified warehouse
    const [rows] = await db.execute(
      'SELECT ws.id, ws.product_id, p.name as product_name, p.manufacturer, p.image, '
      + 'ws.total_pieces, ws.weight_kg, ws.volume_cbm, ws.updated_at '
      + 'FROM warehouse_stock ws '
      + 'JOIN products p ON ws.product_id = p.id '
      + 'WHERE ws.warehouse_id = ? '
      + 'ORDER BY p.name',
      [id]
    );
    
    // Add purchase and selling prices for each item
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Get the most recent purchase and selling prices for this product from stock receipts
      const [priceRows] = await db.execute(
        `SELECT sri.purchase_cost, sri.selling_price 
        FROM stock_receipt_items sri 
        JOIN stock_receipts sr ON sri.receipt_id = sr.id 
        WHERE sri.product_id = ? 
        ORDER BY sr.created_at DESC 
        LIMIT 1`,
        [row.product_id]
      );
      
      row.purchase_cost = priceRows.length > 0 ? priceRows[0].purchase_cost : 0;
      row.selling_price = priceRows.length > 0 ? priceRows[0].selling_price : 0;
    }
    
    res.json({
      warehouse: warehouse[0],
      products: rows
    });
  } catch (error) {
    console.error('Get warehouse products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/warehouses/:warehouseId/products/:productId
app.get('/api/warehouses/:warehouseId/products/:productId', authMiddleware, async (req, res) => {
  try {
    const { warehouseId, productId } = req.params;
    
    // Verify warehouse exists
    const [warehouse] = await db.execute('SELECT id, name FROM warehouses WHERE id = ?', [warehouseId]);
    if (warehouse.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    // Verify product exists
    const [product] = await db.execute(
      'SELECT id, name, manufacturer, image, created_at FROM products WHERE id = ?',
      [productId]
    );
    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get product stock in the specified warehouse
    const [stock] = await db.execute(
      'SELECT ws.id, ws.total_pieces, ws.weight_kg, ws.volume_cbm, ws.updated_at '
      + 'FROM warehouse_stock ws '
      + 'WHERE ws.warehouse_id = ? AND ws.product_id = ?',
      [warehouseId, productId]
    );
    
    if (stock.length === 0) {
      return res.status(404).json({ error: 'Product not found in this warehouse' });
    }
    
    res.json({
      warehouse: warehouse[0],
      product: product[0],
      stock: stock[0]
    });
  } catch (error) {
    console.error('Get warehouse product detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/receipt
app.post('/api/inventory/receipt', authMiddleware, async (req, res) => {
  try {
    const { warehouse_id, supplier_id, items } = req.body;

    // Validate required fields
    if (!warehouse_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Warehouse ID and items array are required' });
    }

    // Validate that supplier exists and is active
    if (!supplier_id) {
      return res.status(400).json({ error: 'Supplier ID is required' });
    }
    
    const [supplier] = await db.execute('SELECT id FROM suppliers WHERE id = ? AND status = 1', [supplier_id]);
    if (supplier.length === 0) {
      return res.status(400).json({ error: 'Supplier not found or inactive' });
    }

    // Validate each item
    for (const item of items) {
      if (item.product_id == null || item.boxes_qty == null || item.pieces_per_box == null || item.loose_pieces == null || item.amount == null) {
        return res.status(400).json({ error: 'Each item must have product_id, boxes_qty, pieces_per_box, loose_pieces, amount' });
      }
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount from item amounts
      const total_amount = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

      // Create stock receipt
      const [receiptResult] = await connection.execute(
        'INSERT INTO stock_receipts (warehouse_id, created_by, total_amount, supplier_id) VALUES (?, ?, ?, ?)',
        [warehouse_id, req.user.id, total_amount, supplier_id || null]
      );
      const receiptId = receiptResult.insertId;

      // Process each item in the receipt
      for (const item of items) {
        // Calculate total pieces
        const total_pieces = (item.boxes_qty * item.pieces_per_box) + item.loose_pieces;
        
        // Insert receipt item
        await connection.execute(
          'INSERT INTO stock_receipt_items (receipt_id, product_id, boxes_qty, weight_kg, volume_cbm, amount, purchase_cost, selling_price, pieces_per_box, loose_pieces, total_pieces) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            receiptId,
            item.product_id,
            item.boxes_qty,
            item.weight_kg || null,
            item.volume_cbm || null,
            item.amount,
            item.purchase_cost,
            item.selling_price || null,
            item.pieces_per_box,
            item.loose_pieces,
            total_pieces
          ]
        );

        // Update warehouse stock
        const [existingStock] = await connection.execute(
          'SELECT id, total_pieces, weight_kg, volume_cbm FROM warehouse_stock WHERE warehouse_id = ? AND product_id = ?',
          [warehouse_id, item.product_id]
        );

        if (existingStock.length > 0) {
          // Update existing stock
          const oldTotalPieces = existingStock[0].total_pieces;
          const oldWeight = existingStock[0].weight_kg;
          const oldVolume = existingStock[0].volume_cbm;
          
          const addedTotalPieces = (item.boxes_qty * item.pieces_per_box) + item.loose_pieces;
          const updatedTotalPieces = oldTotalPieces + addedTotalPieces;
          const updatedWeight = oldWeight ? (parseFloat(oldWeight) + parseFloat(item.weight_kg || 0)) : (item.weight_kg || 0);
          const updatedVolume = oldVolume ? (parseFloat(oldVolume) + parseFloat(item.volume_cbm || 0)) : (item.volume_cbm || 0);

          await connection.execute(
            'UPDATE warehouse_stock SET total_pieces = ?, weight_kg = ?, volume_cbm = ?, updated_at = NOW() WHERE id = ?',
            [updatedTotalPieces, updatedWeight, updatedVolume, existingStock[0].id]
          );
          
          // Record the IN change for stock history
          await connection.execute(
            `INSERT INTO stock_changes 
             (warehouse_id, product_id, user_id, change_type,
              old_total_pieces, new_total_pieces,
              old_weight_kg, new_weight_kg,
              old_volume_cbm, new_volume_cbm, reason)
             VALUES (?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?)`,
            [
              warehouse_id, item.product_id, req.user.id,
              oldTotalPieces, updatedTotalPieces,
              oldWeight, updatedWeight,
              oldVolume, updatedVolume,
              `Receipt #${receiptId}`
            ]
          );
        } else {
          // Insert new stock record
          const totalPieces = (item.boxes_qty * item.pieces_per_box) + item.loose_pieces;
          await connection.execute(
            'INSERT INTO warehouse_stock (warehouse_id, product_id, total_pieces, weight_kg, volume_cbm) VALUES (?, ?, ?, ?, ?)',
            [warehouse_id, item.product_id, totalPieces, item.weight_kg || 0, item.volume_cbm || 0]
          );
          
          // Record the IN change for stock history (new item)
          await connection.execute(
            `INSERT INTO stock_changes 
             (warehouse_id, product_id, user_id, change_type,
              old_total_pieces, new_total_pieces,
              old_weight_kg, new_weight_kg,
              old_volume_cbm, new_volume_cbm, reason)
             VALUES (?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?)`,
            [
              warehouse_id, item.product_id, req.user.id,
              0, totalPieces,
              0, item.weight_kg || 0,
              0, item.volume_cbm || 0,
              `Receipt #${receiptId}`
            ]
          );
        }
      }

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        id: receiptId,
        message: 'Inventory receipt added successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Inventory receipt error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/receipts
app.get('/api/inventory/receipts', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT sr.id, sr.warehouse_id, w.name as warehouse_name, sr.supplier_id, s.name as supplier_name, sr.created_by, u.login as created_by_name,
              sr.created_at, sr.total_amount
       FROM stock_receipts sr
       JOIN warehouses w ON sr.warehouse_id = w.id
       LEFT JOIN suppliers s ON sr.supplier_id = s.id
       JOIN users u ON sr.created_by = u.id
       ORDER BY sr.created_at DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error('Get inventory receipts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/receipt/:id
app.get('/api/inventory/receipt/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get receipt header
    const [receiptRows] = await db.execute(
      `SELECT sr.id, sr.warehouse_id, w.name as warehouse_name, sr.supplier_id, s.name as supplier_name, sr.created_by, u.login as created_by_name,
              sr.created_at, sr.total_amount
       FROM stock_receipts sr
       JOIN warehouses w ON sr.warehouse_id = w.id
       LEFT JOIN suppliers s ON sr.supplier_id = s.id
       JOIN users u ON sr.created_by = u.id
       WHERE sr.id = ?`,
      [id]
    );

    if (receiptRows.length === 0) {
      return res.status(404).json({ error: 'Inventory receipt not found' });
    }

    // Get receipt items
    const [itemRows] = await db.execute(
      'SELECT sri.id, sri.product_id, p.name as product_name, p.manufacturer, p.image, sri.boxes_qty, sri.pieces_per_box, sri.loose_pieces, sri.total_pieces, '
      + 'sri.weight_kg, sri.volume_cbm, sri.amount, sri.purchase_cost, sri.selling_price '
      + 'FROM stock_receipt_items sri '
      + 'JOIN products p ON sri.product_id = p.id '
      + 'WHERE sri.receipt_id = ?',
      [id]
    );

    res.json({
      ...receiptRows[0],
      items: itemRows
    });
  } catch (error) {
    console.error('Get inventory receipt error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/warehouse/stock
app.get('/api/warehouse/stock', authMiddleware, async (req, res) => {
  try {
    // Get warehouse stock with purchase and selling prices
    const [rows] = await db.execute(
      `SELECT ws.id, ws.warehouse_id, w.name as warehouse_name, ws.product_id, p.name as product_name,
              ws.total_pieces, ws.weight_kg, ws.volume_cbm, ws.updated_at
       FROM warehouse_stock ws
       JOIN warehouses w ON ws.warehouse_id = w.id
       JOIN products p ON ws.product_id = p.id
       ORDER BY w.name, p.name`
    );
    
    // Add purchase and selling prices for each item
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Get the most recent purchase and selling prices for this product from stock receipts
      const [priceRows] = await db.execute(
        `SELECT sri.purchase_cost, sri.selling_price 
        FROM stock_receipt_items sri 
        JOIN stock_receipts sr ON sri.receipt_id = sr.id 
        WHERE sri.product_id = ? 
        ORDER BY sr.created_at DESC 
        LIMIT 1`,
        [row.product_id]
      );
      
      row.purchase_cost = priceRows.length > 0 ? priceRows[0].purchase_cost : 0;
      row.selling_price = priceRows.length > 0 ? priceRows[0].selling_price : 0;
    }

    res.json(rows);
  } catch (error) {
    console.error('Get warehouse stock error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/warehouse/stock/:id
app.put('/api/warehouse/stock/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { total_pieces, weight_kg, volume_cbm, reason } = req.body;

    // Get current stock
    const [currentStock] = await db.execute(
      'SELECT warehouse_id, product_id, total_pieces as current_total_pieces, weight_kg as current_weight, volume_cbm as current_volume FROM warehouse_stock WHERE id = ?',
      [id]
    );

    if (currentStock.length === 0) {
      return res.status(404).json({ error: 'Stock record not found' });
    }

    const stock = currentStock[0];

    // Update stock
    const [result] = await db.execute(
      'UPDATE warehouse_stock SET total_pieces = ?, weight_kg = ?, volume_cbm = ?, updated_at = NOW() WHERE id = ?',
      [total_pieces, weight_kg, volume_cbm, id]
    );

    // Record the change in history
    await db.execute(
      `INSERT INTO stock_changes 
       (warehouse_id, product_id, user_id, change_type, old_total_pieces, new_total_pieces,
        old_weight_kg, new_weight_kg, old_volume_cbm, new_volume_cbm, reason)
       VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?)`,
      [
        stock.warehouse_id, stock.product_id, req.user.id,
        stock.current_total_pieces, total_pieces,
        stock.current_weight, weight_kg,
        stock.current_volume, volume_cbm,
        reason || null
      ]
    );

    res.json({
      id,
      message: 'Stock updated successfully'
    });
  } catch (error) {
    console.error('Update warehouse stock error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/warehouse/stock/move
app.post('/api/warehouse/stock/move', authMiddleware, async (req, res) => {
  try {
    const { from_warehouse_id, to_warehouse_id, product_id, total_pieces, weight_kg, volume_cbm, reason } = req.body;

    const qty = parseInt(total_pieces, 10);
    if (!from_warehouse_id || !to_warehouse_id || !product_id || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Required fields are missing or invalid' });
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get current stock in source warehouse
      const [fromStock] = await connection.execute(
        'SELECT id, total_pieces as current_total_pieces, weight_kg as current_weight, volume_cbm as current_volume FROM warehouse_stock WHERE warehouse_id = ? AND product_id = ?',
        [from_warehouse_id, product_id]
      );

      if (fromStock.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Not enough stock in source warehouse' });
      }

      const stock = fromStock[0];

      // Check if we have enough stock
      if (stock.current_total_pieces < qty) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Not enough stock in source warehouse' });
      }
      
      // Check if we have enough weight and volume to subtract
      const subtractWeight = parseFloat(weight_kg || 0);
      const subtractVolume = parseFloat(volume_cbm || 0);
      
      if (stock.current_weight != null && subtractWeight > parseFloat(stock.current_weight || 0)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Not enough weight in source warehouse' });
      }
      
      if (stock.current_volume != null && subtractVolume > parseFloat(stock.current_volume || 0)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Not enough volume in source warehouse' });
      }

      // Update source warehouse (subtract stock)
      const newFromTotalPieces = stock.current_total_pieces - qty;
      const newFromWeight = Math.max(0, parseFloat(stock.current_weight || 0) - parseFloat(weight_kg || 0));
      const newFromVolume = Math.max(0, parseFloat(stock.current_volume || 0) - parseFloat(volume_cbm || 0));

      await connection.execute(
        'UPDATE warehouse_stock SET total_pieces = ?, weight_kg = ?, volume_cbm = ?, updated_at = NOW() WHERE id = ?',
        [newFromTotalPieces, newFromWeight, newFromVolume, stock.id]
      );

      // Record the OUT change
      await connection.execute(
        `INSERT INTO stock_changes 
         (warehouse_id, product_id, user_id, change_type, old_total_pieces, new_total_pieces,
          old_weight_kg, new_weight_kg, old_volume_cbm, new_volume_cbm, reason)
         VALUES (?, ?, ?, 'OUT', ?, ?, ?, ?, ?, ?, ?)`,
        [
          from_warehouse_id, product_id, req.user.id,
          stock.current_total_pieces, newFromTotalPieces,
          stock.current_weight, newFromWeight,
          stock.current_volume, newFromVolume,
          reason || `Transfer to warehouse ${to_warehouse_id}`
        ]
      );

      // Update destination warehouse (add stock)
      const [toStock] = await connection.execute(
        'SELECT id, total_pieces as current_total_pieces, weight_kg as current_weight, volume_cbm as current_volume FROM warehouse_stock WHERE warehouse_id = ? AND product_id = ?',
        [to_warehouse_id, product_id]
      );

      if (toStock.length > 0) {
        // Update existing stock in destination
        const newToTotalPieces = toStock[0].current_total_pieces + qty;
        const newToWeight = parseFloat(toStock[0].current_weight || 0) + parseFloat(weight_kg || 0);
        const newToVolume = parseFloat(toStock[0].current_volume || 0) + parseFloat(volume_cbm || 0);

        await connection.execute(
          'UPDATE warehouse_stock SET total_pieces = ?, weight_kg = ?, volume_cbm = ?, updated_at = NOW() WHERE id = ?',
          [newToTotalPieces, newToWeight, newToVolume, toStock[0].id]
        );
      } else {
        // Create new stock record in destination
        await connection.execute(
          'INSERT INTO warehouse_stock (warehouse_id, product_id, total_pieces, weight_kg, volume_cbm) VALUES (?, ?, ?, ?, ?)',
          [to_warehouse_id, product_id, qty, weight_kg || 0, volume_cbm || 0]
        );
      }

      // Record the IN change (correct old/new values)
      const toOldPieces = toStock.length > 0 ? toStock[0].current_total_pieces : 0;
      const toOldWeight = toStock.length > 0 ? (parseFloat(toStock[0].current_weight) || 0) : 0;
      const toOldVolume = toStock.length > 0 ? (parseFloat(toStock[0].current_volume) || 0) : 0;
      
      const addWeight = parseFloat(weight_kg || 0);
      const addVolume = parseFloat(volume_cbm || 0);
      
      const toNewPieces = toOldPieces + qty;
      const toNewWeight = toOldWeight + addWeight;
      const toNewVolume = toOldVolume + addVolume;
      
      await connection.execute(
        `INSERT INTO stock_changes 
         (warehouse_id, product_id, user_id, change_type,
          old_total_pieces, new_total_pieces,
          old_weight_kg, new_weight_kg,
          old_volume_cbm, new_volume_cbm, reason)
         VALUES (?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?)`,
        [
          to_warehouse_id, product_id, req.user.id,
          toOldPieces, toNewPieces,
          toOldWeight, toNewWeight,
          toOldVolume, toNewVolume,
          reason || `Transfer from warehouse ${from_warehouse_id}`
        ]
      );

      // Commit transaction
      await connection.commit();
      connection.release();

      res.json({
        message: 'Stock moved successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Move warehouse stock error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stock/history
app.get('/api/stock/history', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT sc.id, sc.warehouse_id, w.name as warehouse_name, sc.product_id, p.name as product_name, '
      + 'p.manufacturer, p.image, sc.user_id, u.login as user_name, sc.change_type, '
      + 'sc.old_total_pieces, sc.new_total_pieces, '
      + 'sc.old_weight_kg, sc.new_weight_kg, sc.old_volume_cbm, sc.new_volume_cbm, '
      + 'sc.reason, sc.created_at '
      + 'FROM stock_changes sc '
      + 'JOIN warehouses w ON sc.warehouse_id = w.id '
      + 'JOIN products p ON sc.product_id = p.id '
      + 'JOIN users u ON sc.user_id = u.id '
      + 'ORDER BY sc.created_at DESC'
    );

    res.json(rows);
  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stock/history/:id
app.get('/api/stock/history/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.execute(
      'SELECT sc.id, sc.warehouse_id, w.name as warehouse_name, sc.product_id, p.name as product_name, '
      + 'p.manufacturer, p.image, sc.user_id, u.login as user_name, sc.change_type, '
      + 'sc.old_total_pieces, sc.new_total_pieces, '
      + 'sc.old_weight_kg, sc.new_weight_kg, sc.old_volume_cbm, sc.new_volume_cbm, '
      + 'sc.reason, sc.created_at '
      + 'FROM stock_changes sc '
      + 'JOIN warehouses w ON sc.warehouse_id = w.id '
      + 'JOIN products p ON sc.product_id = p.id '
      + 'JOIN users u ON sc.user_id = u.id '
      + 'WHERE sc.id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Stock change record not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Customer Management Routes

// POST /api/customers
app.post('/api/customers', authMiddleware, async (req, res) => {
  try {
    const { full_name, phone, city } = req.body;

    if (!full_name) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO customers (full_name, phone, city) VALUES (?, ?, ?)',
      [full_name, phone || null, city || null]
    );

    res.status(201).json({
      id: result.insertId,
      full_name,
      phone,
      city,
      balance: 0,
      message: 'Customer created successfully'
    });
  } catch (error) {
    console.error('Add customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, full_name, phone, city, balance, created_at, updated_at FROM customers ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:id
app.get('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.execute('SELECT id, full_name, phone, city, balance, created_at, updated_at FROM customers WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/customers/:id
app.put('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, city } = req.body;

    if (!full_name) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const [result] = await db.execute(
      'UPDATE customers SET full_name = ?, phone = ?, city = ? WHERE id = ?',
      [full_name, phone || null, city || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const [updatedCustomer] = await db.execute('SELECT id, full_name, phone, city, balance, created_at, updated_at FROM customers WHERE id = ?', [id]);
    
    res.json({
      ...updatedCustomer[0],
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/customers/:id
app.delete('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute('DELETE FROM customers WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:id/details
app.get('/api/customers/:id/details', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get customer info
    const [customerRows] = await db.execute(
      'SELECT id, full_name, phone, city, balance, created_at, updated_at FROM customers WHERE id = ?',
      [id]
    );

    if (customerRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerRows[0];

    // Get customer's sales
    const [sales] = await db.execute(
      `SELECT s.id, s.total_amount, s.created_at as transaction_date, 'sale' as transaction_type
       FROM sales s
       WHERE s.customer_id = ?
       ORDER BY s.created_at DESC`,
      [id]
    );

    // Get customer's returns
    const [returns] = await db.execute(
      `SELECT r.id, r.total_amount, r.created_at as transaction_date, 'return' as transaction_type
       FROM returns r
       WHERE r.customer_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );

    // Combine and sort all transactions
    const allTransactions = [
      ...sales.map(s => ({
        id: s.id,
        amount: s.total_amount,
        date: s.transaction_date,
        type: s.transaction_type
      })),
      ...returns.map(r => ({
        id: r.id,
        amount: r.total_amount,
        date: r.transaction_date,
        type: r.transaction_type
      }))
    ];

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      ...customer,
      transactions: allTransactions
    });
  } catch (error) {
    console.error('Get customer details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/customers/:id/update-balance
app.post('/api/customers/:id/update-balance', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, operation, reason } = req.body; // operation: 'add' or 'subtract'

    if (!amount || !operation) {
      return res.status(400).json({ error: 'Amount and operation are required' });
    }

    // Get current balance
    const [currentCustomer] = await db.execute('SELECT balance FROM customers WHERE id = ?', [id]);
    
    if (currentCustomer.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    let newBalance;
    if (operation === 'add') {
      newBalance = parseFloat(currentCustomer[0].balance) + parseFloat(amount);
    } else if (operation === 'subtract') {
      newBalance = parseFloat(currentCustomer[0].balance) - parseFloat(amount);
    } else {
      return res.status(400).json({ error: 'Operation must be "add" or "subtract"' });
    }

    // Update balance
    await db.execute('UPDATE customers SET balance = ? WHERE id = ?', [newBalance, id]);

    res.json({
      id,
      new_balance: newBalance,
      message: 'Customer balance updated successfully'
    });
  } catch (error) {
    console.error('Update customer balance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sales Management Routes

// POST /api/sales
app.post('/api/sales', authMiddleware, async (req, res) => {
  try {
    const { customer_id, store_id, items } = req.body;

    // Validate required fields
    if (!store_id) {
      return res.status(400).json({ error: 'Store ID is required' });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.unit_price) {
        return res.status(400).json({ error: 'Each item must have product_id, quantity, and unit_price' });
      }
    }

    // Check if store exists and get its warehouse
    const [store] = await db.execute(
      'SELECT id, warehouse_id FROM stores WHERE id = ? AND is_active = 1',
      [store_id]
    );
    
    if (store.length === 0) {
      return res.status(400).json({ error: 'Store not found or inactive' });
    }
    
    const storeWarehouseId = store[0].warehouse_id;

    // Get demo customer if no customer is provided
    let customerId = customer_id;
    if (!customerId) {
      const [demoCustomer] = await db.execute('SELECT id FROM customers WHERE full_name = ?', ['Demo Customer']);
      if (demoCustomer.length > 0) {
        customerId = demoCustomer[0].id;
      } else {
        return res.status(500).json({ error: 'Demo customer not found' });
      }
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseInt(item.quantity)), 0);

      // Create sale with store_id and warehouse_id
      const [saleResult] = await connection.execute(
        'INSERT INTO sales (customer_id, store_id, warehouse_id, total_amount, created_by) VALUES (?, ?, ?, ?, ?)',
        [customerId, store_id, storeWarehouseId, total_amount, req.user.id]
      );
      const saleId = saleResult.insertId;

      // Process each item in the sale
      for (const item of items) {
        const totalPrice = parseFloat(item.unit_price) * parseInt(item.quantity);
        
        // Insert sale item
        await connection.execute(
          'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
          [saleId, item.product_id, item.quantity, item.unit_price, totalPrice]
        );

        // Update warehouse stock - only from the specific store's warehouse
        const [stockRows] = await connection.execute(
          'SELECT id, total_pieces FROM warehouse_stock WHERE warehouse_id = ? AND product_id = ? FOR UPDATE',
          [storeWarehouseId, item.product_id]
        );

        if (stockRows.length > 0) {
          const stockRow = stockRows[0];
          const requestedQuantity = parseInt(item.quantity);
          
          // Check if we have enough stock in this specific warehouse
          if (requestedQuantity > stockRow.total_pieces) {
            // Not enough stock
            await connection.rollback();
            connection.release();
            return res.status(400).json({ 
              error: `Not enough stock for product ID: ${item.product_id} in store warehouse. Requested: ${requestedQuantity}, Available: ${stockRow.total_pieces}` 
            });
          }
          
          // Deduct from this warehouse only
          const newTotalPieces = stockRow.total_pieces - requestedQuantity;
          
          await connection.execute(
            'UPDATE warehouse_stock SET total_pieces = ? WHERE id = ?',
            [newTotalPieces, stockRow.id]
          );
        } else {
          // No stock found for this product in this warehouse
          await connection.rollback();
          connection.release();
          return res.status(400).json({ 
            error: `Not enough stock for product ID: ${item.product_id} in store warehouse` 
          });
        }
      }

      // Update customer balance (subtract the purchase amount)
      await connection.execute(
        'UPDATE customers SET balance = balance - ? WHERE id = ?',
        [total_amount, customerId]
      );

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        id: saleId,
        message: 'Sale created successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sales
app.get('/api/sales', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT s.id, s.customer_id, c.full_name as customer_name, s.total_amount, s.created_by, 
              u.login as created_by_name, s.created_at, s.store_id, s.warehouse_id, st.name as store_name, w.name as warehouse_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN stores st ON s.store_id = st.id
       LEFT JOIN warehouses w ON s.warehouse_id = w.id
       JOIN users u ON s.created_by = u.id
       ORDER BY s.created_at DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sales/:id
app.get('/api/sales/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get sale header
    const [saleRows] = await db.execute(
      `SELECT s.id, s.customer_id, c.full_name as customer_name, s.total_amount, s.created_by, 
              u.login as created_by_name, s.created_at, s.store_id, s.warehouse_id, st.name as store_name, w.name as warehouse_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN stores st ON s.store_id = st.id
       LEFT JOIN warehouses w ON s.warehouse_id = w.id
       JOIN users u ON s.created_by = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (saleRows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Get sale items
    const [itemRows] = await db.execute(
      'SELECT si.id, si.product_id, p.name as product_name, p.manufacturer, p.image, si.quantity, '
      + 'si.unit_price, si.total_price '
      + 'FROM sale_items si '
      + 'JOIN products p ON si.product_id = p.id '
      + 'WHERE si.sale_id = ?',
      [id]
    );

    res.json({
      ...saleRows[0],
      items: itemRows
    });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Returns Management Routes

// POST /api/returns
app.post('/api/returns', authMiddleware, async (req, res) => {
  try {
    const { customer_id, sale_id, store_id, items } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.unit_price) {
        return res.status(400).json({ error: 'Each item must have product_id, quantity, and unit_price' });
      }
    }

    // Get demo customer if no customer is provided
    let customerId = customer_id;
    if (!customerId) {
      const [demoCustomer] = await db.execute('SELECT id FROM customers WHERE full_name = ?', ['Demo Customer']);
      if (demoCustomer.length > 0) {
        customerId = demoCustomer[0].id;
      } else {
        return res.status(500).json({ error: 'Demo customer not found' });
      }
    }
    
    // If sale_id is provided, validate that return quantities don't exceed purchased quantities
    let returnWarehouseId = null;
    
    if (sale_id) {
      // Get the original sale items and warehouse
      const [saleInfo] = await db.execute(
        'SELECT warehouse_id FROM sales WHERE id = ?',
        [sale_id]
      );
      
      if (saleInfo.length === 0) {
        return res.status(400).json({ error: 'Sale not found' });
      }
      
      returnWarehouseId = saleInfo[0].warehouse_id;
      
      // Get the original sale items
      const [saleItems] = await db.execute(
        'SELECT product_id, quantity FROM sale_items WHERE sale_id = ?',
        [sale_id]
      );
      
      if (saleItems.length === 0) {
        return res.status(400).json({ error: 'Sale has no items' });
      }
      
      // Create a map of purchased quantities by product_id
      const purchasedQuantities = {};
      for (const saleItem of saleItems) {
        if (purchasedQuantities[saleItem.product_id]) {
          purchasedQuantities[saleItem.product_id] += saleItem.quantity;
        } else {
          purchasedQuantities[saleItem.product_id] = saleItem.quantity;
        }
      }
      
      // Check each return item against purchased quantities
      for (const returnItem of items) {
        const purchasedQty = purchasedQuantities[returnItem.product_id] || 0;
        const returnQty = parseInt(returnItem.quantity);
        
        if (returnQty > purchasedQty) {
          return res.status(400).json({ 
            error: `Cannot return more than purchased. Product ID ${returnItem.product_id}: purchased ${purchasedQty}, trying to return ${returnQty}` 
          });
        }
      }
    } else if (store_id) {
      // If no sale_id but store_id is provided, use store's warehouse
      const [store] = await db.execute(
        'SELECT warehouse_id FROM stores WHERE id = ? AND is_active = 1',
        [store_id]
      );
      
      if (store.length === 0) {
        return res.status(400).json({ error: 'Store not found or inactive' });
      }
      
      returnWarehouseId = store[0].warehouse_id;
    } else {
      return res.status(400).json({ error: 'Either sale_id or store_id is required for returns' });
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseInt(item.quantity)), 0);

      // Create return
      const [returnResult] = await connection.execute(
        'INSERT INTO returns (customer_id, total_amount, created_by, sale_id, warehouse_id, store_id) VALUES (?, ?, ?, ?, ?, ?)',
        [customerId, total_amount, req.user.id, sale_id || null, returnWarehouseId, store_id || null]
      );
      const returnId = returnResult.insertId;
      
      // Process each item in the return
      for (const item of items) {
        const totalPrice = parseFloat(item.unit_price) * parseInt(item.quantity);
        
        // Insert return item
        await connection.execute(
          'INSERT INTO return_items (return_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
          [returnId, item.product_id, item.quantity, item.unit_price, totalPrice]
        );
        
        // Update warehouse stock (add back the returned items) to the determined warehouse
        const [stockRows] = await connection.execute(
          'SELECT id, total_pieces FROM warehouse_stock WHERE warehouse_id = ? AND product_id = ?',
          [returnWarehouseId, item.product_id]
        );
        
        const addQty = parseInt(item.quantity, 10);
        
        if (stockRows.length > 0) {
          const currentStock = stockRows[0];
          const oldTotalPieces = currentStock.total_pieces;
          const newTotalPieces = oldTotalPieces + addQty;
          
          await connection.execute(
            'UPDATE warehouse_stock SET total_pieces = ?, updated_at = NOW() WHERE id = ?',
            [newTotalPieces, currentStock.id]
          );
          
          // Record the IN change for return
          await connection.execute(
            `INSERT INTO stock_changes 
             (warehouse_id, product_id, user_id, change_type,
              old_total_pieces, new_total_pieces,
              old_weight_kg, new_weight_kg,
              old_volume_cbm, new_volume_cbm, reason)
             VALUES (?, ?, ?, 'IN', ?, ?, 0, 0, 0, 0, ?)`,
            [
              returnWarehouseId, item.product_id, req.user.id,
              oldTotalPieces, newTotalPieces,
              `Return #${returnId}${sale_id ? ` (sale #${sale_id})` : ''}`
            ]
          );
        } else {
          await connection.execute(
            'INSERT INTO warehouse_stock (warehouse_id, product_id, total_pieces, weight_kg, volume_cbm) VALUES (?, ?, ?, 0, 0)',
            [returnWarehouseId, item.product_id, addQty]
          );
          
          // Record the IN change for return (new item)
          await connection.execute(
            `INSERT INTO stock_changes 
             (warehouse_id, product_id, user_id, change_type,
              old_total_pieces, new_total_pieces,
              old_weight_kg, new_weight_kg,
              old_volume_cbm, new_volume_cbm, reason)
             VALUES (?, ?, ?, 'IN', ?, ?, 0, 0, 0, 0, ?)`,
            [
              returnWarehouseId, item.product_id, req.user.id,
              0, addQty,
              `Return #${returnId}${sale_id ? ` (sale #${sale_id})` : ''}`
            ]
          );
        }
      }

      // Update customer balance (refund the returned amount)
      await connection.execute(
        'UPDATE customers SET balance = balance + ? WHERE id = ?',
        [total_amount, customerId]
      );

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        id: returnId,
        message: 'Return created successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Create return error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/returns
app.get('/api/returns', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.customer_id, c.full_name as customer_name, r.total_amount, r.created_by, 
              u.login as created_by_name, r.created_at, r.sale_id, r.warehouse_id, r.store_id
       FROM returns r
       LEFT JOIN customers c ON r.customer_id = c.id
       JOIN users u ON r.created_by = u.id
       ORDER BY r.created_at DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error('Get returns error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/returns/:id
app.get('/api/returns/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get return header
    const [returnRows] = await db.execute(
      `SELECT r.id, r.customer_id, c.full_name as customer_name, r.total_amount, r.created_by, 
              u.login as created_by_name, r.created_at, r.sale_id, r.warehouse_id, r.store_id
       FROM returns r
       LEFT JOIN customers c ON r.customer_id = c.id
       JOIN users u ON r.created_by = u.id
       WHERE r.id = ?`,
      [id]
    );

    if (returnRows.length === 0) {
      return res.status(404).json({ error: 'Return not found' });
    }

    // Get return items
    const [itemRows] = await db.execute(
      'SELECT ri.id, ri.product_id, p.name as product_name, p.manufacturer, p.image, ri.quantity, '
      + 'ri.unit_price, ri.total_price '
      + 'FROM return_items ri '
      + 'JOIN products p ON ri.product_id = p.id '
      + 'WHERE ri.return_id = ?',
      [id]
    );

    res.json({
      ...returnRows[0],
      items: itemRows
    });
  } catch (error) {
    console.error('Get return error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server and initialize database
const startServer = async () => {
  try {
    // Test database connection
    await db.execute('SELECT 1');
    console.log('Database connected successfully');
        
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;