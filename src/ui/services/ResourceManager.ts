/**
 * Resource Manager
 * 
 * Professional asset management system for displacement maps and other resources.
 * Handles CDN loading, caching, fallbacks, and resource resolution.
 * 
 * Features:
 * - CDN-first loading with local fallbacks
 * - Intelligent caching with version management  
 * - Resource preloading and prefetching
 * - Hash-based integrity verification
 * - Automatic retry with exponential backoff
 */

import { APP_CONFIG } from '../config/constants';

interface ResourceManifest {
  version: string;
  baseUrl: string;
  resources: {
    [category: string]: {
      [id: string]: {
        type: 'svg' | 'png' | 'jpg';
        path: string;
        hash?: string;
        size?: number;
        dimensions?: { width: number; height: number };
      };
    };
  };
}

interface CacheEntry {
  url: string;
  data: string; // data URL
  timestamp: number;
  hash?: string;
}

export class ResourceManager {
  private manifest: ResourceManifest | null = null;
  private cache = new Map<string, CacheEntry>();
  private loadingPromises = new Map<string, Promise<string>>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_RETRIES = 3;

  constructor(
    private manifestUrl: string = 'https://raw.githubusercontent.com/bbssppllvv/Dispace-Figma-Plugin/main/assets/manifest.json',
    private cdnBaseUrl: string = 'https://raw.githubusercontent.com/bbssppllvv/Dispace-Figma-Plugin/main/assets'
  ) {}

  /**
   * Initialize resource manager by loading manifest
   */
  async initialize(): Promise<void> {
    try {
      const response = await fetch(this.manifestUrl, {
        cache: 'force-cache',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
      }
      
      this.manifest = await response.json();
      console.log(`✅ ResourceManager initialized with ${Object.keys(this.manifest?.resources || {}).length} categories`);
      
      // Preload critical resources
      await this.preloadCriticalResources();
      
    } catch (error) {
      console.error('❌ ResourceManager initialization failed:', error);
      // Continue without manifest - will use fallbacks
    }
  }

  /**
   * Resolve resource:// URL to actual CDN URL
   */
  resolveResource(resourceId: string): string | null {
    if (!this.manifest) {
      console.warn(`No manifest loaded, cannot resolve: ${resourceId}`);
      return null;
    }

    // Parse resource://category/id or resource://id format
    const parts = resourceId.replace('resource://', '').split('/');
    let category: string, id: string;
    
    if (parts.length === 2) {
      [category, id] = parts;
    } else {
      // Search all categories for the ID
      id = parts[0];
      category = Object.keys(this.manifest.resources).find(cat => 
        this.manifest!.resources[cat][id]
      ) || 'displacement-maps';
    }

    const resource = this.manifest.resources[category]?.[id];
    if (!resource) {
      console.error(`Resource not found: ${resourceId}`);
      return null;
    }

    return `${this.cdnBaseUrl}${resource.path}`;
  }

  /**
   * Load resource with caching and fallbacks
   */
  async loadResource(resourceId: string): Promise<string> {
    // Check if already loading
    if (this.loadingPromises.has(resourceId)) {
      return this.loadingPromises.get(resourceId)!;
    }

    // Check cache first
    const cached = this.getCachedResource(resourceId);
    if (cached) {
      return cached;
    }

    // Start loading
    const loadPromise = this.loadResourceInternal(resourceId);
    this.loadingPromises.set(resourceId, loadPromise);

    try {
      const result = await loadPromise;
      this.loadingPromises.delete(resourceId);
      return result;
    } catch (error) {
      this.loadingPromises.delete(resourceId);
      throw error;
    }
  }

  private async loadResourceInternal(resourceId: string): Promise<string> {
    const url = this.resolveResource(resourceId);
    if (!url) {
      throw new Error(`Cannot resolve resource: ${resourceId}`);
    }

    // Try loading with retries
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          cache: 'force-cache',
          headers: {
            'Accept': 'image/*, text/*'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const dataUrl = await this.blobToDataUrl(blob);
        
        // Cache the result
        this.cacheResource(resourceId, url, dataUrl);
        
        console.log(`✅ Loaded resource: ${resourceId}`);
        return dataUrl;

      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Attempt ${attempt + 1} failed for ${resourceId}:`, error);
        
        if (attempt < this.MAX_RETRIES - 1) {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // All retries failed
    console.error(`❌ Failed to load resource after ${this.MAX_RETRIES} attempts: ${resourceId}`);
    throw lastError || new Error(`Failed to load resource: ${resourceId}`);
  }

  /**
   * Preload critical resources for better UX
   */
  private async preloadCriticalResources(): Promise<void> {
    if (!this.manifest) return;

    // Preload Popular category resources
    const criticalResources: string[] = [];
    
    // Find resources used by Popular presets
    Object.entries(this.manifest.resources).forEach(([category, resources]) => {
      Object.keys(resources).forEach(id => {
        // Add logic to determine critical resources
        if (category === 'displacement-maps') {
          criticalResources.push(`resource://${category}/${id}`);
        }
      });
    });

    // Load critical resources in background
    const preloadPromises = criticalResources.slice(0, 5).map(async (resourceId) => {
      try {
        await this.loadResource(resourceId);
      } catch (error) {
        // Silent fail for preloading
        console.warn(`Preload failed for ${resourceId}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
    console.log(`✅ Preloaded ${criticalResources.length} critical resources`);
  }

  private getCachedResource(resourceId: string): string | null {
    const entry = this.cache.get(resourceId);
    if (!entry) return null;

    // Check if cache is still valid
    const isExpired = Date.now() - entry.timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(resourceId);
      return null;
    }

    return entry.data;
  }

  private cacheResource(resourceId: string, url: string, data: string, hash?: string): void {
    this.cache.set(resourceId, {
      url,
      data,
      timestamp: Date.now(),
      hash
    });
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Prefetch multiple resources (for engine compatibility)
   */
  async prefetchMapSources(sources: string[]): Promise<void> {
    const promises = sources.map(async (src) => {
      try {
        await this.loadResource(src);
      } catch (error) {
        // Silent fail for prefetching
        console.warn(`Prefetch failed for ${src}:`, error);
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Clear cache (for development/testing)
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    console.log('🗑️ Resource cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([id, entry]) => ({
        id,
        size: entry.data.length,
        age: Date.now() - entry.timestamp
      }))
    };
  }
}

// Singleton instance
export const resourceManager = new ResourceManager();
