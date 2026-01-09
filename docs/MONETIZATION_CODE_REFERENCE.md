# Технический справочник по монетизации

> Точные ссылки на код и структура файлов

## Структура файлов монетизации

```
src/ui/
├── services/
│   ├── LicenseService.ts      ← ГЛАВНЫЙ ФАЙЛ для интеграции
│   ├── StorageAdapter.ts      ← Абстракция хранилища
│   └── index.ts               ← Экспорт сервисов
├── managers/
│   └── ModalManager.ts        ← Обработчики кнопок paywall
├── components/
│   ├── paywall.html           ← UI модального окна апгрейда
│   ├── copycode.html          ← Copy Code для Pro
│   ├── copycode-free.html     ← Copy Code для Free (заблокированный)
│   ├── DevTools.ts            ← Dev-кнопка переключения Free/Pro
│   └── gallery/
│       └── PresetGalleryView.ts ← PRO-бейджи на пресетах
├── config/
│   └── constants.ts           ← Конфигурация DEV_MODE
└── App.ts                     ← Главный контроллер приложения
```

---

## Ключевые файлы и строки кода

### 1. LicenseService.ts — Сервис лицензирования

**Путь:** `src/ui/services/LicenseService.ts`

| Строки | Описание |
|--------|----------|
| 16-17 | Типы `LicenseState` и `LicenseChangeListener` |
| 19-31 | Конструктор — инициализация сервиса |
| 33-43 | `isPro()`, `isFree()`, `getState()` — проверка статуса |
| 45-55 | `canAccessPreset()`, `canApplyPreset()`, `canExportCode()` — проверки доступа |
| 57-69 | Dev-методы для тестирования |
| 75-78 | `onStateChange()` — подписка на изменения |
| **80-99** | **`upgradeToPro()`** — **МЕСТО ДЛЯ STRIPE ИНТЕГРАЦИИ** |
| **105-114** | **`validateLicenseWithServer()`** — **МЕСТО ДЛЯ СЕРВЕРНОЙ ВАЛИДАЦИИ** |
| 116-128 | `checkDevMode()` — проверка dev-режима |
| 131-150 | `loadSavedState()` — загрузка состояния |
| 152-168 | `saveState()` — сохранение состояния |
| 170-178 | `notifyListeners()` — уведомление подписчиков |
| 181 | Экспорт singleton `licenseService` |

### 2. ModalManager.ts — Обработка кнопок апгрейда

**Путь:** `src/ui/managers/ModalManager.ts`

| Строки | Описание |
|--------|----------|
| 11-14 | Импорты (licenseService, HTML шаблоны) |
| 33-54 | Инъекция HTML модалов в DOM |
| **57-82** | **Handler кнопки "Get Pro Access"** — **МЕСТО ДЛЯ ИНТЕГРАЦИИ** |
| 84-95 | Handler кнопки Upgrade из Copy Code Free |
| 97-115 | Copy to Clipboard handler |

### 3. PresetGalleryView.ts — PRO-бейджи

**Путь:** `src/ui/components/gallery/PresetGalleryView.ts`

| Строки | Описание |
|--------|----------|
| 5 | Импорт `licenseService` |
| 56 | Подписка на изменение лицензии для обновления бейджей |
| **299-314** | **`refreshBadges()`** — логика показа/скрытия PRO-бейджей |
| 306-312 | Условие показа: `preset.premium && !licenseService.isPro()` |

### 4. App.ts — Главный контроллер

**Путь:** `src/ui/App.ts`

| Строки | Описание |
|--------|----------|
| 15 | Импорт `licenseService` |
| 80 | Получение кнопки `#upgradeToPro` |
| **255-256** | Проверка `isPremiumPreset` и `canApplyPreset` |
| **291-293** | Блокировка Copy Code для Free |
| **308** | Блокировка Apply для PRO-пресетов на Free |
| **371-374** | Подписка на изменение лицензии |

### 5. constants.ts — Конфигурация

**Путь:** `src/ui/config/constants.ts`

| Строки | Описание |
|--------|----------|
| **155-175** | Секция `LICENSE` с настройками |
| **158** | **`DEV_MODE_ENABLED: true`** — **ИЗМЕНИТЬ НА `false` ДЛЯ ПРОДАКШЕНА** |
| 164-169 | `FREE_FEATURES` — список Free-функций |
| 170-174 | `PRO_FEATURES` — список Pro-функций |

---

## API LicenseService

### Публичные методы

```typescript
// Проверка состояния
isPro(): boolean              // true если Pro
isFree(): boolean             // true если Free
getState(): LicenseState      // 'free' | 'pro'

// Проверка доступа
canAccessPreset(preset: { premium?: boolean }): boolean
canApplyPreset(preset: { premium?: boolean }): boolean
canExportCode(): boolean      // true только для Pro

// Подписка на изменения
onStateChange(listener: (state: LicenseState) => void): () => void
// Возвращает функцию unsubscribe

// Апгрейд (ТРЕБУЕТ РЕАЛИЗАЦИИ)
upgradeToPro(): Promise<void>
validateLicenseWithServer(): Promise<boolean>

// Dev-методы (только в DEV_MODE)
devToggleLicense(): void      // Переключить Free/Pro
devSetLicense(state: LicenseState): void
isDevModeEnabled(): boolean
```

### Использование в коде

```typescript
import { licenseService } from './services';

// Проверка доступа
if (licenseService.isPro()) {
  // Pro функционал
}

// Проверка доступа к пресету
const preset = { id: 'test', premium: true };
if (!licenseService.canApplyPreset(preset)) {
  showPaywall();
}

// Подписка на изменения
const unsubscribe = licenseService.onStateChange((state) => {
  console.log('License changed:', state);
  updateUI();
});

// Отписка при необходимости
unsubscribe();
```

---

## Preset структура

### Тип Preset (`src/ui/presets/types.ts`)

```typescript
interface Preset {
  id: string;
  name: string;
  layers: PresetLayer[];
  defaultScale: number;
  textureScale?: number;
  defaultStrength: number;
  
  premium?: boolean;           // ← Флаг премиум-пресета
  categories: string[];
  order?: number;
  isCustom?: boolean;
  createdAt?: number;
  category?: string;           // Legacy
}
```

### Пример Premium-пресета (`assets/presets.json`)

```json
{
  "id": "new-preset-1",
  "name": "Vertical llllll",
  "premium": true,
  "categories": ["vertical", "popular"],
  "defaultScale": 50,
  "textureScale": 0.1,
  "defaultStrength": 150,
  "layers": [
    {
      "src": "resource://21",
      "tiling": "tiled",
      "scaleMode": "yOnly"
    }
  ]
}
```

---

## UI элементы

### HTML элементы

| ID | Файл | Описание |
|----|------|----------|
| `#upgradeToPro` | index.html:182 | Кнопка "Upgrade to Pro" |
| `#paywall-overlay` | paywall.html:2 | Модальное окно апгрейда |
| `#go-pro-button` | paywall.html:53 | Кнопка "Get Pro Access" в paywall |
| `#copycode-overlay` | copycode.html:2 | Модал Copy Code (Pro) |
| `#copycode-overlay-free` | copycode-free.html:2 | Модал Copy Code (Free) |
| `#upgrade-from-copycode` | copycode-free.html:89 | Кнопка Upgrade в Free-модале |

### CSS классы

| Класс | Файл | Описание |
|-------|------|----------|
| `.preset-pro-badge` | main.css:862-877 | PRO-бейдж на пресетах |
| `.paywall-modal` | main.css:1019+ | Стили модала апгрейда |
| `.copycode-modal` | main.css | Стили модала Copy Code |
| `.copycode-modal-free` | main.css | Стили Free-модала |

---

## Пошаговая интеграция Stripe

### Шаг 1: Создать endpoint на сервере

```javascript
// server.js (Node.js + Express)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/create-checkout', async (req, res) => {
  const { figmaUserId } = req.body;
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: 'price_XXX', // Ваш Price ID из Stripe Dashboard
      quantity: 1,
    }],
    mode: 'payment', // или 'subscription'
    success_url: 'https://your-site.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://your-site.com/cancel',
    metadata: {
      figmaUserId: figmaUserId
    }
  });
  
  res.json({ checkoutUrl: session.url });
});
```

### Шаг 2: Модифицировать LicenseService.upgradeToPro()

```typescript
// src/ui/services/LicenseService.ts

async upgradeToPro(): Promise<void> {
  try {
    // Получить Figma User ID (нужно передать из code.ts)
    const figmaUserId = await this.getFigmaUserId();
    
    const response = await fetch('https://your-server.com/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ figmaUserId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }
    
    const { checkoutUrl } = await response.json();
    
    // Открыть Stripe Checkout в новой вкладке
    window.open(checkoutUrl, '_blank');
    
    // Периодически проверять статус
    this.startLicensePolling();
    
  } catch (error) {
    console.error('Upgrade failed:', error);
    throw error;
  }
}

private async startLicensePolling(): void {
  const pollInterval = setInterval(async () => {
    const isValid = await this.validateLicenseWithServer();
    if (isValid) {
      this.currentState = 'pro';
      this.saveState();
      this.notifyListeners();
      clearInterval(pollInterval);
    }
  }, 3000); // Проверять каждые 3 секунды
  
  // Остановить через 5 минут
  setTimeout(() => clearInterval(pollInterval), 300000);
}
```

### Шаг 3: Добавить webhook handler

```javascript
// server.js
app.post('/api/webhook/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const figmaUserId = session.metadata.figmaUserId;
    
    // Сохранить лицензию в БД
    await saveLicense(figmaUserId, 'pro');
  }
  
  res.json({ received: true });
});
```

### Шаг 4: Отключить DEV_MODE

```typescript
// src/ui/config/constants.ts

LICENSE: {
  DEV_MODE_ENABLED: false,  // ← ИЗМЕНИТЬ НА false
  // ...
}
```

---

## Тестирование

### В Dev Mode (DEV_MODE_ENABLED: true)

1. Открыть плагин в Figma
2. Нажать кнопку с короной (🔶 оранжевая = Free, 🟢 зеленая = Pro)
3. Статус переключается между Free и Pro
4. Проверить:
   - PRO-бейджи появляются/исчезают
   - Кнопка Apply/Upgrade переключается
   - Copy Code работает/блокируется

### Production тестирование

1. Установить `DEV_MODE_ENABLED: false`
2. Использовать Stripe Test Mode
3. Проверить полный flow:
   - Нажать "Upgrade to Pro"
   - Оплатить тестовой картой (4242 4242 4242 4242)
   - Дождаться обновления статуса
   - Проверить доступ к Pro-функциям

---

## Полезные ссылки

- [Stripe Checkout Docs](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Figma Plugin API - currentUser](https://www.figma.com/plugin-docs/api/figma/#currentuser)

---

*Последнее обновление: Январь 2026*

