/**
 * Filter Renderer - Canvas Operations Engine
 * 
 * Handles all Canvas-based operations for rendering displacement maps and generating final
 * output images. This high-performance module optimizes texture tiling, applies real-time
 * blur effects, and manages multiple canvas resources to prevent memory leaks.
 * 
 * Core capabilities:
 * - Efficient texture tiling with viewport culling
 * - Real-time soft blur application to displacement maps
 * - Debounced updates for smooth user interaction
 * - SVG-to-PNG conversion for Figma export
 * - Canvas resource pooling and reuse
 * 
 * Quality Improvements (v2.0):
 * - Consistent image smoothing settings between preview and final render
 * - High-DPI display support with devicePixelRatio scaling
 * - Configurable quality settings via APP_CONFIG.QUALITY
 * - Size limiting to prevent Figma "Image is too large" errors
 * 
 * The renderer uses optimized drawing techniques and includes hooks for future effects
 * techniques to maintain 60fps performance even with complex displacement operations.
 * 
 * @module FilterRenderer
 */

import { APP_CONFIG } from '../config/constants';
import { debounce } from '../utils/debounce';
import type { SVGElements, EngineState, CanvasResources, ObjectPool } from './types';
import type { ImageLoader } from './ImageLoader';

/**
 * Object Pool Implementation for Performance Optimization
 * Reuses XMLSerializer, FileReader, and Image objects to reduce garbage collection
 */
class RenderObjectPool implements ObjectPool {
  xmlSerializers: XMLSerializer[] = [];
  fileReaders: FileReader[] = [];
  images: HTMLImageElement[] = [];

  constructor() {
    if (APP_CONFIG.PERFORMANCE.ENABLE_OBJECT_POOLING) {
      this.initializePools();
    }
  }

  private initializePools(): void {
    // Pre-allocate XMLSerializers
    for (let i = 0; i < APP_CONFIG.PERFORMANCE.XML_SERIALIZER_POOL_SIZE; i++) {
      this.xmlSerializers.push(new XMLSerializer());
    }
    
    // Pre-allocate FileReaders
    for (let i = 0; i < APP_CONFIG.PERFORMANCE.FILE_READER_POOL_SIZE; i++) {
      this.fileReaders.push(new FileReader());
    }
    
    // Pre-allocate Images
    for (let i = 0; i < APP_CONFIG.PERFORMANCE.IMAGE_POOL_SIZE; i++) {
      this.images.push(new Image());
    }
  }

  getXMLSerializer(): XMLSerializer {
    return this.xmlSerializers.pop() || new XMLSerializer();
  }

  returnXMLSerializer(serializer: XMLSerializer): void {
    if (this.xmlSerializers.length < APP_CONFIG.PERFORMANCE.XML_SERIALIZER_POOL_SIZE) {
      this.xmlSerializers.push(serializer);
    }
  }

  getFileReader(): FileReader {
    const reader = this.fileReaders.pop() || new FileReader();
    // Reset any previous event handlers
    reader.onload = null;
    reader.onerror = null;
    reader.onabort = null;
    return reader;
  }

  returnFileReader(reader: FileReader): void {
    if (this.fileReaders.length < APP_CONFIG.PERFORMANCE.FILE_READER_POOL_SIZE) {
      // Clear event handlers before returning to pool
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
      this.fileReaders.push(reader);
    }
  }

  getImage(): HTMLImageElement {
    const image = this.images.pop() || new Image();
    // Reset any previous event handlers and properties
    image.onload = null;
    image.onerror = null;
    image.src = '';
    image.crossOrigin = null;
    return image;
  }

  returnImage(image: HTMLImageElement): void {
    if (this.images.length < APP_CONFIG.PERFORMANCE.IMAGE_POOL_SIZE) {
      // Clear event handlers and properties before returning to pool
      image.onload = null;
      image.onerror = null;
      image.src = '';
      image.crossOrigin = null;
      this.images.push(image);
    }
  }

  clear(): void {
    this.xmlSerializers.length = 0;
    this.fileReaders.length = 0;
    this.images.length = 0;
  }
}

export class FilterRenderer {
  // Canvas resource management
  private canvasResources: CanvasResources;
  private debouncedUpdate: () => void;

  // Performance optimization state (removed unused caches)
  
  // Batch rendering control
  private isBatchMode = false;

  // Interaction state for progressive rendering
  private isInteracting = false;
  
  
  // Performance optimization: cache expensive calculations
  private cachedBaseScale: number = 1;
  private cachedImageMaxDimension: number = 0;
  private cachedMapMaxDimension: number = 0;
  
  // Track last generated object URL to revoke and avoid memory leaks
  private lastTextureObjectUrl: string | null = null;
  
  // Guard against race conditions from async canvas.toBlob callbacks
  private renderGeneration: number = 0;
  
  // Flag to prevent updates during export
  private isExporting = false;
  private pendingUpdateDuringExport = false;
  
  constructor(
    private svgElements: SVGElements,
    private engineState: EngineState,
    _reflectEffect: unknown, // Placeholder for future implementation
    private imageLoader: ImageLoader | null,  // Added for original texture access
    updateCallback: () => void
  ) {
    this.canvasResources = this.initializeCanvasResources();
    this.debouncedUpdate = debounce(updateCallback, APP_CONFIG.DEBOUNCE_DELAY);
  }

  private initializeCanvasResources(): CanvasResources {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = APP_CONFIG.QUALITY.IMAGE_SMOOTHING_ENABLED;
    if (ctx.imageSmoothingEnabled) {
      (ctx as any).imageSmoothingQuality = 'high';
    }
    
    // Reusable temp canvas for blur operations to prevent memory leaks
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.imageSmoothingEnabled = APP_CONFIG.QUALITY.IMAGE_SMOOTHING_ENABLED;
    if (tempCtx.imageSmoothingEnabled) {
      (tempCtx as any).imageSmoothingQuality = 'high';
    }
    
    // Reusable render canvas for getImageBytes optimization
    const renderCanvas = document.createElement("canvas");
    const renderCtx = renderCanvas.getContext("2d")!;
    renderCtx.imageSmoothingEnabled = APP_CONFIG.QUALITY.IMAGE_SMOOTHING_ENABLED;
    if (renderCtx.imageSmoothingEnabled) {
      (renderCtx as any).imageSmoothingQuality = 'high';
    }

    // Initialize object pool for performance optimization
    const objectPool = APP_CONFIG.PERFORMANCE.ENABLE_OBJECT_POOLING ? new RenderObjectPool() : undefined;

    return {
      canvas,
      ctx,
      tempCanvas,
      tempCtx,
      renderCanvas,
      renderCtx,
      objectPool
    };
  }

  /**
   * Draws tiled displacement map on canvas
   */
  private drawTiledMap(
    targetCtx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    map: HTMLImageElement,
    mapScale: number,
    scaleMode: 'uniform' | 'xOnly' | 'yOnly' = 'uniform',
    alignX: 'left' | 'center' | 'right' = 'left',
    alignY: 'top' | 'center' | 'bottom' = 'top',
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    // Compute tile size with non-uniform scaling support
    let w = Math.max(1, map.width * mapScale);
    let h = Math.max(1, map.height * mapScale);
    const mode = scaleMode || 'uniform';
    if (mode === 'xOnly') {
      // Scale only X; fill Y to 100%
      h = Math.max(1, canvasH);
    } else if (mode === 'yOnly') {
      // Scale only Y; fill X to 100%
      w = Math.max(1, canvasW);
    }

    // Skip drawing if canvas is too small
    if (canvasW <= 0 || canvasH <= 0) return;

    // Compute origin based on alignment
    let originX = 0;
    let originY = 0;
    if (alignX === 'center') {
      originX = Math.floor((canvasW - w) / 2);
    } else if (alignX === 'right') {
      originX = canvasW - w;
    }
    if (alignY === 'center') {
      originY = Math.floor((canvasH - h) / 2);
    } else if (alignY === 'bottom') {
      originY = canvasH - h;
    }
    originX += offsetX;
    originY += offsetY;

    // Compute start indices so that first tile covers origin properly
    const startI = Math.floor((0 - originX) / w) - 1;
    const startJ = Math.floor((0 - originY) / h) - 1;
    const endI = Math.ceil((canvasW - originX) / w) + 1;
    const endJ = Math.ceil((canvasH - originY) / h) + 1;

    for (let i = startI; i <= endI; i++) {
      for (let j = startJ; j <= endJ; j++) {
        const x = originX + i * w;
        const y = originY + j * h;
        
        // Optimization: skip tiles that are completely outside visible area
        if (x > canvasW || y > canvasH) continue;
        if (x + w < 0 || y + h < 0) continue;
        
        targetCtx.drawImage(map, x, y, w, h);
      }
    }
  }

  /** Draw one layer according to its tiling/scaling/blend settings */
  private drawLayer(
    targetCtx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    image: HTMLImageElement,
    tiling: 'tiled' | 'stretched',
    scalePct: number,
    scaleMode: 'uniform' | 'xOnly' | 'yOnly',
    opacity: number = 1,
    blendMode: GlobalCompositeOperation = 'source-over',
    alignX: 'left' | 'center' | 'right' = 'left',
    alignY: 'top' | 'center' | 'bottom' = 'top',
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    targetCtx.save();
    targetCtx.globalAlpha = Math.max(0, Math.min(1, opacity));
    targetCtx.globalCompositeOperation = blendMode;
    if (tiling === 'tiled') {
      // Compute scale based on cachedBaseScale
      const mapScale = (scalePct * 0.01) * this.cachedBaseScale;
      this.drawTiledMap(targetCtx, canvasW, canvasH, image, mapScale, scaleMode, alignX, alignY, offsetX, offsetY);
    } else {
      // stretched
      // For stretched, alignment/offset can shift the image before stretching via translate
      if (offsetX !== 0 || offsetY !== 0) {
        targetCtx.translate(offsetX, offsetY);
      }
      targetCtx.drawImage(image, 0, 0, canvasW, canvasH);
    }
    targetCtx.restore();
  }

  /**
   * Updates cached scale calculations when image or map changes
   * Call this when setMapImage or image dimensions change
   */
  private updateScaleCache(): void {
    const { mapImage, imageWidth, imageHeight, layerImages } = this.engineState;
    const referenceImage = (layerImages && layerImages.length > 0) ? layerImages[0].image : mapImage;

    if (referenceImage) {
      this.cachedImageMaxDimension = Math.max(imageWidth, imageHeight);
      this.cachedMapMaxDimension = Math.max(referenceImage.width, referenceImage.height);
      this.cachedBaseScale = this.cachedImageMaxDimension / this.cachedMapMaxDimension;
    } else {
      this.cachedImageMaxDimension = Math.max(imageWidth, imageHeight) || 1;
      this.cachedMapMaxDimension = 1;
      this.cachedBaseScale = 1;
    }
  }

  /**
   * Sets interaction state to enable/disable progressive rendering optimization
   */
  setInteractionState(active: boolean): void {
    this.isInteracting = active;
  }

  /**
   * Redraws the displacement map with current settings (OPTIMIZED)
   */
  redrawMap(softValue: number): void {
    // Block updates during export to prevent race conditions
    if (this.isExporting) {
      this.pendingUpdateDuringExport = true;
      return;
    }

    // In Multilayer mode we may not rely on mapImage; allow layerImages path to run
    // We also proceed if NO map is present, to ensure feImg dimensions are updated to match the viewBox.
    // This prevents "corner" artifacts where the previous map texture (with small dimensions) 
    // is applied to a new large image before the new map loads.
    const hasMap = !!this.engineState.mapImage || (!!this.engineState.layerImages && this.engineState.layerImages.length > 0);
    
    // Increment render generation to invalidate older async callbacks
    const myGeneration = ++this.renderGeneration;

    const { svg } = this.svgElements;
    const { canvas, ctx } = this.canvasResources;
    const { mapImage, scalePct, textureScale } = this.engineState;
    
    const vb = svg.viewBox.baseVal;

    // Use a per-engine down-scaled version for performance (keep feImage sized to viewBox).
    // ratio must be consistently applied in BOTH single-map and multi-layer paths
    const maxRatio = Math.min(1, this.engineState.previewMax / Math.max(vb.width, vb.height));
    
    // PROGRESSIVE RENDERING:
    // Instead of resizing the canvas (which clears it and causes flickering),
    // we always keep the canvas at the "high quality" size (maxRatio).
    // During interaction, we can optionally simplify what we draw, but we DON'T change canvas dimensions.
    
    // Calculate base canvas dimensions
    const baseCnvW = Math.max(1, Math.round(vb.width * maxRatio));
    const baseCnvH = Math.max(1, Math.round(vb.height * maxRatio));
    
    // Apply devicePixelRatio for Retina/high-DPI displays if enabled
    let dpr = 1;
    if (APP_CONFIG.QUALITY.USE_DEVICE_PIXEL_RATIO && typeof window !== 'undefined' && window.devicePixelRatio) {
      dpr = Math.max(
        APP_CONFIG.QUALITY.DPR_MIN_BOUND,
        Math.min(APP_CONFIG.QUALITY.DPR_MAX_BOUND, window.devicePixelRatio)
      );
    }
    
    const cnvW = Math.max(1, Math.round(baseCnvW * dpr));
    const cnvH = Math.max(1, Math.round(baseCnvH * dpr));
    
    // Only resize if dimensions actually changed (e.g. image load), not for progressive downscaling
    if (canvas.width !== cnvW || canvas.height !== cnvH) {
      canvas.width = cnvW;
      canvas.height = cnvH;
    }
    
    // Reset transform accounting for DPR scaling (always set, even if DPR=1, to ensure clean state)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, baseCnvW, baseCnvH);

    // Effective ratio for drawing calculations
    // If interacting, we could logically simulate lower res, but since we kept canvas large,
    // we just draw at full resolution. The bottleneck was likely the resize-thrashing.
    // If performance is still an issue, we can skip some heavy operations here.
    const drawRatio = maxRatio;

    // Use cached base scale instead of recalculating Math.max every time
    const scaleForPreview = (scalePct * textureScale * 0.01) * drawRatio * this.cachedBaseScale; // 0.01 instead of /100

    // Unified path: always use layerImages if present (single or multiple)
    // Use base dimensions for drawing (DPR scaling is handled by transform)
    if (this.engineState.layerImages && this.engineState.layerImages.length > 0) {
      // Clear once before stacking layers
      // canvas is already cleared above
      for (const layer of this.engineState.layerImages) {
        // scaleMultiplier modifies how fast this layer responds to global scale slider
        const layerMultiplier = layer.scaleMultiplier ?? 1.0;
        this.drawLayer(
          ctx,
          baseCnvW,
          baseCnvH,
          layer.image,
          layer.tiling,
          // Apply ratio to percent scale so thumbnails (with smaller cnv) match Live Preview
          (this.engineState.scalePct * textureScale * layerMultiplier) * drawRatio,
          layer.scaleMode || 'uniform',
          layer.opacity,
          layer.blendMode,
          layer.alignX || 'left',
          layer.alignY || 'top',
          layer.offsetX || 0,
          layer.offsetY || 0
        );
      }
    } else {
      // Fallback for extreme edge cases: no layers were set
      if (mapImage) {
        this.drawTiledMap(ctx, baseCnvW, baseCnvH, mapImage, (this.engineState.scalePct * textureScale * 0.01) * drawRatio * this.cachedBaseScale);
      }
    }

    // Soft blur now handled via SVG feMapGaussianBlur; no canvas blur here

    // Prefer Blob URLs to reduce memory churn; fallback to dataURL if needed
    const applyTextureUrl = (url: string) => {
      this.svgElements.feImg.setAttribute("href", url);
      // Ensure feImg matches the SVG viewBox so preview and apply share the same coordinate system
      this.svgElements.feImg.setAttribute("width", String(vb.width));
      this.svgElements.feImg.setAttribute("height", String(vb.height));
    };

    // CHANGED: Use toDataURL (sync) for instant Live Preview updates
    // The previous async toBlob caused a noticeable delay between slider movement and visual update.
    // While sync operations can block the main thread, for the preview size (usually < 1000px),
    // modern JS engines handle this fast enough to perceive as "instant".
    
    // Revoke previous URL if it existed to clean up any lingering ObjectURLs
    if (this.lastTextureObjectUrl) {
      URL.revokeObjectURL(this.lastTextureObjectUrl);
      this.lastTextureObjectUrl = null;
    }
    
    const dataUrl = canvas.toDataURL('image/png');
    applyTextureUrl(dataUrl);
  }

  /**
   * Triggers debounced update
   */
  triggerUpdate(): void {
    // Skip updates during batch mode
    if (this.isBatchMode) {
      return;
    }
    
    // Defer updates during export
    if (this.isExporting) {
      this.pendingUpdateDuringExport = true;
      return;
    }
    
    this.debouncedUpdate();
  }

  /**
   * Sets batch mode state - when enabled, updates are deferred
   */
  setBatchMode(enabled: boolean): void {
    this.isBatchMode = enabled;
  }

  /**
   * Returns current batch mode state
   */
  isBatchModeEnabled(): boolean {
    return this.isBatchMode;
  }

  /**
   * Forces an immediate update regardless of batch mode (for final batch render)
   */
  triggerBatchUpdate(): void {
    // Force update even in batch mode
    this.debouncedUpdate();
  }

  /**
   * Renders SVG to bytes for export (OPTIMIZED VERSION)
   * Uses object pooling and async/await for better performance and maintainability
   */
  async renderToBytes(): Promise<Uint8Array> {
    this.isExporting = true;
    this.pendingUpdateDuringExport = false;
    
    const { svg } = this.svgElements;
    const { renderCanvas, renderCtx, objectPool } = this.canvasResources;
    
    const vb = svg.viewBox.baseVal;
    
    // Calculate output dimensions in 1:1 CSS pixels (ignore devicePixelRatio)
    // Clamp only by Figma absolute limit on the longest side
    const maxSafeSize = APP_CONFIG.QUALITY.FIGMA_ABSOLUTE_LIMIT;
    
    // FIXED: Proportional scaling to maintain aspect ratio
    const originalWidth = vb.width;
    const originalHeight = vb.height;
    // aspectRatio not used directly
    
    // Calculate scale factor to fit within limits while preserving aspect ratio
    const maxScale = Math.min(
      maxSafeSize / originalWidth,  // Scale limited by width
      maxSafeSize / originalHeight  // Scale limited by height
    );
    
    // Apply scale factor (clamp to max 1.0 to prevent upscaling)
    const scaleFactor = Math.min(maxScale, 1.0);
    const finalWidth = Math.max(1, Math.round(originalWidth * scaleFactor));
    const finalHeight = Math.max(1, Math.round(originalHeight * scaleFactor));
    
    // Setup canvas
    renderCanvas.width = finalWidth;
    renderCanvas.height = finalHeight;
    renderCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform matrix
    renderCtx.imageSmoothingEnabled = APP_CONFIG.QUALITY.IMAGE_SMOOTHING_ENABLED;
    if (renderCtx.imageSmoothingEnabled) {
      (renderCtx as any).imageSmoothingQuality = 'high';
    }
    renderCtx.clearRect(0, 0, finalWidth, finalHeight);

    // Get pooled objects or create new ones
    const xmlSerializer = objectPool?.getXMLSerializer() || new XMLSerializer();
    const image = objectPool?.getImage() || new Image();
    
    let svgUrl: string | null = null;
    
    // RACE CONDITION FIX: Get texture snapshot for safe swapping
    // We need to ensure the high-res texture is available before snapshotting
    let textureSnapshot = this.imageLoader?.getTextureSnapshot() || null;
    
    // If we are using the image loader and have a current image, ensure high-res texture is ready
    // This moves the 7s+ generation time to the Export click, not the selection time
    if (this.imageLoader && !textureSnapshot?.originalTexture && this.imageLoader.getCurrentImageId()) {
      await this.imageLoader.getOriginalMirroredTextureAsync();
      // Refresh snapshot after generation
      textureSnapshot = this.imageLoader.getTextureSnapshot();
    }

    let originalTextureSwapped = false;
    
    // Prepare a HIGH-RES displacement texture for export (do not reuse downscaled preview)
    // 1) Save current feImg href to restore later
    const originalFeImgHref = this.svgElements.feImg.getAttribute('href');
    
    // Async function to prepare high-res texture without blocking UI
    const prepareHighResFeImgForExport = async (): Promise<void> => {
      const { canvas, ctx } = this.canvasResources;
      const { mapImage } = this.engineState;
      
      // If there is no displacement map yet, fall back to existing preview texture
      if (!mapImage) {
        const fallbackUrl = await new Promise<string>((resolve) => {
          canvas.toBlob(blob => {
             if (blob) {
               const reader = new FileReader();
               reader.onload = () => resolve(reader.result as string);
               reader.readAsDataURL(blob);
             } else {
               resolve(canvas.toDataURL('image/png'));
             }
          });
        });
        this.svgElements.feImg.setAttribute('href', fallbackUrl);
        return;
      }
      
      // Unblock UI
      await new Promise(r => setTimeout(r, 0));

      // Render the tiled map at FULL SVG viewBox resolution (ratio = 1)
      const fullW = Math.max(1, vb.width);
      const fullH = Math.max(1, vb.height);
      canvas.width = fullW;
      canvas.height = fullH;
      ctx.clearRect(0, 0, fullW, fullH);
      
      // Compute scale using cachedBaseScale without preview ratio downscaling
      const scalePct = this.engineState.scalePct;
      const textureScale = this.engineState.textureScale;
      const scaleForExport = (scalePct * textureScale * 0.01) * this.cachedBaseScale;
      
      // Draw tiled map
      ctx.imageSmoothingEnabled = APP_CONFIG.QUALITY.IMAGE_SMOOTHING_ENABLED;
      if (ctx.imageSmoothingEnabled) {
        (ctx as any).imageSmoothingQuality = 'high';
      }
      
      // Optimization: Yield control if we have many layers or complex drawing
      if (this.engineState.layerImages && this.engineState.layerImages.length > 0) {
        for (const layer of this.engineState.layerImages) {
           // Yield every layer to keep UI responsive
           if (fullW > 2000 || fullH > 2000) {
             await new Promise(r => setTimeout(r, 0));
           }
           
          // scaleMultiplier modifies how fast this layer responds to global scale slider
          const layerMultiplier = layer.scaleMultiplier ?? 1.0;
          this.drawLayer(
            ctx,
            fullW,
            fullH,
            layer.image,
            layer.tiling,
            this.engineState.scalePct * textureScale * layerMultiplier,
            layer.scaleMode || 'uniform',
            layer.opacity,
            layer.blendMode,
            layer.alignX || 'left',
            layer.alignY || 'top',
            layer.offsetX || 0,
            layer.offsetY || 0
          );
        }
      } else {
        if (mapImage) {
          this.drawTiledMap(ctx, fullW, fullH, mapImage, scaleForExport);
        }
      }
      
      // Ensure feImg attributes match the full SVG space
      this.svgElements.feImg.setAttribute('width', String(fullW));
      this.svgElements.feImg.setAttribute('height', String(fullH));
      
      // Unblock UI before encoding
      await new Promise(r => setTimeout(r, 0));

      // Convert to Data URL asynchronously using Blob + FileReader
      // This avoids the massive main thread freeze of synchronous toDataURL on 4k+ images
      const dataUrl = await new Promise<string>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
             // Fallback to sync if blob fails
             resolve(canvas.toDataURL('image/png'));
             return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to encode export texture'));
          reader.readAsDataURL(blob);
        }, 'image/png');
      });

      this.svgElements.feImg.setAttribute('href', dataUrl);
    };

    try {
      // IMPORTANT: inline a high-res displacement texture so export is not limited by preview quality
      await prepareHighResFeImgForExport();
      
      // Unblock UI
      await new Promise(r => setTimeout(r, 0));

      // Optional: for strict visual parity, keep preview texture instead of swapping to original
      if (!APP_CONFIG.QUALITY.MATCH_PREVIEW_ON_EXPORT && this.imageLoader && textureSnapshot) {
        const { originalTexture, previewTexture, imageId } = textureSnapshot;
        if (originalTexture && previewTexture && originalTexture !== previewTexture) {
          const currentImageId = this.imageLoader.getCurrentImageId();
          if (currentImageId === imageId) {
            this.svgElements.feSourceImg.setAttribute('href', originalTexture);
            originalTextureSwapped = true;
            if (console.info && APP_CONFIG.LICENSE.DEV_MODE_ENABLED) {
              console.info('Final render: using original high-quality texture');
            }
          } else {
            if (console.info && APP_CONFIG.LICENSE.DEV_MODE_ENABLED) {
              console.info('Final render: skipping texture swap due to image change');
            }
          }
        }
      }
      
      // Unblock UI
      await new Promise(r => setTimeout(r, 0));
      
      // Serialize SVG to string
      const svgString = xmlSerializer.serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      svgUrl = URL.createObjectURL(svgBlob);
      
      // Load SVG as image
      await this.loadImageFromUrl(image, svgUrl);
      
      // Unblock UI
      await new Promise(r => setTimeout(r, 0));

      // Draw to canvas
      renderCtx.clearRect(0, 0, finalWidth, finalHeight); // Ensure clear
      renderCtx.drawImage(image, 0, 0, finalWidth, finalHeight);
      
      // Convert canvas to Uint8Array
      const imageBytes = await this.canvasToUint8Array(renderCanvas, objectPool);
      
      return imageBytes;
      
    } finally {
      this.isExporting = false;

      // Restore feImg href after export
      if (originalFeImgHref !== null) {
        this.svgElements.feImg.setAttribute('href', originalFeImgHref);
      }
      // CRITICAL: Restore preview texture for Live Preview
      if (originalTextureSwapped && textureSnapshot?.previewTexture) {
        this.svgElements.feSourceImg.setAttribute('href', textureSnapshot.previewTexture);
        if (console.info && APP_CONFIG.LICENSE.DEV_MODE_ENABLED) {
          console.info('Final render complete: restored preview texture for Live Preview');
        }
      }
      
      // Process any updates that were blocked during export
      if (this.pendingUpdateDuringExport) {
        // Use triggerUpdate to debounce, or forceRedraw if immediate update needed
        this.debouncedUpdate();
        this.pendingUpdateDuringExport = false;
      }
      
      // Cleanup: return objects to pool and revoke URL
      if (objectPool) {
        objectPool.returnXMLSerializer(xmlSerializer);
        objectPool.returnImage(image);
      }
      
      if (svgUrl && APP_CONFIG.PERFORMANCE.AUTO_CLEANUP_URLS) {
        URL.revokeObjectURL(svgUrl);
      }
      
      // Optional: Force garbage collection in development
      if (APP_CONFIG.PERFORMANCE.FORCE_GC_AFTER_RENDER && 'gc' in window) {
        (window as any).gc();
      }
    }
  }

  /**
   * Fast low-res render for thumbnails (fixed DPR=1 and small side)
   */
  async renderToThumbnailBytes(maxSide: number = 144): Promise<Uint8Array> {
    const { svg } = this.svgElements;
    const { renderCanvas, renderCtx, objectPool } = this.canvasResources;
    const vb = svg.viewBox.baseVal;
    const aspect = vb.width / Math.max(1, vb.height);
    const outW = Math.round(aspect >= 1 ? maxSide : maxSide * aspect);
    const outH = Math.round(aspect >= 1 ? maxSide / aspect : maxSide);
    renderCanvas.width = outW;
    renderCanvas.height = outH;
    renderCtx.setTransform(1, 0, 0, 1, 0, 0);
    renderCtx.imageSmoothingEnabled = true;

    const xmlSerializer = objectPool?.getXMLSerializer() || new XMLSerializer();
    const image = objectPool?.getImage() || new Image();

    // Ensure feImg is inline to avoid blob URL issues
    const savedFeImgHref = this.svgElements.feImg.getAttribute('href');
    const { canvas } = this.canvasResources;
    this.svgElements.feImg.setAttribute('href', canvas.toDataURL('image/png'));

    let svgUrl: string | null = null;
    try {
      const svgString = xmlSerializer.serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      svgUrl = URL.createObjectURL(svgBlob);
      await this.loadImageFromUrl(image, svgUrl);
      renderCtx.clearRect(0, 0, outW, outH);
      renderCtx.drawImage(image, 0, 0, outW, outH);
      return await this.canvasToUint8Array(renderCanvas, objectPool);
    } finally {
      if (savedFeImgHref !== null) this.svgElements.feImg.setAttribute('href', savedFeImgHref);
      if (objectPool) { objectPool.returnXMLSerializer(xmlSerializer); objectPool.returnImage(image); }
      if (svgUrl && APP_CONFIG.PERFORMANCE.AUTO_CLEANUP_URLS) {
        try { URL.revokeObjectURL(svgUrl); } catch {}
      }
    }
  }

  /**
   * Renders a thumbnail directly to a Data URL with internal cropping.
   * Eliminates multiple encode/decode steps (Canvas -> Blob -> Image -> Canvas -> Blob -> DataURL).
   */
  async renderToThumbnailDataUrl(maxSide: number = 144, cropFactor: number = 2.0): Promise<string> {
    const { svg } = this.svgElements;
    const { renderCanvas, renderCtx, objectPool } = this.canvasResources;
    const vb = svg.viewBox.baseVal;
    // Standard thumbnail logic: render fixed size then crop center
    const aspect = vb.width / Math.max(1, vb.height);
    const renderW = Math.round(aspect >= 1 ? maxSide * cropFactor : (maxSide * cropFactor) * aspect);
    const renderH = Math.round(aspect >= 1 ? (maxSide * cropFactor) / aspect : maxSide * cropFactor);
    
    // Setup intermediate canvas
    renderCanvas.width = renderW;
    renderCanvas.height = renderH;
    renderCtx.setTransform(1, 0, 0, 1, 0, 0);
    renderCtx.imageSmoothingEnabled = true;
    
    const xmlSerializer = objectPool?.getXMLSerializer() || new XMLSerializer();
    const image = objectPool?.getImage() || new Image();
    
    const savedFeImgHref = this.svgElements.feImg.getAttribute('href');
    const { canvas } = this.canvasResources;
    this.svgElements.feImg.setAttribute('href', canvas.toDataURL('image/png'));
    
    let svgUrl: string | null = null;
    try {
      const svgString = xmlSerializer.serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      svgUrl = URL.createObjectURL(svgBlob);
      await this.loadImageFromUrl(image, svgUrl);
      
      // Draw full image to canvas
      renderCtx.clearRect(0, 0, renderW, renderH);
      renderCtx.drawImage(image, 0, 0, renderW, renderH);
      
      // Create final cropped canvas
      const cropCanvas = objectPool ? document.createElement('canvas') : this.canvasResources.tempCanvas; 
      // Note: using tempCanvas might be risky if concurrent, but this is single-threaded mostly.
      // To be safe, create a new small canvas or reuse a specific 'cropCanvas' if we added one.
      // Let's just create one for now, it's cheap for small sizes.
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = maxSide;
      finalCanvas.height = maxSide;
      const finalCtx = finalCanvas.getContext('2d')!;
      finalCtx.imageSmoothingEnabled = true;
      // @ts-ignore
      if (finalCtx.imageSmoothingQuality) (finalCtx as any).imageSmoothingQuality = 'high';
      
      // Calculate center crop
      const cw = renderW / cropFactor; // = maxSide roughly, depending on aspect
      const ch = renderH / cropFactor;
      
      // We want to output exactly maxSide x maxSide
      // The input 'renderW/H' is scaled by cropFactor.
      // We want to take the center '1/cropFactor' portion of the image.
      
      // Correct logic matching the worker:
      // Source dimensions: renderW, renderH
      // Target dimensions: maxSide, maxSide
      // We want to simulate: Draw full image -> Crop center 1/cropFactor portion -> Scale to maxSide?
      // No, usually we render larger, then crop the center.
      
      // Worker logic:
      // srcW = img.width (renderW), srcH = img.height (renderH)
      // cw = srcW / cropFactor, ch = srcH / cropFactor
      // sx = (srcW - cw)/2, sy = (srcH - ch)/2
      // drawImage(img, sx, sy, cw, ch, 0, 0, size, size)
      
      const cw_src = renderW / cropFactor;
      const ch_src = renderH / cropFactor;
      const sx = Math.max(0, (renderW - cw_src) / 2);
      const sy = Math.max(0, (renderH - ch_src) / 2);
      
      finalCtx.drawImage(renderCanvas, sx, sy, cw_src, ch_src, 0, 0, maxSide, maxSide);
      
      return finalCanvas.toDataURL('image/png');
      
    } finally {
      if (savedFeImgHref !== null) this.svgElements.feImg.setAttribute('href', savedFeImgHref);
      if (objectPool) { objectPool.returnXMLSerializer(xmlSerializer); objectPool.returnImage(image); }
      if (svgUrl && APP_CONFIG.PERFORMANCE.AUTO_CLEANUP_URLS) {
        try { URL.revokeObjectURL(svgUrl); } catch {}
      }
    }
  }

  /**
   * Helper: Load image from URL with Promise wrapper
   */
  private loadImageFromUrl(image: HTMLImageElement, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = (err) => reject(new Error(`Failed to load SVG image: ${err}`));
      image.src = url;
    });
  }

  /**
   * Helper: Convert canvas to Uint8Array using pooled FileReader
   */
  private canvasToUint8Array(canvas: HTMLCanvasElement, objectPool?: ObjectPool): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob from canvas"));
          return;
        }
        
        const reader = objectPool?.getFileReader() || new FileReader();
        
        reader.onload = () => {
          const result = new Uint8Array(reader.result as ArrayBuffer);
          
          // Return reader to pool
          if (objectPool) {
            objectPool.returnFileReader(reader);
          }
          
          resolve(result);
        };
        
        reader.onerror = () => {
          // Return reader to pool even on error
          if (objectPool) {
            objectPool.returnFileReader(reader);
          }
          reject(new Error("Failed to read blob"));
        };
        
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  }

  /**
   * Sets new map image and triggers redraw
   */
  setMapImage(mapImage: HTMLImageElement | null): void {
    this.engineState.mapImage = mapImage;
    if (mapImage) {
      this.updateScaleCache(); // Update cache after map image is set
      this.triggerUpdate();
    }
  }

  /**
   * Updates image dimensions and refreshes cache
   */
  updateImageDimensions(width: number, height: number): void {
    // Skip recalculation if nothing changed
    if (this.engineState.imageWidth === width && this.engineState.imageHeight === height) {
      return;
    }
    this.engineState.imageWidth = width;
    this.engineState.imageHeight = height;
    this.updateScaleCache(); // Refresh cache after dimension change
  }

  /**
   * Gets current canvas resources (for testing or advanced usage)
   */
  getCanvasResources(): Readonly<CanvasResources> {
    return this.canvasResources;
  }

  /**
   * Cleanup method to properly dispose of resources
   * Should be called when the FilterRenderer is no longer needed
   */
  dispose(): void {
    // Revoke last texture URL to free memory
    if (this.lastTextureObjectUrl && APP_CONFIG.PERFORMANCE.AUTO_CLEANUP_URLS) {
      try { URL.revokeObjectURL(this.lastTextureObjectUrl); } catch {}
      this.lastTextureObjectUrl = null;
    }
    if (this.canvasResources.objectPool) {
      this.canvasResources.objectPool.clear();
    }
    
    // Clear canvas contents to free memory
    if (APP_CONFIG.PERFORMANCE.REUSE_CANVAS_BUFFERS) {
      const { ctx, tempCtx, renderCtx } = this.canvasResources;
      const { canvas, tempCanvas, renderCanvas } = this.canvasResources;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
      
      // Reset canvas dimensions to save memory
      canvas.width = 1;
      canvas.height = 1;
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      renderCanvas.width = 1;
      renderCanvas.height = 1;
    }
  }
} 