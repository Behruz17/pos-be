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
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Users table created/verified');
    
    // Add created_at column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE users 
        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('Created_at column added to users table');
    } catch (error) {
      // If column already exists, we'll get an error, which is OK
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('Created_at column already exists in users table');
      } else {
        console.log('Created_at column already exists or other error:', error.message);
      }
    }
    
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
        image VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Products table created/verified');
    
    // Add image column if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE products 
        ADD COLUMN image VARCHAR(500)
      `);
      console.log('Image column added to products table');
    } catch (error) {
      // If column already exists, we'll get an error, which is OK
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('Image column already exists in products table');
      } else {
        console.log('Image column already exists or other error:', error.message);
      }
    }
    
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
        purchase_cost DECIMAL(10, 2),
        selling_price DECIMAL(10, 2),
        FOREIGN KEY (receipt_id) REFERENCES stock_receipts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Stock receipt items table created/verified');
    
    // Add purchase_cost and selling_price columns if they don't exist
    try {
      await db.execute(`
        ALTER TABLE stock_receipt_items 
        ADD COLUMN purchase_cost DECIMAL(10, 2)
      `);
      console.log('Purchase_cost column added to stock_receipt_items table');
    } catch (error) {
      // If column already exists, we'll get an error, which is OK
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('Purchase_cost column already exists in stock_receipt_items table');
      } else {
        console.log('Purchase_cost column already exists or other error:', error.message);
      }
    }
    
    try {
      await db.execute(`
        ALTER TABLE stock_receipt_items 
        ADD COLUMN selling_price DECIMAL(10, 2)
      `);
      console.log('Selling_price column added to stock_receipt_items table');
    } catch (error) {
      // If column already exists, we'll get an error, which is OK
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('Selling_price column already exists in stock_receipt_items table');
      } else {
        console.log('Selling_price column already exists or other error:', error.message);
      }
    }
    
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
    
    // Create sales table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT,
        total_amount DECIMAL(10, 2) NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Sales table created/verified');
    
    // Create sale items table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Sale items table created/verified');
    
    // Create returns table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT,
        total_amount DECIMAL(10, 2) NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sale_id INT,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
      )
    `);
    
    console.log('Returns table created/verified');
    
    // Create return items table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS return_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        return_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Return items table created/verified');
    
    // Create demo customer if none exists
    const [existingDemoCustomer] = await db.execute('SELECT id FROM customers WHERE full_name = ?', ['Demo Customer']);
    if (existingDemoCustomer.length === 0) {
      await db.execute('INSERT INTO customers (full_name, phone, city, balance) VALUES (?, ?, ?, ?)', ['Demo Customer', null, null, 0]);
      console.log('Demo customer created');
    } else {
      console.log('Demo customer already exists');
    }
    
    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
};

setupDatabase();