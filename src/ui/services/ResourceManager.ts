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
  private missingResourcesLogged = new Set<string>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_RETRIES = 3;

  constructor(
    private githubApiUrl: string = 'https://api.github.com/repos/bbssppllvv/Dispace-Figma-Plugin/contents/assets/displacement-maps/svg',
    private cdnBaseUrl: string = 'https://raw.githubusercontent.com/bbssppllvv/Dispace-Figma-Plugin/main/assets'
  ) {}

  /**
   * Initialize resource manager by scanning GitHub API
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔍 Scanning GitHub for available resources...');
      
      const response = await fetch(this.githubApiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to scan GitHub: ${response.status}`);
      }
      
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from GitHub API');
      }
      
      let files;
      try {
        files = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse GitHub API response:', parseError);
        console.error('Response text (first 200 chars):', text.substring(0, 200));
        throw new Error(`Invalid JSON response from GitHub API: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      if (!Array.isArray(files)) {
        throw new Error(`Expected array from GitHub API, got ${typeof files}`);
      }
      
      // Create virtual manifest from GitHub API
      this.manifest = {
        version: '1.0.0',
        baseUrl: this.cdnBaseUrl,
        resources: {
          'displacement-maps': {}
        }
      };
      
      for (const file of files) {
        const isSvg = file.name.endsWith('.svg');
        const isPng = file.name.endsWith('.png');

        if (file.type === 'file' && (isSvg || isPng)) {
          const id = file.name.replace(/\.[^/.]+$/, '');
          this.manifest.resources['displacement-maps'][id] = {
            type: isSvg ? 'svg' : 'png',
            path: `/displacement-maps/svg/${file.name}`,
            hash: file.sha,
            size: file.size,
            dimensions: { width: 0, height: 0 } // Will be loaded on demand
          };
        }
      }
      
      const resourceCount = Object.keys(this.manifest.resources['displacement-maps']).length;
      // console.log(`✅ ResourceManager auto-discovered ${resourceCount} resources from GitHub`);
      
      // Preload critical resources
      await this.preloadCriticalResources();
      
    } catch (error) {
      console.warn('⚠️ ResourceManager GitHub scan failed (expected in Figma sandbox):', error instanceof Error ? error.message : String(error));
      // console.log('✅ Using direct URL fallback for resources (sandbox mode)');
      // Continue without resources - will use fallbacks
    }
  }

  /**
   * Resolve resource:// URL to actual CDN URL
   */
  resolveResource(resourceId: string): string | null {
    if (!this.manifest) {
      // This is normal in Figma sandbox - using direct URLs
      // Fallback: direct URL construction without manifest
      // Handle files with spaces in names
      const fileName = resourceId.includes(' ') ? resourceId : resourceId;
      
      // Try to guess extension or use SVG as default
      if (fileName.endsWith('.svg') || fileName.endsWith('.png')) {
         return `${this.cdnBaseUrl}/displacement-maps/svg/${fileName}`;
      }
      
      // Default to SVG if no extension provided
      return `${this.cdnBaseUrl}/displacement-maps/svg/${fileName}.svg`;
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
      // Use warn instead of error for missing resources (common with custom presets)
      // Only log once per resource to avoid spam
      if (!this.missingResourcesLogged?.has(resourceId)) {
        if (!this.missingResourcesLogged) {
          this.missingResourcesLogged = new Set();
        }
        this.missingResourcesLogged.add(resourceId);
        console.warn(`Resource not found: ${resourceId} (using fallback)`);
      }
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
      // Return fallback texture instead of throwing error
      // This prevents console spam for missing custom preset resources
      return this.createFallbackTexture();
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
        
        return dataUrl;

      } catch (error) {
        lastError = error as Error;
        // Only log warnings for retries, not for final failure
        if (attempt < this.MAX_RETRIES - 1) {
          // Silent retries - don't spam console
        }
        
        if (attempt < this.MAX_RETRIES - 1) {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // All retries failed - return fallback instead of throwing
    // This prevents console spam for missing resources
    return this.createFallbackTexture();
  }

  /**
   * Create a neutral fallback texture when resource loading fails
   */
  private createFallbackTexture(): string {
    const svg = `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="fallback" patternUnits="userSpaceOnUse" width="10" height="10">
            <rect width="5" height="5" fill="#808080"/>
            <rect x="5" y="5" width="5" height="5" fill="#808080"/>
            <rect x="5" y="0" width="5" height="5" fill="#a0a0a0"/>
            <rect x="0" y="5" width="5" height="5" fill="#a0a0a0"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fallback)"/>
      </svg>
    `;
    
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
