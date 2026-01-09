import { appStore } from '../store/AppStore';
import { generateRandomizedValues } from '../utils/randomizer';
import type { DisplacementEngine } from '../engine';
import type { Preset } from '../presets';
import { getRandomPreset } from '../components/PresetGallery';
import { buildMapSourceFromPreset } from '../utils/maps';

/**
 * Manages the complex orchestration of the "Shuffle" operation.
 * Handles:
 * - UI Locking/Unlocking
 * - Batch mode toggling (to prevent rendering intermediate frames)
 * - Map loading
 * - Slider value updates
 * - Final rendering
 */
export class RandomizerManager {
  private engine: DisplacementEngine;
  private sliders: any; // Using any to avoid circular dependency with controls init return type
  private randomButton: HTMLButtonElement;
  private updateUIModeCallback: () => void;
  
  private shuffleTimeoutId: number | null = null;
  private readonly SHUFFLE_TIMEOUT_MS = 5000;

  constructor(
    engine: DisplacementEngine, 
    sliders: any, 
    randomButton: HTMLButtonElement,
    updateUIModeCallback: () => void
  ) {
    this.engine = engine;
    this.sliders = sliders;
    this.randomButton = randomButton;
    this.updateUIModeCallback = updateUIModeCallback;
  }

  /**
   * Main entry point to perform a randomized shuffle
   */
  public async randomize() {
    
    // Prevent concurrent shuffle operations
    if (appStore.isShuffling) {
      return;
    }

    // Check if we have a selected image (required for shuffle)
    if (!appStore.hasSelectedImage) {
      return;
    }

    // Select a random preset
    const randomPreset = getRandomPreset();
    
    // Fallback to selected preset if random fails (e.g., gallery not loaded)
    let targetPreset = randomPreset || appStore.selectedPreset;

    if (!targetPreset) {
      console.error('❌ [SHUFFLE] No preset available for shuffle');
      return;
    }

    // Validate preset structure to prevent crashes
    if (!targetPreset.layers || !Array.isArray(targetPreset.layers) || targetPreset.layers.length === 0) {
      // Try to find a valid fallback preset using the same method as getRandomPreset
      const { getRandomPreset } = await import('../components/PresetGallery');
      let fallbackPreset = getRandomPreset();
      
      // Keep trying until we find a valid preset or exhaust attempts
      let attempts = 0;
      while (fallbackPreset && (!fallbackPreset.layers || !Array.isArray(fallbackPreset.layers) || fallbackPreset.layers.length === 0) && attempts < 10) {
        fallbackPreset = getRandomPreset();
        attempts++;
      }
      
      if (fallbackPreset && fallbackPreset.layers && Array.isArray(fallbackPreset.layers) && fallbackPreset.layers.length > 0) {
        console.warn('⚠️ [SHUFFLE] Target preset is invalid, using fallback preset:', fallbackPreset.name);
        targetPreset = fallbackPreset;
      } else {
        // No valid presets available - abort silently
        console.warn('⚠️ [SHUFFLE] No valid presets available for shuffle');
        return;
      }
    }
    
    // Start shuffle operation
    this.startShuffleOperation();
    
    // Perform the shuffle with the target preset
    await this.performBatchedShuffle(targetPreset);
  }

  private startShuffleOperation() {
    appStore.setIsShuffling(true);
    
    // Enable batch mode in engine to prevent individual renders
    this.engine.setBatchMode(true);
    
    // Enable batch mode for sliders to prevent visual updates
    if (this.sliders) {
      this.sliders.setBatchMode(true);
    }
    
    // Set recovery timeout to prevent permanent freezing
    this.shuffleTimeoutId = window.setTimeout(() => {
      console.warn('⏰ [SHUFFLE] Operation timed out, forcing completion');
      this.endShuffleOperation();
    }, this.SHUFFLE_TIMEOUT_MS);

    // Disable button to provide visual feedback
    this.randomButton.disabled = true;
  }

  private async performBatchedShuffle(preset: Preset) {
    
    try {
      // Generate new random values
      const randomValues = generateRandomizedValues();
      
      // Step 1: Build map source and update store atomically
      const mapSource = (await import('../utils/maps')).buildMapSourceFromPreset(preset);
      
      // Update app state atomically with both preset and map (so UI can react)
      appStore.setPresetAndMap(preset, mapSource);
      
      // Dispatch event to update Gallery selection ring
      document.dispatchEvent(new CustomEvent('preset:randomized', { 
        detail: { presetName: preset.name } 
      }));
      await this.engine.loadMapAndWait(mapSource);
      
      // Step 2: Update all sliders (engine updates but no renders triggered due to batch mode)
      this.updateSliders(randomValues);
      
      // Step 3: End batch mode and trigger single final render
      this.endShuffleOperation();
      
    } catch (error) {
      console.error('❌ [SHUFFLE] Shuffle operation failed:', error);
      this.endShuffleOperation();
    }
  }

  private updateSliders(values: { [key: string]: number }) {
    
    if (!this.sliders) {
      console.warn('⚠️ [SLIDERS] No sliders available');
      return;
    }
    
    let updateCount = 0;

    for (const key in values) {
      if (key in this.sliders) {
        (this.sliders as any)[key].setValue(values[key], true);
        updateCount++;
      } else {
        console.warn(`⚠️ [SLIDERS] Slider ${key} not found`);
      }
    }
  }

  private endShuffleOperation() {
    appStore.setIsShuffling(false);
    
    // Disable batch mode for sliders first (this will trigger visual updates)
    if (this.sliders) {
      this.sliders.setBatchMode(false);
    }
    
    // Disable batch mode and trigger final render
    this.engine.setBatchMode(false);
    
    // Add a small delay to ensure slider visuals update before final render
    setTimeout(() => {
      this.engine.triggerBatchUpdate();
    }, 5);
    
    // Clear timeout
    if (this.shuffleTimeoutId) {
      clearTimeout(this.shuffleTimeoutId);
      this.shuffleTimeoutId = null;
    }
    
    // Force update UI mode
    this.updateUIModeCallback();
    
    // Re-enable button
    this.randomButton.disabled = false;
  }
}
