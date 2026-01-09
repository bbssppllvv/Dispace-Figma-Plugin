import { Preset, PresetCategory as CategoryData } from '../../presets';
import { presetService, customPresetService, CustomPreset } from '../../services';

export type PresetCategory = {
  name: string;
  presets: Preset[];
};

export class PresetStore {
  private allPresets: Preset[] = [];
  private isLoaded = false;

  async loadAll(): Promise<void> {
    try {
      
      // Load presets from CDN via PresetService
      const cdnPresets = await presetService.loadPresets();
      
      // Load custom presets
      let customPresets: CustomPreset[] = [];
      if (customPresetService.isReady()) {
        customPresets = await customPresetService.loadCustomPresets();
      } else {
        // Wait for initialization if not ready
        await customPresetService.waitForInitialization();
        customPresets = await customPresetService.loadCustomPresets();
      }
      
      // Merge all presets
      this.allPresets = [...cdnPresets, ...customPresets];
      this.isLoaded = true;
      
    } catch (error) {
      console.error('❌ PresetStore: Failed to load presets:', error);
      
      // Fallback to empty array
      console.error('❌ PresetStore: CDN loading failed, using empty preset list');
      this.allPresets = [];
      this.isLoaded = true;
    }
  }

  getAllPresets(): Preset[] {
    return this.allPresets;
  }

  async getCategories(): Promise<PresetCategory[]> {
    // Get category data with sort order
    const categoriesData = await presetService.getCategoriesData();
    const categoryMap = new Map<string, CategoryData>();
    categoriesData.forEach(cat => categoryMap.set(cat.name, cat));
    
    // Group presets by categories
    const map = new Map<string, Preset[]>();
    
    for (const preset of this.allPresets) {
      // Support for multiple categories - add preset to each category
      if (preset.categories && preset.categories.length > 0) {
        for (const categoryId of preset.categories) {
          // Find category by ID or name
          const categoryData = categoriesData.find(cat => cat.id === categoryId || cat.name === categoryId);
          const categoryName = categoryData ? categoryData.name : categoryId;
          
          const list = map.get(categoryName) || [];
          list.push(preset);
          map.set(categoryName, list);
        }
      } else if (preset.category) {
        // Fallback to legacy category field
        const list = map.get(preset.category) || [];
        list.push(preset);
        map.set(preset.category, list);
      }
    }
    
    // Ensure Custom category exists
    if (!map.has('Custom')) {
      map.set('Custom', []);
    }
    
    // Sort categories by order
    const sortedEntries = Array.from(map.entries()).sort(([nameA], [nameB]) => {
      const catA = categoryMap.get(nameA);
      const catB = categoryMap.get(nameB);
      
      const orderA = catA?.order ?? 999;
      const orderB = catB?.order ?? 999;
      
      if (orderA !== orderB) return orderA - orderB;
      return nameA.localeCompare(nameB);
    });
    
    return sortedEntries.map(([name, presets]) => ({ name, presets }));
  }

  isReady(): boolean {
    return this.isLoaded;
  }

  async deleteCustomPreset(id: string): Promise<void> {
    await customPresetService.deleteCustomPreset(id);
    await this.loadAll();
  }

  async saveCustomPreset(file: File): Promise<CustomPreset> {
    const preset = await customPresetService.saveCustomPreset(file);
    await this.loadAll();
    return preset;
  }

  /**
   * Force refresh presets from CDN
   */
  async refreshFromCDN(): Promise<void> {
    this.isLoaded = false;
    await presetService.refreshPresets();
    await this.loadAll();
    
    // Notify UI about update
    document.dispatchEvent(new CustomEvent('presets:refreshed', {
      detail: { presets: this.allPresets }
    }));
  }
}
