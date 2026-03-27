# Миграция базы данных для добавления полей rate и converted_sum

## Описание
Добавляет поля `rate` и `converted_sum` в таблицу `delivery_operations` для поддержки конвертации валют по курсу.

## Файлы
- `migrations/002_add_delivery_rate_fields.sql` - SQL миграция
- Обновлен `db.sql` - новая структура таблицы

## Применение миграции

### Вариант 1: Через mysql консоль
```bash
mysql -u username -p database_name < migrations/002_add_delivery_rate_fields.sql
```

### Вариант 2: Через phpMyAdmin
1. Откройте phpMyAdmin
2. Выберите базу данных
3. Перейдите на вкладку SQL
4. Скопируйте содержимое файла `migrations/002_add_delivery_rate_fields.sql`
5. Вставьте и выполните SQL

## Что добавлено

### Новые поля в таблице `delivery_operations`:
- `rate` - decimal(10,4) DEFAULT NULL - Курс валюты для конвертации
- `converted_sum` - decimal(10,2) DEFAULT NULL - Сконвертированная сумма (sum / rate)

### Обновленные эндпоинты:
1. **PUT /api/delivery-operations/receipt/:receipt_id/delivery-cost**
   - Добавлен параметр `rate` в тело запроса
   - Автоматический расчет `converted_sum` как `delivery_cost / rate`
   - Валидация: курс должен быть > 0

2. **GET /api/delivery-operations/:driver_id**
   - В ответ включены поля `rate` и `converted_sum`

3. **Создание приходов через stock receipts**
   - Добавлена поддержка новых полей при создании операций доставки

## Пример использования
```json
{
  "delivery_cost": 800,
  "currency": "yuan", 
  "rate": 10,
  "delivery_driver_id": 1
}
```
Результат:
- `sum` = 800 (оригинальная сумма в delivery_operations)
- `rate` = 10 (курс валюты)
- `converted_sum` = 80.00 (800 / 10)

## Важно
- Поля опциональные - если `rate` не указан, `converted_sum` будет NULL
- Все существующие данные останутся с NULL значениями в новых полях
- Обратная совместимость сохранена

**Важно:** В базе данных хранится оригинальная сумма прихода из `stock_receipts`, а не стоимость доставки!
