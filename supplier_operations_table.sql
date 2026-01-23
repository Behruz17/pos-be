-- Create supplier_operations table to track all supplier-related operations
CREATE TABLE supplier_operations (
    id INT NOT NULL AUTO_INCREMENT,
    supplier_id INT NOT NULL,
    warehouse_id INT,
    sum DECIMAL(10,2) NOT NULL,
    type ENUM('RECEIPT', 'PAYMENT') NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_supplier_id (supplier_id),
    INDEX idx_warehouse_id (warehouse_id),
    INDEX idx_date (date),
    INDEX idx_type (type),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);