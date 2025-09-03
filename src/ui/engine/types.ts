/**
 * Displacement Engine - Type Definitions
 * 
 * This file centralizes all TypeScript interfaces and types used throughout the displacement
 * engine system. It serves as the single source of truth for data structures, ensuring
 * type safety and consistent contracts between all engine modules.
 * 
 * Key type categories:
 * - Effect Settings: Configuration for visual effects (strength, blur, chromatic aberration)
 * - Engine State: Internal state management for images, dimensions, and current operations
 * - DOM References: Typed references to SVG elements and Canvas resources
 * - Public API: Complete interface definition for the engine's public methods
 * 
 * Centralizing types here prevents circular dependencies and makes the system easier 
 * to understand and modify.
 * 
 * @module EngineTypes
 */

// Types for the displacement engine modules

export interface EffectSettings {
  strength: number;
  chromaticAberration: number;
  blur: number;
  soft: number;
  scale: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface SVGElements {
  svg: SVGSVGElement;
  filterEl: SVGFilterElement;
  feImg: SVGImageElement;
  feSourceImg: SVGImageElement;
  feDispMapR: SVGFEDisplacementMapElement;
  feDispMapG: SVGFEDisplacementMapElement;
  feDispMapB: SVGFEDisplacementMapElement;
  feDispMapDissolve: SVGFEDisplacementMapElement;
  feGaussianBlur: SVGFEGaussianBlurElement;
  feMapGaussianBlur: SVGFEGaussianBlurElement;
  outputRect: SVGRectElement;
  maskRect: SVGRectElement;
  noiseTexture: SVGImageElement;
}

export interface CanvasResources {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tempCanvas: HTMLCanvasElement;
  tempCtx: CanvasRenderingContext2D;
  renderCanvas: HTMLCanvasElement;
  renderCtx: CanvasRenderingContext2D;
  
  // Object pool for performance optimization (optional for backward compatibility)
  objectPool?: ObjectPool;
}

// Object pooling for performance optimization
export interface ObjectPool {
  xmlSerializers: XMLSerializer[];
  fileReaders: FileReader[];
  images: HTMLImageElement[];
  
  // Pool management methods
  getXMLSerializer(): XMLSerializer;
  returnXMLSerializer(serializer: XMLSerializer): void;
  getFileReader(): FileReader;
  returnFileReader(reader: FileReader): void;
  getImage(): HTMLImageElement;
  returnImage(image: HTMLImageElement): void;
  
  // Cleanup
  clear(): void;
}

export interface EngineState {
  imageWidth: number;
  imageHeight: number;
  mapImage: HTMLImageElement | null;
  /**
   * Generalized multi-layer support: ordered list of layers to render into a single
   * displacement texture. When present, renderer will use these instead of mapImage/overlay.
   */
  layerImages?: Array<{
    image: HTMLImageElement;
    tiling: 'tiled' | 'stretched';
    scale?: number; // percent (if undefined, falls back to global scalePct)
    scaleMode?: 'uniform' | 'xOnly' | 'yOnly';
    opacity?: number; // 0..1
    blendMode?: GlobalCompositeOperation;
    alignX?: 'left' | 'center' | 'right';
    alignY?: 'top' | 'center' | 'bottom';
    offsetX?: number; // px
    offsetY?: number; // px
  }>;
  scalePct: number;
  // Removed: global scaleMode (use per-layer on layerImages)
  // scaleMode?: 'uniform' | 'xOnly' | 'yOnly';
  currentMapLoadingUrl: string | null;
  effectSettings: EffectSettings;
  filterMarginPercent: number;
  initialSize: number;
  /** Per-engine preview max side for internal downscale (replaces global APP_CONFIG.CNV_MAX mutation) */
  previewMax: number;
}

export interface DisplacementEngineAPI {
  // Core methods
  clear(): void;
  
  // Effect settings
  setStrength(val: number): void;
  setScale(val: number): void;
  setScaleMode(mode: 'uniform' | 'xOnly' | 'yOnly'): void;
  setChromaticAberration(val: number): void;
  setBlur(val: number): void;
  setSoft(val: number): void;
  setDissolveStrength(val: number): void;
  
  // Batch rendering control
  setBatchMode(enabled: boolean): void;
  triggerBatchUpdate(): void;
  
  // Image operations
  loadSourceFromBytes(bytes: Uint8Array): Promise<void>;
  loadMap(srcOrFile: MapSource | null): void;
  loadMapAndWait(srcOrFile: MapSource | null): Promise<void>;
  getImageBytes(): Promise<Uint8Array>;
  /**
   * Renders a low-resolution raster of the current effect for thumbnails.
   * Uses fixed small output size and DPR=1 for speed.
   */
  getThumbnailBytes(maxSide?: number): Promise<Uint8Array>;
  
  // Reflect effect operations
  setReflectOpacity(opacity: number): void;
  setReflectSharpness(sharpness: number): void;
  destroyReflectEffect(): void;
  
  // Resource management
  dispose(): void;

  // Export
  exportSVGCode(): {
    code: string;
    settings: {
      strength: number;
      chromaticAberration: number;
      blur: number;
      soft: number;
      dissolveStrength: string;
      displacementMapUrl: string;
    };
  };
  
  // Utility functions
  bytesToDataUrl: typeof import('../utils/image').bytesToDataUrl;
  createMirroredTexture: typeof import('../utils/image').createMirroredTexture;

  // Thumbnail/preview helpers
  /**
   * Snapshot of current textures for safe use in background/thumbnail rendering
   */
  getTextureSnapshot(): { originalTexture: string | null; previewTexture: string | null; imageId: string | null };

  /**
   * Current image dimensions used by the engine
   */
  getImageDimensions(): { width: number; height: number };

  /**
   * Current effect settings (used for consistent thumbnail rendering)
   */
  getCurrentEffectSettings(): {
    strength: number;
    chromaticAberration: number;
    blur: number;
    soft: number;
    scale: number;
    dissolveStrength: string;
  };

  /**
   * Injects a preview texture (data URL) into the engine and updates internal dimensions.
   * Used for lightweight thumbnail engines that mirror the main preview state.
   */
  setSourceTextureFromPreview(previewTexture: string, width: number, height: number): void;

  /**
   * Forces an immediate redraw using current state, bypassing debounce/batch guards.
   */
  forceRedraw(): void;

  /**
   * Replaces displacement feImage href with an inline data URL to ensure filters
   * resolve correctly when serializing SVG to PNG (avoids blob URL issues).
   */
  inlineDisplacementTextureForExport(): void;

  /**
   * Prefetch one or more map sources into the internal image cache without
   * changing current engine state or triggering renders.
   */
  prefetchMapSources(mapSources: MapSource[]): Promise<void>;
}

export interface DisplacementEngineInitOptions {
  /**
   * Disable optional reflect effect to improve performance for thumbnails
   */
  enableReflectEffect?: boolean;
  /**
   * Override maximum canvas size used internally for preview rendering
   */
  cnvMax?: number;
  /**
   * Override filter margin percent (edge handling) — lower for thumbnails
   */
  filterMarginPercent?: number;
}

/**
 * Composite map source definition. When provided, the engine will render
 * layer1 (tiled/scaled) and then draw layer2 stretched to the full canvas,
 * producing a single displacement map texture.
 */
// Legacy CompositeMapSource removed in favor of MultiLayerMapSource

export interface LayerSpec {
  src: string | File | HTMLImageElement;
  tiling: 'tiled' | 'stretched';
  scale?: number; // percent
  scaleMode?: 'uniform' | 'xOnly' | 'yOnly';
  opacity?: number; // 0..1
  blendMode?: GlobalCompositeOperation;
  alignX?: 'left' | 'center' | 'right';
  alignY?: 'top' | 'center' | 'bottom';
  offsetX?: number; // px
  offsetY?: number; // px
}

export interface MultiLayerMapSource {
  layers: LayerSpec[];
}

export type MapSource = string | File | HTMLImageElement | MultiLayerMapSource;  