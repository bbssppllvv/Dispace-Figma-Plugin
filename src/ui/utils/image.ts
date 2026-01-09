import { APP_CONFIG } from '../config/constants';

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string = 'image/png'): string {
  // Use Blob URL which is much faster than base64 conversion for large images
  // Note: The caller or cache is responsible for revoking the URL
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  return url;
}

/**
 * Resizes image to fit within preview bounds while maintaining aspect ratio
 * Used for Live Preview optimization - returns resized dataURL (Async)
 */
export function resizeImageForPreview(img: HTMLImageElement, maxSize: number): Promise<string> {
  const { width, height } = img;
  
  // If image is already small enough, return as-is
  if (width <= maxSize && height <= maxSize) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            if (blob) {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            } else {
                resolve(canvas.toDataURL('image/png'));
            }
        }, 'image/png');
    });
  }
  
  // Calculate optimal size maintaining aspect ratio
  const aspectRatio = width / height;
  let newWidth: number, newHeight: number;
  
  if (width > height) {
    newWidth = maxSize;
    newHeight = Math.round(maxSize / aspectRatio);
  } else {
    newHeight = maxSize;
    newWidth = Math.round(maxSize * aspectRatio);
  }
  
  // Create resized image using canvas
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d')!;
  
  // Use high-quality image scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, newWidth, newHeight);
  
  return new Promise(resolve => {
    canvas.toBlob(blob => {
        if (blob) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        } else {
            resolve(canvas.toDataURL('image/png'));
        }
    }, 'image/png');
  });
}

/**
 * Returns a data URL of the image where all edges are mirrored with the given padding.
 * This prevents edge-clamping artifacts when using the bitmap as a tiled displacement map.
 *
 * @param img  Loaded HTMLImageElement (must be fully decoded/loaded).
 * @param padding  Number of pixels to mirror on each side.
 */
export function createMirroredTexture(img: HTMLImageElement, padding: number): Promise<string> {
  const w = img.width;
  const h = img.height;
  const p = Math.max(0, padding);

  const cnv = document.createElement('canvas');
  cnv.width = w + p * 2;
  cnv.height = h + p * 2;
  const ctx = cnv.getContext('2d')!;

  // Center image
  ctx.drawImage(img, p, p, w, h);

  // Top edge
  ctx.save();
  ctx.translate(p, 0);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0, w, p, 0, -p, w, p);
  ctx.restore();

  // Bottom edge
  ctx.save();
  ctx.translate(p, h + 2 * p);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, h - p, w, p, 0, 0, w, p);
  ctx.restore();

  // Left edge
  ctx.save();
  ctx.translate(0, p);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, p, h, -p, 0, p, h);
  ctx.restore();

  // Right edge
  ctx.save();
  ctx.translate(w + 2 * p, p);
  ctx.scale(-1, 1);
  ctx.drawImage(img, w - p, 0, p, h, 0, 0, p, h);
  ctx.restore();

  // Corners - simple transformations with correct coordinates
  const drawCorner = (sx: number, sy: number, dx: number, dy: number, flipX: boolean, flipY: boolean) => {
    ctx.save();
    // Account for coordinate inversion after scale
    ctx.translate(dx + (flipX ? p : 0), dy + (flipY ? p : 0));
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(img, sx, sy, p, p, 0, 0, p, p);
    ctx.restore();
  };

  // Top-left corner
  drawCorner(0, 0, 0, 0, true, true);
  // Top-right corner
  drawCorner(w - p, 0, w + p, 0, true, true);
  // Bottom-left corner
  drawCorner(0, h - p, 0, h + p, true, true);
  // Bottom-right corner
  drawCorner(w - p, h - p, w + p, h + p, true, true);

  return new Promise(resolve => {
    cnv.toBlob(blob => {
        if (blob) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        } else {
            resolve(cnv.toDataURL('image/png'));
        }
    }, 'image/png');
  });
}

// Image cache for performance optimization
interface CachedImage {
  dataUrl: string;
  mirroredDataUrl: string;
  timestamp: number;
  originalSize: number;
}

const imageCache = new Map<string, CachedImage>();

/**
 * Creates a cache key from image bytes
 * Includes FILTER_MARGIN_PERCENT to invalidate cache when margin changes
 */
function createCacheKey(bytes: Uint8Array): string {
  // Use first and last 32 bytes + length for fast hashing
  const start = bytes.slice(0, 32);
  const end = bytes.slice(-32);
  // Include FILTER_MARGIN_PERCENT so cache invalidates when margin changes
  return `${bytes.length}_${APP_CONFIG.FILTER_MARGIN_PERCENT}_${Array.from(start).join('')}_${Array.from(end).join('')}`;
}

/**
 * Cleans expired cache entries
 */
function cleanCache(): void {
  const now = Date.now();
  for (const [key, cached] of imageCache.entries()) {
    if (now - cached.timestamp > APP_CONFIG.PERFORMANCE.IMAGE_CACHE_TTL) {
      // Revoke blob URL if it is one (starts with blob:)
      if (cached.dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(cached.dataUrl);
      }
      imageCache.delete(key);
    }
  }
  
  // Limit cache size
  if (imageCache.size > APP_CONFIG.PERFORMANCE.IMAGE_CACHE_MAX_SIZE) {
    const entries = Array.from(imageCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, imageCache.size - APP_CONFIG.PERFORMANCE.IMAGE_CACHE_MAX_SIZE);
    toDelete.forEach(([key, cached]) => {
      if (cached.dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(cached.dataUrl);
      }
      imageCache.delete(key);
    });
  }
}

/**
 * Optimized image processing for preview with caching
 * Returns both original (for final render) and preview-optimized (for Live Preview) versions
 * SAFE: Preview optimization doesn't affect final render quality
 * OPTIMIZED: Lazy loading of preview mirrored textures to prevent performance regression
 */
export async function processImageForPreview(bytes: Uint8Array): Promise<{
  originalDataUrl: string;          // Original image for final render
  previewDataUrl: string;           // Optimized for Live Preview
  originalMirroredDataUrl: string;  // Original mirrored texture for final render
  previewMirroredDataUrl: string;   // Optimized mirrored texture for Live Preview (lazy)
  isOptimized: boolean;             // Whether preview optimization was applied
}> {
  // Clean cache periodically
  cleanCache();
  
  // Check cache first
  const cacheKey = createCacheKey(bytes);
  const cached = imageCache.get(cacheKey);
  if (cached) {
    return {
      originalDataUrl: cached.dataUrl,
      previewDataUrl: cached.dataUrl, // For cache hits, both are the same (original)
      originalMirroredDataUrl: cached.mirroredDataUrl,
      previewMirroredDataUrl: cached.mirroredDataUrl, // For cache hits, both are the same
      isOptimized: false // Cache hit, but preserving original quality
    };
  }
  
  // Process image - create both original and preview versions
  // Use Blob URL for massive performance win over base64
  const originalDataUrl = bytesToDataUrl(bytes);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const originalSize = Math.max(img.width, img.height);
        let isOptimized = false;
        let previewDataUrl = originalDataUrl;
        
        // Create preview-optimized version if beneficial
        if (APP_CONFIG.PERFORMANCE.ENABLE_PREVIEW_OPTIMIZATION && 
            originalSize > APP_CONFIG.PERFORMANCE.PREVIEW_MAX_SIZE) {
          // Async resize
          resizeImageForPreview(img, APP_CONFIG.PERFORMANCE.PREVIEW_MAX_SIZE).then(url => {
             previewDataUrl = url;
             isOptimized = true;
             finish();
          });
          return;
        } else {
            finish();
        }
        
        function finish() {
            // ALWAYS create original mirrored texture (needed for final render)
            // PERFORMANCE FIX: Defer creation of high-res mirrored texture if optimization is applied
            // This prevents blocking the UI with massive canvas operations for large images (e.g. 4000px+)
            
            let originalMirroredDataUrlPromise: Promise<string> | null = null;
            const originalPadding = Math.round(Math.max(img.width, img.height) * APP_CONFIG.FILTER_MARGIN_PERCENT / 100);
            
            if (!isOptimized) {
                // Small image: just create it now as it's cheap
                originalMirroredDataUrlPromise = createMirroredTexture(img, originalPadding);
            }
            
            if (isOptimized) {
              // Create preview mirrored texture from optimized image
              const previewImg = new Image();
              previewImg.onload = () => {
                const previewPadding = Math.round(Math.max(previewImg.width, previewImg.height) * APP_CONFIG.FILTER_MARGIN_PERCENT / 100);
                createMirroredTexture(previewImg, previewPadding).then(previewMirroredDataUrl => {
                     resolve({
                      originalDataUrl,
                      previewDataUrl,
                      originalMirroredDataUrl: null!, // It's null here if optimized (will be lazy loaded)
                      previewMirroredDataUrl,
                      isOptimized: true
                    });
                });
              };
              
              previewImg.onerror = () => {
                // Fallback to original
                if (!originalMirroredDataUrlPromise) {
                    originalMirroredDataUrlPromise = createMirroredTexture(img, originalPadding);
                }
                originalMirroredDataUrlPromise!.then(url => {
                    resolve({
                      originalDataUrl,
                      previewDataUrl: originalDataUrl,
                      originalMirroredDataUrl: url,
                      previewMirroredDataUrl: url,
                      isOptimized: false
                    });
                });
              };
              
              previewImg.src = previewDataUrl;
              return;
            }
            
            // No optimization applied
            originalMirroredDataUrlPromise!.then(url => {
                imageCache.set(cacheKey, {
                  dataUrl: originalDataUrl,
                  mirroredDataUrl: url,
                  timestamp: Date.now(),
                  originalSize: bytes.length
                });
                
                resolve({
                  originalDataUrl,
                  previewDataUrl: originalDataUrl,
                  originalMirroredDataUrl: url,
                  previewMirroredDataUrl: url,
                  isOptimized: false
                });
            });
        }
        
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = originalDataUrl;
  });
}
