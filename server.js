const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db');
const { authMiddleware, authorizeStoreAccess } = require('./middleware');
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
      role: req.user.role,
      store_id: req.user.store_id
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

    const { login, password, name, role = 'USER', store_id } = req.body;

    // Validate required fields
    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required' });
    }

    // For USER role, store_id is required
    if (role === 'USER' && !store_id) {
      return res.status(400).json({ error: 'Store ID is required for regular users' });
    }

    // Validate that store exists (if provided)
    if (store_id) {
      const [store] = await db.execute('SELECT id FROM stores WHERE id = ?', [store_id]);
      if (store.length === 0) {
        return res.status(400).json({ error: 'Store not found' });
      }
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
      'INSERT INTO users (login, name, role, password_hash, store_id) VALUES (?, ?, ?, ?, ?)',
      [login, name || null, role, hashedPassword, store_id || null]
    );

    // Get the newly created user with created_at
    const [newUser] = await db.execute(
      'SELECT id, login, name, role, store_id, created_at FROM users WHERE id = ?',
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

    const [rows] = await db.execute('SELECT id, login, name, role, store_id, created_at FROM users ORDER BY created_at DESC');

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
    const { name, manufacturer, product_code, notification_threshold } = req.body;
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

    if (!product_code) {
      return res.status(400).json({ error: 'Product code is required' });
    }

    // Set default notification threshold to 10 if not provided
    const threshold = notification_threshold !== undefined ? parseInt(notification_threshold, 10) : 10;

    // Check if product_code already exists
    const [existingProduct] = await db.execute(
      'SELECT id FROM products WHERE product_code = ?',
      [product_code]
    );

    if (existingProduct.length > 0) {
      return res.status(400).json({ error: 'Product code must be unique' });
    }

    const [result] = await db.execute(
      'INSERT INTO products (name, manufacturer, product_code, image, notification_threshold) VALUES (?, ?, ?, ?, ?)',
      [name, manufacturer || null, product_code, image, threshold]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      manufacturer,
      product_code,
      image,
      message: 'Product added successfully'
    });
  } catch (error) {
    console.error('Add product error:', error);
    // Handle duplicate entry error specifically
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Product code must be unique' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products
app.get('/api/products', authMiddleware, async (req, res) => {
  try {
    // Get products with their last unit prices from sales, total stock, and purchase/selling prices
    const [rows] = await db.execute(
      `SELECT p.id, p.name, p.manufacturer, p.product_code, p.image, p.notification_threshold, p.created_at, `
      + `COALESCE(last_sale.last_unit_price, 0) as last_unit_price, `
      + `COALESCE(total_stock.total_quantity, 0) as total_stock, `
      + `COALESCE(prices.purchase_cost, 0) as purchase_cost, `
      + `COALESCE(prices.selling_price, 0) as selling_price `
      + `FROM products p `
      + `LEFT JOIN (`
      + `SELECT si.product_id, si.unit_price as last_unit_price, `
      + `ROW_NUMBER() OVER (PARTITION BY si.product_id ORDER BY s.created_at DESC) as rn `
      + `FROM sale_items si `
      + `JOIN sales s ON si.sale_id = s.id `
      + `) last_sale ON p.id = last_sale.product_id AND last_sale.rn = 1 `
      + `LEFT JOIN (`
      + `SELECT product_id, SUM(total_pieces) as total_quantity `
      + `FROM warehouse_stock `
      + `GROUP BY product_id `
      + `) total_stock ON p.id = total_stock.product_id `
      + `LEFT JOIN (`
      + `SELECT sri.product_id, sri.purchase_cost, sri.selling_price, `
      + `ROW_NUMBER() OVER (PARTITION BY sri.product_id ORDER BY sr.created_at DESC) as rn `
      + `FROM stock_receipt_items sri `
      + `JOIN stock_receipts sr ON sri.receipt_id = sr.id `
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
    const { name, manufacturer, product_code, notification_threshold } = req.body;

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

    // Check if product_code already exists for a different product
    if (product_code) {
      const [existingProduct] = await db.execute(
        'SELECT id FROM products WHERE product_code = ? AND id != ?',
        [product_code, id]
      );

      if (existingProduct.length > 0) {
        return res.status(400).json({ error: 'Product code must be unique' });
      }
    }

    // Prepare the update query based on whether notification_threshold is provided
    let updateQuery = 'UPDATE products SET name = ?, manufacturer = ?, product_code = ?, image = ?';
    let queryParams = [name, manufacturer || null, product_code || null, image, id];

    if (notification_threshold !== undefined) {
      updateQuery += ', notification_threshold = ?';
      queryParams = [name, manufacturer || null, product_code || null, image, parseInt(notification_threshold, 10), id];
    } else {
      queryParams = [name, manufacturer || null, product_code || null, image, id];
    }

    const [result] = await db.execute(updateQuery + ' WHERE id = ?', queryParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const [updatedProduct] = await db.execute('SELECT id, name, manufacturer, product_code, image, notification_threshold, created_at FROM products WHERE id = ?', [id]);

    res.json({
      ...updatedProduct[0],
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Update product error:', error);
    // Handle duplicate entry error specifically
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Product code must be unique' });
    }
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

// GET /api/products/missing
app.get('/api/products/missing', authMiddleware, async (req, res) => {
  try {
    // Get all products with their notification thresholds and total stock across all warehouses
    const [rows] = await db.execute(
      `SELECT p.id, p.name, p.manufacturer, p.product_code, p.image, p.notification_threshold, COALESCE(total_stock.total_quantity, 0) as total_stock
       FROM products p
       LEFT JOIN (
         SELECT product_id, SUM(total_pieces) as total_quantity
         FROM warehouse_stock
         GROUP BY product_id
       ) total_stock ON p.id = total_stock.product_id
       WHERE COALESCE(total_stock.total_quantity, 0) < p.notification_threshold
       ORDER BY p.name`
    );

    res.json(rows);
  } catch (error) {
    console.error('Get missing products error:', error);
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
    const { name, phone, balance, status, warehouse_id } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    if (!warehouse_id) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }

    // Validate that warehouse exists
    const [warehouse] = await db.execute('SELECT id FROM warehouses WHERE id = ?', [warehouse_id]);
    if (warehouse.length === 0) {
      return res.status(400).json({ error: 'Warehouse not found' });
    }

    const [result] = await db.execute(
      'INSERT INTO suppliers (name, phone, balance, status, warehouse_id) VALUES (?, ?, ?, ?, ?)',
      [name, phone || null, balance || 0, status !== undefined ? status : 1, warehouse_id]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      phone,
      balance: balance || 0,
      status: status !== undefined ? status : 1,
      warehouse_id,
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
      'SELECT id, name, phone, balance, status, warehouse_id, created_at, updated_at FROM suppliers WHERE status IN (1) ORDER BY name'
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
      'SELECT id, name, phone, balance, status, warehouse_id, created_at, updated_at FROM suppliers WHERE id = ?',
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
    const { name, phone, balance, status, warehouse_id } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    if (!warehouse_id) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }

    // Validate that warehouse exists
    const [warehouse] = await db.execute('SELECT id FROM warehouses WHERE id = ?', [warehouse_id]);
    if (warehouse.length === 0) {
      return res.status(400).json({ error: 'Warehouse not found' });
    }

    // Check if supplier exists
    const [existingSupplier] = await db.execute('SELECT id FROM suppliers WHERE id = ?', [id]);

    if (existingSupplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const [result] = await db.execute(
      'UPDATE suppliers SET name = ?, phone = ?, balance = ?, status = ?, warehouse_id = ? WHERE id = ?',
      [name, phone || null, balance !== undefined ? balance : 0, status !== undefined ? status : 1, warehouse_id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const [updatedSupplier] = await db.execute(
      'SELECT id, name, phone, balance, status, warehouse_id, created_at, updated_at FROM suppliers WHERE id = ?',
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

// POST /api/suppliers/:id/payment
app.post('/api/suppliers/:id/payment', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, warehouse_id, note } = req.body;

    // Validate required fields
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    // Check if supplier exists
    const [existingSupplier] = await db.execute('SELECT id, balance FROM suppliers WHERE id = ? AND status = 1', [id]);

    if (existingSupplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Validate warehouse if provided
    let warehouseId = null;
    if (warehouse_id) {
      const [warehouse] = await db.execute('SELECT id FROM warehouses WHERE id = ?', [warehouse_id]);
      if (warehouse.length === 0) {
        return res.status(400).json({ error: 'Warehouse not found' });
      }
      warehouseId = warehouse_id;
    }

    // Update supplier balance (decrease it since payment reduces debt)
    const newBalance = parseFloat(existingSupplier[0].balance) - parseFloat(amount);
    await db.execute('UPDATE suppliers SET balance = ? WHERE id = ?', [newBalance, id]);

    // Record the payment operation
    const [result] = await db.execute(
      'INSERT INTO supplier_operations (supplier_id, warehouse_id, sum, type) VALUES (?, ?, ?, ?)',
      [id, warehouseId, amount, 'PAYMENT']
    );

    res.json({
      operation_id: result.insertId,
      supplier_id: id,
      amount: amount,
      new_balance: newBalance,
      message: 'Payment recorded successfully'
    });
  } catch (error) {
    console.error('Record supplier payment error:', error);
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

    // Get products in the specified warehouse with their latest prices
    const [rows] = await db.execute(
      `SELECT ws.id, ws.product_id, p.name as product_name, p.manufacturer, p.image, p.product_code, 
      ws.total_pieces, ws.weight_kg, ws.volume_cbm, ws.updated_at,
      COALESCE(prices.purchase_cost, 0) as purchase_cost,
      COALESCE(prices.selling_price, 0) as selling_price
      FROM warehouse_stock ws
      JOIN products p ON ws.product_id = p.id
      LEFT JOIN (
        SELECT sri.product_id, sri.purchase_cost, sri.selling_price,
        ROW_NUMBER() OVER (PARTITION BY sri.product_id ORDER BY sr.created_at DESC) as rn
        FROM stock_receipt_items sri
        JOIN stock_receipts sr ON sri.receipt_id = sr.id
      ) prices ON ws.product_id = prices.product_id AND prices.rn = 1
      WHERE ws.warehouse_id = ?
      ORDER BY p.name`,
      [id]
    );

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
      'SELECT id, name, manufacturer, image, product_code, created_at FROM products WHERE id = ?',
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

      // Update supplier balance (increase it since we received goods from supplier)
      const [currentSupplier] = await connection.execute('SELECT balance FROM suppliers WHERE id = ?', [supplier_id]);
      const newBalance = parseFloat(currentSupplier[0].balance) + parseFloat(total_amount);
      await connection.execute('UPDATE suppliers SET balance = ? WHERE id = ?', [newBalance, supplier_id]);

      // Log the supplier operation for this receipt
      await connection.execute(
        'INSERT INTO supplier_operations (supplier_id, warehouse_id, receipt_id, sum, type) VALUES (?, ?, ?, ?, ?)',
        [supplier_id, warehouse_id, receiptId, total_amount, 'RECEIPT']
      );

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

// GET /api/suppliers/:supplierId/operations
app.get('/api/suppliers/:supplierId/operations', authMiddleware, async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { warehouseId, type, limit } = req.query;

    // Verify supplier exists
    const [supplier] = await db.execute('SELECT id, name, phone, balance FROM suppliers WHERE id = ? AND status = 1', [supplierId]);
    if (supplier.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Build query based on filters
    let query = `SELECT so.id, so.supplier_id, s.name as supplier_name, so.warehouse_id, 
                    w.name as warehouse_name, so.receipt_id, so.sum, so.type, so.date
             FROM supplier_operations so
             LEFT JOIN suppliers s ON so.supplier_id = s.id
             LEFT JOIN warehouses w ON so.warehouse_id = w.id
             WHERE so.supplier_id = ?`;

    const queryParams = [supplierId];

    // Add warehouse filter if provided
    if (warehouseId) {
      query += ' AND so.warehouse_id = ?';
      queryParams.push(warehouseId);
    }

    // Add type filter if provided
    if (type) {
      query += ' AND so.type = ?';
      queryParams.push(type);
    }

    query += ' ORDER BY so.date DESC';

    // Add limit if provided
    if (limit) {
      query += ' LIMIT ?';
      queryParams.push(parseInt(limit));
    }

    const [operations] = await db.execute(query, queryParams);

    res.json({
      supplier: supplier[0],
      operations: operations
    });
  } catch (error) {
    console.error('Get supplier operations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/warehouses/:warehouseId/suppliers
app.get('/api/warehouses/:warehouseId/suppliers', authMiddleware, async (req, res) => {
  try {
    const { warehouseId } = req.params;

    // Verify warehouse exists
    const [warehouse] = await db.execute('SELECT id, name FROM warehouses WHERE id = ?', [warehouseId]);
    if (warehouse.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    // Get suppliers that are directly assigned to this warehouse
    const [suppliers] = await db.execute(
      `SELECT id, name, phone, balance, status, warehouse_id, created_at, updated_at
       FROM suppliers 
       WHERE warehouse_id = ? AND status = 1
       ORDER BY name`,
      [warehouseId]
    );

    res.json({
      warehouse: warehouse[0],
      suppliers: suppliers
    });
  } catch (error) {
    console.error('Get warehouse suppliers error:', error);
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
      'SELECT sri.id, sri.product_id, p.name as product_name, p.manufacturer, p.image, p.product_code, sri.boxes_qty, sri.pieces_per_box, sri.loose_pieces, sri.total_pieces, '
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

// GET /api/stock-receipt-items
app.get('/api/stock-receipt-items', authMiddleware, async (req, res) => {
  try {
    const { receipt_id, supplier_id, warehouse_id } = req.query;

    // Build query based on provided filters
    let query = 'SELECT sri.*, p.name as product_name, p.manufacturer, p.image, p.product_code ';
    query += 'FROM stock_receipt_items sri ';
    query += 'JOIN stock_receipts sr ON sri.receipt_id = sr.id ';
    query += 'JOIN products p ON sri.product_id = p.id ';

    const queryParams = [];
    let whereConditions = [];

    if (receipt_id) {
      whereConditions.push('sri.receipt_id = ?');
      queryParams.push(receipt_id);
    }

    if (supplier_id) {
      whereConditions.push('sr.supplier_id = ?');
      queryParams.push(supplier_id);
    }

    if (warehouse_id) {
      whereConditions.push('sr.warehouse_id = ?');
      queryParams.push(warehouse_id);
    }

    if (whereConditions.length > 0) {
      query += 'WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY sri.id DESC';

    const [rows] = await db.execute(query, queryParams);

    res.json(rows);
  } catch (error) {
    console.error('Get stock receipt items error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/warehouse/stock
app.get('/api/warehouse/stock', authMiddleware, async (req, res) => {
  try {
    // Get warehouse stock with purchase and selling prices
    const [rows] = await db.execute(
      `SELECT ws.id, ws.warehouse_id, w.name as warehouse_name, ws.product_id, p.name as product_name, p.product_code,
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
      'SELECT sc.id, sc.warehouse_id, w.name as warehouse_name, sc.product_id, p.name as product_name, p.product_code, '
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
      'SELECT sc.id, sc.warehouse_id, w.name as warehouse_name, sc.product_id, p.name as product_name, p.product_code, '
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
app.post('/api/customers', authMiddleware, authorizeStoreAccess(false), async (req, res) => {
  try {
    const { full_name, phone, city, store_id } = req.body;

    if (!full_name) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    let actualStoreId = store_id;

    // For regular users, override store_id to their assigned store
    if (req.user.role !== 'ADMIN') {
      actualStoreId = req.userStoreId;
    } else {
      // For admins, store_id is required in request
      if (!store_id) {
        return res.status(400).json({ error: 'Store ID is required' });
      }
    }

    // Validate that store exists
    const [store] = await db.execute('SELECT id FROM stores WHERE id = ?', [actualStoreId]);
    if (store.length === 0) {
      return res.status(400).json({ error: 'Store not found' });
    }

    const [result] = await db.execute(
      'INSERT INTO customers (full_name, phone, city, store_id) VALUES (?, ?, ?, ?)',
      [full_name, phone || null, city || null, actualStoreId]
    );

    res.status(201).json({
      id: result.insertId,
      full_name,
      phone,
      city,
      store_id: actualStoreId,
      balance: 0,
      message: 'Customer created successfully'
    });
  } catch (error) {
    console.error('Add customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers
app.get('/api/customers', authMiddleware, authorizeStoreAccess(true), async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'ADMIN') {
      // Admins see all customers
      query = 'SELECT id, full_name, phone, city, store_id, balance, created_at, updated_at FROM customers ORDER BY created_at DESC';
    } else {
      // Regular users see only customers from their store
      query = 'SELECT id, full_name, phone, city, store_id, balance, created_at, updated_at FROM customers WHERE store_id = ? ORDER BY created_at DESC';
      params = [req.userStoreId];
    }

    const [rows] = await db.execute(query, params);
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

    const [rows] = await db.execute('SELECT id, full_name, phone, city, store_id, balance, created_at, updated_at FROM customers WHERE id = ?', [id]);

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
    const { full_name, phone, city, store_id } = req.body;

    if (!full_name) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    if (!store_id) {
      return res.status(400).json({ error: 'Store ID is required' });
    }

    // Validate that store exists
    const [store] = await db.execute('SELECT id FROM stores WHERE id = ?', [store_id]);
    if (store.length === 0) {
      return res.status(400).json({ error: 'Store not found' });
    }

    const [result] = await db.execute(
      'UPDATE customers SET full_name = ?, phone = ?, city = ?, store_id = ? WHERE id = ?',
      [full_name, phone || null, city || null, store_id || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const [updatedCustomer] = await db.execute('SELECT id, full_name, phone, city, store_id, balance, created_at, updated_at FROM customers WHERE id = ?', [id]);

    res.json({
      ...updatedCustomer[0],
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stores/:storeId/customers
app.get('/api/stores/:storeId/customers', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;

    // Verify store exists
    const [store] = await db.execute('SELECT id, name, warehouse_id FROM stores WHERE id = ?', [storeId]);
    if (store.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Get all customers with this store_id
    const [customers] = await db.execute(
      `SELECT c.id, c.full_name, c.phone, c.city, c.store_id, c.balance, c.created_at, c.updated_at
       FROM customers c
       WHERE c.store_id = ?
       ORDER BY c.full_name`,
      [storeId]
    );

    res.json({
      store: store[0],
      customers: customers
    });
  } catch (error) {
    console.error('Get store customers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:customerId/sales/:storeId
app.get('/api/customers/:customerId/sales/:storeId', authMiddleware, async (req, res) => {
  try {
    const { customerId, storeId } = req.params;

    // Verify customer exists
    const [customer] = await db.execute('SELECT id, full_name, phone, city, balance FROM customers WHERE id = ?', [customerId]);
    if (customer.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Verify store exists
    const [store] = await db.execute('SELECT id, name, warehouse_id FROM stores WHERE id = ?', [storeId]);
    if (store.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Get sales records for this customer at this store
    const [sales] = await db.execute(
      `SELECT s.id, s.customer_id, c.full_name as customer_name, s.total_amount, s.payment_status, s.created_by,
              u.login as created_by_name, s.created_at, s.store_id, s.warehouse_id,
              st.name as store_name, w.name as warehouse_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN stores st ON s.store_id = st.id
       LEFT JOIN warehouses w ON s.warehouse_id = w.id
       JOIN users u ON s.created_by = u.id
       WHERE s.customer_id = ? AND s.store_id = ?
       ORDER BY s.created_at DESC`,
      [customerId, storeId]
    );

    res.json({
      customer: customer[0],
      store: store[0],
      sales: sales
    });
  } catch (error) {
    console.error('Get customer store sales error:', error);
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
    const { month, year } = req.query;

    // Get customer info
    const [customerRows] = await db.execute(
      'SELECT id, full_name, phone, city, balance, created_at, updated_at FROM customers WHERE id = ?',
      [id]
    );

    if (customerRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerRows[0];

    // Build date condition for filtering
    let dateCondition = '';
    const dateParams = [];
    if (month && year) {
      dateCondition = ' AND MONTH(s.created_at) = ? AND YEAR(s.created_at) = ?';
      dateParams.push(parseInt(month), parseInt(year));
    } else if (month) {
      dateCondition = ' AND MONTH(s.created_at) = ?';
      dateParams.push(parseInt(month));
    } else if (year) {
      dateCondition = ' AND YEAR(s.created_at) = ?';
      dateParams.push(parseInt(year));
    }

    // Get customer's sales
    const [sales] = await db.execute(
      `SELECT s.id, s.total_amount, s.created_at as transaction_date, 'sale' as transaction_type
       FROM sales s
       WHERE s.customer_id = ?` + dateCondition + `
       ORDER BY s.created_at DESC`,
      [id, ...dateParams]
    );

    // Get customer's returns
    const [returns] = await db.execute(
      `SELECT r.id, r.total_amount, r.created_at as transaction_date, 'return' as transaction_type
       FROM returns r
       WHERE r.customer_id = ?` + dateCondition + `
       ORDER BY r.created_at DESC`,
      [id, ...dateParams]
    );

    // Get customer's payment operations
    let paymentDateCondition = '';
    const paymentDateParams = [];
    if (month && year) {
      paymentDateCondition = ' AND MONTH(co.date) = ? AND YEAR(co.date) = ?';
      paymentDateParams.push(parseInt(month), parseInt(year));
    } else if (month) {
      paymentDateCondition = ' AND MONTH(co.date) = ?';
      paymentDateParams.push(parseInt(month));
    } else if (year) {
      paymentDateCondition = ' AND YEAR(co.date) = ?';
      paymentDateParams.push(parseInt(year));
    }

    const [payments] = await db.execute(
      `SELECT co.id, co.sum as total_amount, co.date as transaction_date, 'payment' as transaction_type
       FROM customer_operations co
       WHERE co.customer_id = ? AND co.type = 'PAYMENT'` + paymentDateCondition + `
       ORDER BY co.date DESC`,
      [id, ...paymentDateParams]
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
      })),
      ...payments.map(p => ({
        id: p.id,
        amount: p.total_amount,
        date: p.transaction_date,
        type: p.transaction_type
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

// POST /api/customers/:id/payment
app.post('/api/customers/:id/payment', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_method, note, store_id } = req.body;

    // Validate required fields
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Validate customer exists
    const [customer] = await db.execute('SELECT id, balance, full_name FROM customers WHERE id = ?', [id]);
    if (customer.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Validate store if provided
    if (store_id) {
      const [store] = await db.execute('SELECT id FROM stores WHERE id = ?', [store_id]);
      if (store.length === 0) {
        return res.status(400).json({ error: 'Store not found' });
      }
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Record the payment in customer_operations table
      const [result] = await connection.execute(
        'INSERT INTO customer_operations (customer_id, store_id, sale_id, sum, type, date) VALUES (?, ?, ?, ?, ?, CURDATE())',
        [id, store_id || null, null, parsedAmount, 'PAYMENT']
      );

      // Update customer balance (reduce debt/negative balance)
      const newBalance = parseFloat(customer[0].balance) + parsedAmount;
      await connection.execute('UPDATE customers SET balance = ? WHERE id = ?', [newBalance, id]);

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        id: result.insertId,
        customer_id: id,
        customer_name: customer[0].full_name,
        amount: parsedAmount,
        payment_method: payment_method || 'CASH',
        note: note || null,
        store_id: store_id || null,
        new_balance: newBalance,
        message: 'Customer payment recorded successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Record customer payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/retail-debtors
app.get('/api/retail-debtors', authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.query;

    // For non-admin users, restrict to their store
    let storeFilter = '';
    const params = [];
    if (req.user.role !== 'ADMIN') {
      storeFilter = 'WHERE rd.store_id = ?';
      params.push(req.userStoreId);
    } else if (store_id) {
      storeFilter = 'WHERE rd.store_id = ?';
      params.push(store_id);
    }

    const [debtors] = await db.execute(`
      SELECT 
        rd.id,
        rd.customer_name,
        rd.phone,
        rd.store_id,
        rd.created_at,
        SUM(CASE WHEN ro.type = 'DEBT' THEN ro.amount ELSE 0 END) as total_debt,
        SUM(CASE WHEN ro.type IN ('PAYMENT','RETURN') THEN ro.amount ELSE 0 END) as total_paid,
        (SUM(CASE WHEN ro.type = 'DEBT' THEN ro.amount ELSE 0 END) - 
         SUM(CASE WHEN ro.type IN ('PAYMENT','RETURN') THEN ro.amount ELSE 0 END)) as remaining_balance
      FROM retail_debtors rd
      LEFT JOIN retail_operations ro ON rd.id = ro.retail_debtor_id
      ${storeFilter}
      GROUP BY rd.id, rd.customer_name, rd.phone, rd.store_id, rd.created_at
      HAVING remaining_balance > 0
      ORDER BY remaining_balance DESC
    `, params);

    res.json(debtors);
  } catch (error) {
    console.error('Get retail debtors error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/retail-debtors
app.post('/api/retail-debtors', authMiddleware, async (req, res) => {
  try {
    const { customer_name, phone, sale_id, amount, store_id } = req.body;

    // Валидация
    if (!customer_name || !sale_id || !amount) {
      return res.status(400).json({ error: 'Customer name, sale_id and amount are required' });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Determine store for debtor (admins can pass store_id, users are limited to their store)
      let actualStoreId = store_id;
      if (req.user.role !== 'ADMIN') {
        actualStoreId = req.userStoreId;
      } else {
        if (!actualStoreId) {
          return res.status(400).json({ error: 'Store ID is required for admin when creating retail debtor' });
        }
      }

      // Validate that store exists (if provided)
      if (actualStoreId) {
        const [storeCheck] = await connection.execute('SELECT id FROM stores WHERE id = ?', [actualStoreId]);
        if (storeCheck.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: 'Store not found' });
        }
      }

      // Создаем должника
      const [debtorResult] = await connection.execute(
        'INSERT INTO retail_debtors (customer_name, phone, store_id) VALUES (?, ?, ?)',
        [customer_name, phone || null, actualStoreId || null]
      );

      const debtorId = debtorResult.insertId;

      // Создаем операцию долга
      await connection.execute(
        'INSERT INTO retail_operations (retail_debtor_id, sale_id, amount, type) VALUES (?, ?, ?, ?)',
        [debtorId, sale_id, amount, 'DEBT']
      );

      await connection.commit();
      connection.release();

      res.status(201).json({
        id: debtorId,
        customer_name,
        phone,
        message: 'Retail debtor created successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Create retail debtor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/retail-debtors/:id
app.get('/api/retail-debtors/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [debtor] = await db.execute(`
      SELECT 
        rd.id,
        rd.customer_name,
        rd.phone,
        rd.store_id,
        rd.created_at,
        SUM(CASE WHEN ro.type = 'DEBT' THEN ro.amount ELSE 0 END) as total_debt,
        SUM(CASE WHEN ro.type IN ('PAYMENT','RETURN') THEN ro.amount ELSE 0 END) as total_paid,
        (SUM(CASE WHEN ro.type = 'DEBT' THEN ro.amount ELSE 0 END) - 
         SUM(CASE WHEN ro.type IN ('PAYMENT','RETURN') THEN ro.amount ELSE 0 END)) as remaining_balance
      FROM retail_debtors rd
      LEFT JOIN retail_operations ro ON rd.id = ro.retail_debtor_id
      WHERE rd.id = ?
      GROUP BY rd.id, rd.customer_name, rd.phone, rd.store_id, rd.created_at
    `, [id]);

    if (debtor.length === 0) {
      return res.status(404).json({ error: 'Retail debtor not found' });
    }

    // Restrict access for non-admins to their store
    if (req.user.role !== 'ADMIN' && debtor[0].store_id !== req.userStoreId) {
      return res.status(404).json({ error: 'Retail debtor not found' });
    }

    // Получаем историю операций
    const [operations] = await db.execute(`
      SELECT 
        ro.id,
        ro.type,
        ro.amount,
        ro.description,
        ro.created_at,
        s.id as sale_id,
        s.total_amount as sale_amount
      FROM retail_operations ro
      LEFT JOIN sales s ON ro.sale_id = s.id
      WHERE ro.retail_debtor_id = ?
      ORDER BY ro.created_at DESC
    `, [id]);

    res.json({
      ...debtor[0],
      operations
    });
  } catch (error) {
    console.error('Get retail debtor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/retail-debtors/:id/payments
app.post('/api/retail-debtors/:id/payments', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Проверяем существует ли должник и доступность для пользователя
    const [debtor] = await db.execute(
      'SELECT id, store_id FROM retail_debtors WHERE id = ?', [id]
    );

    if (debtor.length === 0) {
      return res.status(404).json({ error: 'Retail debtor not found' });
    }

    if (req.user.role !== 'ADMIN' && debtor[0].store_id !== req.userStoreId) {
      return res.status(404).json({ error: 'Retail debtor not found' });
    }

    // Создаем операцию оплаты
    const [result] = await db.execute(
      'INSERT INTO retail_operations (retail_debtor_id, amount, type, description) VALUES (?, ?, ?, ?)',
      [id, amount, 'PAYMENT', description || null]
    );

    res.status(201).json({
      id: result.insertId,
      retail_debtor_id: id,
      amount,
      type: 'PAYMENT',
      description,
      message: 'Payment recorded successfully'
    });
  } catch (error) {
    console.error('Record retail payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/retail-debtors/:id/operations
app.get('/api/retail-debtors/:id/operations', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [operations] = await db.execute(`
      SELECT 
        ro.id,
        ro.type,
        ro.amount,
        ro.description,
        ro.created_at,
        s.id as sale_id,
        s.total_amount as sale_amount
      FROM retail_operations ro
      LEFT JOIN sales s ON ro.sale_id = s.id
      WHERE ro.retail_debtor_id = ?
      ORDER BY ro.created_at DESC
    `, [id]);

    res.json(operations);
  } catch (error) {
    console.error('Get retail operations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:customerId/operations
// Modified to make customerId optional - if not provided, returns operations for all customers in specified store
app.get('/api/customers/:customerId/operations', authMiddleware, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { store_id, type, month, year } = req.query;

    // If customerId is provided, verify customer exists
    let customer = null;
    if (customerId && customerId !== 'undefined' && customerId !== 'null') {
      const [customerResult] = await db.execute('SELECT id, full_name, phone, balance FROM customers WHERE id = ?', [customerId]);
      if (customerResult.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      customer = customerResult[0];
    }

    // Require store_id when no customer specified
    if (!customerId && !store_id) {
      return res.status(400).json({ error: 'store_id is required when no customer specified' });
    }

    // Build query based on filters - includes both customer_operations and returns
    let query = `
      SELECT * FROM (
        SELECT 
          co.id, 
          co.customer_id, 
          c.full_name as customer_name, 
          co.store_id, 
          s.name as store_name, 
          co.sale_id, 
          co.sum, 
          co.type, 
          co.date,
          'operation' as source
        FROM customer_operations co
        LEFT JOIN customers c ON co.customer_id = c.id
        LEFT JOIN stores s ON co.store_id = s.id
        
        UNION ALL
        
        SELECT 
          r.id, 
          r.customer_id, 
          c.full_name as customer_name, 
          r.store_id, 
          s.name as store_name, 
          r.sale_id, 
          r.total_amount as sum, 
          'RETURN' as type, 
          r.created_at as date,
          'return' as source
        FROM returns r
        LEFT JOIN customers c ON r.customer_id = c.id
        LEFT JOIN stores s ON r.store_id = s.id
      ) as operations
    `;

    const queryParams = [];
    const conditions = [];

    // Add customer filter if provided
    if (customerId && customerId !== 'undefined' && customerId !== 'null') {
      conditions.push('customer_id = ?');
      queryParams.push(customerId);
    }

    // Add store filter if provided
    if (store_id) {
      conditions.push('store_id = ?');
      queryParams.push(store_id);
    }

    // Add type filter if provided
    if (type) {
      conditions.push('type = ?');
      queryParams.push(type);
    }

    // Add date filtering if month and/or year are provided
    if (month && year) {
      conditions.push('(MONTH(date) = ? AND YEAR(date) = ?)');
      queryParams.push(parseInt(month), parseInt(year));
    } else if (month) {
      conditions.push('MONTH(date) = ?');
      queryParams.push(parseInt(month));
    } else if (year) {
      conditions.push('YEAR(date) = ?');
      queryParams.push(parseInt(year));
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC';

    const [operations] = await db.execute(query, queryParams);

    const response = {
      operations: operations
    };

    // Include customer info only if specific customer was requested
    if (customer) {
      response.customer = customer;
    }

    // Include store info if store_id was specified
    if (store_id) {
      const [storeResult] = await db.execute('SELECT id, name FROM stores WHERE id = ?', [store_id]);
      if (storeResult.length > 0) {
        response.store = storeResult[0];
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Get customer operations error:', error);
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
    const { customer_id, store_id, items, payment_status = 'DEBT' } = req.body;

    // Validate required fields
    if (!store_id) {
      return res.status(400).json({ error: 'Store ID is required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Validate payment status
    if (payment_status !== 'PAID' && payment_status !== 'DEBT') {
      return res.status(400).json({ error: 'Payment status must be either PAID or DEBT' });
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

    // Handle retail customer logic
    let customerId = customer_id;
    let isRetailDebt = false;

    if (!customerId && payment_status === 'DEBT') {
      // This is a retail customer taking debt - we'll create retail debtor record
      isRetailDebt = true;
      // Customer ID remains NULL for retail debt sales
    }
    // For regular retail cash sales, customer_id remains NULL

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseInt(item.quantity)), 0);

      // Create sale with store_id, warehouse_id, and payment_status
      // customer_id can be NULL for retail sales
      const [saleResult] = await connection.execute(
        'INSERT INTO sales (customer_id, store_id, warehouse_id, total_amount, payment_status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [customerId || null, store_id, storeWarehouseId, total_amount, payment_status, req.user.id]
      );
      const saleId = saleResult.insertId;

      // Process each item in the sale
      for (const item of items) {
        const totalPrice = parseFloat(item.unit_price) * parseInt(item.quantity);

        // Verify product exists before inserting sale item
        const [productCheck] = await connection.execute(
          'SELECT id FROM products WHERE id = ?',
          [item.product_id]
        );

        if (productCheck.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            error: `Product with ID ${item.product_id} not found`
          });
        }

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

      // Handle retail debt creation if needed
      if (isRetailDebt) {
        const { customer_name, phone } = req.body;

        if (!customer_name) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: 'Customer name is required for retail debt sales' });
        }

        // Create retail debtor (associate with sale's store)
        const [debtorResult] = await connection.execute(
          'INSERT INTO retail_debtors (customer_name, phone, store_id) VALUES (?, ?, ?)',
          [customer_name, phone || null, store_id || null]
        );

        const debtorId = debtorResult.insertId;

        // Create retail operation for the debt
        await connection.execute(
          'INSERT INTO retail_operations (retail_debtor_id, sale_id, amount, type) VALUES (?, ?, ?, ?)',
          [debtorId, saleId, total_amount, 'DEBT']
        );

        // Commit transaction
        await connection.commit();
        connection.release();

        return res.status(201).json({
          id: saleId,
          retail_debtor_id: debtorId,
          customer_name: customer_name,
          phone: phone || null,
          amount: total_amount,
          message: 'Sale created successfully with retail debt record'
        });
      }

      // Update customer balance based on payment status and log the operation
      // Only for registered customers (not retail)
      if (!isRetailDebt && customerId && payment_status === 'DEBT') {
        // If it's debt, decrease customer balance (they owe money)
        await connection.execute(
          'UPDATE customers SET balance = balance - ? WHERE id = ?',
          [total_amount, customerId]
        );

        // Log the debt operation
        await connection.execute(
          'INSERT INTO customer_operations (customer_id, store_id, sale_id, sum, type) VALUES (?, ?, ?, ?, ?)',
          [customerId, store_id, saleId, total_amount, 'DEBT']
        );
      } else if (!isRetailDebt && customerId) {
        // If it's paid, don't change the balance (assuming payment was made separately)
        // Only for registered customers with valid ID
        // Log the paid operation
        await connection.execute(
          'INSERT INTO customer_operations (customer_id, store_id, sale_id, sum, type) VALUES (?, ?, ?, ?, ?)',
          [customerId, store_id, saleId, total_amount, 'PAID']
        );
      }

      // Commit transaction for regular sales
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
    const { day, month, year, store_id } = req.query;

    // Return retail sales + debt payments + retail cash returns
    // This combines:
    // 1. Retail sales (customer_id IS NULL)
    // 2. Debt payment/return operations from retail_operations
    // 3. Retail cash returns (customer_id IS NULL AND retail_debtor_id IS NULL)

    let dateCondition = '';
    let dateConditions = [];

    if (day && month && year) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dateCondition = ` AND DATE(created_at) = '${dateStr}'`;
      dateConditions = [dateStr, dateStr, dateStr];
    } else if (month && year) {
      dateCondition = ` AND YEAR(created_at) = ${parseInt(year)} AND MONTH(created_at) = ${parseInt(month)}`;
      dateConditions = [parseInt(year), parseInt(month), parseInt(year), parseInt(month), parseInt(year), parseInt(month)];
    } else if (year) {
      dateCondition = ` AND YEAR(created_at) = ${parseInt(year)}`;
      dateConditions = [parseInt(year), parseInt(year), parseInt(year)];
    }

    let storeCondition = store_id ? ` AND s.store_id = ${parseInt(store_id)}` : '';
    let storeConditionDebtor = store_id ? ` AND rd.store_id = ${parseInt(store_id)}` : '';
    let storeConditionReturn = store_id ? ` AND r.store_id = ${parseInt(store_id)}` : '';

    let query = `
      SELECT * FROM (
        SELECT 
          'SALE' as type,
          s.id as transaction_id,
          NULL as retail_debtor_id,
          s.total_amount as amount,
          s.payment_status,
          s.created_at,
          s.created_by,
          u.login as created_by_name,
          s.store_id,
          st.name as store_name,
          s.warehouse_id,
          w.name as warehouse_name,
          NULL as customer_name,
          NULL as phone
        FROM sales s
        LEFT JOIN stores st ON s.store_id = st.id
        LEFT JOIN warehouses w ON s.warehouse_id = w.id
        JOIN users u ON s.created_by = u.id
        WHERE s.customer_id IS NULL${storeCondition}${day && month && year ? ` AND DATE(s.created_at) = '${dateConditions[0]}'` : (month && year ? ` AND YEAR(s.created_at) = ${dateConditions[0]} AND MONTH(s.created_at) = ${dateConditions[1]}` : (year ? ` AND YEAR(s.created_at) = ${dateConditions[0]}` : ''))}
        
        UNION ALL
        
        SELECT 
          ro.type as type,
          ro.id as transaction_id,
          ro.retail_debtor_id,
          ro.amount,
          'PAID' as payment_status,
          ro.created_at,
          NULL as created_by,
          NULL as created_by_name,
          rd.store_id as store_id,
          NULL as store_name,
          NULL as warehouse_id,
          NULL as warehouse_name,
          rd.customer_name,
          rd.phone
        FROM retail_operations ro
        JOIN retail_debtors rd ON ro.retail_debtor_id = rd.id
        WHERE ro.type IN ('PAYMENT','RETURN')${storeConditionDebtor}${day && month && year ? ` AND DATE(ro.created_at) = '${dateConditions[0]}'` : (month && year ? ` AND YEAR(ro.created_at) = ${dateConditions[0]} AND MONTH(ro.created_at) = ${dateConditions[1]}` : (year ? ` AND YEAR(ro.created_at) = ${dateConditions[0]}` : ''))}
        
        UNION ALL
        
        SELECT 
          'RETURN' as type,
          r.id as transaction_id,
          NULL as retail_debtor_id,
          r.total_amount as amount,
          'REFUND' as payment_status,
          r.created_at,
          r.created_by,
          u.login as created_by_name,
          r.store_id,
          st.name as store_name,
          r.warehouse_id,
          w.name as warehouse_name,
          NULL as customer_name,
          NULL as phone
        FROM returns r
        LEFT JOIN stores st ON r.store_id = st.id
        LEFT JOIN warehouses w ON r.warehouse_id = w.id
        JOIN users u ON r.created_by = u.id
        WHERE r.customer_id IS NULL AND r.retail_debtor_id IS NULL${storeConditionReturn}${day && month && year ? ` AND DATE(r.created_at) = '${dateConditions[0]}'` : (month && year ? ` AND YEAR(r.created_at) = ${dateConditions[0]} AND MONTH(r.created_at) = ${dateConditions[1]}` : (year ? ` AND YEAR(r.created_at) = ${dateConditions[0]}` : ''))}
      ) as transactions
      ORDER BY created_at DESC
    `;

    const [rows] = await db.execute(query);

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
      `SELECT s.id, s.customer_id, c.full_name as customer_name, s.total_amount, s.payment_status, s.created_by, 
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
      'SELECT si.id, si.product_id, p.name as product_name, p.manufacturer, p.image, p.product_code, si.quantity, '
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

// POST /api/returns/client - Возврат для зарегистрированных клиентов
app.post('/api/returns/client', authMiddleware, async (req, res) => {
  try {
    const { customer_id, store_id, items } = req.body;

    // Validate required fields
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required for client returns' });
    }

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required for client returns' });
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

    const customerId = customer_id;

    // Validate that customer exists
    const [customer] = await db.execute('SELECT id FROM customers WHERE id = ?', [customerId]);
    if (customer.length === 0) {
      return res.status(400).json({ error: 'Customer not found' });
    }

    // Validate that store exists and get warehouse
    const [store] = await db.execute(
      'SELECT warehouse_id FROM stores WHERE id = ? AND is_active = 1',
      [store_id]
    );

    if (store.length === 0) {
      return res.status(400).json({ error: 'Store not found or inactive' });
    }

    const returnWarehouseId = store[0].warehouse_id;

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseInt(item.quantity)), 0);

      // Create return
      const [returnResult] = await connection.execute(
        'INSERT INTO returns (customer_id, total_amount, created_by, warehouse_id, store_id) VALUES (?, ?, ?, ?, ?)',
        [customerId, total_amount, req.user.id, returnWarehouseId, store_id || null]
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
              `Return #${returnId}`
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
              `Return #${returnId}`
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
        message: 'Client return created successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Create client return error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/returns/retail-cash - Возврат для розничных клиентов (наличные)
app.post('/api/returns/retail-cash', authMiddleware, async (req, res) => {
  try {
    const { store_id, items } = req.body;

    // Validate required fields
    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required for retail cash returns' });
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

    // Validate that store exists
    const [store] = await db.execute(
      'SELECT id, warehouse_id FROM stores WHERE id = ? AND is_active = 1',
      [store_id]
    );

    if (store.length === 0) {
      return res.status(400).json({ error: 'Store not found or inactive' });
    }

    const returnWarehouseId = store[0].warehouse_id;

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseInt(item.quantity)), 0);

      // Create return (without customer_id for retail cash)
      const [returnResult] = await connection.execute(
        'INSERT INTO returns (total_amount, created_by, warehouse_id, store_id) VALUES (?, ?, ?, ?)',
        [total_amount, req.user.id, returnWarehouseId, store_id]
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

        // Update warehouse stock (add back the returned items)
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
              `Retail cash return #${returnId}`
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
              `Retail cash return #${returnId}`
            ]
          );
        }
      }

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        id: returnId,
        message: 'Retail cash return created successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Create retail cash return error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/returns/retail-debt - Возврат для розничных клиентов (в долг)
app.post('/api/returns/retail-debt', authMiddleware, async (req, res) => {
  try {
    const { retail_debtor_id, store_id, items } = req.body;

    // Validate required fields
    if (!retail_debtor_id) {
      return res.status(400).json({ error: 'retail_debtor_id is required for retail debt returns' });
    }

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required for retail debt returns' });
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

    // Validate that retail debtor exists
    const [debtor] = await db.execute('SELECT id FROM retail_debtors WHERE id = ?', [retail_debtor_id]);
    if (debtor.length === 0) {
      return res.status(400).json({ error: 'Retail debtor not found' });
    }

    // Validate that store exists
    const [store] = await db.execute(
      'SELECT id, warehouse_id FROM stores WHERE id = ? AND is_active = 1',
      [store_id]
    );

    if (store.length === 0) {
      return res.status(400).json({ error: 'Store not found or inactive' });
    }

    const returnWarehouseId = store[0].warehouse_id;

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseInt(item.quantity)), 0);

      // Create return (link to retail debtor)
      const [returnResult] = await connection.execute(
        'INSERT INTO returns (total_amount, created_by, retail_debtor_id, warehouse_id, store_id) VALUES (?, ?, ?, ?, ?)',
        [total_amount, req.user.id, retail_debtor_id, returnWarehouseId, store_id]
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

        // Update warehouse stock (add back the returned items)
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
              `Retail debt return #${returnId} (debtor #${retail_debtor_id})`
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
              `Retail debt return #${returnId} (debtor #${retail_debtor_id})`
            ]
          );
        }
      }

      // Create retail operation to reduce debtor's debt
      await connection.execute(
        'INSERT INTO retail_operations (retail_debtor_id, amount, type, description) VALUES (?, ?, ?, ?)',
        [retail_debtor_id, total_amount, 'RETURN', `Return #${returnId}`]
      );

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        id: returnId,
        retail_debtor_id: retail_debtor_id,
        message: 'Retail debt return created successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Create retail debt return error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/returns
app.get('/api/returns', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.customer_id, c.full_name as customer_name, r.retail_debtor_id, rd.customer_name as retail_debtor_name, r.total_amount, r.created_by, 
              u.login as created_by_name, r.created_at, r.sale_id, r.warehouse_id, r.store_id
       FROM returns r
       LEFT JOIN customers c ON r.customer_id = c.id
       LEFT JOIN retail_debtors rd ON r.retail_debtor_id = rd.id
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
      `SELECT r.id, r.customer_id, c.full_name as customer_name, r.retail_debtor_id, rd.customer_name as retail_debtor_name, r.total_amount, r.created_by, 
              u.login as created_by_name, r.created_at, r.sale_id, r.warehouse_id, r.store_id
             FROM returns r
             LEFT JOIN customers c ON r.customer_id = c.id
             LEFT JOIN retail_debtors rd ON r.retail_debtor_id = rd.id
             JOIN users u ON r.created_by = u.id
             WHERE r.id = ?`,
      [id]
    );

    if (returnRows.length === 0) {
      return res.status(404).json({ error: 'Return not found' });
    }

    // Get return items
    const [itemRows] = await db.execute(
      'SELECT ri.id, ri.product_id, p.name as product_name, p.manufacturer, p.image, p.product_code, ri.quantity, '
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

// Expenses Management Routes

// POST /api/expenses
app.post('/api/expenses', authMiddleware, async (req, res) => {
  try {
    const { amount, comment, expense_date, store_id } = req.body;

    // Validate required fields
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    if (!store_id) {
      return res.status(400).json({ error: 'Store ID is required' });
    }

    // Validate amount is a number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Validate store_id exists
    const [storeResult] = await db.execute('SELECT id FROM stores WHERE id = ?', [store_id]);
    if (storeResult.length === 0) {
      return res.status(400).json({ error: 'Store not found' });
    }

    // Validate date format if provided
    let expenseDate = new Date();
    if (expense_date) {
      expenseDate = new Date(expense_date);
      if (isNaN(expenseDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
    }

    const [result] = await db.execute(
      'INSERT INTO expenses (amount, comment, expense_date, store_id) VALUES (?, ?, ?, ?)',
      [parsedAmount, comment || null, expenseDate.toISOString().split('T')[0], store_id]
    );

    res.status(201).json({
      id: result.insertId,
      amount: parsedAmount,
      comment: comment || null,
      expense_date: expenseDate.toISOString().split('T')[0],
      store_id: store_id,
      message: 'Expense added successfully'
    });
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/expenses
app.get('/api/expenses', authMiddleware, async (req, res) => {
  try {
    const { month, year, store_id } = req.query;

    let query = 'SELECT e.id, e.amount, e.comment, e.expense_date, e.store_id, s.name as store_name, e.created_at, e.updated_at FROM expenses e LEFT JOIN stores s ON e.store_id = s.id';
    const params = [];
    let conditions = [];

    // Add date filtering if month and/or year are provided
    if (month && year) {
      // Both month and year provided
      const dateCondition = 'DATE_FORMAT(e.expense_date, "%Y-%m") = ?';
      conditions.push(dateCondition);
      params.push(`${year}-${String(month).padStart(2, '0')}`);
    } else if (year) {
      // Only year provided
      const dateCondition = 'YEAR(e.expense_date) = ?';
      conditions.push(dateCondition);
      params.push(parseInt(year, 10));
    } else if (month) {
      // Only month provided - this doesn't make sense without year, so we could ignore or use current year
      // For now, we'll ignore month without year to avoid ambiguous results
    }

    // Add store filtering if store_id is provided
    if (store_id) {
      conditions.push('e.store_id = ?');
      params.push(store_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY e.expense_date DESC, e.created_at DESC';

    const [rows] = await db.execute(query, params);

    res.json(rows);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/expenses/:id
app.get('/api/expenses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.execute(
      'SELECT e.id, e.amount, e.comment, e.expense_date, e.store_id, s.name as store_name, e.created_at, e.updated_at FROM expenses e LEFT JOIN stores s ON e.store_id = s.id WHERE e.id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/expenses/:id
app.put('/api/expenses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, comment, expense_date, store_id } = req.body;

    // Validate required fields if provided
    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
    }

    if (store_id !== undefined) {
      // Validate store_id exists
      const [storeResult] = await db.execute('SELECT id FROM stores WHERE id = ?', [store_id]);
      if (storeResult.length === 0) {
        return res.status(400).json({ error: 'Store not found' });
      }
    }

    // Validate date format if provided
    let expenseDate = null;
    if (expense_date) {
      expenseDate = new Date(expense_date);
      if (isNaN(expenseDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      expenseDate = expenseDate.toISOString().split('T')[0];
    }

    // Prepare update parameters
    let updateQuery = 'UPDATE expenses SET ';
    const queryParams = [];

    if (amount !== undefined) {
      updateQuery += 'amount = ?';
      queryParams.push(parseFloat(amount));
    }

    if (comment !== undefined) {
      if (queryParams.length > 0) updateQuery += ', ';
      updateQuery += 'comment = ?';
      queryParams.push(comment || null);
    }

    if (expense_date !== undefined) {
      if (queryParams.length > 0) updateQuery += ', ';
      updateQuery += 'expense_date = ?';
      queryParams.push(expenseDate);
    }

    if (store_id !== undefined) {
      if (queryParams.length > 0) updateQuery += ', ';
      updateQuery += 'store_id = ?';
      queryParams.push(store_id);
    }

    updateQuery += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    queryParams.push(id);

    const [result] = await db.execute(updateQuery, queryParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const [updatedExpense] = await db.execute(
      'SELECT e.id, e.amount, e.comment, e.expense_date, e.store_id, s.name as store_name, e.created_at, e.updated_at FROM expenses e LEFT JOIN stores s ON e.store_id = s.id WHERE e.id = ?',
      [id]
    );

    res.json({
      ...updatedExpense[0],
      message: 'Expense updated successfully'
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute('DELETE FROM expenses WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stores/:id/financial-summary
// Get total sales (PAID/PAYMENT), total customer debts (DEBT), and total expenses for a specific store
app.get('/api/stores/:id/financial-summary', authMiddleware, async (req, res) => {
  try {
    const { id: storeId } = req.params;
    const { month, year } = req.query;

    // Validate store exists
    const [storeResult] = await db.execute('SELECT id, name FROM stores WHERE id = ?', [storeId]);
    if (storeResult.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const store = storeResult[0];

    // Build date condition
    let dateCondition = '';
    const dateParams = [];

    // Filter by month and year
    if (month && year) {
      // Filter by specific month and year
      dateCondition = ' AND YEAR(date) = ? AND MONTH(date) = ?';
      dateParams.push(parseInt(year, 10), parseInt(month, 10));
    } else if (month) {
      // Filter by month only (current year assumed)
      dateCondition = ' AND MONTH(date) = ? AND YEAR(date) = YEAR(CURDATE())';
      dateParams.push(parseInt(month, 10));
    } else if (year) {
      // Filter by year only
      dateCondition = ' AND YEAR(date) = ?';
      dateParams.push(parseInt(year, 10));
    }
    // If no filters, get all data

    // Get cash sales from sales table (payment_status = 'PAID' and customer_id IS NULL)
    const [cashSalesResult] = await db.execute(
      `SELECT COALESCE(SUM(total_amount), 0) as cash_sales 
       FROM sales 
       WHERE store_id = ? AND payment_status = 'PAID' AND customer_id IS NULL${dateCondition.replace(/date/g, 'created_at')}`,
      [storeId, ...dateParams]
    );

    // Get paid debts and customer payments from customer_operations (type IN ('PAID','PAYMENT'))
    const [paidDebtsResult] = await db.execute(
      `SELECT COALESCE(SUM(sum), 0) as paid_debts 
       FROM customer_operations 
       WHERE store_id = ? AND type IN ('PAID','PAYMENT')${dateCondition}`,
      [storeId, ...dateParams]
    );

    // Get customer debt balances (negative balances = what customers owe)
    const [customerDebtsResult] = await db.execute(
      `SELECT COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) as customer_debt_balance 
       FROM customers 
       WHERE store_id = ?`,
      [storeId]
    );

    // Get retail debtor debt balances
     const [retailDebtsResult] = await db.execute(
      `SELECT COALESCE(SUM(
        (SELECT COALESCE(SUM(CASE WHEN ro.type = 'DEBT' THEN ro.amount ELSE 0 END), 0) 
         FROM retail_operations ro 
         WHERE ro.retail_debtor_id = rd.id)
        -
        (SELECT COALESCE(SUM(CASE WHEN ro.type IN ('PAYMENT','RETURN') THEN ro.amount ELSE 0 END), 0) 
         FROM retail_operations ro 
         WHERE ro.retail_debtor_id = rd.id)
       ), 0) as retail_debt_balance 
       FROM retail_debtors rd 
       WHERE rd.store_id = ? AND rd.id IN (SELECT DISTINCT retail_debtor_id FROM retail_operations)`
     , [storeId]);

    // Calculate final values
    const cashSales = parseFloat(cashSalesResult[0].cash_sales);
    const paidDebts = parseFloat(paidDebtsResult[0].paid_debts);
    const customerDebtBalance = parseFloat(customerDebtsResult[0].customer_debt_balance);
    const retailDebtBalance = parseFloat(retailDebtsResult[0].retail_debt_balance);

    // Apply correct business logic formulas
    const totalSales = cashSales + paidDebts;  // Cash sales + paid debts and customer payments
    const totalDebts = customerDebtBalance + retailDebtBalance;  // Customer + retail debts

    // Get total expenses - separate date filtering for expenses table
    let expenseQuery = 'SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE store_id = ?';
    let expenseParams = [storeId];

    if (month && year) {
      // Filter by specific month and year
      expenseQuery += ' AND YEAR(expense_date) = ? AND MONTH(expense_date) = ?';
      expenseParams.push(parseInt(year, 10), parseInt(month, 10));
    } else if (month) {
      // Filter by month only (current year assumed)
      expenseQuery += ' AND MONTH(expense_date) = ? AND YEAR(expense_date) = YEAR(CURDATE())';
      expenseParams.push(parseInt(month, 10));
    } else if (year) {
      // Filter by year only
      expenseQuery += ' AND YEAR(expense_date) = ?';
      expenseParams.push(parseInt(year, 10));
    }
    // If no filters, get all data

    const [expensesResult] = await db.execute(expenseQuery, expenseParams);

    const totalExpenses = parseFloat(expensesResult[0].total_expenses);

    res.json({
      store_id: parseInt(storeId),
      store_name: store.name,
      total_sales: parseFloat(totalSales.toFixed(2)),
      total_debts: parseFloat(totalDebts.toFixed(2)),
      total_expenses: parseFloat(totalExpenses.toFixed(2)),
      breakdown: {
        cash_sales: parseFloat(cashSales.toFixed(2)),
        paid_debts: parseFloat(paidDebts.toFixed(2)),
        customer_debt_balance: parseFloat(customerDebtBalance.toFixed(2)),
        retail_debt_balance: parseFloat(retailDebtBalance.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Get store financial summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stores/financial-summary
// Get financial summary for ALL stores
app.get('/api/stores/financial-summary', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;

    // Build date condition
    let dateCondition = '';
    let salesDateCondition = '';
    const dateParams = [];

    // Filter by month and year
    if (month && year) {
      // Filter by specific month and year
      dateCondition = ' AND YEAR(co.date) = ? AND MONTH(co.date) = ?';
      salesDateCondition = ' AND YEAR(s.created_at) = ? AND MONTH(s.created_at) = ?';
      dateParams.push(parseInt(year, 10), parseInt(month, 10));
    } else if (month) {
      // Filter by month only (current year assumed)
      dateCondition = ' AND MONTH(co.date) = ? AND YEAR(co.date) = YEAR(CURDATE())';
      salesDateCondition = ' AND MONTH(s.created_at) = ? AND YEAR(s.created_at) = YEAR(CURDATE())';
      dateParams.push(parseInt(month, 10));
    } else if (year) {
      // Filter by year only
      dateCondition = ' AND YEAR(co.date) = ?';
      salesDateCondition = ' AND YEAR(s.created_at) = ?';
      dateParams.push(parseInt(year, 10));
    }
    // If no filters, get all data

    // Get all stores
    const [storesResult] = await db.execute('SELECT id, name FROM stores ORDER BY name');

    // Get cash sales per store (retail cash sales: payment_status = 'PAID' and customer_id IS NULL)
    const [cashSalesResult] = await db.execute(
      `SELECT s.store_id, COALESCE(SUM(s.total_amount), 0) as cash_sales
       FROM sales s
       WHERE s.payment_status = 'PAID' AND s.customer_id IS NULL${salesDateCondition}
       GROUP BY s.store_id`,
      dateParams
    );

    // Get paid debts and customer payments per store from customer_operations (type IN ('PAID','PAYMENT'))
    const [paidDebtsResult] = await db.execute(
      `SELECT store_id, COALESCE(SUM(sum), 0) as paid_debts
       FROM customer_operations
       WHERE store_id IS NOT NULL AND type IN ('PAID','PAYMENT')${dateCondition}
       GROUP BY store_id`,
      dateParams
    );

    // Get customer debt balances per store (negative balances)
    const [customerDebtsResult] = await db.execute(
      `SELECT store_id, COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) as customer_debt_balance
       FROM customers
       WHERE store_id IS NOT NULL
       GROUP BY store_id`
    );

    // Get retail debt balances per store by linking retail_operations to sales (when sale_id exists)
    const [retailDebtsResult] = await db.execute(
      `SELECT s.store_id, COALESCE(SUM(CASE WHEN ro.type = 'DEBT' THEN ro.amount ELSE 0 END) -
                                 SUM(CASE WHEN ro.type IN ('PAYMENT','RETURN') THEN ro.amount ELSE 0 END), 0) as retail_debt_balance
       FROM retail_operations ro
       JOIN sales s ON ro.sale_id = s.id
       WHERE s.store_id IS NOT NULL
       GROUP BY s.store_id`
    );

    // Get expense data for all stores
    let expenseQuery = `SELECT store_id, COALESCE(SUM(amount), 0) as total_expenses 
                       FROM expenses 
                       WHERE store_id IS NOT NULL`;
    let expenseParams = [];

    if (month && year) {
      expenseQuery += ' AND YEAR(expense_date) = ? AND MONTH(expense_date) = ?';
      expenseParams.push(parseInt(year, 10), parseInt(month, 10));
    } else if (month) {
      expenseQuery += ' AND MONTH(expense_date) = ? AND YEAR(expense_date) = YEAR(CURDATE())';
      expenseParams.push(parseInt(month, 10));
    } else if (year) {
      expenseQuery += ' AND YEAR(expense_date) = ?';
      expenseParams.push(parseInt(year, 10));
    }

    expenseQuery += ' GROUP BY store_id';
    const [expensesResult] = await db.execute(expenseQuery, expenseParams);

    // Create maps for quick lookup
    const cashSalesMap = {};
    cashSalesResult.forEach(row => {
      cashSalesMap[row.store_id] = parseFloat(row.cash_sales);
    });

    const paidDebtsMap = {};
    paidDebtsResult.forEach(row => {
      paidDebtsMap[row.store_id] = parseFloat(row.paid_debts);
    });

    const customerDebtMap = {};
    customerDebtsResult.forEach(row => {
      customerDebtMap[row.store_id] = parseFloat(row.customer_debt_balance);
    });

    const retailDebtMap = {};
    retailDebtsResult.forEach(row => {
      retailDebtMap[row.store_id] = parseFloat(row.retail_debt_balance);
    });

    const expensesMap = {};
    expensesResult.forEach(row => {
      expensesMap[row.store_id] = parseFloat(row.total_expenses);
    });

    // Build response for all stores mirroring single-store output
    const storeStats = storesResult.map(store => {
      const storeId = store.id;
      const cashSales = cashSalesMap[storeId] || 0;
      const paidDebts = paidDebtsMap[storeId] || 0;
      const customerDebtBalance = customerDebtMap[storeId] || 0;
      const retailDebtBalance = retailDebtMap[storeId] || 0;
      const totalExpenses = expensesMap[storeId] || 0;

      const totalSales = cashSales + paidDebts; // Cash sales + paid debts/payments
      const totalDebts = customerDebtBalance + retailDebtBalance;

      return {
        store_id: storeId,
        store_name: store.name,
        total_sales: parseFloat(totalSales.toFixed(2)),
        total_debts: parseFloat(totalDebts.toFixed(2)),
        total_expenses: parseFloat(totalExpenses.toFixed(2)),
        breakdown: {
          cash_sales: parseFloat(cashSales.toFixed(2)),
          paid_debts: parseFloat(paidDebts.toFixed(2)),
          customer_debt_balance: parseFloat(customerDebtBalance.toFixed(2)),
          retail_debt_balance: parseFloat(retailDebtBalance.toFixed(2))
        }
      };
    });

    res.json({
      stores: storeStats,
      total_stores: storesResult.length
    });
  } catch (error) {
    console.error('Get all stores financial summary error:', error);
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