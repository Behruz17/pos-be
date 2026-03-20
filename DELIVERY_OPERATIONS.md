# Delivery Operations Database Documentation

## Overview

The `delivery_operations` table is designed to track all financial operations related to delivery drivers. This system provides a complete audit trail of delivery costs and payments, similar to how `supplier_operations` works for suppliers.

## Table Structure

### delivery_operations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| `delivery_driver_id` | INT | NOT NULL, FOREIGN KEY → delivery_drivers.id | ID of the delivery driver |
| `stock_receipt_id` | INT | NULL, FOREIGN KEY → stock_receipts.id (ON DELETE SET NULL) | ID of the associated stock receipt |
| `sum` | DECIMAL(10,2) | NOT NULL, DEFAULT 0.00 | Amount of the operation |
| `currency` | VARCHAR(20) | NULL | Currency code (somoni, dollar, yuan, etc.) |
| `type` | ENUM('RECEIPT','PAYMENT') | NOT NULL | Type of operation |
| `date` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the operation was created |

## Operation Types

### RECEIPT
- Represents money owed to the delivery driver for delivery services
- Created automatically when a stock receipt is created with a delivery driver
- Initial value is 0, can be updated later
- Always linked to a specific stock receipt
- Currency is NULL by default, can be updated later

### PAYMENT
- Represents actual payment made to the delivery driver
- Created manually when paying the driver
- Not linked to any stock receipt
- Reduces the driver's balance

## API Endpoints

### 1. Get Driver Operations
```
GET /api/delivery-operations/:driver_id
```
**Query Parameters:**
- `type` (optional): Filter by operation type ('RECEIPT' or 'PAYMENT')
- `start_date` (optional): Filter operations from this date
- `end_date` (optional): Filter operations until this date

**Response:**
```json
[
  {
    "id": 1,
    "delivery_driver_id": 1,
    "stock_receipt_id": 15,
    "sum": "1500.00",
    "type": "RECEIPT",
    "date": "2026-03-19T21:50:00.000Z",
    "driver_name": "Иван Петров",
    "receipt_amount": "25000.00"
  }
]
```

### 2. Update Delivery Cost
```
PUT /api/delivery-operations/receipt/:receipt_id/delivery-cost
```
**Request Body:**
```json
{
  "delivery_cost": 1500,
  "currency": "somoni",
  "delivery_driver_id": 1
}
```

**Response:**
```json
{
  "message": "Delivery cost updated successfully",
  "delivery_cost": 1500,
  "currency": "somoni",
  "receipt_id": 15
}
```

### 3. Record Payment to Driver
```
POST /api/delivery-operations/:driver_id/payment
```
**Request Body:**
```json
{
  "amount": 1000,
  "note": "Оплата за март"
}
```

**Response:**
```json
{
  "id": 25,
  "message": "Payment recorded successfully",
  "payment": {
    "delivery_driver_id": 1,
    "amount": 1000,
    "note": "Оплата за март",
    "balance": 500
  }
}
```

### 4. Get Driver Statistics
```
GET /api/delivery-operations/:driver_id/statistics
```

**Response:**
```json
{
  "driver": {
    "id": 1,
    "name": "Иван Петров"
  },
  "statistics": {
    "total_receipts": 5,
    "total_payments": 3,
    "total_receipt_amount": 7500,
    "total_payment_amount": 5000,
    "balance": 2500
  }
}
```

## Workflow Examples

### Example 1: Standard Delivery Workflow

1. **Create Stock Receipt with Driver**
   ```http
   POST /api/inventory/receipt
   {
     "warehouse_id": 1,
     "supplier_id": 1,
     "delivery_driver_id": 1,
     "items": [...]
   }
   ```
   → Creates `delivery_operations` record with `sum = 0`

2. **Update Delivery Cost**
   ```http
   PUT /api/delivery-operations/receipt/15/delivery-cost
   {
     "delivery_cost": 1500,
     "delivery_driver_id": 1
   }
   ```
   → Updates the operation sum to 1500

3. **Pay the Driver**
   ```http
   POST /api/delivery-operations/1/payment
   {
     "amount": 1500,
     "note": "Оплата за доставку"
   }
   ```
   → Creates PAYMENT operation, balance becomes 0

### Example 2: Multiple Deliveries Before Payment

1. Create multiple receipts with driver → multiple RECEIPT operations
2. Update delivery costs for each receipt
3. Make one bulk payment → single PAYMENT operation

## Balance Calculation

The driver's balance is calculated as:
```
balance = SUM(RECEIPT operations) - SUM(PAYMENT operations)
```

## Migration Details

The migration file `001_add_delivery_operations.sql`:

1. Creates the `delivery_operations` table with all constraints
2. Creates indexes for performance optimization
3. Automatically creates delivery operations for existing stock receipts that have delivery drivers
4. Sets appropriate AUTO_INCREMENT value

## Important Notes

1. **Automatic Creation**: When creating a stock receipt with a delivery driver, a delivery operation is automatically created with `sum = 0`
2. **Flexible Updates**: Delivery cost can be updated anytime after receipt creation
3. **Balance Tracking**: The system maintains a complete balance history for each driver
4. **Data Integrity**: Foreign key constraints ensure referential integrity
5. **Performance**: Indexes on frequently queried columns (driver_id, receipt_id, date, type)

## Related Tables

- `delivery_drivers` - Driver information
- `stock_receipts` - Receipt information (receipts can have multiple delivery operations over time)
- `supplier_operations` - Similar structure for supplier operations (for reference)
