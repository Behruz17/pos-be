-- phpMyAdmin SQL Dump
-- version 4.9.7
-- https://www.phpmyadmin.net/
--
-- Хост: localhost
-- Время создания: Янв 21 2026 г., 09:06
-- Версия сервера: 8.0.34-26-beget-1-1
-- Версия PHP: 5.6.40

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- База данных: `k98108ya_pos`
--

-- --------------------------------------------------------

--
-- Структура таблицы `customers`
--
-- Создание: Янв 06 2026 г., 18:53
-- Последнее обновление: Янв 20 2026 г., 05:24
--

DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` int NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `balance` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `customers`
--

INSERT INTO `customers` (`id`, `full_name`, `phone`, `city`, `balance`, `created_at`) VALUES
(4, 'Imron ', NULL, 'Istaravshan ', '-123320.00', '2026-01-13 05:41:11'),
(5, 'Demo Customer', NULL, NULL, '-1937.00', '2026-01-14 11:36:21'),
(6, 'Тестовый Клиент', '+79991234567', 'Москва', '-500.00', '2026-01-18 09:27:13'),
(7, 'Qa', NULL, NULL, '-101000.00', '2026-01-20 05:22:49');

-- --------------------------------------------------------

--
-- Структура таблицы `products`
--
-- Создание: Янв 17 2026 г., 18:16
--

DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `manufacturer` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `image` varchar(500) DEFAULT NULL,
  `pieces_per_box` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `products`
--

INSERT INTO `products` (`id`, `name`, `manufacturer`, `created_at`, `image`, `pieces_per_box`) VALUES
(16, 'НовыйТовар', NULL, '2026-01-18 10:04:17', '/uploads/image-1768730656660-945815806.png', 1),
(17, 'Тестовый товар', 'Тест', '2026-01-18 10:06:44', 'https://example.com/test.jpg', 1),
(18, 'Тестовый товар', 'Тест', '2026-01-18 10:17:41', 'https://example.com/test.jpg', 1),
(19, 'Бутылки', 'Кока кола 2', '2026-01-18 15:45:02', '/uploads/image-1768751098637-435670672.jpg', 1),
(20, 'Компютеры', NULL, '2026-01-18 15:47:11', '/uploads/image-1768751229763-426016673.jpg', 1);

-- --------------------------------------------------------

--
-- Структура таблицы `returns`
--
-- Создание: Янв 11 2026 г., 04:40
--

DROP TABLE IF EXISTS `returns`;
CREATE TABLE `returns` (
  `id` int NOT NULL,
  `customer_id` int DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sale_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `returns`
--

INSERT INTO `returns` (`id`, `customer_id`, `total_amount`, `created_by`, `created_at`, `sale_id`) VALUES
(13, 6, '500.00', 1, '2026-01-18 09:27:16', NULL),
(14, 6, '50111010.00', 2, '2026-01-18 19:49:03', 23);

-- --------------------------------------------------------

--
-- Структура таблицы `return_items`
--
-- Создание: Янв 11 2026 г., 04:40
--

DROP TABLE IF EXISTS `return_items`;
CREATE TABLE `return_items` (
  `id` int NOT NULL,
  `return_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `return_items`
--

INSERT INTO `return_items` (`id`, `return_id`, `product_id`, `quantity`, `unit_price`, `total_price`) VALUES
(15, 14, 20, 10, '101.00', '1010.00'),
(16, 14, 19, 5000, '10022.00', '50110000.00');

-- --------------------------------------------------------

--
-- Структура таблицы `sales`
--
-- Создание: Янв 21 2026 г., 06:03
-- Последнее обновление: Янв 20 2026 г., 05:24
--

DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
  `id` int NOT NULL,
  `customer_id` int DEFAULT NULL,
  `store_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `sales`
--

INSERT INTO `sales` (`id`, `customer_id`, `store_id`, `warehouse_id`, `total_amount`, `created_by`, `created_at`) VALUES
(23, 6, NULL, NULL, '50111010.00', 2, '2026-01-18 19:38:31'),
(24, 7, NULL, NULL, '101000.00', 1, '2026-01-20 05:24:37');

-- --------------------------------------------------------

--
-- Структура таблицы `sale_items`
--
-- Создание: Янв 11 2026 г., 04:26
-- Последнее обновление: Янв 20 2026 г., 05:24
--

DROP TABLE IF EXISTS `sale_items`;
CREATE TABLE `sale_items` (
  `id` int NOT NULL,
  `sale_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `sale_items`
--

INSERT INTO `sale_items` (`id`, `sale_id`, `product_id`, `quantity`, `unit_price`, `total_price`) VALUES
(26, 23, 20, 10, '101.00', '1010.00'),
(27, 23, 19, 5000, '10022.00', '50110000.00'),
(28, 24, 20, 1000, '101.00', '101000.00');

-- --------------------------------------------------------

--
-- Структура таблицы `stock_changes`
--
-- Создание: Янв 17 2026 г., 18:20
--

DROP TABLE IF EXISTS `stock_changes`;
CREATE TABLE `stock_changes` (
  `id` int NOT NULL,
  `warehouse_id` int NOT NULL,
  `product_id` int NOT NULL,
  `user_id` int NOT NULL,
  `change_type` enum('IN','OUT','ADJUSTMENT') NOT NULL,
  `old_weight_kg` decimal(10,2) DEFAULT '0.00',
  `new_weight_kg` decimal(10,2) DEFAULT '0.00',
  `old_volume_cbm` decimal(10,2) DEFAULT '0.00',
  `new_volume_cbm` decimal(10,2) DEFAULT '0.00',
  `reason` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `old_total_pieces` int NOT NULL DEFAULT '0',
  `new_total_pieces` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `stock_changes`
--

INSERT INTO `stock_changes` (`id`, `warehouse_id`, `product_id`, `user_id`, `change_type`, `old_weight_kg`, `new_weight_kg`, `old_volume_cbm`, `new_volume_cbm`, `reason`, `created_at`, `old_total_pieces`, `new_total_pieces`) VALUES
(14, 11, 19, 2, 'ADJUSTMENT', '50.00', '50.00', '104.00', '104.00', '- 1 штука, потерялось', '2026-01-18 17:28:54', 500338253, 500338252),
(15, 11, 19, 2, 'OUT', '50.00', '49.00', '104.00', '102.00', 'Transfer to warehouse 10', '2026-01-18 17:35:48', 500338252, 500338152),
(16, 10, 19, 2, 'IN', '0.00', '1.00', '0.00', '2.00', 'Transfer from warehouse 11', '2026-01-18 17:35:49', 0, 100),
(17, 10, 19, 2, 'OUT', '1.00', '0.00', '2.00', '0.00', 'Transfer to warehouse 11', '2026-01-18 18:21:25', 100, 0),
(18, 11, 19, 2, 'IN', '49.00', '50.00', '102.00', '104.00', 'Transfer from warehouse 10', '2026-01-18 18:21:25', 500338152, 500338252),
(19, 11, 20, 2, 'OUT', '100.00', '0.00', '100.00', '0.00', 'Transfer to warehouse 10', '2026-01-18 18:24:12', 1001, 0),
(20, 10, 20, 2, 'IN', '0.00', '100.00', '0.00', '100.00', 'Transfer from warehouse 11', '2026-01-18 18:24:13', 0, 1001),
(21, 11, 19, 2, 'ADJUSTMENT', '50.00', '50.00', '104.00', '104.00', NULL, '2026-01-18 18:38:28', 500338252, 500338200),
(22, 10, 20, 2, 'IN', '0.00', '0.00', '0.00', '0.00', 'Return #14', '2026-01-18 19:49:05', 991, 1001),
(23, 10, 19, 2, 'IN', '0.00', '0.00', '0.00', '0.00', 'Return #14', '2026-01-18 19:49:06', 0, 5000);

-- --------------------------------------------------------

--
-- Структура таблицы `stock_receipts`
--
-- Создание: Янв 04 2026 г., 06:49
--

DROP TABLE IF EXISTS `stock_receipts`;
CREATE TABLE `stock_receipts` (
  `id` int NOT NULL,
  `warehouse_id` int NOT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `total_amount` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `stock_receipts`
--

INSERT INTO `stock_receipts` (`id`, `warehouse_id`, `created_by`, `created_at`, `total_amount`) VALUES
(21, 10, 1, '2026-01-18 09:27:09', '5000.00'),
(22, 11, 2, '2026-01-18 16:19:38', '59163.00'),
(23, 11, 2, '2026-01-18 16:26:58', '91080.00'),
(24, 11, 2, '2026-01-18 16:59:39', '1100.00'),
(25, 10, 1, '2026-01-19 07:01:13', '50.00');

-- --------------------------------------------------------

--
-- Структура таблицы `stock_receipt_items`
--
-- Создание: Янв 17 2026 г., 18:21
--

DROP TABLE IF EXISTS `stock_receipt_items`;
CREATE TABLE `stock_receipt_items` (
  `id` int NOT NULL,
  `receipt_id` int NOT NULL,
  `product_id` int NOT NULL,
  `boxes_qty` int NOT NULL,
  `weight_kg` decimal(10,2) DEFAULT NULL,
  `volume_cbm` decimal(10,2) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `purchase_cost` decimal(10,2) DEFAULT NULL,
  `selling_price` decimal(10,2) DEFAULT NULL,
  `pieces_per_box` int NOT NULL DEFAULT '1',
  `loose_pieces` int NOT NULL DEFAULT '0',
  `total_pieces` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `stock_receipt_items`
--

INSERT INTO `stock_receipt_items` (`id`, `receipt_id`, `product_id`, `boxes_qty`, `weight_kg`, `volume_cbm`, `amount`, `purchase_cost`, `selling_price`, `pieces_per_box`, `loose_pieces`, `total_pieces`) VALUES
(22, 22, 19, 10, '0.00', '54.00', '59163.00', '20.00', '111.00', 50, 33, 50033),
(23, 23, 19, 15, '50.00', '50.00', '91080.00', '100.00', '110.00', 55, 3, 8253),
(24, 24, 20, 10, '100.00', '100.00', '1100.00', '10.00', '10.10', 10, 1, 1001),
(25, 25, 16, 5, NULL, NULL, '50.00', '1.00', '1.50', 10, 0, 500);

-- --------------------------------------------------------

--
-- Структура таблицы `stores`
--
-- Создание: Янв 21 2026 г., 06:02
--

DROP TABLE IF EXISTS `stores`;
CREATE TABLE `stores` (
  `id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `city` varchar(100) DEFAULT NULL,
  `warehouse_id` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Структура таблицы `tokens`
--
-- Создание: Дек 29 2025 г., 17:15
--

DROP TABLE IF EXISTS `tokens`;
CREATE TABLE `tokens` (
  `user_id` int NOT NULL,
  `token` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `tokens`
--

INSERT INTO `tokens` (`user_id`, `token`) VALUES
(2, '46a5319aa0b33a7d9efea977814a63c68d8a612476e60835f12b8c92d7ad6a62'),
(1, '89e2ce3215222dbf849864cb82865d928ae2f7593c22aff246ae6888fb1efb22');

-- --------------------------------------------------------

--
-- Структура таблицы `users`
--
-- Создание: Янв 12 2026 г., 13:05
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL,
  `login` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('ADMIN','USER') NOT NULL DEFAULT 'USER',
  `name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `users`
--

INSERT INTO `users` (`id`, `login`, `password_hash`, `role`, `name`, `created_at`) VALUES
(1, 'admin', '$2b$10$hEDF421bVqvq9EvEG3LPZ.4MohlTuAyBKrGFQTV7FVk2HS8rpQG.O', 'ADMIN', 'Test', '2026-01-12 13:05:07'),
(2, 'Merodzh', '$2b$10$Ui/08NPOniUYkUyaVDTY2.ufAwmjWFbfYw.ev1gnrd6cdLO5ET2RC', 'ADMIN', 'Иван', '2026-01-12 13:05:07'),
(3, 'updated_testuser', '$2b$10$IZQYHvsne2IPnjF7fC/Y2uvWhpciCuyhGk7avtttHC3oNQG7ZySya', 'USER', 'Updated Test User', '2026-01-18 09:27:05');

-- --------------------------------------------------------

--
-- Структура таблицы `warehouses`
--
-- Создание: Янв 21 2026 г., 06:03
--

DROP TABLE IF EXISTS `warehouses`;
CREATE TABLE `warehouses` (
  `id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `city` varchar(100) DEFAULT NULL,
  `is_main` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `warehouses`
--

INSERT INTO `warehouses` (`id`, `name`, `is_default`, `city`, `is_main`, `is_active`, `created_at`) VALUES
(10, 'Тестовый склад', 1, NULL, 0, 1, '2026-01-21 06:03:33'),
(11, 'Main', 0, NULL, 0, 1, '2026-01-21 06:03:33');

-- --------------------------------------------------------

--
-- Структура таблицы `warehouse_stock`
--
-- Создание: Янв 17 2026 г., 18:20
-- Последнее обновление: Янв 20 2026 г., 05:24
--

DROP TABLE IF EXISTS `warehouse_stock`;
CREATE TABLE `warehouse_stock` (
  `id` int NOT NULL,
  `warehouse_id` int NOT NULL,
  `product_id` int NOT NULL,
  `weight_kg` decimal(10,2) DEFAULT '0.00',
  `volume_cbm` decimal(10,2) DEFAULT '0.00',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `total_pieces` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `warehouse_stock`
--

INSERT INTO `warehouse_stock` (`id`, `warehouse_id`, `product_id`, `weight_kg`, `volume_cbm`, `total_pieces`) VALUES
(22, 11, 19, '50.00', '104.00', 500333200),
(23, 11, 20, '0.00', '0.00', 0),
(24, 10, 19, '0.00', '0.00', 5000),
(25, 10, 20, '100.00', '100.00', 1),
(26, 10, 16, '0.00', '0.00', 500);

--
-- Индексы сохранённых таблиц
--

--
-- Индексы таблицы `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `returns`
--
ALTER TABLE `returns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `sale_id` (`sale_id`);

--
-- Индексы таблицы `return_items`
--
ALTER TABLE `return_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `return_id` (`return_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Индексы таблицы `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `fk_sales_store` (`store_id`),
  ADD KEY `fk_sales_warehouse` (`warehouse_id`);

--
-- Индексы таблицы `sale_items`
--
ALTER TABLE `sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sale_id` (`sale_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Индексы таблицы `stock_changes`
--
ALTER TABLE `stock_changes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `warehouse_id` (`warehouse_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Индексы таблицы `stock_receipts`
--
ALTER TABLE `stock_receipts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `warehouse_id` (`warehouse_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Индексы таблицы `stock_receipt_items`
--
ALTER TABLE `stock_receipt_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `receipt_id` (`receipt_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Индексы таблицы `stores`
--
ALTER TABLE `stores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_stores_warehouse` (`warehouse_id`);

--
-- Индексы таблицы `tokens`
--
ALTER TABLE `tokens`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `token` (`token`);

--
-- Индексы таблицы `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `login` (`login`);

--
-- Индексы таблицы `warehouses`
--
ALTER TABLE `warehouses`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `warehouse_stock`
--
ALTER TABLE `warehouse_stock`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_warehouse_product` (`warehouse_id`,`product_id`),
  ADD KEY `product_id` (`product_id`);

--
-- AUTO_INCREMENT для сохранённых таблиц
--

--
-- AUTO_INCREMENT для таблицы `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT для таблицы `products`
--
ALTER TABLE `products`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT для таблицы `returns`
--
ALTER TABLE `returns`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT для таблицы `return_items`
--
ALTER TABLE `return_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT для таблицы `sales`
--
ALTER TABLE `sales`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT для таблицы `sale_items`
--
ALTER TABLE `sale_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT для таблицы `stock_changes`
--
ALTER TABLE `stock_changes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT для таблицы `stock_receipts`
--
ALTER TABLE `stock_receipts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT для таблицы `stock_receipt_items`
--
ALTER TABLE `stock_receipt_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT для таблицы `stores`
--
ALTER TABLE `stores`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT для таблицы `warehouses`
--
ALTER TABLE `warehouses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT для таблицы `warehouse_stock`
--
ALTER TABLE `warehouse_stock`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- Ограничения внешнего ключа сохраненных таблиц
--

--
-- Ограничения внешнего ключа таблицы `returns`
--
ALTER TABLE `returns`
  ADD CONSTRAINT `returns_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `returns_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `returns_ibfk_3` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL;

--
-- Ограничения внешнего ключа таблицы `return_items`
--
ALTER TABLE `return_items`
  ADD CONSTRAINT `return_items_ibfk_1` FOREIGN KEY (`return_id`) REFERENCES `returns` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `return_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `fk_sales_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`),
  ADD CONSTRAINT `fk_sales_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `sale_items`
--
ALTER TABLE `sale_items`
  ADD CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `stock_changes`
--
ALTER TABLE `stock_changes`
  ADD CONSTRAINT `stock_changes_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_changes_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_changes_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `stock_receipts`
--
ALTER TABLE `stock_receipts`
  ADD CONSTRAINT `stock_receipts_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_receipts_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `stock_receipt_items`
--
ALTER TABLE `stock_receipt_items`
  ADD CONSTRAINT `stock_receipt_items_ibfk_1` FOREIGN KEY (`receipt_id`) REFERENCES `stock_receipts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_receipt_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `stores`
--
ALTER TABLE `stores`
  ADD CONSTRAINT `fk_stores_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Ограничения внешнего ключа таблицы `tokens`
--
ALTER TABLE `tokens`
  ADD CONSTRAINT `tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `warehouse_stock`
--
ALTER TABLE `warehouse_stock`
  ADD CONSTRAINT `warehouse_stock_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `warehouse_stock_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
