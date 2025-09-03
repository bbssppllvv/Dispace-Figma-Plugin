/**
 * Resource Resolver
 * 
 * Utility for resolving resource:// URLs to actual data URLs.
 * Integrates with ResourceManager for CDN loading with fallbacks.
 */

import { resourceManager } from '../services/ResourceManager';

/**
 * Resolve a resource URL to a data URL
 * Supports both resource:// URLs and regular URLs
 */
export async function resolveResourceUrl(src: string): Promise<string> {
  // If it's already a data URL or HTTP URL, return as-is
  if (src.startsWith('data:') || src.startsWith('http')) {
    return src;
  }
  
  // If it's a resource:// URL, resolve through ResourceManager
  if (src.startsWith('resource://')) {
    try {
      return await resourceManager.loadResource(src.replace('resource://', ''));
    } catch (error) {
      console.error('Failed to resolve resource:', src, error);
      
      // Fallback to a neutral gray texture
      return createFallbackTexture();
    }
  }
  
  // Unknown format, return as-is and let the engine handle it
  return src;
}

/**
 * Batch resolve multiple resource URLs
 */
export async function resolveResourceUrls(sources: string[]): Promise<string[]> {
  const promises = sources.map(src => resolveResourceUrl(src));
  return Promise.all(promises);
}

/**
 * Create a neutral fallback texture when resource loading fails
 */
function createFallbackTexture(): string {
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
 * Preload resources for better performance
 */
export async function preloadResources(sources: string[]): Promise<void> {
  const resourceSources = sources.filter(src => src.startsWith('resource://'));
  
  if (resourceSources.length === 0) return;
  
  try {
    const resourceIds = resourceSources.map(src => src.replace('resource://', ''));
    
    // Use ResourceManager's prefetch if available
    if (typeof resourceManager.prefetchMapSources === 'function') {
      await resourceManager.prefetchMapSources(resourceIds);
    } else {
      // Fallback to individual loading
      const promises = resourceIds.map(id => 
        resourceManager.loadResource(id).catch(() => {
          // Silent fail for preloading
        })
      );
      await Promise.allSettled(promises);
    }
  } catch (error) {
    console.warn('Resource preloading failed:', error);
  }
}
