const db = require('./db');
const bcrypt = require('bcrypt');

const setupDatabase = async () => {
  try {
    console.log('Setting up database...');
    
    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        login VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100),
        role ENUM('ADMIN', 'USER') DEFAULT 'USER',
        password_hash VARCHAR(255) NOT NULL
      )
    `);
    
    console.log('Users table created/verified');
    
    // Create tokens table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tokens (
        user_id INT PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Tokens table created/verified');
    
    // Create a default user for testing if not exists
    const defaultLogin = 'admin';
    const defaultPassword = 'password123';
    
    const [existingUsers] = await db.execute('SELECT id FROM users WHERE login = ?', [defaultLogin]);
    
    if (existingUsers.length === 0) {
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      await db.execute('INSERT INTO users (login, name, role, password_hash) VALUES (?, ?, ?, ?)', [defaultLogin, 'Admin User', 'ADMIN', hashedPassword]);
      console.log(`Default user created: ${defaultLogin} / ${defaultPassword}`);
    } else {
      console.log('Default user already exists');
    }
    
    // Create products table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        manufacturer VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Products table created/verified');
    
    // Create warehouses table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);
    
    console.log('Warehouses table created/verified');
    
    // Create stock receipts table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS stock_receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        warehouse_id INT NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Stock receipts table created/verified');
    
    // Create stock receipt items table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS stock_receipt_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        receipt_id INT NOT NULL,
        product_id INT NOT NULL,
        boxes_qty INT NOT NULL,
        pieces_qty INT NOT NULL,
        weight_kg DECIMAL(10, 2),
        volume_cbm DECIMAL(10, 2),
        amount DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (receipt_id) REFERENCES stock_receipts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Stock receipt items table created/verified');
    
    // Create warehouse stock table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS warehouse_stock (
        id INT AUTO_INCREMENT PRIMARY KEY,
        warehouse_id INT NOT NULL,
        product_id INT NOT NULL,
        boxes_qty INT NOT NULL DEFAULT 0,
        pieces_qty INT NOT NULL DEFAULT 0,
        weight_kg DECIMAL(10, 2) DEFAULT 0,
        volume_cbm DECIMAL(10, 2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_warehouse_product (warehouse_id, product_id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Warehouse stock table created/verified');
    
    // Add default warehouse if none exists
    const [existingWarehouses] = await db.execute('SELECT id FROM warehouses LIMIT 1');
    if (existingWarehouses.length === 0) {
      await db.execute('INSERT INTO warehouses (name) VALUES (?)', ['Main Warehouse']);
      console.log('Default warehouse created: Main Warehouse');
    } else {
      console.log('Warehouse already exists');
    }
    
    // Create stock changes history table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS stock_changes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        warehouse_id INT NOT NULL,
        product_id INT NOT NULL,
        user_id INT NOT NULL,
        change_type ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL,
        old_boxes_qty INT NOT NULL DEFAULT 0,
        new_boxes_qty INT NOT NULL DEFAULT 0,
        old_pieces_qty INT NOT NULL DEFAULT 0,
        new_pieces_qty INT NOT NULL DEFAULT 0,
        old_weight_kg DECIMAL(10, 2) DEFAULT 0,
        new_weight_kg DECIMAL(10, 2) DEFAULT 0,
        old_volume_cbm DECIMAL(10, 2) DEFAULT 0,
        new_volume_cbm DECIMAL(10, 2) DEFAULT 0,
        reason VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Stock changes history table created/verified');
    
    // Create customers table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        city VARCHAR(100),
        balance DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Customers table created/verified');
    
    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
};

setupDatabase();