import { Preset } from "./presets";
import { APP_CONFIG } from "./config/constants";
import { figmaService } from "./services";

// Максимальный размер изображения для оптимизации
const MAX_IMAGE_SIZE = APP_CONFIG.INITIAL_SIZE;
const CUSTOM_CATEGORY = 'Custom';

export interface CustomPreset extends Preset {
  isCustom: true;
  category: 'Custom';
  createdAt: number;
}

class CustomPresetsManager {
  private customPresets: CustomPreset[] = [];
  private isInitialized = false;

  constructor() {
    // Слушаем автоматическую загрузку пресетов при запуске плагина
    window.addEventListener('message', (event) => {
      const raw = (event as any)?.data;
      const msg = raw && (raw.pluginMessage ? raw.pluginMessage : raw);
      if (!msg || !msg.type) return;

      if (msg.type === 'custom-presets-loaded' && !this.isInitialized) {
        this.customPresets = msg.presets || [];
        this.isInitialized = true;
        
        // Уведомляем о том, что пресеты загружены
        document.dispatchEvent(new CustomEvent('custom-presets-initialized'));
      }
    });
  }

  // Проверяем, инициализированы ли пресеты
  isReady(): boolean {
    return this.isInitialized;
  }

  // Ожидаем инициализации если еще не готовы
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return;
    
    return new Promise((resolve) => {
      const handler = () => {
        document.removeEventListener('custom-presets-initialized', handler);
        resolve();
      };
      document.addEventListener('custom-presets-initialized', handler);
    });
  }

  // Загрузить все кастомные пресеты при инициализации
  async loadCustomPresets(): Promise<CustomPreset[]> {
    if (!this.isInitialized) {
      await this.waitForInitialization();
    }
    return this.customPresets;
  }

  // Сохранить новый кастомный пресет
  async saveCustomPreset(file: File, name?: string): Promise<CustomPreset> {
    try {
      // Оптимизируем изображение перед сохранением
      const optimizedDataUrl = await this.optimizeImage(file);
      
      const preset: CustomPreset = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name || `Custom ${this.customPresets.length + 1}`,
        layers: [ { src: optimizedDataUrl, tiling: 'tiled' } ],
        defaultScale: APP_CONFIG.DEFAULT_PRESET_SCALE,
        defaultStrength: APP_CONFIG.DEFAULT_PRESET_STRENGTH,
        category: CUSTOM_CATEGORY,
        isCustom: true,
        createdAt: Date.now()
      };

      // ✅ ПОСЛЕ: Безопасный вызов через сервис
      await figmaService.saveCustomPreset(preset);

      // Добавляем в начало списка
      this.customPresets.unshift(preset);
      return preset;
    } catch (error) {
      console.error('Error saving custom preset:', error);
      throw error;
    }
  }

  // Удалить кастомный пресет
  async deleteCustomPreset(presetId: string): Promise<void> {
    try {
      // ✅ ПОСЛЕ: Безопасный вызов через сервис
      await figmaService.deleteCustomPreset(presetId);

      this.customPresets = this.customPresets.filter(p => p.id !== presetId);
    } catch (error) {
      console.error('Error deleting custom preset:', error);
      throw error;
    }
  }

  // Получить все кастомные пресеты
  getCustomPresets(): CustomPreset[] {
    return this.customPresets;
  }

  // Проверить использование storage
  async getStorageUsage(): Promise<{ used: number; total: number; percentage: number }> {
    try {
      // ✅ ПОСЛЕ: Безопасный вызов через сервис  
      const response = await figmaService.getStorageUsage();
      return response.usage;
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return { used: 0, total: APP_CONFIG.STORAGE_LIMIT, percentage: 0 };
    }
  }

  // Оптимизация изображения перед сохранением
  private async optimizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }

        // Определяем размеры для оптимизации
        const { width, height } = this.calculateOptimalSize(img.width, img.height);
        
        canvas.width = width;
        canvas.height = height;
        
        // Рисуем оптимизированное изображение
        ctx.drawImage(img, 0, 0, width, height);
        
        // Конвертируем в base64 с качеством 0.8
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  // Вычисляем оптимальный размер для изображения
  private calculateOptimalSize(width: number, height: number): { width: number; height: number } {
    if (width <= MAX_IMAGE_SIZE && height <= MAX_IMAGE_SIZE) {
      return { width, height };
    }

    const aspectRatio = width / height;
    
    if (width > height) {
      return {
        width: MAX_IMAGE_SIZE,
        height: Math.round(MAX_IMAGE_SIZE / aspectRatio)
      };
    } else {
      return {
        width: Math.round(MAX_IMAGE_SIZE * aspectRatio),
        height: MAX_IMAGE_SIZE
      };
    }
  }
}

// Экспортируем singleton instance
export const customPresetsManager = new CustomPresetsManager(); 