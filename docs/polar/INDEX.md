# Polar Documentation Index

> Polar — платформа для монетизации цифровых продуктов: подписки, разовые покупки, лицензии, checkout, webhooks.
> Полная документация Polar: https://polar.sh/docs/llms.txt

Все файлы документации находятся в папке `resources/`.

---

## Интеграция и SDK

### [TypeScript SDK](./resources/typescript-sdk.md)
Установка и быстрый старт с `@polar-sh/sdk`. Содержит quickstart-код, список всех поддерживаемых фреймворк-адаптеров (Next.js, Express, Hono, Astro, Remix, Sveltekit и др.). **Иди сюда, если:** нужно понять, как подключить Polar SDK в JS/TS проекте, или узнать, какие фреймворки поддерживаются из коробки.

### [Python SDK](./resources/python-sdk.md)
Установка и quickstart с `polar-sdk` для Python. Синхронный и асинхронный режим через HTTPX, валидация через Pydantic, настройка sandbox. **Иди сюда, если:** интегрируешь Polar в Python-проект (Flask, Django, FastAPI и др.).

### [Next.js Integration](./resources/nextjs.md)
Полная интеграция Polar с Next.js: создание checkout-роутов, customer portal, обработка webhooks через `@polar-sh/nextjs`. Содержит готовые примеры route handlers и полный список webhook-хэндлеров (onOrderCreated, onSubscriptionCanceled и т.д.). **Иди сюда, если:** строишь приложение на Next.js и нужны готовые примеры серверных роутов для оплаты.

### [SvelteKit Integration](./resources/sveltekit.md)
Интеграция Polar с SvelteKit: checkout, customer portal, webhooks через `@polar-sh/sveltekit`. Пути файлов в формате SvelteKit (`src/routes/`). **Иди сюда, если:** строишь приложение на SvelteKit.

### [Supabase Integration](./resources/supabase.md)
Интеграция Polar с Supabase Edge Functions: checkout, customer portal, webhooks через `@polar-sh/supabase`. **Иди сюда, если:** используешь Supabase как бэкенд и хочешь подключить оплату.

### [MCP Server](./resources/mcp.md)
Подключение Polar как MCP-сервера к AI-агентам: Cursor, Claude Desktop, Claude Code, ChatGPT, Windsurf, Codex. Содержит JSON-конфиги для каждого клиента, production и sandbox URL. **Иди сюда, если:** нужно подключить Polar к AI-инструменту через Model Context Protocol.

---

## Аутентификация и безопасность

### [Authentication](./resources/authentication.md)
Два механизма аутентификации API: Organization Access Tokens (OAT) и OAuth 2.0. Описание программы GitHub Secret Scanning и автоматического отзыва утёкших токенов. **Иди сюда, если:** нужно понять, как авторизовать запросы к Polar API, или разобраться с безопасностью токенов.

### [OAuth 2.0 Connect](./resources/oauth2.md)
Полный OAuth 2.0 Authorization Code Flow: URL авторизации, обмен кода на токен, refresh-токены, разница между organization-level и user-level токенами, поддержка PKCE для публичных клиентов. **Иди сюда, если:** реализуешь OAuth-интеграцию с Polar для стороннего приложения.

---

## Продукты и ценообразование

### [Products](./resources/products.md)
Создание цифровых продуктов: название, описание, модели ценообразования (fixed, pay-what-you-want, free), биллинг-циклы (one-time, monthly, yearly), медиа, checkout fields, автоматические entitlements (license keys, Discord, GitHub, file downloads). Варианты (variants) через несколько продуктов. Архивация. **Иди сюда, если:** нужно понять структуру продуктов Polar или создать новый продукт.

### [Trials](./resources/trials.md)
Настройка бесплатных пробных периодов для подписок: параметры (unit + duration), переопределение trial через checkout link/API, управление trial для существующих подписок, защита от злоупотреблений (нормализация email, fingerprint карт). **Иди сюда, если:** нужно добавить trial к подписке или защититься от повторных пробных периодов.

### [Seat-Based Pricing](./resources/seat-based-pricing.md)
Продажа командных продуктов с назначаемыми местами и тиражным ценообразованием. Подписки vs разовые покупки, управление местами (assign/revoke/claim), масштабирование, API-примеры, webhooks. Лимиты: 1000 мест, 24ч claim links. **Иди сюда, если:** строишь B2B-продукт с командными лицензиями или per-seat ценообразованием.

### [Discounts](./resources/discounts.md)
Создание скидок: процентные и фиксированные, разовые / на N месяцев / навсегда, коды, ограничения по продуктам, датам и количеству использований. **Иди сюда, если:** нужно настроить промо-коды или скидочные кампании.

### [Custom Fields](./resources/custom-fields.md)
Добавление пользовательских полей на checkout: text, number, date, checkbox, select. Slug/name система, настройка label/help/placeholder с Markdown, привязка к продуктам, чтение данных через API. **Иди сюда, если:** нужно собирать дополнительные данные от покупателей при оформлении заказа.

---

## Benefits и лицензирование

### [Benefits](./resources/benefits.md)
Система автоматических entitlements: типы (Credits, License Keys, File Downloads, GitHub Repository Access, Discord Invites, Custom), жизненный цикл (grant → cycle → revoke), grace period при неудавшихся платежах, привязка к продуктам. **Иди сюда, если:** нужно понять, какие типы benefits бывают, как они выдаются и отзываются.

### [License Keys](./resources/license-keys.md)
Лицензионные ключи: брендированные префиксы, лимиты активаций по устройствам, срок действия, квоты использования, валидация и активация/деактивация через API. Rate limit: 3 req/sec для публичных endpoint'ов. **Иди сюда, если:** продаёшь софт и нужна система лицензирования с активацией по устройствам.

---

## Checkout и оплата

### [Checkout Links](./resources/checkout-links.md)
Создание и шаринг checkout-ссылок: label, несколько продуктов в одной ссылке, скидки, метаданные. Query-параметры для предзаполнения полей (email, name, discount_code) и UTM-трекинга. **Иди сюда, если:** нужно быстро создать ссылку для оплаты без кода.

### [Checkout API](./resources/checkout-api.md)
Программное создание checkout-сессий: несколько продуктов, ad-hoc цены (динамическое ценообразование), external_customer_id для связки с внутренней системой. Примеры на TypeScript и Python. **Иди сюда, если:** нужна полная программная интеграция checkout.

### [Embedded Checkout](./resources/checkout-embedded.md)
Встраивание checkout прямо на сайт: HTML-сниппет, JS-библиотека `@polar-sh/checkout`, React-интеграция, события (loaded, close, confirmed, success), программное открытие/закрытие, Apple Pay / Google Pay в embedded-режиме. **Иди сюда, если:** хочешь встроить форму оплаты на свой сайт без редиректа.

---

## Webhooks

### [Setup Webhooks](./resources/webhooks-setup.md)
Первоначальная настройка: создание endpoint в дашборде Polar, выбор URL, формат доставки (Raw / Slack / Discord), установка секрета, подписка на события. **Иди сюда, если:** настраиваешь webhooks в Polar с нуля.

### [Webhooks Local Development](./resources/webhooks-local.md)
Получение webhooks на локальной машине через Polar CLI (`polar listen`). Установка CLI, аутентификация, настройка secret в .env. **Иди сюда, если:** разрабатываешь обработчик webhooks локально и нужен туннель.

### [Webhook Delivery & Handling](./resources/webhooks-delivery.md)
Валидация, парсинг, обработка webhook-запросов: SDK-примеры (Express, Flask), Standard Webhooks спецификация, base64-кодирование секрета, IP allowlist, retry-логика (10 попыток, exponential backoff), таймауты (10 сек), автоматическое отключение после 10 неудач. Troubleshooting HTTP 404/403/3xx. **Иди сюда, если:** нужно написать серверный обработчик webhooks или отладить проблемы с доставкой.

### [Webhook Events Reference](./resources/webhook-events.md)
Полный список всех webhook-событий Polar: benefit, checkout, customer, customer_seat, order, product, refund, subscription. Таблица с описанием каждого события. Список всех camelCase handler names для фреймворк-адаптеров. **Иди сюда, если:** нужно узнать, какие события существуют и как называются хэндлеры.

---

## Управление заказами и клиентами

### [Orders & Subscriptions](./resources/orders-subscriptions.md)
Обзор продаж в дашборде: список заказов, детали (сумма, налоги, инвойсы, клиент), состояния checkout-сессий (Open, Confirmed, Succeeded, Expired), просмотр payment attempts. **Иди сюда, если:** нужно понять, как устроен обзор продаж и какие статусы бывают у checkout.

### [Customer Portal](./resources/customer-portal.md)
Портал для клиентов: просмотр заказов, подписок, получение чеков и benefits. URL-доступ через `polar.sh/your-org-slug/portal`, создание pre-authenticated ссылок через API (`customerSessions.create`), Next.js-утилита `CustomerPortal`. **Иди сюда, если:** нужно дать клиентам доступ к личному кабинету.

### [Customer State](./resources/customer-state.md)
Единый объект состояния клиента: активные подписки, выданные benefits, балансы meters — одним API-вызовом или через webhook `customer.state_changed`. Работает с External ID. **Иди сюда, если:** нужно быстро проверить, имеет ли пользователь доступ к сервису.

### [Refunds](./resources/refunds.md)
Обработка возвратов: создание через API, типы (полный возврат, на баланс клиента), webhook-события (`refund.created`, `refund.updated`, `order.refunded`), автоматический отзыв benefits. **Иди сюда, если:** нужно реализовать логику возврата средств.

---

## Events, метрики и аналитика

### [Events & Metering](./resources/events-metering.md)
Usage-based биллинг: отслеживание событий, batch ingestion, иерархические события (parent-child), meters для агрегации, cost tracking с точностью до долей цента, Credits как benefit-тип. **Иди сюда, если:** строишь продукт с тарификацией по использованию (API calls, compute, tokens и т.д.).

### [Metrics & Analytics](./resources/metrics.md)
Метрики и аналитика: revenue, MRR, churn rate, AOV, checkout conversion, cost insights. Фильтрация по продуктам, группировка по периодам. **Иди сюда, если:** нужно получить бизнес-метрики через API.

---

## API Reference

### [API Reference](./resources/api-reference.md)
Полный список всех API-эндпоинтов Polar (100+ endpoints): Benefits, Checkouts, Customers, Events, License Keys, Meters, Orders, Products, Refunds, Subscriptions, Webhooks, OAuth2, Customer Portal API. Rate limits (300 req/min), пагинация, OAuth scopes. **Иди сюда, если:** нужен справочник по конкретному API-эндпоинту или хочешь узнать, какие операции доступны.

---

## Среда разработки

### [Sandbox Environment](./resources/sandbox.md)
Изолированная тестовая среда на `sandbox.polar.sh`: тестовые платежи через Stripe test cards (4242...), отдельные токены, API на `sandbox-api.polar.sh`, конфигурация SDK для sandbox. Подписки автоматически отменяются через 90 дней. **Иди сюда, если:** настраиваешь dev-окружение или тестируешь оплату без реальных денег.
