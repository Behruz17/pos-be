# Документация по API для POS системы

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
  "role": "ADMIN"
}
```

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
  "role": "USER" (по умолчанию) или "ADMIN"
}
```
**Ответ:**
```json
{
  "id": 2,
  "login": "user",
  "name": "Имя пользователя",
  "role": "USER",
  "created_at": "2023-01-01T00:00:00.000Z",
  "message": "User created successfully"
}
```

## 2. Управление пользователями (только для администраторов)

### GET /api/users
**Назначение:** Получение списка всех пользователей  
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
    "created_at": "2023-01-01T00:00:00.000Z"
  }
]
```

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
  "image": "Ссылка на изображение товара (необязательно)"
}
```

**Вариант 2: Создание с загрузкой файла**
**Тип контента:** `multipart/form-data`
- `name` (string) - Название товара
- `manufacturer` (string, опционально) - Производитель
- `image` (file) - Изображение товара

**Ответ:**
```json
{
  "id": 1,
  "name": "Название товара",
  "manufacturer": "Производитель",
  "image": "/uploads/filename.jpg",
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
  "image": "Ссылка на изображение товара (необязательно)"
}
```

**Вариант 2: Обновление с загрузкой файла**
**Тип контента:** `multipart/form-data`
- `name` (string) - Новое название товара
- `manufacturer` (string, опционально) - Новый производитель
- `image` (file) - Новое изображение товара

**Ответ:**
```json
{
  "id": 1,
  "name": "Новое название товара",
  "manufacturer": "Новый производитель",
  "image": "/uploads/filename.jpg",
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
    "image": "Ссылка на изображение товара",
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

## 6. Приход товаров на склад

### POST /api/inventory/receipt
**Назначение:** Создание документа прихода товаров на склад  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "warehouse_id": 1,
  "items": [
    {
      "product_id": 1,
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
  "city": "Город" (необязательно)
}
```
**Ответ:**
```json
{
  "id": 1,
  "full_name": "Ф.И.О. клиента",
  "phone": "+79991234567",
  "city": "Город",
  "balance": 0.00,
  "created_at": "2023-01-01T00:00:00.000Z",
  "updated_at": "2023-01-01T00:00:00.000Z",
  "message": "Customer created successfully"
}
```

### GET /api/customers
**Назначение:** Получение списка всех клиентов  
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
    "balance": -123320.00,
    "created_at": "2023-01-01T00:00:00.000Z",
    "updated_at": "2023-01-01T00:00:00.000Z"
  }
]
```

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
  "city": "Город" (необязательно)
}
```
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

### GET /api/customers/:id/details
**Назначение:** Получение подробной информации о клиенте, включая историю транзакций  
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
  "customer_id": 1 (необязательно, если не указан - используется демо-клиент),
  "store_id": 1 (обязательно),
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

**Важные изменения:**
- Теперь обязательно указывать `store_id` - система определяет склад списания через магазин
- Списание происходит только с одного склада (склада магазина), а не "размазывается" по всем складам
- В базе данных сохраняются `store_id` и `warehouse_id` для каждой продажи

### GET /api/sales
**Назначение:** Получение списка всех продаж  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Ответ:**
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "customer_name": "Ф.И.О. клиента",
    "total_amount": 1000.00,
    "created_by": 1,
    "created_by_name": "admin",
    "created_at": "2023-01-01T00:00:00.000Z",
    "store_id": 1,
    "warehouse_id": 1,
    "store_name": "Название магазина",
    "warehouse_name": "Название склада"
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

## 11. Возвраты

### POST /api/returns
**Назначение:** Создание нового возврата  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса (вариант A - с привязкой к продаже):**
```json
{
  "customer_id": 1 (необязательно, если не указан - используется демо-клиент),
  "sale_id": 1 (обязательно для варианта A),
  "items": [
    {
      "product_id": 1,
      "quantity": 1,
      "unit_price": 500.00
    }
  ]
}
```
**Тело запроса (вариант B - с привязкой к магазину):**
```json
{
  "customer_id": 1 (необязательно, если не указан - используется демо-клиент),
  "store_id": 1 (обязательно для варианта B),
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
  "message": "Return created successfully"
}
```

**Важные изменения:**
- **Вариант A:** Если указан `sale_id`, товар возвращается на склад, с которого была совершена продажа
- **Вариант B:** Если указан `store_id` (и НЕ указан `sale_id`), товар возвращается на склад магазина
- Убрана логика универсального возврата в "дефолтный склад"
- Все возвраты строго привязаны к конкретному складу
- В таблицу `returns` теперь записываются `warehouse_id` и `store_id` для точного отслеживания мест возврата
- Добавлены поля `warehouse_id` и `store_id` в ответы API для отчетности по возвратам

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