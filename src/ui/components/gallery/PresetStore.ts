import { Preset } from '../../presets';
import { presetService } from '../../services/PresetService';
import { customPresetsManager, CustomPreset } from '../../customPresets';
import { eventBus } from '../../core/EventBus';

export type PresetCategory = {
  name: string;
  presets: Preset[];
};

export class PresetStore {
  private allPresets: Preset[] = [];
  private isLoaded = false;

  async loadAll(): Promise<void> {
    try {
      console.log('🔄 PresetStore: Loading presets from CDN...');
      
      // Загружаем пресеты с CDN через PresetService
      const cdnPresets = await presetService.loadPresets();
      console.log(`✅ PresetStore: Loaded ${cdnPresets.length} presets from CDN`);
      
      // Загружаем кастомные пресеты
      let customPresets: CustomPreset[] = [];
      if (customPresetsManager.isReady()) {
        customPresets = await customPresetsManager.loadCustomPresets();
        console.log(`✅ PresetStore: Loaded ${customPresets.length} custom presets`);
      }
      
      // Объединяем все пресеты
      this.allPresets = [...cdnPresets, ...customPresets];
      this.isLoaded = true;
      
      console.log(`✅ PresetStore: Total ${this.allPresets.length} presets loaded`);
      
    } catch (error) {
      console.error('❌ PresetStore: Failed to load presets:', error);
      
      // Fallback на пустой массив
      console.error('❌ PresetStore: CDN loading failed, using empty preset list');
      this.allPresets = [];
      this.isLoaded = true;
    }
  }

  getAllPresets(): Preset[] {
    return this.allPresets;
  }

  getCategories(): PresetCategory[] {
    const map = new Map<string, Preset[]>();
    for (const p of this.allPresets) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    if (!map.has('Custom')) {
      map.set('Custom', []);
    }
    return Array.from(map.entries()).map(([name, presets]) => ({ name, presets }));
  }

  isReady(): boolean {
    return this.isLoaded;
  }

  async deleteCustomPreset(id: string): Promise<void> {
    await customPresetsManager.deleteCustomPreset(id);
    await this.loadAll();
  }

  async saveCustomPreset(file: File): Promise<CustomPreset> {
    const preset = await customPresetsManager.saveCustomPreset(file);
    await this.loadAll();
    return preset;
  }

  /**
   * Обновить пресеты с CDN (принудительно)
   */
  async refreshFromCDN(): Promise<void> {
    console.log('🔄 PresetStore: Force refreshing from CDN...');
    this.isLoaded = false;
    await presetService.refreshPresets();
    await this.loadAll();
    
    // Уведомляем UI об обновлении
    document.dispatchEvent(new CustomEvent('presets:refreshed', {
      detail: { presets: this.allPresets }
    }));
  }
}


