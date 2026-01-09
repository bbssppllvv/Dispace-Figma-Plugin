/**
 * Custom Preset Service
 * 
 * Manages user-created custom presets stored in Figma clientStorage.
 * Handles loading, saving, deleting, and optimization of custom presets.
 */

import type { Preset } from '../presets/types';
import { figmaService } from './FigmaService';
import { APP_CONFIG } from '../config/constants';

export interface CustomPreset extends Preset {
  isCustom: true;
  category: 'Custom';
  createdAt: number;
}

/**
 * Service for managing custom presets
 */
export class CustomPresetService {
  private customPresets: CustomPreset[] = [];
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Listen for automatic preset loading when plugin starts
    this.setupMessageListener();
  }

  /**
   * Setup message listener for custom presets loaded from backend
   */
  private setupMessageListener(): void {
    figmaService.onMessage('custom-presets-loaded', (message) => {
      if (!this.isInitialized) {
        const rawPresets = (message as any).presets || [];
        let migratedCount = 0;
        
        // Migrate old format (map) to new format (layers) and filter invalid presets
        this.customPresets = rawPresets
          .map((p: any) => {
            if (!p || typeof p !== 'object') {
              return null;
            }
            
            const hasMap = typeof p.map === 'string' && p.map.length > 0;
            const hasLayers = Array.isArray(p.layers) && p.layers.length > 0;
            
            // If preset has map but no layers, it needs migration
            if (hasMap && !hasLayers) {
              migratedCount++;
            }
            
            return this.migratePresetFormat(p);
          })
          .filter((p: any) => {
            if (!p || typeof p !== 'object') {
              return false;
            }
            
            const isValid = Array.isArray(p.layers) && p.layers.length > 0 && 
                           p.layers[0] && typeof p.layers[0].src === 'string' && 
                           p.layers[0].src.length > 0;
            
            if (!isValid) {
              // Only log if preset had data that we couldn't migrate
              if (p.id || p.name) {
                console.warn('⚠️ Skipping invalid custom preset after migration:', { id: p.id, name: p.name });
              }
            }
            return isValid;
          });
        
        if (migratedCount > 0) {
          console.log(`✅ Migrated ${migratedCount} custom presets from old format (map) to new format (layers)`);
        }
        
        this.isInitialized = true;
        
        // Notify that presets are loaded
        document.dispatchEvent(new CustomEvent('custom-presets-initialized'));
      }
    });
  }

  /**
   * Migrate old preset format (with `map` field) to new format (with `layers` array)
   */
  private migratePresetFormat(preset: any): any {
    // If preset already has layers, ensure it has categories
    if (preset.layers && Array.isArray(preset.layers) && preset.layers.length > 0) {
      // Ensure categories array exists (for backward compatibility)
      if (!preset.categories || !Array.isArray(preset.categories)) {
        preset.categories = preset.category ? [preset.category] : ['Custom'];
      }
      // Ensure category field exists for backward compatibility
      if (!preset.category && preset.categories.length > 0) {
        preset.category = preset.categories[0];
      }
      return preset;
    }

    // Migrate old format: `map` -> `layers`
    if (preset.map && typeof preset.map === 'string') {
      const migrated = {
        ...preset,
        layers: [{
          src: preset.map,
          tiling: preset.tiling || 'tiled',
          scaleMode: preset.scaleMode || 'uniform',
          alignX: preset.alignX || 'center',
          alignY: preset.alignY || 'center'
        }],
        // Ensure categories array exists
        categories: preset.categories || (preset.category ? [preset.category] : ['Custom']),
        // Ensure category field exists for backward compatibility
        category: preset.category || 'Custom'
      };
      // Remove old map field
      delete migrated.map;
      return migrated;
    }

    // If no layers and no map, return as-is (will be filtered out)
    return preset;
  }

  /**
   * Check if presets are initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Wait for initialization if not ready yet
   */
  async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise((resolve) => {
      const handler = () => {
        document.removeEventListener('custom-presets-initialized', handler);
        resolve();
      };
      document.addEventListener('custom-presets-initialized', handler);
    });

    return this.initializationPromise;
  }

  /**
   * Load all custom presets
   */
  async loadCustomPresets(): Promise<CustomPreset[]> {
    if (!this.isInitialized) {
      await this.waitForInitialization();
    }
    return this.customPresets;
  }

  /**
   * Save a new custom preset
   */
  async saveCustomPreset(file: File, name?: string): Promise<CustomPreset> {
    try {
      // Optimize image before saving
      const optimizedDataUrl = await this.optimizeImage(file);
      
      const preset: CustomPreset = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name || `Custom ${this.customPresets.length + 1}`,
        layers: [{ src: optimizedDataUrl, tiling: 'tiled' }],
        defaultScale: APP_CONFIG.DEFAULT_PRESET_SCALE,
        defaultStrength: APP_CONFIG.DEFAULT_PRESET_STRENGTH,
        categories: ['Custom'],
        category: 'Custom', // For backward compatibility
        isCustom: true,
        createdAt: Date.now()
      };

      // Save through FigmaService
      await figmaService.saveCustomPreset(preset);

      // Add to beginning of list
      this.customPresets.unshift(preset);
      return preset;
    } catch (error) {
      console.error('Error saving custom preset:', error);
      throw error;
    }
  }

  /**
   * Delete a custom preset
   */
  async deleteCustomPreset(presetId: string): Promise<void> {
    try {
      await figmaService.deleteCustomPreset(presetId);
      this.customPresets = this.customPresets.filter(p => p.id !== presetId);
    } catch (error) {
      console.error('Error deleting custom preset:', error);
      throw error;
    }
  }

  /**
   * Get all custom presets
   */
  getCustomPresets(): CustomPreset[] {
    return this.customPresets;
  }

  /**
   * Get storage usage
   */
  async getStorageUsage(): Promise<{ used: number; total: number; percentage: number }> {
    try {
      const response = await figmaService.getStorageUsage();
      return response.usage;
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return { used: 0, total: APP_CONFIG.STORAGE_LIMIT, percentage: 0 };
    }
  }

  /**
   * Optimize image before saving
   */
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

        // Determine optimal size for optimization
        const { width, height } = this.calculateOptimalSize(img.width, img.height);
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw optimized image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with quality 0.8
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate optimal size for image
   */
  private calculateOptimalSize(width: number, height: number): { width: number; height: number } {
    const MAX_IMAGE_SIZE = APP_CONFIG.INITIAL_SIZE;
    
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

// Singleton instance
export const customPresetService = new CustomPresetService();

