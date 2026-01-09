/**
 * Message handlers for UI communication
 */

import { withErrorHandling, formatImageError } from './utils';
import { processSelectedImage, getSelectedNode, createNewImageRectangle, modifyNodeWithImage, duplicateNodeWithImage, ChainState } from './selection';

/**
 * Load and send custom presets to UI
 */
export async function loadAndSendCustomPresets(): Promise<void> {
  try {
    const presetIds = await figma.clientStorage.getAsync('custom_presets_list') || [];
    const presets = [];

    for (const id of presetIds) {
      const presetData = await figma.clientStorage.getAsync(`custom_preset_${id}`);
      if (presetData) {
        presets.push(presetData);
      }
    }

    figma.ui.postMessage({
      type: 'custom-presets-loaded',
      presets: presets.sort((a: any, b: any) => b.createdAt - a.createdAt)
    });
  } catch (error) {
    console.error('Error loading custom presets:', error);
    figma.ui.postMessage({
      type: 'custom-presets-load-error',
      error: String(error)
    });
  }
}

/**
 * Chain placement state for "apply as copy" mode
 */
const chainState: Record<string, ChainState> = {};

/**
 * Create message handlers map
 */
export function createMessageHandlers() {
  return {
    // UI handshake: when UI is ready, (re)send current selection and presets
    'ui-ready': withErrorHandling(async () => {
      console.log('[DEBUG] ui-ready message received from UI');
      // Ensure presets are available in UI (in case initial send happened before UI listeners attached)
      await loadAndSendCustomPresets();
      // Send current selection state
      console.log('[DEBUG] Processing selection after ui-ready');
      await processSelectedImage();
    }),

    'apply-displacement-result': withErrorHandling(async (msg) => {
      // Try to use current selection; if absent, create a new image rectangle centered in the viewport
      let node = getSelectedNode();
      try {
        if (!node) {
          // No valid selection → insert a new rectangle with the image fill at viewport center
          await createNewImageRectangle(msg.imageBytes);
        } else {
          // Modify/copy the existing selection
          // modifyNodeWithImage and duplicateNodeWithImage now handle both image fills and generic nodes
          const mode = (msg && msg.mode) === 'copy' ? 'copy' : 'modify';
          if (mode === 'modify') {
            modifyNodeWithImage(node, msg.imageBytes);
          } else {
            duplicateNodeWithImage(node, msg.imageBytes, chainState);
          }
        }
        figma.notify('Displacement effect applied successfully!');
        figma.ui.postMessage({ type: 'apply-success' });
      } catch (error) {
        console.error('Error creating image:', error);
        const errorMessage = formatImageError(error);
        figma.notify(errorMessage);
        figma.ui.postMessage({
          type: 'apply-error',
          error: errorMessage
        });
        throw error; // Re-throw to be caught by withErrorHandling
      }
    }),

    'save-custom-preset': withErrorHandling(async (msg) => {
      const { preset } = msg;
      await figma.clientStorage.setAsync(`custom_preset_${preset.id}`, preset);
      const currentIds = await figma.clientStorage.getAsync('custom_presets_list') || [];
      if (!currentIds.includes(preset.id)) {
        currentIds.push(preset.id);
        await figma.clientStorage.setAsync('custom_presets_list', currentIds);
      }
      figma.ui.postMessage({ type: 'custom-preset-saved', preset });
    }),

    'delete-custom-preset': withErrorHandling(async (msg) => {
      const { presetId } = msg;
      await figma.clientStorage.deleteAsync(`custom_preset_${presetId}`);
      const currentIds = await figma.clientStorage.getAsync('custom_presets_list') || [];
      const filteredIds = currentIds.filter((id: string) => id !== presetId);
      await figma.clientStorage.setAsync('custom_presets_list', filteredIds);
      figma.ui.postMessage({ type: 'custom-preset-deleted', presetId });
    }),

    'get-storage-usage': withErrorHandling(async () => {
      const keys = await figma.clientStorage.keysAsync();
      let totalSize = 0;
      for (const key of keys) {
        const value = await figma.clientStorage.getAsync(key);
        totalSize += new TextEncoder().encode(JSON.stringify(value)).length;
      }
      const totalLimit = 5 * 1024 * 1024; // 5MB
      figma.ui.postMessage({
        type: 'storage-usage-result',
        usage: {
          used: totalSize,
          total: totalLimit,
          percentage: (totalSize / totalLimit) * 100
        }
      });
    })
  };
}

