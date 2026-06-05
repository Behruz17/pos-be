# Черновики продаж

## Описание
Простая система для сохранения черновиков продаж. Пользователь может сохранить заполненную форму продажи и вернуться к ней позже.

## Эндпоинты

### POST /api/sales/drafts - Сохранить черновик
**Назначение:** Сохранение продажи как черновик  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Тело запроса:**
```json
{
  "store_id": 1,
  "warehouse_id": 1,
  "customer_id": 123,
  "customer_name": "Иван Петров",
  "phone": "+9921234567",
  "items": [
    {
      "product_id": 1,
      "quantity": 5,
      "unit_price": 100.50
    }
  ],
  "payment_status": "UNPAID",
  "notes": "Черновик для клиента"
}
```
**Ответ:**
```json
{
  "id": 1,
  "message": "Sale draft saved successfully",
  "draft": {
    "id": 1,
    "store_id": 1,
    "warehouse_id": 1,
    "customer_id": 123,
    "customer_name": "Иван Петров",
    "phone": "+9921234567",
    "items": [
      {
        "product_id": 1,
        "quantity": 5,
        "unit_price": 100.50
      }
    ],
    "total_amount": 502.50,
    "payment_status": "UNPAID",
    "notes": "Черновик для клиента"
  }
}
```

### GET /api/sales/drafts - Получить последний черновик или черновики клиента
**Назначение:** Получение последнего черновика пользователя или всех черновиков конкретного клиента  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры запроса (опционально):**
- `store_id` - ID магазина для фильтрации (админы могут указать любой магазин)
- `customer_id` - ID клиента для получения всех его черновиков

**Ответ без `customer_id` (если черновик найден):**
```json
{
  "id": 1,
  "store_id": 1,
  "warehouse_id": 1,
  "customer_id": 123,
  "customer_name": "Иван Петров",
  "phone": "+9921234567",
  "items": [
    {
      "product_id": 1,
      "quantity": 5,
      "unit_price": 100.50
    }
  ],
  "total_amount": 502.50,
  "payment_status": "UNPAID",
  "notes": "Черновик для клиента",
  "created_at": "2026-03-27T18:20:00.000Z",
  "updated_at": "2026-03-27T18:20:00.000Z",
  "store_name": "Main Store",
  "warehouse_name": "Main Warehouse"
}
```

**Ответ без `customer_id` (если черновиков нет):**
```json
null
```

**Ответ с `customer_id` (может быть несколько черновиков):**
```json
[
  {
    "id": 1,
    "store_id": 1,
    "warehouse_id": 1,
    "customer_id": 123,
    "customer_name": "Иван Петров",
    "phone": "+9921234567",
    "items": [
      {
        "product_id": 1,
        "quantity": 5,
        "unit_price": 100.50
      }
    ],
    "total_amount": 502.50,
    "payment_status": "UNPAID",
    "notes": "Первый черновик для клиента",
    "created_at": "2026-03-27T18:20:00.000Z",
    "updated_at": "2026-03-27T18:20:00.000Z",
    "store_name": "Main Store",
    "warehouse_name": "Main Warehouse"
  },
  {
    "id": 2,
    "store_id": 1,
    "warehouse_id": 1,
    "customer_id": 123,
    "customer_name": "Иван Петров",
    "phone": "+9921234567",
    "items": [
      {
        "product_id": 2,
        "quantity": 1,
        "unit_price": 250.00
      }
    ],
    "total_amount": 250.00,
    "payment_status": "UNPAID",
    "notes": "Второй черновик для клиента",
    "created_at": "2026-03-28T10:00:00.000Z",
    "updated_at": "2026-03-28T10:00:00.000Z",
    "store_name": "Main Store",
    "warehouse_name": "Main Warehouse"
  }
]
```

**Ответ с `customer_id`, если у клиента нет черновиков:**
```json
[]
```

### DELETE /api/sales/drafts/:id - Удалить черновик
**Назначение:** Удаление черновика  
**Заголовки:**
- `Authorization: Bearer <токен>`
**Параметры:**
- `id` - ID черновика

**Ответ:**
```json
{
  "message": "Sale draft deleted successfully"
}
```

## Примечания

- **Безопасность:** Пользователь может видеть только свои черновики
- **Автоматический расчет:** `total_amount` рассчитывается автоматически из товаров
- **Формат данных:** Все поля опциональные кроме `store_id`, `warehouse_id` и `items`
- **Черновики клиента:** один клиент может иметь несколько черновиков; используйте `GET /api/sales/drafts?customer_id=<id>`
- **Сортировка:** Черновики сортируются по дате обновления (новые первые)

## Преимущества

✅ **Простота:** Легко сохранить и продолжить позже  
✅ **Безопасность:** Данные не теряются при ошибках  
✅ **Гибкость:** Можно редактировать перед финальной продажей  
✅ **Удобство:** Пользователь не теряет введенную информацию
