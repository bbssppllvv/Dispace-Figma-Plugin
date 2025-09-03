import { APP_CONFIG } from '../config/constants';

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string = 'image/png'): string {
  // Convert to binary string in manageable chunks to avoid stack overflow
  let binary = '';
  const CHUNK_SZ = APP_CONFIG.CHUNK_SIZE; // Safe for most browsers
  for (let i = 0; i < bytes.length; i += CHUNK_SZ) {
    const chunk = bytes.subarray(i, i + CHUNK_SZ);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Resizes image to fit within preview bounds while maintaining aspect ratio
 * Used for Live Preview optimization - returns resized dataURL
 */
export function resizeImageForPreview(img: HTMLImageElement, maxSize: number): string {
  const { width, height } = img;
  
  // If image is already small enough, return as-is
  if (width <= maxSize && height <= maxSize) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
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
  
  return canvas.toDataURL('image/png');
}

/**
 * Returns a data URL of the image where all edges are mirrored with the given padding.
 * This prevents edge-clamping artifacts when using the bitmap as a tiled displacement map.
 *
 * @param img  Loaded HTMLImageElement (must be fully decoded/loaded).
 * @param padding  Number of pixels to mirror on each side.
 */
export function createMirroredTexture(img: HTMLImageElement, padding: number): string {
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

  // Corners - простые трансформации с правильными координатами
  const drawCorner = (sx: number, sy: number, dx: number, dy: number, flipX: boolean, flipY: boolean) => {
    ctx.save();
    // Учитываем инверсию координат после scale
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

  return cnv.toDataURL();
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
 */
function createCacheKey(bytes: Uint8Array): string {
  // Use first and last 32 bytes + length for fast hashing
  const start = bytes.slice(0, 32);
  const end = bytes.slice(-32);
  return `${bytes.length}_${Array.from(start).join('')}_${Array.from(end).join('')}`;
}

/**
 * Cleans expired cache entries
 */
function cleanCache(): void {
  const now = Date.now();
  for (const [key, cached] of imageCache.entries()) {
    if (now - cached.timestamp > APP_CONFIG.PERFORMANCE.IMAGE_CACHE_TTL) {
      imageCache.delete(key);
    }
  }
  
  // Limit cache size
  if (imageCache.size > APP_CONFIG.PERFORMANCE.IMAGE_CACHE_MAX_SIZE) {
    const entries = Array.from(imageCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, imageCache.size - APP_CONFIG.PERFORMANCE.IMAGE_CACHE_MAX_SIZE);
    toDelete.forEach(([key]) => imageCache.delete(key));
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
          previewDataUrl = resizeImageForPreview(img, APP_CONFIG.PERFORMANCE.PREVIEW_MAX_SIZE);
          isOptimized = true;
        }
        
        // ALWAYS create original mirrored texture (needed for final render)
        const originalPadding = Math.round(Math.max(img.width, img.height) * 0.2);
        const originalMirroredDataUrl = createMirroredTexture(img, originalPadding);
        
        // PERFORMANCE FIX: Create preview mirrored texture only if optimization was applied
        let previewMirroredDataUrl = originalMirroredDataUrl; // Default to original
        
        if (isOptimized) {
          // Create preview mirrored texture from optimized image
          const previewImg = new Image();
          previewImg.onload = () => {
            const previewPadding = Math.round(Math.max(previewImg.width, previewImg.height) * 0.2);
            previewMirroredDataUrl = createMirroredTexture(previewImg, previewPadding);
            
            // Cache the results (original quality)
            imageCache.set(cacheKey, {
              dataUrl: originalDataUrl,
              mirroredDataUrl: originalMirroredDataUrl,
              timestamp: Date.now(),
              originalSize: bytes.length
            });
            
            resolve({
              originalDataUrl,
              previewDataUrl,
              originalMirroredDataUrl,
              previewMirroredDataUrl,
              isOptimized: true
            });
          };
          
          previewImg.onerror = () => {
            // Fallback to original if optimization fails
            resolve({
              originalDataUrl,
              previewDataUrl: originalDataUrl,
              originalMirroredDataUrl,
              previewMirroredDataUrl: originalMirroredDataUrl,
              isOptimized: false
            });
          };
          
          previewImg.src = previewDataUrl;
          return; // Exit here, resolution happens in previewImg.onload
        }
        
        // No optimization applied - use original textures for both
        imageCache.set(cacheKey, {
          dataUrl: originalDataUrl,
          mirroredDataUrl: originalMirroredDataUrl,
          timestamp: Date.now(),
          originalSize: bytes.length
        });
        
        resolve({
          originalDataUrl,
          previewDataUrl: originalDataUrl,
          originalMirroredDataUrl,
          previewMirroredDataUrl: originalMirroredDataUrl,
          isOptimized: false
        });
        
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = originalDataUrl;
  });
} 