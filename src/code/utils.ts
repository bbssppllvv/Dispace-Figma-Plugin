/**
 * Utility functions for the Figma plugin main thread
 */

/**
 * Higher-order function for message handling with error catching
 */
export function withErrorHandling(handler: (msg: any) => Promise<void>) {
  return async (msg: any) => {
    try {
      await handler(msg);
    } catch (error) {
      console.error(`Error in handler for ${msg.type}:`, error);
      figma.notify(`Error: ${String(error)}`);
      figma.ui.postMessage({ type: `${msg.type}-error`, error: String(error) });
    }
  };
}

/**
 * Format error message for common Figma image errors
 */
export function formatImageError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('Image is too large')) {
      return 'Image is too large for Figma (max 4096px). The effect was downscaled but may need further size reduction.';
    } else if (error.message.includes('Image is too small')) {
      return 'Generated image is too small';
    } else if (error.message.includes('Image type is unsupported')) {
      return 'Generated image format is not supported';
    } else {
      return `Failed to apply effect: ${error.message}`;
    }
  }
  return 'Failed to apply effect';
}

