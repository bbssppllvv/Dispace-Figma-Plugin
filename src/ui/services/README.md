# Services Layer

Сервисы предоставляют чистый API для взаимодействия с внешними системами и управления состоянием.

## FigmaService

### Старый способ (в App.ts):
```typescript
// ❌ Небезопасный прямой postMessage
parent.postMessage({ 
  pluginMessage: { 
    type: 'apply-displacement-result',
    imageBytes
  } 
}, 'https://www.figma.com');

// ❌ Обработка сообщений в App.ts
window.onmessage = (event) => {
  const message = event.data.pluginMessage;
  switch (message.type) {
    case 'selection-updated':
      // Логика здесь...
  }
};
```

### Новый способ:
```typescript
import { figmaService } from '../services';

// ✅ Безопасный типизированный API
await figmaService.applyDisplacementEffect(imageBytes);

// ✅ Типизированная обработка событий
figmaService.onMessage('selection-updated', (message) => {
  // Автокомплит и проверка типов
  console.log(message.imageBytes);
});

// ✅ Async/await для request-response
const result = await figmaService.saveCustomPreset(preset);
```

## StorageService

### Старый способ:
```typescript
// ❌ Прямая работа с localStorage
localStorage.setItem('my-key', JSON.stringify(data));
const data = JSON.parse(localStorage.getItem('my-key') || '{}');
```

### Новый способ:
```typescript
import { storageService } from '../services';

// ✅ Типизированный storage
storageService.save('user-settings', { theme: 'dark' });
const settings = storageService.load('user-settings', { theme: 'light' });

// ✅ Информация о storage
const info = storageService.getStorageInfo();
console.log(`Used: ${info.percentage}%`);
```

## CacheService 

### Старый способ (в PresetGallery.ts):
```typescript
// ❌ Ручное управление кешем
const presetImageCache: Record<string, HTMLImageElement> = {};
const cacheAccessOrder: string[] = [];

function manageCacheSize(newKey: string) {
  // 30+ строк кода для LRU...
}
```

### Новый способ:
```typescript
import { imageCache } from '../services';

// ✅ Простой LRU cache
imageCache.set('preset-1', imageElement);
const cached = imageCache.get('preset-1'); // null если нет

// ✅ Автоматическая очистка по размеру
const stats = imageCache.getStats();
console.log(`Cache utilization: ${stats.utilization}%`);
```

## EventBus Integration

FigmaService автоматически эмитит события через EventBus:

```typescript
import { eventBus } from '../core/EventBus';

// ✅ Современные типизированные события
eventBus.on('image:selected', ({ imageBytes }) => {
  console.log('New image selected:', imageBytes.length);
});

eventBus.on('image:cleared', () => {
  console.log('Selection cleared');
});
```

## Migration Path

1. **Этап 1**: Сервисы инициализированы (✅ СДЕЛАНО)
2. **Этап 2**: Постепенная замена в App.ts
3. **Этап 3**: Замена в customPresets.ts  
4. **Этап 4**: Замена в PresetGallery.ts

## Benefits

- **Типизация**: Автокомплит и проверка типов
- **Безопасность**: Centralized error handling
- **Тестирование**: Легко мокать сервисы
- **Переиспользование**: Один API для всех компонентов
- **Maintenance**: Изменения в одном месте 