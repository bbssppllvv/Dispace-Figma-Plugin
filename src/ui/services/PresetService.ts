/**
 * Preset Service
 * 
 * Загружает пресеты динамически с CDN вместо статической сборки.
 * Позволяет обновлять пресеты без пересборки плагина.
 */

import type { Preset } from '../presets/types';

interface PresetManifest {
  version: string;
  updated: string;
  presets: Preset[];
}

export class PresetService {
  private presets: Preset[] = [];
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  
  private readonly CDN_PRESETS_URL = 'https://raw.githubusercontent.com/bbssppllvv/Dispace-Figma-Plugin/main/assets/presets.json';
  private readonly CACHE_KEY = 'displace_presets_cache';
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  /**
   * Загрузить пресеты с CDN (с кэшированием)
   */
  async loadPresets(): Promise<Preset[]> {
    if (this.isLoaded) {
      return this.presets;
    }

    if (this.loadPromise) {
      await this.loadPromise;
      return this.presets;
    }

    this.loadPromise = this.loadPresetsInternal();
    await this.loadPromise;
    return this.presets;
  }

  private async loadPresetsInternal(): Promise<void> {
    try {
      // Попробуем загрузить из кэша
      const cached = this.getCachedPresets();
      if (cached) {
        this.presets = cached.presets;
        this.isLoaded = true;
        console.log(`✅ Loaded ${this.presets.length} presets from cache`);
        
        // Загружаем свежие данные в фоне
        this.refreshPresetsInBackground();
        return;
      }

      // Загружаем с CDN
      const response = await fetch(this.CDN_PRESETS_URL, {
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifest: PresetManifest = await response.json();
      this.presets = this.sortPresets(manifest.presets || []);
      this.isLoaded = true;

      // Кэшируем результат
      this.cachePresets(manifest);

      console.log(`✅ Loaded ${this.presets.length} presets from CDN`);

    } catch (error) {
      console.error('❌ Failed to load presets from CDN:', error);
      
      // Fallback на встроенные пресеты
      this.presets = await this.loadFallbackPresets();
      this.isLoaded = true;
      
      console.log(`⚠️ Using ${this.presets.length} fallback presets`);
    }
  }

  private async refreshPresetsInBackground(): Promise<void> {
    try {
      const response = await fetch(this.CDN_PRESETS_URL, {
        cache: 'no-cache'
      });

      if (response.ok) {
        const manifest: PresetManifest = await response.json();
        const newPresets = this.sortPresets(manifest.presets || []);
        
        // Проверяем, изменились ли пресеты
        if (JSON.stringify(newPresets) !== JSON.stringify(this.presets)) {
          this.presets = newPresets;
          this.cachePresets(manifest);
          
          // Уведомляем UI об обновлении
          document.dispatchEvent(new CustomEvent('presets:updated', {
            detail: { presets: this.presets }
          }));
          
          console.log('🔄 Presets updated in background');
        }
      }
    } catch (error) {
      // Тихо игнорируем ошибки фоновой загрузки
      console.warn('Background preset refresh failed:', error);
    }
  }

  private sortPresets(presets: Preset[]): Preset[] {
    const categoryPriority: Record<string, number> = {
      'Popular': 1,
      'Ribbed glass': 2,
      'Fabric': 3,
      'Geometric': 4,
      'Organic': 5,
      'Custom': 100
    };

    return presets.sort((a, b) => {
      const pa = categoryPriority[a.category] ?? 999;
      const pb = categoryPriority[b.category] ?? 999;
      if (pa !== pb) return pa - pb;
      const oa = a.order ?? 9999;
      const ob = b.order ?? 9999;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });
  }

  private getCachedPresets(): PresetManifest | null {
    try {
      // Проверяем доступность localStorage
      if (!this.isStorageAvailable()) return null;
      
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      
      if (age > this.CACHE_DURATION) {
        this.clearStorageItem(this.CACHE_KEY);
        return null;
      }

      return data.manifest;
    } catch (error) {
      this.clearStorageItem(this.CACHE_KEY);
      return null;
    }
  }

  private cachePresets(manifest: PresetManifest): void {
    try {
      if (!this.isStorageAvailable()) return;
      
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        manifest
      }));
    } catch (error) {
      // Игнорируем ошибки кэширования
      console.warn('Cache storage failed:', error);
    }
  }

  private isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }

  private clearStorageItem(key: string): void {
    try {
      if (this.isStorageAvailable()) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      // Игнорируем ошибки
    }
  }

  private async loadFallbackPresets(): Promise<Preset[]> {
    // Нет fallback пресетов - все загружается с CDN
    console.warn('No fallback presets available, using empty array');
    return [];
  }

  /**
   * Получить все пресеты
   */
  async getAllPresets(): Promise<Preset[]> {
    return this.loadPresets();
  }

  /**
   * Получить пресеты по категории
   */
  async getPresetsByCategory(category: string): Promise<Preset[]> {
    const presets = await this.loadPresets();
    return presets.filter(preset => preset.category === category);
  }

  /**
   * Получить все категории
   */
  async getCategories(): Promise<string[]> {
    const presets = await this.loadPresets();
    const categories = new Set(presets.map(preset => preset.category));
    return Array.from(categories);
  }

  /**
   * Принудительно обновить пресеты
   */
  async refreshPresets(): Promise<Preset[]> {
    this.clearStorageItem(this.CACHE_KEY);
    this.isLoaded = false;
    this.loadPromise = null;
    return this.loadPresets();
  }

  /**
   * Очистить кэш
   */
  clearCache(): void {
    this.clearStorageItem(this.CACHE_KEY);
    this.isLoaded = false;
    this.loadPromise = null;
  }
}

// Singleton instance
export const presetService = new PresetService();

