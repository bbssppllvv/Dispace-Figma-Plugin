/**
 * Figma Message Handler
 * 
 * Handles all incoming messages from Figma plugin backend.
 * Manages selection updates, errors, and apply callbacks.
 */

import { figmaService } from '../services/FigmaService';
import { uiManager } from './UIManager';
import type { ImageSessionManager } from './ImageSessionManager';

export interface FigmaMessageHandlerDependencies {
  sessionManager: ImageSessionManager;
  applyButton: HTMLButtonElement;
  updateUIMode: () => void;
}

/**
 * Handles all Figma plugin messages
 */
export class FigmaMessageHandler {
  private unsubscribeHandlers: Array<() => void> = [];

  constructor(private deps: FigmaMessageHandlerDependencies) {}

  /**
   * Initialize all message handlers
   */
  init(): void {
    // Selection update handler
    const unsubscribeSelection = figmaService.onMessage('selection-updated', async (message) => {
      console.log('[DEBUG] FigmaMessageHandler: selection-updated received', 'bytes length:', message.imageBytes ? message.imageBytes.length : 0);
      try {
        await this.deps.sessionManager.loadSession(message.imageBytes);
        console.log('[DEBUG] FigmaMessageHandler: session loaded successfully');
      } catch (error) {
        console.error('[DEBUG] FigmaMessageHandler: loadSession failed', error);
        // Error handling is now mostly inside ImageSessionManager, but we can handle specific overrides here
        let errorMessage = 'Error loading image. Please try again.';
        if (error instanceof Error) {
          if (error.message.includes('too large')) {
            errorMessage = 'Image is too large. Please select a smaller image.';
          } else if (error.message.includes('No image data')) {
            errorMessage = 'No image data found. Please select a layer with an image fill.';
          } else if (error.message.includes('Preview container')) {
            errorMessage = 'Preview interface error. Please refresh the plugin.';
          }
        }
        // Use session manager to clear/show error
        this.deps.sessionManager.clearSession(errorMessage, 'error');
      }
    });
    this.unsubscribeHandlers.push(unsubscribeSelection);

    // Selection clear handler
    const unsubscribeClear = figmaService.onMessage('selection-cleared', () => {
      this.deps.sessionManager.clearSession();
    });
    this.unsubscribeHandlers.push(unsubscribeClear);

    // Unsupported nodes handler
    const unsubscribeUnsupported = figmaService.onMessage('unsupported-node', (message) => {
      let reason = "This layer is not supported.";
      if (message.reason === 'multiple') {
        reason = "Please select a single layer.";
      } else if (message.reason === 'vector') {
        reason = "Please select a layer with an image fill, not a vector.";
      } else if (message.reason === 'no-image-fill') {
        reason = "The selected layer does not have an image fill.";
      }
      this.deps.sessionManager.clearSession(reason, 'error');
    });
    this.unsubscribeHandlers.push(unsubscribeUnsupported);

    // Apply success handler
    const unsubscribeApplySuccess = figmaService.onMessage('apply-success', () => {
      uiManager.updateApplyButton(this.deps.applyButton, true, "Apply Effect");
      this.deps.updateUIMode();
    });
    this.unsubscribeHandlers.push(unsubscribeApplySuccess);

    // Apply error handler
    const unsubscribeApplyError = figmaService.onMessage('apply-error', (message) => {
      alert(`Figma failed to apply the effect: ${message.error}`);
      uiManager.updateApplyButton(this.deps.applyButton, true, "Apply Effect");
      this.deps.updateUIMode();
    });
    this.unsubscribeHandlers.push(unsubscribeApplyError);

    // Custom presets loaded handler (empty, but needed for compatibility)
    const unsubscribeCustomPresets = figmaService.onMessage('custom-presets-loaded', () => {
      // Handled in customPresetService
    });
    this.unsubscribeHandlers.push(unsubscribeCustomPresets);
  }

  /**
   * Cleanup all message handlers
   */
  destroy(): void {
    this.unsubscribeHandlers.forEach(unsubscribe => unsubscribe());
    this.unsubscribeHandlers = [];
  }
}
