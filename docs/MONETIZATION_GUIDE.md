# Displace Plugin — Руководство по монетизации

> Документ для специалиста по интеграции платежной системы

## Оглавление

1. [Обзор текущей системы](#обзор-текущей-системы)
2. [Архитектура лицензирования](#архитектура-лицензирования)
3. [Что уже реализовано](#что-уже-реализовано)
4. [Что нужно реализовать](#что-нужно-реализовать)
5. [Точки интеграции](#точки-интеграции)
6. [Free vs Pro функционал](#free-vs-pro-функционал)
7. [Технические детали](#технические-детали)
8. [Рекомендации по интеграции](#рекомендации-по-интеграции)

---

## Обзор текущей системы

Плагин Displace — это Figma-плагин для создания displacement-эффектов на изображениях. Система монетизации уже **архитектурно подготовлена**, но требует интеграции реальной платежной системы.

### Текущий статус

| Компонент | Статус | Описание |
|-----------|--------|----------|
| Модель Free/Pro | ✅ Готова | Два состояния лицензии: `free` и `pro` |
| Premium-пресеты | ✅ Готова | Пресеты могут быть отмечены как `premium: true` |
| UI блокировки | ✅ Готов | PRO-бейджи, paywall-модал, кнопка Upgrade |
| Paywall UI | ✅ Готов | Модальное окно с информацией о Pro |
| Export Code | ✅ Готов | Заблокирован для Free-пользователей |
| Платежная система | ❌ Не реализована | Требуется интеграция Stripe/Gumroad/etc |
| Серверная валидация | ❌ Не реализована | Требуется бэкенд для проверки лицензий |

---

## Архитектура лицензирования

### Главный файл: `src/ui/services/LicenseService.ts`

```typescript
// Два состояния лицензии
type LicenseState = 'free' | 'pro';

// Основной сервис
class LicenseService {
  isPro(): boolean;           // Проверка Pro-статуса
  isFree(): boolean;          // Проверка Free-статуса
  canAccessPreset(preset): boolean;  // Может ли юзер использовать пресет
  canApplyPreset(preset): boolean;   // Может ли применить пресет
  canExportCode(): boolean;   // Может ли экспортировать код
  upgradeToPro(): Promise<void>;     // ← ЗДЕСЬ НУЖНА ИНТЕГРАЦИЯ
}
```

### Схема работы

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIGMA PLUGIN                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     LicenseService                         │  │
│  │  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │  │
│  │  │ Free State  │ ←→ │ State Manager │ ←→ │  Pro State   │  │  │
│  │  └─────────────┘    └──────────────┘    └──────────────┘  │  │
│  │         │                   │                   │          │  │
│  │         ▼                   ▼                   ▼          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              upgradeToPro() → TODO: Stripe          │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     UI COMPONENTS                          │  │
│  │   • PRO badges on presets                                  │  │
│  │   • Paywall modal                                          │  │
│  │   • Upgrade button                                         │  │
│  │   • Copy Code modal (Free/Pro variants)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (TODO)
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER                              │
│   • Stripe Checkout session                                      │
│   • License validation API                                       │
│   • Webhook handling                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Что уже реализовано

### 1. LicenseService (`src/ui/services/LicenseService.ts`)

**Полностью работающий сервис управления лицензией:**

```typescript
// Публичные методы - ВСЕ РАБОТАЮТ
isPro(): boolean              // true если пользователь Pro
isFree(): boolean             // true если пользователь Free
getState(): LicenseState      // 'free' | 'pro'
canAccessPreset(preset)       // Проверка доступа к пресету
canApplyPreset(preset)        // Проверка возможности применить пресет
canExportCode(): boolean      // true только для Pro

// Система подписки на изменения - РАБОТАЕТ
onStateChange(listener)       // Подписка на изменение статуса
```

### 2. Premium-пресеты (`assets/presets.json`)

Пресеты загружаются с CDN и могут содержать флаг `premium`:

```json
{
  "id": "new-preset-1",
  "name": "Vertical llllll",
  "premium": true,  // ← Этот флаг делает пресет Pro-only
  "categories": ["vertical", "popular"],
  "defaultScale": 50,
  "defaultStrength": 150,
  "layers": [...]
}
```

### 3. UI компоненты

#### PRO Badge на пресетах (`src/ui/components/gallery/PresetGalleryView.ts`)
```typescript
// Автоматически показывает PRO-бейдж для премиум-пресетов
const shouldShow = preset.premium && !licenseService.isPro();
if (shouldShow && !existingBadge) {
  const proBadge = createElement('div', { className: 'preset-pro-badge', textContent: 'PRO' });
  presetElement.appendChild(proBadge);
}
```

#### Paywall Modal (`src/ui/components/paywall.html`)
```html
<div id="paywall-overlay" class="hidden paywall-modal overlay-fixed">
  <!-- Левая панель - превью -->
  <!-- Правая панель - информация о Pro -->
  <button id="go-pro-button" class="btn btn-primary w-full">
    Get Pro Access  <!-- ← Эта кнопка запускает апгрейд -->
  </button>
</div>
```

#### Copy Code Modal — две версии:
- `copycode.html` — для Pro пользователей (полный код)
- `copycode-free.html` — для Free пользователей (размытый код + кнопка Upgrade)

### 4. Кнопка Upgrade в UI (`src/ui/index.html`)
```html
<button id="upgradeToPro" class="btn btn-primary" style="display: none;">
  Upgrade to Pro
</button>
```

Кнопка автоматически показывается когда:
- Выбран Premium-пресет
- Пользователь на Free-плане

### 5. Конфигурация (`src/ui/config/constants.ts`)

```typescript
LICENSE: {
  DEV_MODE_ENABLED: true,  // Включить false для продакшена!
  
  FREE_FEATURES: [
    'All effects and settings',
    'Free presets', 
    'Preview and tweak Pro presets',
    'Custom maps'
  ],
  PRO_FEATURES: [
    'Apply Pro presets to canvas',
    'Export to Code (always Pro-only)',
    'Premium preset library'
  ]
}
```

### 6. Dev Mode для тестирования

В режиме разработки (`DEV_MODE_ENABLED: true`) доступна кнопка переключения Free/Pro в левом верхнем углу плагина.

---

## Что нужно реализовать

### Основная задача: интеграция платежной системы

#### Место интеграции: `LicenseService.upgradeToPro()`

```typescript
// src/ui/services/LicenseService.ts (строки 80-99)

async upgradeToPro(): Promise<void> {
  // TODO: Integrate with Stripe Checkout
  // 1. Create Stripe checkout session with user/plugin info
  // 2. Redirect to Stripe or open popup
  // 3. Handle success webhook on server
  // 4. Update user license status on server
  // 5. Refresh local license state
  
  console.log('🚀 Upgrade to Pro flow - TODO: Implement Stripe integration');
  
  // TODO: Remove this dev simulation when Stripe is integrated
  if (this.isDevMode) {
    console.log('🧪 Dev mode: Simulating Stripe success');
    return Promise.resolve();
  }
  
  // TODO: Replace with actual Stripe integration
  throw new Error('Stripe integration not implemented yet');
}
```

#### Место интеграции: `LicenseService.validateLicenseWithServer()`

```typescript
// src/ui/services/LicenseService.ts (строки 105-114)

async validateLicenseWithServer(): Promise<boolean> {
  // TODO: Implement server-side license validation
  // 1. Get user ID or session token
  // 2. Call backend API to check subscription status
  // 3. Handle expired/cancelled subscriptions
  // 4. Update local state accordingly
  
  console.log('🔄 License validation - TODO: Implement server check');
  return this.isPro(); // Temporary fallback
}
```

#### Место интеграции: Handler кнопки Go Pro

```typescript
// src/ui/managers/ModalManager.ts (строки 57-82)

goProButton.addEventListener('click', async () => {
  // TODO: This is where Stripe integration will happen
  // 1. The next developer should replace licenseService.upgradeToPro()
  //    with actual Stripe Checkout session creation
  // 2. Handle payment success/failure callbacks
  // 3. Update user's license status after successful payment
  
  try {
    await licenseService.upgradeToPro();
    
    // TODO: Remove this dev simulation when Stripe is integrated
    if (licenseService.isDevModeEnabled()) {
      console.log('🧪 Dev mode: Simulating upgrade success');
      licenseService.devSetLicense('pro');
    }
  } catch (error) {
    console.error('Upgrade failed:', error);
    // TODO: Add proper error handling for Stripe failures
  }
});
```

---

## Точки интеграции

### Файлы, которые нужно модифицировать:

| Файл | Что делать |
|------|------------|
| `src/ui/services/LicenseService.ts` | Добавить реальную логику оплаты |
| `src/ui/managers/ModalManager.ts` | Обработать успех/ошибку платежа |
| `src/ui/config/constants.ts` | Установить `DEV_MODE_ENABLED: false` |

### Возможные варианты интеграции:

#### Вариант 1: Stripe Checkout (Рекомендуется)

```typescript
async upgradeToPro(): Promise<void> {
  // Создать checkout session на сервере
  const response = await fetch('https://your-server.com/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      figmaUserId: await this.getFigmaUserId(),
      returnUrl: 'figma://...'
    })
  });
  
  const { checkoutUrl } = await response.json();
  
  // Открыть Stripe Checkout
  window.open(checkoutUrl, '_blank');
}
```

#### Вариант 2: License Keys (Gumroad, LemonSqueezy)

```typescript
async activateLicenseKey(key: string): Promise<boolean> {
  const response = await fetch('https://your-server.com/api/validate-key', {
    method: 'POST',
    body: JSON.stringify({ key, figmaUserId: await this.getFigmaUserId() })
  });
  
  if (response.ok) {
    this.currentState = 'pro';
    this.saveState();
    this.notifyListeners();
    return true;
  }
  return false;
}
```

---

## Free vs Pro функционал

### FREE пользователи могут:
- ✅ Использовать все эффекты и настройки (strength, scale, blur, etc.)
- ✅ Использовать бесплатные пресеты
- ✅ **Просматривать** PRO-пресеты в галерее (видят превью)
- ✅ **Настраивать** PRO-пресеты (крутить слайдеры)
- ✅ Загружать свои displacement-карты
- ❌ **Применять** PRO-пресеты к канвасу
- ❌ Экспортировать код (Copy Code)

### PRO пользователи могут:
- ✅ Всё, что могут FREE
- ✅ Применять PRO-пресеты к канвасу
- ✅ Экспортировать SVG-код эффектов

### Логика блокировки в коде:

```typescript
// src/ui/App.ts

// При нажатии Apply:
private async onApply() {
  const selectedPreset = appStore.selectedPreset;
  if (selectedPreset && !licenseService.canApplyPreset(selectedPreset)) {
    return; // Блок! Показывается кнопка Upgrade вместо Apply
  }
  // ... применение эффекта
}

// При нажатии Copy Code:
private async onCopyCode() {
  if (!licenseService.canExportCode()) {
    this.modalManager.showCopyCodeFreeModal(); // Показать paywall
    return;
  }
  // ... экспорт кода
}
```

---

## Технические детали

### Хранение состояния

Сейчас состояние хранится локально через `StorageAdapter`:
- В браузере: `localStorage`
- В Figma sandbox: не работает (fallback на memory)

**Для продакшена нужно:**
- Хранить состояние на сервере
- Привязывать к Figma User ID или email
- Синхронизировать между устройствами

### Получение Figma User ID

```typescript
// В plugin code (code.ts):
const userId = figma.currentUser?.id;
const userEmail = figma.currentUser?.email; // может быть null
const userName = figma.currentUser?.name;
```

**Важно:** `figma.currentUser` доступен только в plugin code, не в UI.

### Уведомление UI об изменениях

Система подписок работает:

```typescript
// Подписка на изменение лицензии
licenseService.onStateChange((state) => {
  // state: 'free' | 'pro'
  console.log('License changed to:', state);
  // UI автоматически обновится
});
```

При изменении статуса лицензии автоматически:
- Обновляются PRO-бейджи на пресетах
- Переключается кнопка Apply/Upgrade
- Обновляется доступ к Copy Code

---

## Рекомендации по интеграции

### 1. Выбор платежной системы

| Система | Плюсы | Минусы |
|---------|-------|--------|
| **Stripe** | Мощный, гибкий, лучший UX | Требует бэкенд |
| **Gumroad** | Простой, без бэкенда | Высокие комиссии |
| **LemonSqueezy** | Простой, без бэкенда | Меньше контроля |
| **Paddle** | Налоги автоматически | Меньше гибкости |

### 2. Модель монетизации

**Разовая покупка (Lifetime):**
- Проще реализовать
- Один раз купил — навсегда
- Лицензионный ключ

**Подписка (Subscription):**
- Регулярный доход
- Требует проверки статуса
- Сложнее техничически

### 3. Необходимый бэкенд

Минимальные endpoints:

```
POST /api/create-checkout
  → Создать Stripe Checkout session

POST /api/validate-license
  → Проверить статус лицензии по Figma User ID

POST /api/webhook/stripe
  → Обработать webhook от Stripe
```

### 4. Безопасность

- **Не доверять клиенту!** Всегда проверять лицензию на сервере
- Хранить API ключи только на сервере
- Использовать signed webhooks от Stripe

### 5. Чек-лист перед запуском

- [ ] Интегрировать платежную систему
- [ ] Создать бэкенд для валидации
- [ ] Установить `DEV_MODE_ENABLED: false`
- [ ] Протестировать весь flow покупки
- [ ] Добавить обработку ошибок платежей
- [ ] Настроить email-уведомления
- [ ] Проверить работу на Free и Pro аккаунтах

---

## Контакты для вопросов

При возникновении вопросов по коду обращайтесь к разработчику плагина.

---

*Документ создан: Январь 2026*
*Версия плагина: 2.0*

