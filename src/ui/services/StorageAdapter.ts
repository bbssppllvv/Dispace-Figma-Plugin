/**
 * Storage Adapter Interface
 * 
 * Abstracts storage operations to easily switch between localStorage (dev) 
 * and figma.clientStorage (production) without changing business logic.
 */

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * localStorage implementation (current dev/testing)
 */
export class LocalStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('LocalStorage getItem failed:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('LocalStorage setItem failed:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('LocalStorage removeItem failed:', error);
    }
  }
}

/**
 * Figma clientStorage implementation (future production use)
 * TODO: Implement when ready for production
 */
export class FigmaStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    // TODO: Replace with figma.clientStorage.getAsync(key)
    console.warn('FigmaStorageAdapter not implemented yet, falling back to localStorage');
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    // TODO: Replace with figma.clientStorage.setAsync(key, value)
    console.warn('FigmaStorageAdapter not implemented yet, falling back to localStorage');
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    // TODO: Replace with figma.clientStorage.deleteAsync(key)
    console.warn('FigmaStorageAdapter not implemented yet, falling back to localStorage');
    localStorage.removeItem(key);
  }
}

/**
 * Factory function to get the appropriate storage adapter
 * TODO: Switch to FigmaStorageAdapter in production
 */
export function createStorageAdapter(): StorageAdapter {
  // For now, always use localStorage
  // TODO: Check environment and return FigmaStorageAdapter in production
  return new LocalStorageAdapter();
} 