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
 * Figma clientStorage implementation
 * Note: figma.clientStorage is only available in plugin code (code.ts), not in UI.
 * For UI code, we silently fail since storage is not critical for UI functionality.
 */
export class FigmaStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    // In UI context, figma.clientStorage is not available
    // Return null silently - storage is not critical for UI
    return null;
  }

  async setItem(key: string, value: string): Promise<void> {
    // In UI context, figma.clientStorage is not available
    // Silently ignore - storage is not critical for UI
  }

  async removeItem(key: string): Promise<void> {
    // In UI context, figma.clientStorage is not available
    // Silently ignore - storage is not critical for UI
  }
}

/**
 * Factory function to get the appropriate storage adapter
 * In Figma plugin UI context, localStorage is not available, so we use FigmaStorageAdapter
 * which silently fails (storage is not critical for UI functionality)
 */
export function createStorageAdapter(): StorageAdapter {
    // Check localStorage availability
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return new LocalStorageAdapter();
  } catch (error) {
    // In Figma sandbox, localStorage is not available
    // Use FigmaStorageAdapter which silently fails (no console warnings)
    return new FigmaStorageAdapter();
  }
} 