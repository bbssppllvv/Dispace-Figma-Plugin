/**
 * Displacement Engine - Main Entry Point
 * 
 * This is the central hub of the displacement effect system. It orchestrates all the modular 
 * components (SVG rendering, effect state management, image loading, etc.) and provides a 
 * unified API that maintains 100% backward compatibility with the original monolithic engine.
 * 
 * The engine creates complex visual displacement effects by:
 * 1. Generating dynamic SVG filters with channel separation (RGB)
 * 2. Applying displacement maps through Canvas operations
 * 3. Managing real-time parameter updates with optimized rendering
 * 4. Exporting effects as standalone SVG code for web use
 * 
 * This modular architecture allows for easy testing, maintenance, and feature extension
 * while keeping the public API simple and intuitive for consumers.
 * 
 * @module DisplacementEngine
 * @author Figma Plugin Team
 */

import { createReflectEffect, ReflectEffect } from '../components/ReflectEffect';
import { bytesToDataUrl, createMirroredTexture } from '../utils/image';
import { APP_CONFIG } from '../config/constants';

// Import our new modular components
import { initializeSVG, initializeNoiseTexture } from './SVGTemplate';
import { EffectStateManager } from './EffectState';
import { FilterRenderer } from './FilterRenderer';
import { ImageLoader } from './ImageLoader';
import { SVGExporter } from './SVGExporter';
import type { DisplacementEngineAPI, EngineState, DisplacementEngineInitOptions, MapSource } from './types';

/**
 * Initializes the displacement engine with modular architecture
 */
export function initDisplacementEngine(container: HTMLElement, options: DisplacementEngineInitOptions = {}): DisplacementEngineAPI {
  // Initialize SVG structure and get element references
  const svgElements = initializeSVG(container);
  
  // Initialize noise texture for dissolve effects
  initializeNoiseTexture(svgElements.noiseTexture);

  // Initialize reflect effect (optional)
  let reflectEffect: ReflectEffect | null = null;
  if (options.enableReflectEffect !== false) {
    try {
      reflectEffect = createReflectEffect(container);
    } catch (error) {
      // Reflect effect is optional, continue without it
    }
  }

  // Per-engine preview max side (do not mutate global APP_CONFIG)
  const perEnginePreviewMax = typeof options.cnvMax === 'number' ? options.cnvMax : APP_CONFIG.CNV_MAX;

  // Initialize engine state
  const engineState: EngineState = {
    imageWidth: APP_CONFIG.INITIAL_SIZE,
    imageHeight: APP_CONFIG.INITIAL_SIZE,
    mapImage: null,
    scalePct: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.scale,
    currentMapLoadingUrl: null,
    effectSettings: {
      strength: 0,
      chromaticAberration: 0,
      blur: 0,
      soft: 0,
      scale: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.scale
    },
    filterMarginPercent: options.filterMarginPercent ?? APP_CONFIG.FILTER_MARGIN_PERCENT,
    initialSize: APP_CONFIG.INITIAL_SIZE,
    previewMax: perEnginePreviewMax
  };

  // Initialize modular components
  const effectStateManager = new EffectStateManager(svgElements, engineState);
  const imageLoader = new ImageLoader(svgElements, engineState);
  const svgExporter = new SVGExporter(effectStateManager, engineState);
  
  // Create update callback for filter renderer
  const updateCallback = () => {
    console.log('🖼️ [UPDATE] updateCallback called - starting render operation');
    effectStateManager.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
    filterRenderer.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
    
    console.log('🎨 [UPDATE] Calling redrawMap with soft value:', effectStateManager.getSoft());
    filterRenderer.redrawMap(effectStateManager.getSoft());
    
    console.log('✅ [UPDATE] Render operation completed');
  };
  
  

  const filterRenderer = new FilterRenderer(svgElements, engineState, reflectEffect, imageLoader, updateCallback);

  // Create the public API that matches the original engine interface
  const api: DisplacementEngineAPI = {
    // Core methods
    clear() {
      imageLoader.clear();
      effectStateManager.clear();
    },

    // Effect settings (delegated to EffectStateManager)
    setStrength(val: number) {
      console.log('⚙️ [ENGINE] setStrength:', val);
      effectStateManager.setStrength(val);
    },

    setScale(val: number) {
      console.log('⚙️ [ENGINE] setScale:', val);
      effectStateManager.setScale(val);
      // Immediate redraw for smoother Live Preview while scaling
      filterRenderer.redrawMap(effectStateManager.getSoft());
    },
    // Deprecated in new schema; kept for backward compatibility (no-op)
    setScaleMode(_mode: 'uniform' | 'xOnly' | 'yOnly') {},

    setChromaticAberration(val: number) {
      console.log('⚙️ [ENGINE] setChromaticAberration:', val);
      effectStateManager.setChromaticAberration(val);
    },

    setBlur(val: number) {
      console.log('⚙️ [ENGINE] setBlur:', val);
      effectStateManager.setBlur(val);
    },

    setSoft(val: number) {
      console.log('⚙️ [ENGINE] setSoft:', val);
      effectStateManager.setSoft(val);
      // Propagate equivalent soft blur amount to ReflectEffect map blur
      if (reflectEffect) {
        const baseSoftness = (engineState.scalePct / 100) * APP_CONFIG.EFFECT_CALCULATIONS.BLUR_SOFTNESS_FACTOR;
        const stdDeviation = val * baseSoftness;
        try { (reflectEffect as any).setSoftBlur(stdDeviation); } catch {}
      }
    },

    setDissolveStrength(val: number) {
      console.log('⚙️ [ENGINE] setDissolveStrength:', val);
      effectStateManager.setDissolveStrength(val);
      filterRenderer.triggerUpdate();
    },

    // Batch rendering control
    setBatchMode(enabled: boolean) {
      console.log('🛡️ [ENGINE] setBatchMode:', enabled);
      filterRenderer.setBatchMode(enabled);
    },

    triggerBatchUpdate() {
      console.log('🎨 [ENGINE] triggerBatchUpdate called');
      filterRenderer.triggerBatchUpdate();
    },

    // Image operations (delegated to ImageLoader)
    async loadSourceFromBytes(bytes: Uint8Array): Promise<void> {
      await imageLoader.loadSourceFromBytes(bytes);
      effectStateManager.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
      filterRenderer.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
      filterRenderer.triggerUpdate();
    },

    loadMap(srcOrFile: MapSource | null): void {
      console.log('🗺️ [ENGINE] loadMap called with:', srcOrFile);
      if (!srcOrFile) {
        console.log('🚫 [ENGINE] loadMap: no source provided');
        return;
      }
      
      console.log('🚀 [ENGINE] Starting async map loading through ImageLoader');
      imageLoader.loadMap(srcOrFile).then(mapImage => {
        console.log('✅ [ENGINE] ImageLoader.loadMap resolved with:', mapImage ? `image (${mapImage.width}x${mapImage.height})` : 'null');
        if (mapImage) {
          console.log('🎨 [ENGINE] Setting map image in FilterRenderer');
          filterRenderer.setMapImage(mapImage);
        } else {
          console.log('🚫 [ENGINE] No map image returned, skipping setMapImage');
        }
      }).catch(error => {
        console.error('❌ [ENGINE] ImageLoader.loadMap failed:', error);
        // Error is handled internally by loadMap
      });
    },

    async loadMapAndWait(srcOrFile: MapSource | null): Promise<void> {
      console.log('🗺️ [ENGINE] loadMapAndWait called with:', srcOrFile);
      if (!srcOrFile) {
        console.log('🚫 [ENGINE] loadMapAndWait: no source provided');
        return;
      }
      const mapImage = await imageLoader.loadMap(srcOrFile).catch((error) => {
        console.error('❌ [ENGINE] loadMapAndWait failed:', error);
        return null;
      });
      if (mapImage) {
        filterRenderer.setMapImage(mapImage);
      }
    },

    // Export operations
    async getImageBytes(): Promise<Uint8Array> {
      // Ensure feImg contains an inline snapshot of the current preview map
      try { this.inlineDisplacementTextureForExport(); } catch {}
      return filterRenderer.renderToBytes();
    },
    async getThumbnailBytes(maxSide?: number): Promise<Uint8Array> {
      return filterRenderer.renderToThumbnailBytes(maxSide);
    },

    exportSVGCode() {
      return svgExporter.exportSVGCode();
    },

    // Thumbnail helpers
    getTextureSnapshot() {
      return imageLoader.getTextureSnapshot();
    },

    getImageDimensions() {
      return imageLoader.getCurrentImageDimensions();
    },

    getCurrentEffectSettings() {
      return {
        strength: effectStateManager.getStrength(),
        chromaticAberration: effectStateManager.getChromaticAberration(),
        blur: effectStateManager.getBlur(),
        soft: effectStateManager.getSoft(),
        scale: engineState.scalePct,
        dissolveStrength: effectStateManager.getDissolveStrength()
      };
    },

    setSourceTextureFromPreview(previewTexture: string, width: number, height: number) {
      // Set feSourceImg directly and update viewBox/dimensions
      const margin = Math.round(Math.max(width, height) * APP_CONFIG.FILTER_MARGIN_PERCENT / 100);
      svgElements.feSourceImg.setAttribute('href', previewTexture);
      svgElements.feSourceImg.setAttribute('x', String(-margin));
      svgElements.feSourceImg.setAttribute('y', String(-margin));
      svgElements.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svgElements.filterEl.setAttribute('x', String(-margin));
      svgElements.filterEl.setAttribute('y', String(-margin));
      svgElements.filterEl.setAttribute('width', String(width + margin * 2));
      svgElements.filterEl.setAttribute('height', String(height + margin * 2));
      svgElements.feSourceImg.setAttribute('width', String(width + margin * 2));
      svgElements.feSourceImg.setAttribute('height', String(height + margin * 2));
      svgElements.outputRect.setAttribute('width', String(width));
      svgElements.outputRect.setAttribute('height', String(height));
      svgElements.maskRect.setAttribute('width', String(width));
      svgElements.maskRect.setAttribute('height', String(height));
      engineState.imageWidth = width;
      engineState.imageHeight = height;
    },

    forceRedraw() {
      // Directly call the update callback path to recompute scales and redraw map
      effectStateManager.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
      filterRenderer.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
      filterRenderer.redrawMap(effectStateManager.getSoft());
    },

    inlineDisplacementTextureForExport() {
      // Convert current feImg texture to dataURL to avoid external URL resolution issues
      const { canvas } = filterRenderer.getCanvasResources();
      const dataUrl = canvas.toDataURL('image/png');
      svgElements.feImg.setAttribute('href', dataUrl);
    },

    async prefetchMapSources(mapSources: MapSource[]): Promise<void> {
      if (!mapSources || mapSources.length === 0) return;
      const sourcesToLoad: Array<string | File | HTMLImageElement> = [];
      for (const src of mapSources) {
        if (!src) continue;
        if (typeof src === 'string' || src instanceof File || src instanceof HTMLImageElement) {
          sourcesToLoad.push(src);
        } else if (src && (src as any).layers) {
          const multi = src as any;
          for (const layer of multi.layers) {
            sourcesToLoad.push(layer.src);
          }
        }
      }
      try {
        await imageLoader.prefetch(sourcesToLoad);
      } catch {}
    },

    // Reflect effect operations (delegated)
    setReflectOpacity(opacity: number) {
      console.log('🪞 [ENGINE] setReflectOpacity:', opacity);
      if (reflectEffect) {
        reflectEffect.setOpacity(opacity);
        filterRenderer.triggerUpdate();
      } else {
        console.log('🚫 [ENGINE] No reflectEffect available for setReflectOpacity');
      }
    },

    setReflectSharpness(sharpness: number) {
      console.log('🪞 [ENGINE] setReflectSharpness:', sharpness);
      if (reflectEffect) {
        reflectEffect.setSharpness(sharpness);
      } else {
        console.log('🚫 [ENGINE] No reflectEffect available for setReflectSharpness');
      }
    },

    destroyReflectEffect() {
      if (reflectEffect) {
        reflectEffect.destroy();
        reflectEffect = null;
      }
    },

    // Resource management
    dispose() {
      // Clean up all resources
      if (reflectEffect) {
        reflectEffect.destroy();
        reflectEffect = null;
      }
      
      // Dispose filter renderer resources
      filterRenderer.dispose();
      
      // Clear engine state
      imageLoader.clear();
      effectStateManager.clear();
    },

    // Utility functions (for backward compatibility)
    bytesToDataUrl,
    createMirroredTexture
  };

  return api;
}

// Export type for backward compatibility
export type DisplacementEngine = DisplacementEngineAPI;

// Re-export types for external use
export type { DisplacementEngineAPI } from './types'; 