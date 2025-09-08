/**
 * Image Loader - Asset Management System
 * 
 * Manages loading and processing of source images and displacement maps from various sources
 * (bytes, files, URLs). This module handles the complex task of preparing images for the
 * displacement effect pipeline while preventing race conditions and memory leaks.
 * 
 * Key features:
 * - Multi-source image loading (Uint8Array, File objects, URLs, HTMLImageElement)
 * - Automatic mirrored texture generation for seamless edge handling
 * - Dynamic SVG filter region calculation based on image dimensions
 * - Race condition protection for concurrent load operations
 * - Proper error handling and resource cleanup
 * 
 * The loader ensures that images are properly formatted and sized for optimal displacement
 * effect rendering while maintaining the original aspect ratios and quality.
 * 
 * @module ImageLoader
 */

import { processImageForPreview } from '../utils/image';
import { resolveResourceUrl } from '../utils/resource-resolver';
import { APP_CONFIG } from '../config/constants';
import { showSpinner } from '../utils/spinner';
import type { SVGElements, EngineState, MapSource, MultiLayerMapSource } from './types';

export class ImageLoader {
  // Store both original and preview textures for dual-mode rendering
  private originalMirroredDataUrl: string | null = null;
  
  // Race condition protection: unique identifier for current image
  private currentImageId: string | null = null;

  // Global cache for layer images to avoid re-downloading/re-decoding the same URL
  private static layerImageCache: Map<string, HTMLImageElement> = new Map();
  private static inflightLoads: Map<string, Promise<HTMLImageElement>> = new Map();
  
  /**
   * Evict oldest cached images if the cache grows beyond the configured limit.
   * Maintains Map insertion order as a simple LRU approximation (oldest first).
   */
  private static evictLayerCacheIfNeeded(): void {
    const maxSize = Math.max(0, APP_CONFIG.PERFORMANCE.IMAGE_CACHE_MAX_SIZE);
    if (maxSize === 0) {
      // Explicitly disable caching if configured as 0
      ImageLoader.layerImageCache.clear();
      return;
    }
    while (ImageLoader.layerImageCache.size > maxSize) {
      const oldestKey = ImageLoader.layerImageCache.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      ImageLoader.layerImageCache.delete(oldestKey);
    }
  }
  
  constructor(
    private svgElements: SVGElements,
    private engineState: EngineState
  ) {}

  /**
   * Clears both layer cache and inflight map (for hard resets or disposing).
   */
  static clearCaches(): void {
    ImageLoader.layerImageCache.clear();
    ImageLoader.inflightLoads.clear();
  }

  /**
   * Load an image with URL→Image cache and in-flight de-duplication.
   * Accepts string URL, File, or HTMLImageElement.
   * Automatically resolves resource:// URLs through ResourceManager.
   */
  private async loadImageWithCache(src: string | File | HTMLImageElement): Promise<HTMLImageElement> {
    // Direct image objects bypass cache; they are already decoded
    if (src instanceof HTMLImageElement) {
      return src;
    }

    // Resolve to URL/dataURL string
    let url: string;
    if (typeof src === 'string') {
      // Resolve resource:// URLs through ResourceManager
      url = await resolveResourceUrl(src);
    } else {
      // File object to data URL
      url = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(src as File);
      });
    }

    const key = url;
    const cached = ImageLoader.layerImageCache.get(key);
    if (cached) {
      // Refresh recency by moving this key to the end
      ImageLoader.layerImageCache.delete(key);
      ImageLoader.layerImageCache.set(key, cached);
      return cached;
    }

    const inflight = ImageLoader.inflightLoads.get(key);
    if (inflight) return inflight;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ImageLoader.inflightLoads.delete(key);
        // Move to the end (newest) by re-setting the key
        ImageLoader.layerImageCache.set(key, img);
        ImageLoader.evictLayerCacheIfNeeded();
        resolve(img);
      };
      img.onerror = () => {
        ImageLoader.inflightLoads.delete(key);
        reject(new Error('Failed to load image: ' + key));
      };
      img.src = url;
    });

    ImageLoader.inflightLoads.set(key, promise);
    return promise;
  }

  /**
   * Loads source image from bytes and sets up SVG
   * Uses preview-optimized textures for Live Preview performance
   * Stores original textures for final render quality
   */
  async loadSourceFromBytes(bytes: Uint8Array): Promise<void> {
    if (!bytes || bytes.length === 0) {
      throw new Error('No image data provided');
    }

    // Get preview container for spinner
    const previewContainer = document.getElementById('preview');
    if (!previewContainer) {
      throw new Error('Preview container not found');
    }

    // Generate unique ID for race condition protection
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentImageId = imageId;

    // Show loading spinner
    const cleanup = showSpinner(previewContainer, {
      text: 'Processing image...',
      size: 'medium'
    });

    try {
      // Get both original and preview-optimized versions
      const result = await processImageForPreview(bytes);
      
      // Race condition check: ensure this is still the current image
      if (this.currentImageId !== imageId) {
        // Another image was loaded while this one was processing
        return;
      }
      
      // Create image to get original dimensions (originalDataUrl contains true dimensions)
      const originalImg = await this.createImageFromDataUrl(result.originalDataUrl);
      
      // Final race condition check before applying changes
      if (this.currentImageId !== imageId) {
        return;
      }
      
      // Store original dimensions for SVG setup and effect calculations
      const originalWidth = originalImg.width;
      const originalHeight = originalImg.height;
      
      // Calculate dynamic filter margin based on original image size
      const dynamicFilterMargin = Math.round(Math.max(originalWidth, originalHeight) * this.engineState.filterMarginPercent / 100);
      
      // Store original mirrored texture for final render
      this.originalMirroredDataUrl = result.originalMirroredDataUrl;
      
      // Use preview-optimized mirrored texture for Live Preview performance
      const previewMirroredDataUrl = result.previewMirroredDataUrl;

      // Set the source image in the filter to the PREVIEW mirrored data URL
      this.svgElements.feSourceImg.setAttribute("href", previewMirroredDataUrl);
      // Set feImage position to account for the padding
      this.svgElements.feSourceImg.setAttribute('x', String(-dynamicFilterMargin));
      this.svgElements.feSourceImg.setAttribute('y', String(-dynamicFilterMargin));
      
      // CRITICAL: Use original dimensions for engine state and SVG setup
      // This ensures effect calculations are based on original image size
      this.engineState.imageWidth = originalWidth;
      this.engineState.imageHeight = originalHeight;
      
      // Update viewBox to match original image dimensions
      this.svgElements.svg.setAttribute("viewBox", `0 0 ${originalWidth} ${originalHeight}`);

      // Expand the filter region to prevent edge clamping (based on original size)
      this.svgElements.filterEl.setAttribute('x', String(-dynamicFilterMargin));
      this.svgElements.filterEl.setAttribute('y', String(-dynamicFilterMargin));
      this.svgElements.filterEl.setAttribute('width', String(originalWidth + dynamicFilterMargin * 2));
      this.svgElements.filterEl.setAttribute('height', String(originalHeight + dynamicFilterMargin * 2));
      
      const canvasW = originalWidth + dynamicFilterMargin * 2;
      const canvasH = originalHeight + dynamicFilterMargin * 2;
      this.svgElements.feSourceImg.setAttribute("width", String(canvasW));
      this.svgElements.feSourceImg.setAttribute("height", String(canvasH));

      // Update source image dimensions (original size)
      this.svgElements.outputRect.setAttribute("width", String(originalWidth));
      this.svgElements.outputRect.setAttribute("height", String(originalHeight));
      
      // Update mask dimensions to match original image
      this.svgElements.maskRect.setAttribute("width", String(originalWidth));
      this.svgElements.maskRect.setAttribute("height", String(originalHeight));
      
      // Log optimization status
      if (console.info) {
        if (result.isOptimized) {
          console.info(`Live Preview optimized: using ${result.previewDataUrl.length < result.originalDataUrl.length ? 'smaller' : 'optimized'} textures, preserving ${originalWidth}x${originalHeight} calculations`);
        } else {
          console.info(`No optimization needed: image ${originalWidth}x${originalHeight} fits preview bounds`);
        }
      }
      
    } catch (error) {
      console.error('Error in loadSourceFromBytes:', error);
      throw error;
    } finally {
      // Always cleanup spinner
      cleanup();
    }
  }

  /**
   * Loads displacement map from various sources
   */
  async loadMap(srcOrFile: MapSource): Promise<HTMLImageElement | null> {
    if (!srcOrFile) return null;
    
    // General multi-layer source
    if (typeof srcOrFile === 'object' && srcOrFile !== null && (srcOrFile as MultiLayerMapSource).layers) {
      const multi = srcOrFile as MultiLayerMapSource;
      // Compute a stable key for this multi-layer request to guard against races
      const key = 'multi:' + multi.layers.map((spec) => {
        const s = spec.src as any;
        if (typeof s === 'string') return s;
        if (s instanceof HTMLImageElement) return s.src || '[img]';
        if (s && typeof s.name === 'string') return `file:${s.name}`;
        return '[unknown]';
      }).join('|');
      this.engineState.currentMapLoadingUrl = key;

      const images = await Promise.all(multi.layers.map(l => this.loadImageWithCache(l.src)));

      // Race guard: if another map was requested while we were loading, drop this result
      if (this.engineState.currentMapLoadingUrl !== key) {
        return this.engineState.mapImage; // do not mutate state
      }

      this.engineState.layerImages = images.map((image, i) => {
        const spec = multi.layers[i];
        return {
          image,
          tiling: spec.tiling,
          scale: spec.scale,
          scaleMode: spec.scaleMode,
          opacity: typeof spec.opacity === 'number' ? spec.opacity : 1,
          blendMode: spec.blendMode || 'source-over',
          alignX: spec.alignX,
          alignY: spec.alignY,
          offsetX: spec.offsetX,
          offsetY: spec.offsetY
        };
      });
      // Back-compat: set first image as mapImage
      this.engineState.mapImage = this.engineState.layerImages[0]?.image || null;
      this.engineState.currentMapLoadingUrl = null;
      return this.engineState.mapImage;
    }

    // Legacy composite map source removed — rely on MultiLayerMapSource

    // Handle pre-loaded image objects directly (normalize to single-layer)
    if (srcOrFile instanceof HTMLImageElement) {
      this.engineState.layerImages = [
        {
          image: srcOrFile,
          tiling: 'tiled',
          opacity: 1,
          blendMode: 'source-over'
        }
      ];
      this.engineState.mapImage = srcOrFile; // optional back-compat, not used by renderer path
      this.engineState.currentMapLoadingUrl = srcOrFile.src;
      return srcOrFile;
    }
    
    // Handle string URLs or File objects (composite and HTMLImageElement cases were handled above)
    let urlPromise: Promise<string>;
    if (typeof srcOrFile === 'string') {
      urlPromise = Promise.resolve(srcOrFile);
    } else {
      const file = srcOrFile as File; // narrowed by guards above
      urlPromise = new Promise<string>(res => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(file);
      });
    }
    
    return urlPromise.then(async (url) => {
      // If the image is already present and same URL, reuse immediately
      if (this.engineState.mapImage?.src === url) {
        return this.engineState.mapImage;
      }

      this.engineState.currentMapLoadingUrl = url;
      try {
        const img = await this.loadImageWithCache(url);
        if (this.engineState.currentMapLoadingUrl !== url) {
          return null; // superseded by a newer request
        }
        // Normalize to single-layer
        this.engineState.layerImages = [
          {
            image: img,
            tiling: 'tiled',
            opacity: 1,
            blendMode: 'source-over'
          }
        ];
        this.engineState.mapImage = img; // optional back-compat
        return img;
      } catch (e) {
        if (this.engineState.currentMapLoadingUrl === url) {
          this.engineState.mapImage = null;
          this.engineState.currentMapLoadingUrl = null;
        }
        throw e;
      }
    });
  }

  /**
   * Clears current images and resets to initial state
   */
  clear(): void {
    // Clear source image
    if (this.svgElements.feSourceImg) {
      this.svgElements.feSourceImg.setAttribute('href', '');
    }
    
    // Reset viewbox to initial state
    if (this.svgElements.svg) {
      this.svgElements.svg.setAttribute('viewBox', `0 0 ${this.engineState.initialSize} ${this.engineState.initialSize}`);
    }
    
    // Reset dimensions to initial
    if (this.svgElements.outputRect) {
      this.svgElements.outputRect.setAttribute('width', String(this.engineState.initialSize));
      this.svgElements.outputRect.setAttribute('height', String(this.engineState.initialSize));
    }
    
    if (this.svgElements.maskRect) {
      this.svgElements.maskRect.setAttribute('width', String(this.engineState.initialSize));
      this.svgElements.maskRect.setAttribute('height', String(this.engineState.initialSize));
    }

    // Reset engine state
    this.engineState.imageWidth = this.engineState.initialSize;
    this.engineState.imageHeight = this.engineState.initialSize;
    this.engineState.mapImage = null;
    this.engineState.currentMapLoadingUrl = null;
    
    // Clear texture data and image ID
    this.originalMirroredDataUrl = null;
    this.currentImageId = null;
  }

  /**
   * Gets current map image
   */
  getCurrentMap(): HTMLImageElement | null {
    return this.engineState.mapImage;
  }

  /**
   * Gets current image dimensions
   */
  getCurrentImageDimensions(): { width: number; height: number } {
    return {
      width: this.engineState.imageWidth,
      height: this.engineState.imageHeight
    };
  }

  /**
   * Get original mirrored texture for final render (high quality)
   */
  getOriginalMirroredTexture(): string | null {
    return this.originalMirroredDataUrl;
  }

  /**
   * Get current image ID for race condition protection
   */
  getCurrentImageId(): string | null {
    return this.currentImageId;
  }

  /**
   * Get texture snapshot for safe swapping during final render
   */
  getTextureSnapshot(): { originalTexture: string | null, previewTexture: string | null, imageId: string | null } {
    return {
      originalTexture: this.originalMirroredDataUrl,
      previewTexture: this.svgElements.feSourceImg.getAttribute('href'),
      imageId: this.currentImageId
    };
  }

  /**
   * Helper method to create Image from data URL with Promise
   */
  private createImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image from data URL'));
      img.src = dataUrl;
    });
  }

  /**
   * Prefetch a set of layer specs (or generic sources) into the cache.
   * Does not mutate engine state.
   */
  async prefetch(sources: Array<string | File | HTMLImageElement>): Promise<void> {
    const tasks: Promise<any>[] = [];
    for (const src of sources) {
      // Skip direct images (already decoded)
      if (src instanceof HTMLImageElement) continue;
      tasks.push(this.loadImageWithCache(src).catch(() => {}));
    }
    await Promise.all(tasks);
  }
} 