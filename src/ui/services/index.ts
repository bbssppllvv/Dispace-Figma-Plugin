/**
 * Services Index
 * 
 * Central hub for all application services. This module handles service initialization,
 * provides clean exports, and manages service lifecycle.
 */

// Service types
export type { FigmaMessage, FigmaMessageHandlers } from '../types';
export type { StorageAdapter } from './StorageAdapter';

// Import services for internal use
import { figmaService } from './FigmaService';
import { resourceManager } from './ResourceManager';

// Export services for external use
export { figmaService } from './FigmaService';
export { imageCache } from './StorageService';
export { licenseService } from './LicenseService';
export { resourceManager } from './ResourceManager';
export { presetService } from './PresetService';
export { createStorageAdapter, LocalStorageAdapter, FigmaStorageAdapter } from './StorageAdapter';

/**
 * Initialize all services
 * Call this in App.ts constructor to set up all services
 */
export function initializeServices(): void {
  // Initialize Figma service
  figmaService.init();
  
  // Initialize Resource Manager
  resourceManager.initialize().catch(error => {
    console.warn('ResourceManager initialization failed:', error);
  });
  
  // License service is self-initializing
  // imageCache is self-initializing
  
  console.log('All services initialized');
}

/**
 * Cleanup all services
 * Call this when the app is being destroyed
 */
export function destroyServices(): void {
  figmaService.destroy();
  
  console.log('All services destroyed');
} 