/**
 * Image Session Manager
 * 
 * Centralizes the logic for starting a new editing session.
 * Handles image loading, state restoration, and UI updates.
 */

import type { DisplacementEngine } from '../engine';
import { appStore } from '../store/AppStore';
import { uiManager } from './UIManager';
import type { PreviewManager } from './PreviewManager';

export interface ImageSessionManagerDependencies {
  engine: DisplacementEngine;
  controlsContainer: HTMLElement;
  previewManager: PreviewManager;
  onRestoreControls: () => void;
  onUpdateUIMode: () => void;
  lastMapSourceRef: { current: any };
}

/**
 * Manages the lifecycle of an editing session
 */
export class ImageSessionManager {
  constructor(private deps: ImageSessionManagerDependencies) {}

  /**
   * Load a new image into the session
   */
  async loadSession(imageBytes: Uint8Array): Promise<void> {
    console.log('[DEBUG] ImageSessionManager: loadSession started');
    try {
      this.deps.previewManager.hidePreviewMessage();
      uiManager.setControlsEnabled(this.deps.controlsContainer, true);
      
      // Force map reload logic to trigger by resetting tracking
      this.deps.lastMapSourceRef.current = null;
      
      // Load the new image first so dimensions are set correctly in the engine
      console.log('[DEBUG] ImageSessionManager: loading source from bytes');
      await this.deps.engine.loadSourceFromBytes(imageBytes);
      
      // Notify store that image was loaded (triggers gallery update via imageVersion and map reload)
      appStore.notifyImageLoaded();
      
      // Wait for map to load if there's an active map source
      const currentMap = appStore.activeMapSource;
      if (currentMap) {
        // Use loadMapAndWait to ensure map is fully loaded before restoring controls
        console.log('[DEBUG] ImageSessionManager: loading map and waiting');
        await this.deps.engine.loadMapAndWait(currentMap);
        // Update tracking to prevent duplicate loads
        this.deps.lastMapSourceRef.current = currentMap;
      }
      
      // Restore UI settings to the engine AFTER both image and map are loaded
      console.log('[DEBUG] ImageSessionManager: restoring controls');
      this.deps.onRestoreControls();
      
      // Force a final redraw to ensure everything is rendered correctly
      this.deps.engine.forceRedraw();
      
      this.deps.onUpdateUIMode();
      console.log('[DEBUG] ImageSessionManager: loadSession completed');
    } catch (error) {
      console.error('[DEBUG] ImageSessionManager: Error loading session:', error);
      throw error; // Re-throw to allow caller to handle specific error messages
    }
  }

  /**
   * Clear the current session
   */
  clearSession(reason?: string, icon?: 'hint' | 'error'): void {
    this.deps.engine.clear();
    this.deps.lastMapSourceRef.current = null;
    this.deps.previewManager.showPreviewMessage(reason || 'Select any layer', { icon: icon || 'hint' });
    appStore.notifyImageCleared();
    uiManager.setControlsEnabled(this.deps.controlsContainer, false);
    this.deps.onUpdateUIMode();
  }
}


