/**
 * Preset Service
 * 
 * Loads presets dynamically from CDN instead of static build.
 * Allows updating presets without rebuilding the plugin.
 */

import type { Preset, PresetCategory, SampleImage, TooltipData } from '../presets/types';

interface PresetManifest {
  version: string;
  updated: string;
  presets: Preset[];
  categories?: PresetCategory[];
  sampleImages?: SampleImage[];
  tooltips?: TooltipData[];
}

export class PresetService {
  private presets: Preset[] = [];
  private categories: PresetCategory[] = [];
  private sampleImages: SampleImage[] = [];
  private tooltips: TooltipData[] = [];
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  
  private readonly CDN_PRESETS_URL = 'https://raw.githubusercontent.com/bbssppllvv/Dispace-Figma-Plugin/main/assets/presets.json';
  private readonly CACHE_KEY = 'displace_presets_cache';
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  /**
   * Load presets from CDN (with caching)
   * @param force - If true, bypasses cache and forces a fresh fetch from CDN
   */
  async loadPresets(force: boolean = false): Promise<Preset[]> {
    if (!force && this.isLoaded) {
      return this.presets;
    }

    // If forced, reset loading state
    if (force) {
      this.isLoaded = false;
      this.loadPromise = null;
    }

    if (this.loadPromise) {
      await this.loadPromise;
      return this.presets;
    }

    this.loadPromise = this.loadPresetsInternal(force);
    await this.loadPromise;
    return this.presets;
  }

  private async loadPresetsInternal(force: boolean = false): Promise<void> {
    try {
      // Try to load from cache unless forced
      if (!force) {
        const cached = this.getCachedPresets();
      if (cached) {
        this.presets = cached.presets;
        this.categories = cached.categories || [];
        this.sampleImages = cached.sampleImages || [];
        this.tooltips = cached.tooltips || [];
        this.isLoaded = true;
        console.log(`✅ Loaded ${this.presets.length} presets from cache`);

          // Load fresh data in background
          this.refreshPresetsInBackground();
          return;
        }
      }

      // Load from CDN with cache busting if forced
      const url = force ? `${this.CDN_PRESETS_URL}?t=${Date.now()}` : this.CDN_PRESETS_URL;
      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from CDN');
      }
      
      let manifest: PresetManifest;
      try {
        manifest = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse presets.json from CDN:', parseError);
        console.error('Response text (first 200 chars):', text.substring(0, 200));
        throw new Error(`Invalid JSON in presets.json: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      this.presets = this.processPresets(manifest.presets || []);
      this.categories = this.processCategories(manifest.categories || []);
      this.sampleImages = (manifest.sampleImages || []).sort((a, b) => a.order - b.order);
      this.tooltips = manifest.tooltips || [];
      this.isLoaded = true;

      // Cache the result
      this.cachePresets(manifest);

      console.log(`✅ Loaded ${this.presets.length} presets and ${this.categories.length} categories from CDN`);

    } catch (error) {
      console.error('❌ Failed to load presets from CDN:', error);
      
      // Fallback to built-in presets
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
        const text = await response.text();
        if (!text || text.trim().length === 0) {
          console.warn('⚠️ Empty response during background refresh');
          return;
        }
        
        let manifest: PresetManifest;
        try {
          manifest = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to parse presets.json during background refresh:', parseError);
          console.error('Response text (first 200 chars):', text.substring(0, 200));
          return;
        }
        const newPresets = this.processPresets(manifest.presets || []);
        const newCategories = this.processCategories(manifest.categories || []);
        const newSampleImages = (manifest.sampleImages || []).sort((a, b) => a.order - b.order);
        const newTooltips = manifest.tooltips || [];
        
        // Check if data has changed
        if (JSON.stringify(newPresets) !== JSON.stringify(this.presets) || 
            JSON.stringify(newCategories) !== JSON.stringify(this.categories) ||
            JSON.stringify(newSampleImages) !== JSON.stringify(this.sampleImages) ||
            JSON.stringify(newTooltips) !== JSON.stringify(this.tooltips)) {
          this.presets = newPresets;
          this.categories = newCategories;
          this.sampleImages = newSampleImages;
          this.tooltips = newTooltips;
          this.cachePresets(manifest);
          
          // Notify UI about updates
          document.dispatchEvent(new CustomEvent('presets:updated', {
            detail: { 
              presets: this.presets, 
              categories: this.categories,
              sampleImages: this.sampleImages,
              tooltips: this.tooltips
            }
          }));
          
          console.log('🔄 Presets and categories updated in background');
        }
      }
    } catch (error) {
      // Silently ignore background load errors
      console.warn('Background preset refresh failed:', error);
    }
  }

  private processPresets(presets: Preset[]): Preset[] {
    // Process presets with support for legacy and new categories
    return presets.map(preset => {
      // Migrate legacy category field to new categories format
      if (preset.category && !preset.categories) {
        preset.categories = [preset.category];
      }
      
      // Backward compatibility: set category from the first category
      if (preset.categories && preset.categories.length > 0) {
        preset.category = preset.categories[0];
      }
      
      return preset;
    }).sort((a, b) => {
      // Sort by categories and order
      const primaryCategoryA = a.categories?.[0] || a.category || '';
      const primaryCategoryB = b.categories?.[0] || b.category || '';
      
      const categoryA = this.getCategoryByIdOrName(primaryCategoryA);
      const categoryB = this.getCategoryByIdOrName(primaryCategoryB);
      
      const orderA = categoryA?.order ?? 999;
      const orderB = categoryB?.order ?? 999;
      
      if (orderA !== orderB) return orderA - orderB;
      
      // Sort inside category by preset order
      const presetOrderA = a.order ?? 9999;
      const presetOrderB = b.order ?? 9999;
      if (presetOrderA !== presetOrderB) return presetOrderA - presetOrderB;
      
      return a.name.localeCompare(b.name);
    });
  }
  
  private processCategories(categories: PresetCategory[]): PresetCategory[] {
    // Create default categories if missing
    const defaultCategories: PresetCategory[] = [
      { id: 'popular', name: 'Popular', order: 1 },
      { id: 'ribbed-glass', name: 'Ribbed glass', order: 2 },
      { id: 'fabric', name: 'Fabric', order: 3 },
      { id: 'geometric', name: 'Geometric', order: 4 },
      { id: 'organic', name: 'Organic', order: 5 },
      { id: 'custom', name: 'Custom', order: 100 }
    ];
    
    // If no categories, use defaults
    if (categories.length === 0) {
      return defaultCategories;
    }
    
    // Sort by order
    return categories.sort((a, b) => a.order - b.order);
  }
  
  private getCategoryByIdOrName(idOrName: string): PresetCategory | undefined {
    return this.categories.find(cat => cat.id === idOrName || cat.name === idOrName);
  }

  private getCachedPresets(): PresetManifest | null {
    try {
      // Check localStorage availability
      if (!this.isStorageAvailable()) return null;
      
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      let data;
      try {
        data = JSON.parse(cached);
      } catch (parseError) {
        console.error('Failed to parse cached presets:', parseError);
        this.clearStorageItem(this.CACHE_KEY);
        return null;
      }
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
      // Ignore cache errors
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
      // Ignore errors
    }
  }

  private async loadFallbackPresets(): Promise<Preset[]> {
    // No fallback presets - everything loads from CDN
    console.warn('No fallback presets available, using empty array');
    return [];
  }

  /**
   * Get all presets
   */
  async getAllPresets(): Promise<Preset[]> {
    return this.loadPresets();
  }

  /**
   * Get presets by category (supports both ID and category name)
   */
  async getPresetsByCategory(categoryIdOrName: string): Promise<Preset[]> {
    const presets = await this.loadPresets();
    return presets.filter(preset => 
      preset.categories?.includes(categoryIdOrName) || 
      preset.category === categoryIdOrName
    );
  }

  /**
   * Get all categories (new API)
   */
  async getCategoriesData(): Promise<PresetCategory[]> {
    await this.loadPresets();
    return this.categories;
  }

  /**
   * Get all categories (legacy API - returns names only)
   */
  async getCategories(): Promise<string[]> {
    const categories = await this.getCategoriesData();
    return categories.map(cat => cat.name);
  }

  /**
   * Get all sample images
   */
  async getSampleImages(): Promise<SampleImage[]> {
    await this.loadPresets();
    return this.sampleImages;
  }

  /**
   * Get all tooltips
   */
  async getTooltips(): Promise<TooltipData[]> {
    await this.loadPresets();
    return this.tooltips;
  }

  /**
   * Get category by ID or name
   */
  async getCategoryById(id: string): Promise<PresetCategory | undefined> {
    await this.loadPresets();
    return this.getCategoryByIdOrName(id);
  }

  /**
   * Force refresh presets
   */
  async refreshPresets(): Promise<Preset[]> {
    this.clearStorageItem(this.CACHE_KEY);
    // Pass force=true to bypass cache and append timestamp
    return this.loadPresets(true);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.clearStorageItem(this.CACHE_KEY);
    this.isLoaded = false;
    this.loadPromise = null;
  }
}

// Singleton instance
export const presetService = new PresetService();
