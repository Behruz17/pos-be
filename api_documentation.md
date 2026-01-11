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
  "message": "User created successfully"
}
```

## 2. Управление складами

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

## 3. Управление товарами

### POST /api/products
**Назначение:** Создание нового товара  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "name": "Название товара",
  "manufacturer": "Производитель (необязательно)"
}
```
**Ответ:**
```json
{
  "id": 1,
  "name": "Название товара",
  "manufacturer": "Производитель",
  "message": "Product added successfully"
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
    "created_at": "2023-01-01T00:00:00.000Z"
  }
]
```

## 4. Приход товаров на склад

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
      "pieces_qty": 10,
      "weight_kg": 25.5,
      "volume_cbm": 1.2,
      "amount": 500.00
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
    "total_amount": 500.00
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
  "total_amount": 500.00,
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Название товара",
      "manufacturer": "Производитель",
      "boxes_qty": 5,
      "pieces_qty": 10,
      "weight_kg": 25.5,
      "volume_cbm": 1.2,
      "amount": 500.00
    }
  ]
}
```

## 5. Управление остатками на складах

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
    "boxes_qty": 10,
    "pieces_qty": 20,
    "weight_kg": 50.5,
    "volume_cbm": 2.5,
    "updated_at": "2023-01-01T00:00:00.000Z"
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
  "boxes_qty": 15,
  "pieces_qty": 25,
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
  "boxes_qty": 5,
  "pieces_qty": 10,
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

## 6. История изменений остатков

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
    "user_id": 1,
    "user_name": "admin",
    "change_type": "ADJUSTMENT",
    "old_boxes_qty": 10,
    "new_boxes_qty": 15,
    "old_pieces_qty": 20,
    "new_pieces_qty": 25,
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
  "user_id": 1,
  "user_name": "admin",
  "change_type": "ADJUSTMENT",
  "old_boxes_qty": 10,
  "new_boxes_qty": 15,
  "old_pieces_qty": 20,
  "new_pieces_qty": 25,
  "old_weight_kg": 50.5,
  "new_weight_kg": 60.0,
  "old_volume_cbm": 2.5,
  "new_volume_cbm": 3.0,
  "reason": "Корректировка по инвентаризации",
  "created_at": "2023-01-01T00:00:00.000Z"
}
```

## 7. Управление клиентами

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
  "balance": 0,
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
    "balance": 1000.00,
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
  "balance": 1000.00,
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
  "balance": 1000.00,
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
  "new_balance": 1500.00,
  "message": "Customer balance updated successfully"
}
```

## 8. Продажи

### POST /api/sales
**Назначение:** Создание новой продажи  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "customer_id": 1 (необязательно, если не указан - используется демо-клиент),
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
    "created_at": "2023-01-01T00:00:00.000Z"
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
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Название товара",
      "manufacturer": "Производитель",
      "quantity": 2,
      "unit_price": 500.00,
      "total_price": 1000.00
    }
  ]
}
```
