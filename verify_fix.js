const db = require('./db');

async function testQuery() {
    try {
        console.log('Connecting to database...');

        // Get a warehouse ID
        const [warehouses] = await db.execute('SELECT id FROM warehouses LIMIT 1');
        if (warehouses.length === 0) {
            console.log('No warehouses found to test with.');
            process.exit(0);
        }

        const warehouseId = warehouses[0].id;
        console.log(`Testing with warehouse ID: ${warehouseId}`);

        const startTime = Date.now();

        // Run the optimized query
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
            [warehouseId]
        );

        const endTime = Date.now();

        console.log(`Query executed successfully in ${endTime - startTime}ms`);
        console.log(`Returned ${rows.length} rows.`);
        if (rows.length > 0) {
            console.log('Sample row:', rows[0]);
        }

        process.exit(0);
    } catch (error) {
        console.error('Query failed:', error);
        process.exit(1);
    }
}

testQuery();
