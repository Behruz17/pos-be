-- Create customer_operations table to track all customer-related operations
CREATE TABLE customer_operations (
    id INT NOT NULL AUTO_INCREMENT,
    customer_id INT NOT NULL,
    store_id INT,
    sum DECIMAL(10,2) NOT NULL,
    type ENUM('PAID','DEBT') NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_store_id (store_id),
    INDEX idx_date (date),
    INDEX idx_type (type),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
);