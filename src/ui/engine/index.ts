import { bytesToDataUrl, createMirroredTexture } from '../utils/image';
import { APP_CONFIG } from '../config/constants';

// Import our modular components
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

  // Per-engine preview max side (do not mutate global APP_CONFIG)
  const perEnginePreviewMax = typeof options.cnvMax === 'number' ? options.cnvMax : APP_CONFIG.CNV_MAX;

  // Initialize engine state
  const engineState: EngineState = {
    imageWidth: APP_CONFIG.INITIAL_SIZE,
    imageHeight: APP_CONFIG.INITIAL_SIZE,
    mapImage: null,
    scalePct: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.scale,
    textureScale: 1,
    currentMapLoadingUrl: null,
    effectSettings: {
      strength: 0,
      chromaticAberration: 0,
      blur: 0,
      soft: 0,
      scale: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.scale,
      dissolveStrength: 0,
      grain: 0,
      grainSize: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.grainSize,
      reflectStrength: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectStrength,
      reflectSoftness: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectSoftness,
      reflectSharpness: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectSharpness,
      reflectLightX: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectLightX,
      reflectLightY: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectLightY
    },
    filterMarginPercent: options.filterMarginPercent ?? APP_CONFIG.FILTER_MARGIN_PERCENT,
    initialSize: APP_CONFIG.INITIAL_SIZE,
    previewMax: perEnginePreviewMax
  };

  // Initialize modular components
  const effectStateManager = new EffectStateManager(svgElements, engineState);
  const imageLoader = new ImageLoader(svgElements, engineState);
  const svgExporter = new SVGExporter(effectStateManager, engineState, null);
  
  // Create update callback for filter renderer
  const updateCallback = () => {
    effectStateManager.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
    filterRenderer.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
    filterRenderer.redrawMap(effectStateManager.getSoft());
  };

  const filterRenderer = new FilterRenderer(svgElements, engineState, null, imageLoader, updateCallback);

  // Create the public API
  const api: DisplacementEngineAPI = {
    // Core methods
    clear() {
      imageLoader.clear();
      effectStateManager.clear();
    },

    // Effect settings
    setStrength(val: number) {
      effectStateManager.setStrength(val);
    },

    setScale(val: number) {
      effectStateManager.setScale(val);
      if (!filterRenderer.isBatchModeEnabled()) {
        filterRenderer.redrawMap(effectStateManager.getSoft());
      }
    },

    setTextureScale(val: number) {
      engineState.textureScale = val;
      if (!filterRenderer.isBatchModeEnabled()) {
        filterRenderer.redrawMap(effectStateManager.getSoft());
      }
    },

    setScaleMode(_mode: 'uniform' | 'xOnly' | 'yOnly') {},

    setChromaticAberration(val: number) {
      effectStateManager.setChromaticAberration(val);
    },

    setBlur(val: number) {
      effectStateManager.setBlur(val);
    },

    setSoft(val: number) {
      effectStateManager.setSoft(val);
    },

    setDissolveStrength(val: number) {
      effectStateManager.setDissolveStrength(val);
      filterRenderer.triggerUpdate();
    },

    setGrain(val: number) {
      effectStateManager.setGrain(val);
      filterRenderer.triggerUpdate();
    },

    setGrainSize(val: number) {
      effectStateManager.setGrainSize(val);
      filterRenderer.triggerUpdate();
    },

    setReflectStrength(val: number) {
      effectStateManager.setReflectStrength(val);
      filterRenderer.triggerUpdate();
    },

    setReflectSoftness(val: number) {
      effectStateManager.setReflectSoftness(val);
      filterRenderer.triggerUpdate();
    },

    setReflectSharpness(val: number) {
      effectStateManager.setReflectSharpness(val);
      filterRenderer.triggerUpdate();
    },

    setReflectLightPosition(x: number, y: number) {
      effectStateManager.setReflectLightPosition(x, y);
      filterRenderer.triggerUpdate();
    },

    setEffectSettings(settings: any) {
      effectStateManager.setAll(settings);
      if (!filterRenderer.isBatchModeEnabled()) {
        filterRenderer.redrawMap(effectStateManager.getSoft());
      }
    },

    // Batch rendering control
    setBatchMode(enabled: boolean) {
      filterRenderer.setBatchMode(enabled);
    },

    setInteractionState(active: boolean) {
      filterRenderer.setInteractionState(active);
      if (!active) {
        filterRenderer.redrawMap(effectStateManager.getSoft());
      }
    },

    triggerBatchUpdate() {
      filterRenderer.triggerBatchUpdate();
    },

    triggerUpdate() {
      filterRenderer.triggerUpdate();
    },

    // Image operations
    async loadSourceFromBytes(bytes: Uint8Array): Promise<void> {
      await imageLoader.loadSourceFromBytes(bytes);
      effectStateManager.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
      filterRenderer.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
      filterRenderer.redrawMap(effectStateManager.getSoft());
    },

    loadMap(srcOrFile: MapSource | null): void {
      if (!srcOrFile) return;
      
      imageLoader.loadMap(srcOrFile).then(mapImage => {
        if (mapImage) {
          filterRenderer.setMapImage(mapImage);
        }
      }).catch(error => {
        console.error('❌ [ENGINE] ImageLoader.loadMap failed:', error);
      });
    },

    async loadMapAndWait(srcOrFile: MapSource | null): Promise<void> {
      if (!srcOrFile) return;
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
      try { this.inlineDisplacementTextureForExport(); } catch {}
      return filterRenderer.renderToBytes();
    },

    async getThumbnailBytes(maxSide?: number): Promise<Uint8Array> {
      return filterRenderer.renderToThumbnailBytes(maxSide);
    },

    async getThumbnailDataUrl(maxSide?: number, cropFactor?: number): Promise<string> {
      return filterRenderer.renderToThumbnailDataUrl(maxSide, cropFactor);
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
        dissolveStrength: effectStateManager.getDissolveStrength(),
        grain: effectStateManager.getGrain(),
        grainSize: effectStateManager.getGrainSize(),
        reflectStrength: effectStateManager.getSettings().reflectStrength,
        reflectSoftness: effectStateManager.getSettings().reflectSoftness,
        reflectSharpness: effectStateManager.getSettings().reflectSharpness,
        reflectLightX: effectStateManager.getSettings().reflectLightX,
        reflectLightY: effectStateManager.getSettings().reflectLightY
      };
    },

    setSourceTextureFromPreview(previewTexture: string, width: number, height: number) {
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
      effectStateManager.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
      filterRenderer.updateImageDimensions(engineState.imageWidth, engineState.imageHeight);
      filterRenderer.redrawMap(effectStateManager.getSoft());
    },

    inlineDisplacementTextureForExport() {
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

    // Resource management
    dispose() {
      filterRenderer.dispose();
      imageLoader.clear();
      effectStateManager.clear();
    },

    // Utility functions
    bytesToDataUrl,
    createMirroredTexture
  };

  return api;
}

// Export type for backward compatibility
export type DisplacementEngine = DisplacementEngineAPI;

// Re-export types for external use
export type { DisplacementEngineAPI } from './types';
