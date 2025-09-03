import { APP_CONFIG } from '../config/constants';

/**
 * Service for local storage operations
 * Provides type-safe storage with error handling
 */
export class StorageService {
  private readonly keyPrefix = 'displace-plugin-';

  /**
   * Save data to localStorage with error handling
   */
  public save<T>(key: string, data: T): boolean {
    try {
      const prefixedKey = this.keyPrefix + key;
      const serialized = JSON.stringify(data);
      localStorage.setItem(prefixedKey, serialized);
      return true;
    } catch (error) {
      console.error(`Failed to save to localStorage:`, error);
      return false;
    }
  }

  /**
   * Load data from localStorage with type safety
   */
  public load<T>(key: string, defaultValue: T): T {
    try {
      const prefixedKey = this.keyPrefix + key;
      const item = localStorage.getItem(prefixedKey);
      
      if (item === null) {
        return defaultValue;
      }
      
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Failed to load from localStorage:`, error);
      return defaultValue;
    }
  }

  /**
   * Remove item from localStorage
   */
  public remove(key: string): boolean {
    try {
      const prefixedKey = this.keyPrefix + key;
      localStorage.removeItem(prefixedKey);
      return true;
    } catch (error) {
      console.error(`Failed to remove from localStorage:`, error);
      return false;
    }
  }

  /**
   * Check if key exists in localStorage
   */
  public exists(key: string): boolean {
    try {
      const prefixedKey = this.keyPrefix + key;
      return localStorage.getItem(prefixedKey) !== null;
    } catch (error) {
      console.error(`Failed to check localStorage:`, error);
      return false;
    }
  }

  /**
   * Clear all plugin data from localStorage
   */
  public clearAll(): boolean {
    try {
      const keys = Object.keys(localStorage);
      const pluginKeys = keys.filter(key => key.startsWith(this.keyPrefix));
      
      pluginKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to clear localStorage:`, error);
      return false;
    }
  }

  /**
   * Get storage usage info
   */
  public getStorageInfo(): { used: number; available: number; percentage: number } {
    try {
      let used = 0;
      const keys = Object.keys(localStorage);
      const pluginKeys = keys.filter(key => key.startsWith(this.keyPrefix));
      
      pluginKeys.forEach(key => {
        const value = localStorage.getItem(key) || '';
        used += new TextEncoder().encode(key + value).length;
      });
      
      // Estimate available space (browsers typically allow 5-10MB)
      const estimated = 5 * 1024 * 1024; // 5MB conservative estimate
      const percentage = (used / estimated) * 100;
      
      return {
        used,
        available: estimated - used,
        percentage: Math.min(percentage, 100)
      };
    } catch (error) {
      console.error(`Failed to get storage info:`, error);
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  /**
   * Check if storage quota is exceeded
   */
  public isStorageFull(): boolean {
    try {
      const info = this.getStorageInfo();
      return info.percentage > 90; // Consider full at 90%
    } catch (error) {
      return false;
    }
  }
}

/**
 * Cache service with LRU eviction
 */
export class CacheService<T> {
  private cache: Map<string, { value: T; accessTime: number }> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;

  constructor(maxSize: number = APP_CONFIG.MAX_CACHE_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * Get item from cache
   */
  public get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // Update access time and order
    item.accessTime = Date.now();
    this.updateAccessOrder(key);
    
    return item.value;
  }

  /**
   * Set item in cache
   */
  public set(key: string, value: T): void {
    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key);
    }

    // Add new entry
    this.cache.set(key, {
      value,
      accessTime: Date.now()
    });

    this.updateAccessOrder(key);
    this.enforceMaxSize();
  }

  /**
   * Remove item from cache
   */
  public delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.removeFromAccessOrder(key);
    }
    return existed;
  }

  /**
   * Check if key exists in cache
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all cache
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Get cache stats
   */
  public getStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100
    };
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private enforceMaxSize(): void {
    while (this.cache.size > this.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()!;
      this.cache.delete(oldestKey);
    }
  }
}

// Singleton instances
export const storageService = new StorageService();
export const imageCache = new CacheService<HTMLImageElement>(); 