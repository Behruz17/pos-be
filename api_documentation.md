# Документация по API для POS системы

## Важное замечание о доступе

Система реализует многоуровневый контроль доступа:

- **Администраторы (ADMIN)**: Полный доступ ко всем магазинам и данным
- **Пользователи (USER)**: 
  - Полный доступ только к своему магазину (store_id)
  - Read-only доступ к данным других магазинов
  - Все операции автоматически ограничены их магазином

**Требование**: Все USER-пользователи должны иметь store_id в таблице users.

## 1. Аутентификация

### POST /api/auth/login
**Назначение:** Вход пользователя по логину и паролю  
**Тело запроса:**
```json
{
  "login": "string",
  "password": "string"
}
```
**Ответ (успешный):**
```json
{
  "token": "токен_пользователя",
  "user": {
    "id": 1,
    "login": "admin",
    "name": "Admin User",
    "role": "ADMIN"
  }
}
```

### POST /api/auth/logout
**Назначение:** Выход пользователя (удаление токена)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
{
  "message": "ok"
}
```

### GET /api/auth/me
**Назначение:** Получение информации о текущем пользователе  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
{
  "id": 1,
  "login": "admin",
  "name": "Admin User",
  "role": "ADMIN",
  "store_id": 1
}
```
**Примечания:**
- Поле store_id присутствует для всех пользователей
- Для администраторов store_id может быть null

### POST /api/auth/register
**Назначение:** Создание нового пользователя (только для администраторов)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "login": "string",
  "password": "string",
  "name": "Имя пользователя (необязательно)",
  "role": "USER" (по умолчанию) или "ADMIN",
  "store_id": "ID магазина (обязательно для USER)"
}
```
**Ответ:**
```json
{
  "id": 2,
  "login": "user",
  "name": "Имя пользователя",
  "role": "USER",
  "store_id": 1,
  "created_at": "2023-01-01T00:00:00.000Z",
  "message": "User created successfully"
}
```
**Примечания:**
- Для USER-пользователей поле store_id обязательно
- Администраторы могут создавать пользователей без store_id
- Только администраторы могут создавать других администраторов

## 2. Управление пользователями (только для администраторов)

### GET /api/users
**Назначение:** Получение списка всех пользователей (только для администраторов)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "login": "admin",
    "name": "Admin User",
    "role": "ADMIN",
    "store_id": null,
    "created_at": "2023-01-01T00:00:00.000Z"
  },
  {
    "id": 2,
    "login": "user",
    "name": "Regular User",
    "role": "USER",
    "store_id": 1,
    "created_at": "2023-01-02T00:00:00.000Z"
  }
]
```
**Примечания:**
- Только администраторы могут получить список всех пользователей
- В ответе включено поле store_id для каждого пользователя

### GET /api/users/:id
**Назначение:** Получение информации о конкретном пользователе  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID пользователя
**Ответ:**
```json
{
  "id": 1,
  "login": "admin",
  "name": "Admin User",
  "role": "ADMIN",
  "created_at": "2023-01-01T00:00:00.000Z"
}
```

### PUT /api/users/:id
**Назначение:** Обновление информации о пользователе  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID пользователя
**Тело запроса:**
```json
{
  "login": "new_login",
  "name": "Новое имя пользователя",
  "role": "USER" или "ADMIN"
}
```
**Ответ:**
```json
{
  "id": 1,
  "login": "new_login",
  "name": "Новое имя пользователя",
  "role": "USER",
  "created_at": "2023-01-01T00:00:00.000Z",
  "message": "User updated successfully"
}
```

### DELETE /api/users/:id
**Назначение:** Удаление пользователя  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID пользователя
**Ответ:**
```json
{
  "message": "User deleted successfully"
}
```

## 3. Управление магазинами

### POST /api/stores
**Назначение:** Создание нового магазина  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "name": "Название магазина",
  "city": "Город (необязательно)",
  "warehouse_id": 1
}
```
**Ответ:**
```json
{
  "id": 1,
  "name": "Название магазина",
  "city": "Город",
  "warehouse_id": 1,
  "message": "Store added successfully"
}
```

### GET /api/stores
**Назначение:** Получение списка всех магазинов  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Название магазина",
    "city": "Город",
    "warehouse_id": 1,
    "warehouse_name": "Название склада"
  }
]
```

### PUT /api/stores/:id
**Назначение:** Обновление информации о магазине  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID магазина
**Тело запроса:**
```json
{
  "name": "Новое название магазина",
  "city": "Новый город (необязательно)",
  "warehouse_id": 2
}
```
**Ответ:**
```json
{
  "id": 1,
  "name": "Новое название магазина",
  "city": "Новый город",
  "warehouse_id": 2,
  "warehouse_name": "Новое название склада",
  "message": "Store updated successfully"
}
```

### DELETE /api/stores/:id
**Назначение:** Удаление магазина (мягкое удаление)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID магазина
**Ответ:**
```json
{
  "message": "Store deleted successfully"
}
```

## 4. Управление складами

### POST /api/warehouses
**Назначение:** Создание нового склада  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "name": "Название склада"
}
```
**Ответ:**
```json
{
  "id": 1,
  "name": "Название склада",
  "message": "Warehouse added successfully"
}
```

### GET /api/warehouses
**Назначение:** Получение списка всех складов  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Main Warehouse"
  }
]
```

### PUT /api/warehouses/:id
**Назначение:** Обновление информации о складе  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID склада
**Тело запроса:**
```json
{
  "name": "Новое название склада",
  "city": "Новый город (необязательно)",
  "is_default": true (необязательно),
  "is_main": false (необязательно)
}
```
**Ответ:**
```json
{
  "id": 1,
  "name": "Новое название склада",
  "city": "Новый город",
  "is_default": true,
  "is_main": false,
  "message": "Warehouse updated successfully"
}
```

### DELETE /api/warehouses/:id
**Назначение:** Удаление склада  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID склада
**Ответ (успешный):**
```json
{
  "message": "Warehouse deleted successfully"
}
```
**Ответ (склад не найден):**
```json
{
  "error": "Warehouse not found"
}
```
**Ответ (склад содержит товары):**
```json
{
  "error": "Cannot delete warehouse with existing stock. Please transfer or remove all products first."
}
```

### GET /api/warehouses/:id/products
**Назначение:** Получение списка товаров в конкретном складе  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID склада
**Ответ:**
```json
{
  "warehouse": {
    "id": 1,
    "name": "Main Warehouse"
  },
  "products": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Название товара",
      "manufacturer": "Производитель",
      "image": "Ссылка на изображение товара",
      "total_pieces": 30,
      "weight_kg": 50.5,
      "volume_cbm": 2.5,
      "updated_at": "2023-01-01T00:00:00.000Z",
      "purchase_cost": 400.00,
      "selling_price": 600.00
    }
  ]
}
```

### GET /api/warehouses/:warehouseId/products/:productId
**Назначение:** Получение детальной информации о конкретном товаре в конкретном складе  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `warehouseId` - ID склада
- `productId` - ID товара
**Ответ:**
```json
{
  "warehouse": {
    "id": 1,
    "name": "Main Warehouse"
  },
  "product": {
    "id": 1,
    "name": "Название товара",
    "manufacturer": "Производитель",
    "image": "Ссылка на изображение товара",
    "created_at": "2023-01-01T00:00:00.000Z"
  },
  "stock": {
    "id": 1,
    "total_pieces": 30,
    "weight_kg": 50.5,
    "volume_cbm": 2.5,
    "updated_at": "2023-01-01T00:00:00.000Z"
  }
}
```

## 5. Управление товарами

### POST /api/products
**Назначение:** Создание нового товара  
**Заголовки:**
- `Authorization: Bearer <токен>`

**Вариант 1: Создание с URL изображения**
**Тип контента:** `application/json`
**Тело запроса:**
```json
{
  "name": "Название товара",
  "manufacturer": "Производитель (необязательно)",
  "product_code": "Уникальный код товара (обязательно)",
  "image": "Ссылка на изображение товара (необязательно)",
  "notification_threshold": 10 (необязательно, по умолчанию 10)
}
```

**Вариант 2: Создание с загрузкой файла**
**Тип контента:** `multipart/form-data`
- `name` (string) - Название товара
- `manufacturer` (string, опционально) - Производитель
- `image` (file) - Изображение товара
- `notification_threshold` (int, опционально) - Количество, при котором товар считается "отсутствующим" (по умолчанию 10)

**Ответ:**
```json
{
  "id": 1,
  "name": "Название товара",
  "manufacturer": "Производитель",
  "product_code": "UNIQUE_CODE",
  "image": "/uploads/filename.jpg",
  "notification_threshold": 10,
  "message": "Product added successfully"
}
```

### PUT /api/products/:id
**Назначение:** Обновление информации о товаре  
**Заголовки:**
- `Authorization: Bearer <токен>`

**Вариант 1: Обновление с URL изображения**
**Тип контента:** `application/json`
**Тело запроса:**
```json
{
  "name": "Новое название товара",
  "manufacturer": "Новый производитель (необязательно)",
  "image": "Ссылка на изображение товара (необязательно)",
  "notification_threshold": 15 (необязательно)
}
```

**Вариант 2: Обновление с загрузкой файла**
**Тип контента:** `multipart/form-data`
- `name` (string) - Новое название товара
- `manufacturer` (string, опционально) - Новый производитель
- `image` (file) - Новое изображение товара
- `notification_threshold` (int, опционально) - Количество, при котором товар считается "отсутствующим"

**Ответ:**
```json
{
  "id": 1,
  "name": "Новое название товара",
  "manufacturer": "Новый производитель",
  "image": "/uploads/filename.jpg",
  "notification_threshold": 15,
  "message": "Product updated successfully"
}
```

### GET /api/products
**Назначение:** Получение списка всех товаров  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Название товара",
    "manufacturer": "Производитель",
    "product_code": "UNIQUE_CODE",
    "image": "Ссылка на изображение товара",
    "notification_threshold": 10,
    "created_at": "2023-01-01T00:00:00.000Z",
    "last_unit_price": 600.00,
    "total_stock": 30,
    "purchase_cost": 400.00,
    "selling_price": 600.00
  }
]
```

### DELETE /api/products/:id
**Назначение:** Удаление товара  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID товара
**Ответ (успешный):**
```json
{
  "message": "Product deleted successfully"
}
```
**Ответ (товар не найден):**
```json
{
  "error": "Product not found"
}
```
**Ответ (товар находится на складе):**
```json
{
  "error": "Cannot delete product that is currently in stock. Please remove from all warehouses first."
}
```
**Ответ (товар использован в операциях):**
```json
{
  "error": "Cannot delete product that has been used in inventory receipts."
}
```

### GET /api/products/missing
**Назначение:** Получение списка товаров с количеством ниже порога уведомления  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Название товара",
    "manufacturer": "Производитель",
    "product_code": "UNIQUE_CODE",
    "image": "Ссылка на изображение товара",
    "notification_threshold": 10,
    "total_stock": 5
  }
]
```

## 6. Приход товаров на склад

### POST /api/inventory/receipt
**Назначение:** Создание документа прихода товаров на склад  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "warehouse_id": 1,
  "supplier_id": 1 (обязательно),
  "items": [
    {
      "product_id": 1,
      "product_name": "Название товара",
      "boxes_qty": 5,
      "pieces_per_box": 10,
      "loose_pieces": 5,
      "weight_kg": 25.5,
      "volume_cbm": 1.2,
      "amount": 5000.00,
      "purchase_cost": 400.00,
      "selling_price": 600.00
    }
  ]
}
```
**Ответ:**
```json
{
  "id": 1,
  "message": "Inventory receipt added successfully"
}
```

**Важные изменения:**
- При каждом приходе товара автоматически создаются записи в истории изменений склада (`stock_changes`) с типом `IN`
- Для каждого товара в приходе фиксируются старые и новые значения остатков, веса и объема
- В поле `reason` указывается номер документа прихода (например, `Receipt #123`) для удобства отслеживания
- Добавлено обязательное поле `supplier_id` для связи прихода с поставщиком
- Проверяется что поставщик существует и активен
- Для каждого товара в приходе теперь требуется указать `product_name` - если товар с указанным `product_id` не существует, он будет создан с указанным именем

### GET /api/inventory/receipts
**Назначение:** Получение списка всех документов прихода  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "warehouse_id": 1,
    "warehouse_name": "Main Warehouse",
    "supplier_id": 1,
    "supplier_name": "Supplier Name",
    "created_by": 1,
    "created_by_name": "admin",
    "created_at": "2023-01-01T00:00:00.000Z",
    "total_amount": 5000.00
  }
]
```

### GET /api/inventory/receipt/:id
**Назначение:** Получение информации о конкретном документе прихода  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID документа прихода
**Ответ:**
```json
{
  "id": 1,
  "warehouse_id": 1,
  "warehouse_name": "Main Warehouse",
  "supplier_id": 1,
  "supplier_name": "Supplier Name",
  "created_by": 1,
  "created_by_name": "admin",
  "created_at": "2023-01-01T00:00:00.000Z",
  "total_amount": 5000.00,
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Название товара",
      "manufacturer": "Производитель",
      "image": "Ссылка на изображение товара",
      "product_code": "UNIQUE_CODE",
      "boxes_qty": 5,
      "pieces_per_box": 10,
      "loose_pieces": 5,
      "total_pieces": 55,
      "weight_kg": 25.5,
      "volume_cbm": 1.2,
      "amount": 5000.00,
      "purchase_cost": 400.00,
      "selling_price": 600.00
    }
  ]
}
```

### GET /api/stock-receipt-items
**Назначение:** Получение записей из таблицы stock_receipt_items с возможностью фильтрации по receipt_id, supplier_id и warehouse_id  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры (query):**
- `receipt_id` (опционально) - ID документа прихода для фильтрации
- `supplier_id` (опционально) - ID поставщика для фильтрации
- `warehouse_id` (опционально) - ID склада для фильтрации
**Примеры использования:**
- `/api/stock-receipt-items?supplier_id=1&warehouse_id=11` - получить все записи прихода для поставщика ID 1 и склада ID 11
- `/api/stock-receipt-items?receipt_id=5` - получить все товары для конкретного документа прихода ID 5
- `/api/stock-receipt-items?supplier_id=1&warehouse_id=11&receipt_id=5` - получить конкретный документ прихода для поставщика и склада

**Ответ:**
```json
[
  {
    "id": 1,
    "receipt_id": 5,
    "product_id": 1,
    "product_name": "Название товара",
    "manufacturer": "Производитель",
    "image": "Ссылка на изображение товара",
    "product_code": "UNIQUE_CODE",
    "boxes_qty": 5,
    "pieces_per_box": 10,
    "loose_pieces": 5,
    "total_pieces": 55,
    "weight_kg": 25.5,
    "volume_cbm": 1.2,
    "amount": 5000.00,
    "purchase_cost": 400.00,
    "selling_price": 600.00
  }
]
```

## 7. Управление остатками на складах

### GET /api/warehouse/stock
**Назначение:** Получение остатков товаров на всех складах  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "warehouse_id": 1,
    "warehouse_name": "Main Warehouse",
    "product_id": 1,
    "product_name": "Название товара",
    "total_pieces": 30,
    "weight_kg": 50.5,
    "volume_cbm": 2.5,
    "updated_at": "2023-01-01T00:00:00.000Z",
    "purchase_cost": 400.00,
    "selling_price": 600.00
  }
]
```

### PUT /api/warehouse/stock/:id
**Назначение:** Редактирование остатков конкретного товара на складе  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID записи остатка
**Тело запроса:**
```json
{
  "total_pieces": 35,
  "weight_kg": 60.0,
  "volume_cbm": 3.0,
  "reason": "Корректировка по инвентаризации"
}
```
**Ответ:**
```json
{
  "id": 1,
  "message": "Stock updated successfully"
}
```

### POST /api/warehouse/stock/move
**Назначение:** Перемещение товаров между складами  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "from_warehouse_id": 1,
  "to_warehouse_id": 2,
  "product_id": 1,
  "total_pieces": 15,
  "weight_kg": 25.0,
  "volume_cbm": 1.2,
  "reason": "Перемещение между складами"
}
```
**Ответ:**
```json
{
  "message": "Stock moved successfully"
}
```

## 8. История изменений остатков

### GET /api/stock/history
**Назначение:** Получение истории всех изменений остатков  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "warehouse_id": 1,
    "warehouse_name": "Main Warehouse",
    "product_id": 1,
    "product_name": "Название товара",
    "manufacturer": "Производитель",
    "image": "Ссылка на изображение товара",
    "user_id": 1,
    "user_name": "admin",
    "change_type": "ADJUSTMENT",
    "old_total_pieces": 20,
    "new_total_pieces": 25,
    "old_weight_kg": 50.5,
    "new_weight_kg": 60.0,
    "old_volume_cbm": 2.5,
    "new_volume_cbm": 3.0,
    "reason": "Корректировка по инвентаризации",
    "created_at": "2023-01-01T00:00:00.000Z"
  }
]
```

### GET /api/stock/history/:id
**Назначение:** Получение конкретной записи истории изменений  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID записи истории
**Ответ:**
```json
{
  "id": 1,
  "warehouse_id": 1,
  "warehouse_name": "Main Warehouse",
  "product_id": 1,
  "product_name": "Название товара",
  "manufacturer": "Производитель",
  "image": "Ссылка на изображение товара",
  "user_id": 1,
  "user_name": "admin",
  "change_type": "ADJUSTMENT",
  "old_total_pieces": 20,
  "new_total_pieces": 25,
  "old_weight_kg": 50.5,
  "new_weight_kg": 60.0,
  "old_volume_cbm": 2.5,
  "new_volume_cbm": 3.0,
  "reason": "Корректировка по инвентаризации",
  "created_at": "2023-01-01T00:00:00.000Z"
}
```

## 9. Управление клиентами

### POST /api/customers
**Назначение:** Создание нового клиента  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "full_name": "Ф.И.О. клиента",
  "phone": "+79991234567" (необязательно),
  "city": "Город" (необязательно),
  "store_id": 1 (обязательно для администраторов)
}
```
**Ответ:**
```json
{
  "id": 1,
  "full_name": "Ф.И.О. клиента",
  "phone": "+79991234567",
  "city": "Город",
  "store_id": 1,
  "balance": 0.00,
  "created_at": "2023-01-01T00:00:00.000Z",
  "updated_at": "2023-01-01T00:00:00.000Z",
  "message": "Customer created successfully"
}
```
**Примечания:**
- Для администраторов: поле store_id обязательно в запросе
- Для обычных пользователей: store_id автоматически устанавливается в их магазин
- Клиенты всегда создаются в магазине пользователя
**Ошибки:**
- `400 Bad Request`: Если не указано поле `full_name`, или если магазин с указанным ID не найден
- `403 Forbidden`: Если пользователь пытается создать клиента не в своем магазине

### GET /api/customers
**Назначение:** Получение списка клиентов  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "full_name": "Ф.И.О. клиента",
    "phone": "+79991234567",
    "city": "Город",
    "store_id": 1,
    "balance": -123320.00,
    "created_at": "2023-01-01T00:00:00.000Z",
    "updated_at": "2023-01-01T00:00:00.000Z"
  }
]
```
**Примечания:**
- Администраторы получают список всех клиентов
- Обычные пользователи получают только клиентов своего магазина
- При доступе к другим магазинам возвращаются только данные с ограниченным доступом

### GET /api/customers/:id
**Назначение:** Получение информации о конкретном клиенте  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID клиента
**Ответ:**
```json
{
  "id": 1,
  "full_name": "Ф.И.О. клиента",
  "phone": "+79991234567",
  "city": "Город",
  "store_id": 1,
  "balance": -123320.00,
  "created_at": "2023-01-01T00:00:00.000Z",
  "updated_at": "2023-01-01T00:00:00.000Z"
}
```

### PUT /api/customers/:id
**Назначение:** Обновление информации о клиенте  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID клиента
**Тело запроса:**
```json
{
  "full_name": "Ф.И.О. клиента",
  "phone": "+79991234567" (необязательно),
  "city": "Город" (необязательно),
  "store_id": 1 (необязательно)
}
```
**Ответ:**
```json
{
  "id": 1,
  "full_name": "Ф.И.О. клиента",
  "phone": "+79991234567",
  "city": "Город",
  "store_id": 1,
  "balance": -123320.00,
  "created_at": "2023-01-01T00:00:00.000Z",
  "updated_at": "2023-01-02T00:00:00.000Z",
  "message": "Customer updated successfully"
}
```

### DELETE /api/customers/:id
**Назначение:** Удаление клиента  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID клиента
**Ответ:**
```json
{
  "message": "Customer deleted successfully"
}
```

### GET /api/customers/:customerId/sales/:storeId
**Назначение:** Получение списка записей из таблицы sales для конкретного клиента в указанном магазине  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `customerId` - ID клиента
- `storeId` - ID магазина
**Ответ:**
```json
{
  "customer": {
    "id": 1,
    "full_name": "Ф.И.О. клиента",
    "phone": "+79991234567",
    "city": "Город",
    "balance": -123320.00
  },
  "store": {
    "id": 1,
    "name": "Название магазина",
    "warehouse_id": 1
  },
  "sales": [
    {
      "id": 1,
      "customer_id": 1,
      "customer_name": "Ф.И.О. клиента",
      "total_amount": 1000.00,
      "payment_status": "DEBT",
      "created_by": 1,
      "created_by_name": "admin",
      "created_at": "2023-01-01T00:00:00.000Z",
      "store_id": 1,
      "warehouse_id": 1,
      "store_name": "Название магазина",
      "warehouse_name": "Название склада"
    }
  ]
}
```

### GET /api/stores/:storeId/customers
**Назначение:** Получение списка клиентов, которые совершали покупки в указанном магазине  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `storeId` - ID магазина
**Ответ:**
```json
{
  "store": {
    "id": 1,
    "name": "Название магазина",
    "warehouse_id": 1
  },
  "customers": [
    {
      "id": 1,
      "full_name": "Ф.И.О. клиента",
      "phone": "+79991234567",
      "city": "Город",
      "store_id": 1,
      "balance": -123320.00,
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /api/customers/:id/details
**Назначение:** Получение подробной информации о клиенте, включая историю транзакций  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID клиента
- `month` (query параметр, опционально) - Месяц для фильтрации транзакций (1-12)
- `year` (query параметр, опционально) - Год для фильтрации транзакций (например, 2023)
**Ответ:**
```json
{
  "id": 1,
  "full_name": "Ф.И.О. клиента",
  "phone": "+79991234567",
  "city": "Город",
  "balance": -123320.00,
  "created_at": "2023-01-01T00:00:00.000Z",
  "updated_at": "2023-01-02T00:00:00.000Z",
  "transactions": [
    {
      "id": 1,
      "amount": 500.00,
      "date": "2023-01-02T10:00:00.000Z",
      "type": "sale"
    },
    {
      "id": 2,
      "amount": 200.00,
      "date": "2023-01-03T10:00:00.000Z",
      "type": "return"
    },
    {
      "id": 3,
      "amount": 100.00,
      "date": "2023-01-04T10:00:00.000Z",
      "type": "payment"
    }
  ]
}
```

### POST /api/customers/:id/payment
**Назначение:** Прием денег от клиента для погашения задолженности  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID клиента
**Тело запроса:**
```json
{
  "amount": 500.00, (обязательно, положительное число)
  "payment_method": "CASH" или "CARD" или "TRANSFER" (необязательно, по умолчанию "CASH"),
  "note": "Комментарий к платежу (необязательно)",
  "store_id": 1 (необязательно, ID магазина для привязки платежа)
}
```
**Ответ:**
```json
{
  "id": 1,
  "customer_id": 1,
  "customer_name": "Ф.И.О. клиента",
  "amount": 500.00,
  "payment_method": "CASH",
  "note": "Комментарий к платежу",
  "store_id": 1,
  "new_balance": -122820.00,
  "message": "Customer payment recorded successfully"
}
```

### GET /api/customers/:customerId/operations
**Назначение:** Получение списка операций клиента или всех операций по магазину
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры пути:**
- `customerId` - ID клиента (опционально)
**Query параметры:**
- `store_id` - ID магазина (обязательно если не указан customerId)
- `type` (опционально) - Тип операции ('PAID', 'DEBT', 'PAYMENT')
- `month` (опционально) - Месяц для фильтрации (1-12)
- `year` (опционально) - Год для фильтрации (например, 2023)

**Примеры использования:**
- `/api/customers/1/operations` - все операции клиента ID 1
- `/api/customers/1/operations?store_id=2` - операции клиента ID 1 только по магазину ID 2
- `/api/customers/1/operations?type=PAYMENT` - только операции типа 'PAYMENT' для клиента ID 1
- `/api/customers/1/operations?month=1&year=2023` - операции клиента ID 1 за январь 2023 года
- `/api/customers/operations?store_id=1&month=1&year=2024` - все операции по магазину ID 1 за январь 2024 года (без указания клиента)

**Ответ (с указанием клиента):**
```json
{
  "customer": {
    "id": 1,
    "full_name": "Customer Name",
    "phone": "+79991234567",
    "balance": -500.00
  },
  "operations": [
    {
      "id": 1,
      "customer_id": 1,
      "customer_name": "Customer Name",
      "store_id": 1,
      "store_name": "Main Store",
      "sale_id": 123,
      "sum": 500.00,
      "type": "PAYMENT",
      "date": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

**Ответ (без указания клиента, только с магазином):**
```json
{
  "store": {
    "id": 1,
    "name": "Main Store"
  },
  "operations": [
    {
      "id": 1,
      "customer_id": 1,
      "customer_name": "Customer Name",
      "store_id": 1,
      "store_name": "Main Store",
      "sum": 500.00,
      "type": "PAYMENT",
      "date": "2023-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "customer_id": 2,
      "customer_name": "Another Customer",
      "store_id": 1,
      "store_name": "Main Store",
      "sale_id": 124,
      "sum": 300.00,
      "type": "PAID",
      "date": "2023-01-02T00:00:00.000Z"
    }
  ]
}
```

### POST /api/customers/:id/update-balance
**Назначение:** Обновление баланса клиента  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID клиента
**Тело запроса:**
```json
{
  "amount": 500.00,
  "operation": "add" (или "subtract"),
  "reason": "Причина изменения баланса (необязательно)"
}
```
**Ответ:**
```json
{
  "id": 1,
  "new_balance": -122820.00,
  "message": "Customer balance updated successfully"
}
```

## 10. Продажи

### POST /api/sales
**Назначение:** Создание новой продажи  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "customer_id": 1 (необязательно, NULL для розничных покупателей),
  "store_id": 1 (обязательно),
  "payment_status": "PAID" или "DEBT" (по умолчанию "DEBT"),
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "unit_price": 500.00
    }
  ]
}
```
**Ответ:**
```json
{
  "id": 1,
  "message": "Sale created successfully"
}
```

**Пример запроса для розничного долга:**
```json
{
  "store_id": 1,
  "payment_status": "DEBT",
  "customer_name": "Иван Петров",
  "phone": "+79991234567",
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "unit_price": 500.00
    }
  ]
}
```
**Ответ для розничного долга:**
```json
{
  "id": 123,
  "retail_debtor_id": 45,
  "customer_name": "Иван Петров",
  "phone": "+79991234567",
  "amount": 1000.00,
  "message": "Sale created successfully with retail debt record"
}
```

**Важные изменения:**
- Теперь обязательно указывать `store_id` - система определяет склад списания через магазин
- Списание происходит только с одного склада (склада магазина), а не "размазывается" по всем складам
- В базе данных сохраняются `store_id` и `warehouse_id` для каждой продажи
- **Розничные покупатели**: Если `customer_id` не указан:
  - При `payment_status: "PAID"` - создается обычная розничная продажа (customer_id = NULL)
  - При `payment_status: "DEBT"` - автоматически создается запись в `retail_debtors` с обязательными полями `customer_name` и опциональным `phone`
- **Постоянные клиенты**: Если `customer_id` указан - используется стандартная логика работы с таблицей `customers`

### GET /api/sales
**Назначение:** Получение списка всех **розничных** продаж и **оплат по долгам**  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры запроса (опционально):**
- `store_id` - ID магазина для фильтрации
**Примеры использования:**
- `/api/sales` - все **розничные** продажи и оплаты по долгам
- `/api/sales?store_id=1` - операции для магазина с ID 1
**Ответ:**
```json
[
  {
    "type": "SALE",           // SALE или PAYMENT
    "transaction_id": 1,      // ID продажи или операции
    "retail_debtor_id": null, // ID должника (только для PAYMENT)
    "amount": 1000.00,
    "payment_status": "DEBT", // DEBT, PAID или PAID (для оплат)
    "created_at": "2023-01-01T00:00:00.000Z",
    "created_by": 1,
    "created_by_name": "admin",
    "store_id": 1,
    "store_name": "Название магазина",
    "warehouse_id": 1,
    "warehouse_name": "Название склада",
    "customer_name": null,   // Имя клиента (только для PAYMENT)
    "phone": null            // Телефон (только для PAYMENT)
  }
]
```

### GET /api/sales/:id
**Назначение:** Получение информации о конкретной продаже  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID продажи
**Ответ:**
```json
{
  "id": 1,
  "customer_id": 1,
  "customer_name": "Ф.И.О. клиента",
  "total_amount": 1000.00,
  "payment_status": "DEBT",
  "created_by": 1,
  "created_by_name": "admin",
  "created_at": "2023-01-01T00:00:00.000Z",
  "store_id": 1,
  "warehouse_id": 1,
  "store_name": "Название магазина",
  "warehouse_name": "Название склада",
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Название товара",
      "manufacturer": "Производитель",
      "image": "Ссылка на изображение товара",
      "quantity": 2,
      "unit_price": 500.00,
      "total_price": 1000.00
    }
  ]
}
```

## 11. Поставщики

### POST /api/suppliers
**Назначение:** Создание нового поставщика  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "name": "Название поставщика",
  "phone": "+79991234567" (необязательно),
  "balance": 1000.50 (необязательно, по умолчанию 0),
  "status": 1 (необязательно, по умолчанию 1 - активен, 0 - неактивен),
  "warehouse_id": 1 (обязательно)
}
```
**Ответ:**
```json
{
  "id": 1,
  "name": "Название поставщика",
  "phone": "+79991234567",
  "balance": 1000.50,
  "status": 1,
  "warehouse_id": 1,
  "message": "Supplier created successfully"
}
```

**Ошибки:**
- `400 Bad Request`: Если не указано поле `name` или `warehouse_id`, или если склад с указанным ID не найден

### GET /api/suppliers
**Назначение:** Получение списка всех поставщиков  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Название поставщика",
    "phone": "+79991234567",
    "balance": 1000.50,
    "status": 1,
    "warehouse_id": 1,
    "created_at": "2023-01-01T00:00:00.000Z",
    "updated_at": "2023-01-01T00:00:00.000Z"
  }
]
```

### GET /api/suppliers/:id
**Назначение:** Получение информации о конкретном поставщике  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID поставщика
**Ответ:**
```json
{
  "id": 1,
  "name": "Название поставщика",
  "phone": "+79991234567",
  "balance": 1000.50,
  "status": 1,
  "warehouse_id": 1,
  "created_at": "2023-01-01T00:00:00.000Z",
  "updated_at": "2023-01-01T00:00:00.000Z"
}
```

### PUT /api/suppliers/:id
**Назначение:** Обновление информации о поставщике  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID поставщика
**Тело запроса:**
```json
{
  "name": "Новое название поставщика",
  "phone": "+79997654321" (необязательно),
  "balance": 2000.75 (необязательно),
  "status": 0 (необязательно, 1 - активен, 0 - неактивен),
  "warehouse_id": 1 (обязательно)
}
```
**Ответ:**
```json
{
  "id": 1,
  "name": "Новое название поставщика",
  "phone": "+79997654321",
  "balance": 2000.75,
  "status": 0,
  "warehouse_id": 1,
  "created_at": "2023-01-01T00:00:00.000Z",
  "updated_at": "2023-01-02T00:00:00.000Z",
  "message": "Supplier updated successfully"
}
```

**Ошибки:**
- `400 Bad Request`: Если не указано поле `name` или `warehouse_id`, или если склад с указанным ID не найден

### POST /api/suppliers/:id/payment
**Назначение:** Запись оплаты поставщику  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID поставщика
**Тело запроса:**
```json
{
  "amount": 1000.50,
  "warehouse_id": 1 (опционально),
  "note": "Примечание к платежу (опционально)"
}
```
**Ответ:**
```json
{
  "operation_id": 1,
  "supplier_id": 1,
  "amount": 1000.50,
  "new_balance": -500.25,
  "message": "Payment recorded successfully"
}
```

### GET /api/suppliers/:supplierId/operations
**Назначение:** Получение списка операций поставщика (приходы товаров, оплаты и т.д.)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `supplierId` - ID поставщика
- `warehouseId` (query параметр, опционально) - ID склада для фильтрации
- `type` (query параметр, опционально) - Тип операции ('RECEIPT' или 'PAYMENT')
- `limit` (query параметр, опционально) - Ограничение количества результатов

**Примеры использования:**
- `/api/suppliers/1/operations` - все операции поставщика ID 1
- `/api/suppliers/1/operations?warehouseId=2` - операции поставщика ID 1 только по складу ID 2
- `/api/suppliers/1/operations?type=RECEIPT` - только операции типа 'RECEIPT' для поставщика ID 1
- `/api/suppliers/1/operations?type=PAYMENT&warehouseId=1` - операции типа 'PAYMENT' для поставщика ID 1 по складу ID 1

**Ответ:**
```json
{
  "supplier": {
    "id": 1,
    "name": "Supplier Name",
    "phone": "+79991234567",
    "balance": 1000.50
  },
  "operations": [
    {
      "id": 1,
      "supplier_id": 1,
      "supplier_name": "Supplier Name",
      "warehouse_id": 1,
      "warehouse_name": "Main Warehouse",
      "receipt_id": 5,
      "sum": 5000.00,
      "type": "RECEIPT",
      "date": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

### DELETE /api/suppliers/:id
**Назначение:** Удаление поставщика (мягкое удаление)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID поставщика
**Ответ (успешный):**
```json
{
  "message": "Supplier deleted successfully"
}
```
**Ответ (поставщик не найден):**
```json
{
  "error": "Supplier not found"
}
```

### GET /api/warehouses/:warehouseId/suppliers
**Назначение:** Получение списка поставщиков, которые напрямую привязаны к указанному складу (имеют warehouse_id = warehouseId)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `warehouseId` - ID склада
**Ответ:**
```json
{
  "warehouse": {
    "id": 1,
    "name": "Название склада"
  },
  "suppliers": [
    {
      "id": 1,
      "name": "Название поставщика",
      "phone": "+79991234567",
      "balance": 1000.50,
      "status": 1,
      "warehouse_id": 1,
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

## 12. Управление розничными должниками

### GET /api/retail-debtors
**Назначение:** Получение списка всех розничных должников с непогашенными долгами  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "customer_name": "Иван Петров",
    "phone": "+79991234567",
    "created_at": "2023-01-01T00:00:00.000Z",
    "total_debt": 5000.00,
    "total_paid": 2000.00,
    "remaining_balance": 3000.00
  }
]
```

### POST /api/retail-debtors
**Назначение:** Создание нового розничного должника и фиксация долга  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "customer_name": "Иван Петров",
  "phone": "+79991234567",
  "sale_id": 123,
  "amount": 5000.00
}
```
**Ответ:**
```json
{
  "id": 1,
  "customer_name": "Иван Петров",
  "phone": "+79991234567",
  "message": "Retail debtor created successfully"
}
```

### GET /api/retail-debtors/:id
**Назначение:** Получение информации о конкретном розничном должнике с историей операций  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID розничного должника
**Ответ:**
```json
{
  "id": 1,
  "customer_name": "Иван Петров",
  "phone": "+79991234567",
  "created_at": "2023-01-01T00:00:00.000Z",
  "total_debt": 5000.00,
  "total_paid": 2000.00,
  "remaining_balance": 3000.00,
  "operations": [
    {
      "id": 1,
      "type": "DEBT",
      "amount": 5000.00,
      "description": null,
      "created_at": "2023-01-01T00:00:00.000Z",
      "sale_id": 123,
      "sale_amount": 5000.00
    },
    {
      "id": 2,
      "type": "PAYMENT",
      "amount": 2000.00,
      "description": "Первая оплата",
      "created_at": "2023-01-02T00:00:00.000Z",
      "sale_id": null,
      "sale_amount": null
    }
  ]
}
```

### POST /api/retail-debtors/:id/payments
**Назначение:** Запись оплаты по долгам розничного должника  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID розничного должника
**Тело запроса:**
```json
{
  "amount": 1000.00,
  "description": "Оплата части долга"
}
```
**Ответ:**
```json
{
  "id": 3,
  "retail_debtor_id": 1,
  "amount": 1000.00,
  "type": "PAYMENT",
  "description": "Оплата части долга",
  "message": "Payment recorded successfully"
}
```

### GET /api/retail-debtors/:id/operations
**Назначение:** Получение истории всех операций по розничному должнику  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID розничного должника
**Ответ:**
```json
[
  {
    "id": 1,
    "type": "DEBT",
    "amount": 5000.00,
    "description": null,
    "created_at": "2023-01-01T00:00:00.000Z",
    "sale_id": 123,
    "sale_amount": 5000.00
  },
  {
    "id": 2,
    "type": "PAYMENT",
    "amount": 2000.00,
    "description": "Первая оплата",
    "created_at": "2023-01-02T00:00:00.000Z",
    "sale_id": null,
    "sale_amount": null
  }
]
```

## 13. Возвраты

### POST /api/returns/client
**Назначение:** Возврат товара для зарегистрированных клиентов  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "customer_id": 1 (обязательно),
  "store_id": 1 (обязательно),
  "items": [
    {
      "product_id": 1,
      "quantity": 1,
      "unit_price": 500.00
    }
  ]
}
```
**Ответ:**
```json
{
  "id": 1,
  "message": "Client return created successfully"
}
```

### POST /api/returns/retail-cash
**Назначение:** Возврат товара для розничных клиентов (наличные)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "store_id": 1 (обязательно),
  "items": [
    {
      "product_id": 1,
      "quantity": 1,
      "unit_price": 500.00
    }
  ]
}
```
**Ответ:**
```json
{
  "id": 1,
  "message": "Retail cash return created successfully"
}
```

### POST /api/returns/retail-debt
**Назначение:** Возврат товара для розничных клиентов (в долг)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "retail_debtor_id": 1 (обязательно),
  "store_id": 1 (обязательно),
  "items": [
    {
      "product_id": 1,
      "quantity": 1,
      "unit_price": 500.00
    }
  ]
}
```
**Ответ:**
```json
{
  "id": 1,
  "retail_debtor_id": 1,
  "message": "Retail debt return created successfully"
}
```

**Важные особенности:**
- **Для зарегистрированных клиентов:** Требуется `customer_id` и `store_id`, возврат уменьшает баланс клиента, товар возвращается на склад магазина
- **Для розничных наличных:** Не требуется `customer_id`, товар возвращается на склад магазина
- **Для розничных в долг:** Требуется `retail_debtor_id` и `store_id`, автоматически создается операция `PAYMENT` для уменьшения долга
 - **Для розничных в долг:** Требуется `retail_debtor_id` и `store_id`. При создании такого возврата в `retail_operations` создаётся операция типа `RETURN`, которая уменьшает долг должника (логика уменьшения долга сохраняется).
 - В таблицу `returns` теперь также записывается `retail_debtor_id` для привязки возврата к розничному должнику.
- Все возвраты строго привязаны к конкретному складу через `store_id`
- В таблицу `returns` записываются `warehouse_id` и `store_id` для точного отслеживания

### GET /api/returns
**Назначение:** Получение списка всех возвратов  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
      "id": 1,
    "customer_id": 1,
    "customer_name": "Ф.И.О. клиента",
    "retail_debtor_id": null,
    "retail_debtor_name": null,
    "total_amount": 500.00,
    "created_by": 1,
    "created_by_name": "admin",
    "created_at": "2023-01-01T00:00:00.000Z",
    "sale_id": 1,
    "warehouse_id": 1,
    "store_id": 1
  }
]
```

### GET /api/returns/:id
**Назначение:** Получение информации о конкретном возврате  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID возврата
**Ответ:**
```json
{
  "id": 1,
  "customer_id": 1,
  "customer_name": "Ф.И.О. клиента",
  "retail_debtor_id": null,
  "retail_debtor_name": null,
  "total_amount": 500.00,
  "created_by": 1,
  "created_by_name": "admin",
  "created_at": "2023-01-01T00:00:00.000Z",
  "sale_id": 1,
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Название товара",
      "manufacturer": "Производитель",
      "image": "Ссылка на изображение товара",
      "quantity": 1,
      "unit_price": 500.00,
      "total_price": 500.00
    }
  ]
}
```

## 13. Расходы

### POST /api/expenses
**Назначение:** Создание нового расхода  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "amount": 1500.50,
  "store_id": 1, (обязательно)
  "comment": "Покупка канцелярии", (необязательно)
  "expense_date": "2023-01-15" (необязательно, по умолчанию сегодняшняя дата)
}
```
**Ответ:**
```json
{
  "id": 1,
  "amount": 1500.50,
  "store_id": 1,
  "comment": "Покупка канцелярии",
  "expense_date": "2023-01-15",
  "message": "Expense added successfully"
}
```

### GET /api/expenses
**Назначение:** Получение списка всех расходов  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры запроса (опционально):**
- `month` - Номер месяца (например, 1 для января, 12 для декабря)
- `year` - Год (например, 2023)
- `store_id` - ID магазина для фильтрации
**Примеры использования:**
- `/api/expenses` - все расходы
- `/api/expenses?year=2023` - расходы за 2023 год
- `/api/expenses?month=12&year=2023` - расходы за декабрь 2023 года
- `/api/expenses?store_id=1` - расходы для магазина с ID 1
- `/api/expenses?month=12&year=2023&store_id=1` - расходы за декабрь 2023 года для магазина с ID 1
**Ответ:**
```json
[
  {
    "id": 1,
    "amount": 1500.50,
    "comment": "Покупка канцелярии",
    "expense_date": "2023-01-15",
    "store_id": 1,
    "store_name": "Main Store",
    "created_at": "2023-01-15T10:00:00.000Z",
    "updated_at": "2023-01-15T10:00:00.000Z"
  }
]
```

### GET /api/expenses/:id
**Назначение:** Получение информации о конкретном расходе  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID расхода
**Ответ:**
```json
{
  "id": 1,
  "amount": 1500.50,
  "comment": "Покупка канцелярии",
  "expense_date": "2023-01-15",
  "store_id": 1,
  "store_name": "Main Store",
  "created_at": "2023-01-15T10:00:00.000Z",
  "updated_at": "2023-01-15T10:00:00.000Z"
}
```

### PUT /api/expenses/:id
**Назначение:** Обновление информации о расходе  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID расхода
**Тело запроса:**
```json
{
  "amount": 2000.00, (необязательно)
  "store_id": 2, (необязательно)
  "comment": "Обновленный комментарий", (необязательно)
  "expense_date": "2023-01-16" (необязательно)
}
```
**Ответ:**
```json
{
  "id": 1,
  "amount": 2000.00,
  "store_id": 2,
  "store_name": "Second Store",
  "comment": "Обновленный комментарий",
  "expense_date": "2023-01-16",
  "created_at": "2023-01-15T10:00:00.000Z",
  "updated_at": "2023-01-16T12:00:00.000Z",
  "message": "Expense updated successfully"
}
```

### DELETE /api/expenses/:id
**Назначение:** Удаление расхода  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID расхода
**Ответ (успешный):**
```json
{
  "message": "Expense deleted successfully"
}
```
**Ответ (расход не найден):**
```json
{
  "error": "Expense not found"
}
```

### GET /api/stores/financial-summary
**Назначение:** Получение финансовой сводки по ВСЕМ магазинам  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры запроса (необязательные):**
- `month` - Номер месяца (1-12)
- `year` - Год (YYYY)

**Приоритет фильтров:**
1. `month` и `year` (конкретный месяц и год)
2. `month` (месяц текущего года)
3. `year` (весь год)
4. Без фильтров (все данные)

**Примеры запросов:**
- `GET /api/stores/financial-summary` - Финансовая сводка по всем магазинам за все время
- `GET /api/stores/financial-summary?month=1&year=2026` - Сводка за январь 2026 года
- `GET /api/stores/financial-summary?month=1` - Сводка за январь текущего года
- `GET /api/stores/financial-summary?year=2026` - Сводка за весь 2026 год

**Ответ:**
```json
{
  "stores": [
    {
      "store_id": 1,
      "store_name": "Магазин1",
      "total_sales": 145.00,
      "total_debts": 640.00,
      "total_expenses": 500.00
    },
    {
      "store_id": 2,
      "store_name": "Магазин2",
      "total_sales": 0.00,
      "total_debts": 0.00,
      "total_expenses": 0.00
    }
  ],
  "total_stores": 2
}
```
**Поля ответа:**
- `stores` - Массив с данными по каждому магазину
  - `store_id` - ID магазина
  - `store_name` - Название магазина
  - `total_sales` - Общая сумма продаж из customer_operations
  - `total_debts` - Общая сумма долгов = долги - оплаты
  - `total_expenses` - Общая сумма расходов
- `total_stores` - Общее количество магазинов в системе

### GET /api/stores/:id/financial-summary
**Назначение:** Получение финансовой сводки по магазину (общая сумма продаж, долги клиентов, расходы)  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры пути:**
- `id` - ID магазина
**Параметры запроса (необязательные):**
- `month` - Номер месяца (1-12)
- `year` - Год (YYYY)

**Приоритет фильтров:**
1. `month` и `year` (конкретный месяц и год)
2. `month` (месяц текущего года)
3. `year` (весь год)
4. Без фильтров (все данные)

**Примеры запросов:**
- `GET /api/stores/1/financial-summary` - За все время
- `GET /api/stores/1/financial-summary?month=1&year=2026` - Январь 2026 года
- `GET /api/stores/1/financial-summary?month=1` - Январь текущего года
- `GET /api/stores/1/financial-summary?year=2026` - Весь 2026 год

**Ответ:**
```json
{
  "store_id": 1,
  "store_name": "Магазин1",
  "total_sales": 145.00,
  "total_debts": 640.00,
  "total_expenses": 500.00
}
```
**Поля ответа:**
- `store_id` - ID магазина
- `store_name` - Название магазина
- `total_sales` - Общая сумма продаж = (оплаты+продажи) - долги (из customer_operations)
- `total_debts` - Общая сумма долгов (из customer_operations)
- `total_expenses` - Общая сумма расходов
**Ответ (магазин не найден):**
```json
{
  "error": "Store not found"
}