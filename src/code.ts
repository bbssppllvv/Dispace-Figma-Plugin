/**
 * Main entry point for the Figma plugin
 */

import { createMessageHandlers, loadAndSendCustomPresets } from './code/handlers';
import { processSelectedImage } from './code/selection';

/**
 * Initialize the plugin
 */
async function main() {
  figma.showUI(__html__, { width: 720, height: 400 });

  // Load custom presets in background, non-blocking
  loadAndSendCustomPresets();

  // Listen for selection changes
  figma.on('selectionchange', processSelectedImage);

  // Create message handlers
  const messageHandlers = createMessageHandlers();

  // Handle messages from the UI
  figma.ui.onmessage = async (msg) => {
    const handler = messageHandlers[msg.type as keyof typeof messageHandlers];
    if (handler) {
      await handler(msg);
    }
  };

  // Initial processing of selection
  await processSelectedImage();
}

main(); 