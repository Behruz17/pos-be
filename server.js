const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db');
const authMiddleware = require('./middleware');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
app.post('/api/products', authMiddleware, async (req, res) => {
  try {
    const { name, manufacturer } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO products (name, manufacturer) VALUES (?, ?)',
      [name, manufacturer || null]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      manufacturer,
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
    const [rows] = await db.execute('SELECT id, name, manufacturer, created_at FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Get products error:', error);
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
      `SELECT ws.id, ws.product_id, p.name as product_name, p.manufacturer, 
              ws.boxes_qty, ws.pieces_qty, ws.weight_kg, ws.volume_cbm, ws.updated_at
       FROM warehouse_stock ws
       JOIN products p ON ws.product_id = p.id
       WHERE ws.warehouse_id = ?
       ORDER BY p.name`
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
    const [product] = await db.execute('SELECT id, name, manufacturer, created_at FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get product stock in the specified warehouse
    const [stock] = await db.execute(
      `SELECT ws.id, ws.boxes_qty, ws.pieces_qty, ws.weight_kg, ws.volume_cbm, ws.updated_at
       FROM warehouse_stock ws
       WHERE ws.warehouse_id = ? AND ws.product_id = ?`
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
    const { warehouse_id, items } = req.body;

    // Validate required fields
    if (!warehouse_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Warehouse ID and items array are required' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_id || !item.boxes_qty || !item.pieces_qty || !item.amount) {
        return res.status(400).json({ error: 'Each item must have product_id, boxes_qty, pieces_qty, and amount' });
      }
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

      // Create stock receipt
      const [receiptResult] = await connection.execute(
        'INSERT INTO stock_receipts (warehouse_id, created_by, total_amount) VALUES (?, ?, ?)',
        [warehouse_id, req.user.id, total_amount]
      );
      const receiptId = receiptResult.insertId;

      // Process each item in the receipt
      for (const item of items) {
        // Insert receipt item
        await connection.execute(
          'INSERT INTO stock_receipt_items (receipt_id, product_id, boxes_qty, pieces_qty, weight_kg, volume_cbm, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            receiptId,
            item.product_id,
            item.boxes_qty,
            item.pieces_qty,
            item.weight_kg || null,
            item.volume_cbm || null,
            item.amount
          ]
        );

        // Update warehouse stock
        const [existingStock] = await connection.execute(
          'SELECT id, boxes_qty, pieces_qty, weight_kg, volume_cbm FROM warehouse_stock WHERE warehouse_id = ? AND product_id = ?',
          [warehouse_id, item.product_id]
        );

        if (existingStock.length > 0) {
          // Update existing stock
          const updatedBoxes = existingStock[0].boxes_qty + item.boxes_qty;
          const updatedPieces = existingStock[0].pieces_qty + item.pieces_qty;
          const updatedWeight = existingStock[0].weight_kg ? (parseFloat(existingStock[0].weight_kg) + parseFloat(item.weight_kg || 0)) : (item.weight_kg || 0);
          const updatedVolume = existingStock[0].volume_cbm ? (parseFloat(existingStock[0].volume_cbm) + parseFloat(item.volume_cbm || 0)) : (item.volume_cbm || 0);

          await connection.execute(
            'UPDATE warehouse_stock SET boxes_qty = ?, pieces_qty = ?, weight_kg = ?, volume_cbm = ?, updated_at = NOW() WHERE id = ?',
            [updatedBoxes, updatedPieces, updatedWeight, updatedVolume, existingStock[0].id]
          );
        } else {
          // Insert new stock record
          await connection.execute(
            'INSERT INTO warehouse_stock (warehouse_id, product_id, boxes_qty, pieces_qty, weight_kg, volume_cbm) VALUES (?, ?, ?, ?, ?, ?)',
            [warehouse_id, item.product_id, item.boxes_qty, item.pieces_qty, item.weight_kg || 0, item.volume_cbm || 0]
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
      `SELECT sr.id, sr.warehouse_id, w.name as warehouse_name, sr.created_by, u.login as created_by_name,
              sr.created_at, sr.total_amount
       FROM stock_receipts sr
       JOIN warehouses w ON sr.warehouse_id = w.id
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
      `SELECT sr.id, sr.warehouse_id, w.name as warehouse_name, sr.created_by, u.login as created_by_name,
              sr.created_at, sr.total_amount
       FROM stock_receipts sr
       JOIN warehouses w ON sr.warehouse_id = w.id
       JOIN users u ON sr.created_by = u.id
       WHERE sr.id = ?`,
      [id]
    );

    if (receiptRows.length === 0) {
      return res.status(404).json({ error: 'Inventory receipt not found' });
    }

    // Get receipt items
    const [itemRows] = await db.execute(
      `SELECT sri.id, sri.product_id, p.name as product_name, p.manufacturer, sri.boxes_qty, sri.pieces_qty,
              sri.weight_kg, sri.volume_cbm, sri.amount
       FROM stock_receipt_items sri
       JOIN products p ON sri.product_id = p.id
       WHERE sri.receipt_id = ?`,
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
    const [rows] = await db.execute(
      `SELECT ws.id, ws.warehouse_id, w.name as warehouse_name, ws.product_id, p.name as product_name,
              ws.boxes_qty, ws.pieces_qty, ws.weight_kg, ws.volume_cbm, ws.updated_at
       FROM warehouse_stock ws
       JOIN warehouses w ON ws.warehouse_id = w.id
       JOIN products p ON ws.product_id = p.id
       ORDER BY w.name, p.name`
    );

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
    const { boxes_qty, pieces_qty, weight_kg, volume_cbm, reason } = req.body;

    // Get current stock
    const [currentStock] = await db.execute(
      'SELECT warehouse_id, product_id, boxes_qty as current_boxes, pieces_qty as current_pieces, weight_kg as current_weight, volume_cbm as current_volume FROM warehouse_stock WHERE id = ?',
      [id]
    );

    if (currentStock.length === 0) {
      return res.status(404).json({ error: 'Stock record not found' });
    }

    const stock = currentStock[0];

    // Update stock
    const [result] = await db.execute(
      'UPDATE warehouse_stock SET boxes_qty = ?, pieces_qty = ?, weight_kg = ?, volume_cbm = ?, updated_at = NOW() WHERE id = ?',
      [boxes_qty, pieces_qty, weight_kg, volume_cbm, id]
    );

    // Record the change in history
    await db.execute(
      `INSERT INTO stock_changes 
       (warehouse_id, product_id, user_id, change_type, old_boxes_qty, new_boxes_qty, 
        old_pieces_qty, new_pieces_qty, old_weight_kg, new_weight_kg, old_volume_cbm, new_volume_cbm, reason)
       VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stock.warehouse_id, stock.product_id, req.user.id,
        stock.current_boxes, boxes_qty,
        stock.current_pieces, pieces_qty,
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
    const { from_warehouse_id, to_warehouse_id, product_id, boxes_qty, pieces_qty, weight_kg, volume_cbm, reason } = req.body;

    if (!from_warehouse_id || !to_warehouse_id || !product_id || boxes_qty < 0 || pieces_qty < 0) {
      return res.status(400).json({ error: 'Required fields are missing or invalid' });
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get current stock in source warehouse
      const [fromStock] = await connection.execute(
        'SELECT id, boxes_qty as current_boxes, pieces_qty as current_pieces, weight_kg as current_weight, volume_cbm as current_volume FROM warehouse_stock WHERE warehouse_id = ? AND product_id = ?',
        [from_warehouse_id, product_id]
      );

      if (fromStock.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Not enough stock in source warehouse' });
      }

      const stock = fromStock[0];

      // Check if we have enough stock
      if (stock.current_boxes < boxes_qty || stock.current_pieces < pieces_qty) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Not enough stock in source warehouse' });
      }

      // Update source warehouse (subtract stock)
      const newFromBoxes = stock.current_boxes - boxes_qty;
      const newFromPieces = stock.current_pieces - pieces_qty;
      const newFromWeight = stock.current_weight ? parseFloat(stock.current_weight) - parseFloat(weight_kg || 0) : 0;
      const newFromVolume = stock.current_volume ? parseFloat(stock.current_volume) - parseFloat(volume_cbm || 0) : 0;

      await connection.execute(
        'UPDATE warehouse_stock SET boxes_qty = ?, pieces_qty = ?, weight_kg = ?, volume_cbm = ?, updated_at = NOW() WHERE id = ?',
        [newFromBoxes, newFromPieces, newFromWeight, newFromVolume, stock.id]
      );

      // Record the OUT change
      await connection.execute(
        `INSERT INTO stock_changes 
         (warehouse_id, product_id, user_id, change_type, old_boxes_qty, new_boxes_qty, 
          old_pieces_qty, new_pieces_qty, old_weight_kg, new_weight_kg, old_volume_cbm, new_volume_cbm, reason)
         VALUES (?, ?, ?, 'OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          from_warehouse_id, product_id, req.user.id,
          stock.current_boxes, newFromBoxes,
          stock.current_pieces, newFromPieces,
          stock.current_weight, newFromWeight,
          stock.current_volume, newFromVolume,
          reason || `Transfer to warehouse ${to_warehouse_id}`
        ]
      );

      // Update destination warehouse (add stock)
      const [toStock] = await connection.execute(
        'SELECT id, boxes_qty as current_boxes, pieces_qty as current_pieces, weight_kg as current_weight, volume_cbm as current_volume FROM warehouse_stock WHERE warehouse_id = ? AND product_id = ?',
        [to_warehouse_id, product_id]
      );

      if (toStock.length > 0) {
        // Update existing stock in destination
        const newToBoxes = toStock[0].current_boxes + boxes_qty;
        const newToPieces = toStock[0].current_pieces + pieces_qty;
        const newToWeight = toStock[0].current_weight ? parseFloat(toStock[0].current_weight) + parseFloat(weight_kg || 0) : parseFloat(weight_kg || 0);
        const newToVolume = toStock[0].current_volume ? parseFloat(toStock[0].current_volume) + parseFloat(volume_cbm || 0) : parseFloat(volume_cbm || 0);

        await connection.execute(
          'UPDATE warehouse_stock SET boxes_qty = ?, pieces_qty = ?, weight_kg = ?, volume_cbm = ?, updated_at = NOW() WHERE id = ?',
          [newToBoxes, newToPieces, newToWeight, newToVolume, toStock[0].id]
        );
      } else {
        // Create new stock record in destination
        await connection.execute(
          'INSERT INTO warehouse_stock (warehouse_id, product_id, boxes_qty, pieces_qty, weight_kg, volume_cbm) VALUES (?, ?, ?, ?, ?, ?)',
          [to_warehouse_id, product_id, boxes_qty, pieces_qty, weight_kg || 0, volume_cbm || 0]
        );
      }

      // Record the IN change
      await connection.execute(
        `INSERT INTO stock_changes 
         (warehouse_id, product_id, user_id, change_type, old_boxes_qty, new_boxes_qty, 
          old_pieces_qty, new_pieces_qty, old_weight_kg, new_weight_kg, old_volume_cbm, new_volume_cbm, reason)
         VALUES (?, ?, ?, 'IN', 0, ?, 0, ?, 0, ?, 0, ?, ?)`,
        [
          to_warehouse_id, product_id, req.user.id,
          boxes_qty, pieces_qty, weight_kg || 0, volume_cbm || 0,
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
      `SELECT sc.id, sc.warehouse_id, w.name as warehouse_name, sc.product_id, p.name as product_name,
              p.manufacturer, sc.user_id, u.login as user_name, sc.change_type,
              sc.old_boxes_qty, sc.new_boxes_qty, sc.old_pieces_qty, sc.new_pieces_qty,
              sc.old_weight_kg, sc.new_weight_kg, sc.old_volume_cbm, sc.new_volume_cbm,
              sc.reason, sc.created_at
       FROM stock_changes sc
       JOIN warehouses w ON sc.warehouse_id = w.id
       JOIN products p ON sc.product_id = p.id
       JOIN users u ON sc.user_id = u.id
       ORDER BY sc.created_at DESC`
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
      `SELECT sc.id, sc.warehouse_id, w.name as warehouse_name, sc.product_id, p.name as product_name,
              p.manufacturer, sc.user_id, u.login as user_name, sc.change_type,
              sc.old_boxes_qty, sc.new_boxes_qty, sc.old_pieces_qty, sc.new_pieces_qty,
              sc.old_weight_kg, sc.new_weight_kg, sc.old_volume_cbm, sc.new_volume_cbm,
              sc.reason, sc.created_at
       FROM stock_changes sc
       JOIN warehouses w ON sc.warehouse_id = w.id
       JOIN products p ON sc.product_id = p.id
       JOIN users u ON sc.user_id = u.id
       WHERE sc.id = ?`,
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
    const { customer_id, items } = req.body;

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

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseInt(item.quantity)), 0);

      // Create sale
      const [saleResult] = await connection.execute(
        'INSERT INTO sales (customer_id, total_amount, created_by) VALUES (?, ?, ?)',
        [customerId, total_amount, req.user.id]
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

        // Update warehouse stock
        const [stockRows] = await connection.execute(
          'SELECT id, boxes_qty, pieces_qty FROM warehouse_stock WHERE product_id = ?',
          [item.product_id]
        );

        if (stockRows.length > 0) {
          const currentStock = stockRows[0];
          // For simplicity, we're reducing from pieces_qty first
          let remainingQuantity = parseInt(item.quantity);
          let newPiecesQty = currentStock.pieces_qty;
          let newBoxesQty = currentStock.boxes_qty;

          // Reduce from pieces first
          if (newPiecesQty >= remainingQuantity) {
            newPiecesQty -= remainingQuantity;
            remainingQuantity = 0;
          } else {
            remainingQuantity -= newPiecesQty;
            newPiecesQty = 0;
            
            // Then reduce from boxes
            if (newBoxesQty > 0) {
              // Convert boxes to pieces equivalent if needed
              // In this simplified version, we assume 1 box = 1 piece for calculation
              if (newBoxesQty >= remainingQuantity) {
                newBoxesQty -= remainingQuantity;
                remainingQuantity = 0;
              } else {
                newBoxesQty = 0;
                remainingQuantity -= newBoxesQty;
              }
            }
          }

          if (remainingQuantity > 0) {
            // Not enough stock
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: `Not enough stock for product ID: ${item.product_id}` });
          }

          // Update stock
          await connection.execute(
            'UPDATE warehouse_stock SET boxes_qty = ?, pieces_qty = ? WHERE id = ?',
            [newBoxesQty, newPiecesQty, currentStock.id]
          );
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
              u.login as created_by_name, s.created_at
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
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
              u.login as created_by_name, s.created_at
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       JOIN users u ON s.created_by = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (saleRows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Get sale items
    const [itemRows] = await db.execute(
      `SELECT si.id, si.product_id, p.name as product_name, p.manufacturer, si.quantity,
              si.unit_price, si.total_price
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`,
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
    const { customer_id, sale_id, items } = req.body;

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

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Calculate total amount
      const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseInt(item.quantity)), 0);

      // Create return
      const [returnResult] = await connection.execute(
        'INSERT INTO returns (customer_id, total_amount, created_by, sale_id) VALUES (?, ?, ?, ?)',
        [customerId, total_amount, req.user.id, sale_id || null]
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
          'SELECT id, boxes_qty, pieces_qty FROM warehouse_stock WHERE product_id = ?',
          [item.product_id]
        );

        if (stockRows.length > 0) {
          // Update existing stock
          const currentStock = stockRows[0];
          const newPiecesQty = currentStock.pieces_qty + parseInt(item.quantity);
          
          await connection.execute(
            'UPDATE warehouse_stock SET pieces_qty = ? WHERE id = ?',
            [newPiecesQty, currentStock.id]
          );
        } else {
          // Create new stock record if none exists
          await connection.execute(
            'INSERT INTO warehouse_stock (warehouse_id, product_id, boxes_qty, pieces_qty) VALUES (?, ?, 0, ?)',
            [1, item.product_id, parseInt(item.quantity)] // Using default warehouse ID 1
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
              u.login as created_by_name, r.created_at, r.sale_id
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
              u.login as created_by_name, r.created_at, r.sale_id
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
      `SELECT ri.id, ri.product_id, p.name as product_name, p.manufacturer, ri.quantity,
              ri.unit_price, ri.total_price
       FROM return_items ri
       JOIN products p ON ri.product_id = p.id
       WHERE ri.return_id = ?`,
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
    
    // Create tables if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        login VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tokens (
        user_id INT PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Tables created/verified successfully');
    
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