// Minimal worker: open the UI iframe
async function main() {
  figma.showUI(__html__, { width: 720, height: 400 });

  // Загружаем кастомные пресеты в фоне, не блокируя запуск UI
  loadAndSendCustomPresets();

  // Общая функция для загрузки кастомных пресетов
  async function loadAndSendCustomPresets() {
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
        presets: presets.sort((a, b) => b.createdAt - a.createdAt)
      });
    } catch (error) {
      console.error('Error loading custom presets:', error);
      figma.ui.postMessage({
        type: 'custom-presets-load-error',
        error: String(error)
      });
    }
  }

  // Function to get the selected image and send it to the UI
  async function processSelectedImage() {
    const node = getSelectedImageNode();
    if (!node || node.fills === figma.mixed) {
      return;
    }

    // Find the first image fill
    const imageFill = (node.fills as readonly Paint[]).find((fill: Paint): fill is ImagePaint => fill.type === 'IMAGE');

    if (!imageFill || !imageFill.imageHash) {
      figma.ui.postMessage({ type: 'unsupported-node', reason: 'no-image-fill' });
      return;
    }

    // Get the image data
    try {
      const image = figma.getImageByHash(imageFill.imageHash);
      if (!image) {
        throw new Error('Image not found by hash');
      }

      const imageBytes = await image.getBytesAsync();

      // Send the image data to the UI
      figma.ui.postMessage({
        type: 'selection-updated',
        imageBytes
      });
    } catch (error) {
      console.error('Error getting image:', error);
      figma.notify('Error getting image: ' + String(error));
      figma.ui.postMessage({ type: 'error', message: 'Error getting image' });
    }
  }

  function getSelectedImageNode() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.ui.postMessage({ type: 'selection-cleared' });
      return null;
    }
    if (selection.length > 1) {
      figma.ui.postMessage({ type: 'unsupported-node', reason: 'multiple' });
      return null;
    }
    const node = selection[0];
    if (!('fills' in node) || node.fills === figma.mixed) {
      figma.ui.postMessage({ type: 'unsupported-node', reason: 'vector' });
      return null;
    }
    return node;
  }

  // Listen for selection changes
  figma.on('selectionchange', processSelectedImage);

  // Higher-order function for message handling with error catching
  const withErrorHandling = (handler: (msg: any) => Promise<void>) => {
    return async (msg: any) => {
      try {
        await handler(msg);
      } catch (error) {
        console.error(`Error in handler for ${msg.type}:`, error);
        figma.notify(`Error: ${String(error)}`);
        figma.ui.postMessage({ type: `${msg.type}-error`, error: String(error) });
      }
    };
  };

  // Handlers for UI messages
  // Session-scoped chain placement state for "apply as copy"
  const chainState: Record<string, { right: number; y: number; gap: number; parentId: string | null; anchorX: number; anchorY: number }> = {};
  const messageHandlers: { [type: string]: (msg: any) => Promise<void> } = {
    // UI handshake: when UI is ready, (re)send current selection and presets
    'ui-ready': withErrorHandling(async () => {
      // Ensure presets are available in UI (in case initial send happened before UI listeners attached)
      await loadAndSendCustomPresets();
      // Send current selection state
      await processSelectedImage();
    }),
    'apply-displacement-result': withErrorHandling(async (msg) => {
      // Try to use current selection; if absent, create a new image rectangle centered in the viewport
      let node = getSelectedImageNode();
      try {
        const newImage = figma.createImage(msg.imageBytes);

        if (!node || node.fills === figma.mixed) {
          // No valid selection → insert a new rectangle with the image fill at viewport center
          const size = await newImage.getSizeAsync();
          const rect = figma.createRectangle();
          rect.resize(size.width, size.height);
          const imgFill: ImagePaint = {
            type: 'IMAGE',
            scaleMode: 'FILL',
            imageHash: newImage.hash,
          };
          rect.fills = [imgFill];
          figma.currentPage.appendChild(rect);
          const center = figma.viewport.center;
          rect.x = center.x - rect.width / 2;
          rect.y = center.y - rect.height / 2;
          figma.currentPage.selection = [rect];
        } else {
          // Modify/copy the existing selection as before
          const newFills = (node.fills as readonly Paint[]).map((fill: Paint) => {
            if (fill.type === 'IMAGE') {
              const newFill = JSON.parse(JSON.stringify(fill));
              (newFill as any).imageHash = newImage.hash;
              return newFill as Paint;
            }
            return fill;
          });
          const mode = (msg && msg.mode) === 'copy' ? 'copy' : 'modify';
          if (mode === 'modify') {
            node.fills = newFills;
          } else {
            // Duplicate the node, place to the right with 10% padding
            const duplicated = node.clone();
            duplicated.fills = newFills as Paint[];
            const paddingRatio = 0.1; // 10%
            const baseWidth = ('width' in node ? (node as any).width as number : 0);
            const gap = Math.round(baseWidth * paddingRatio);
            const baseX = ('x' in node ? (node as any).x as number : 0);
            const baseY = ('y' in node ? (node as any).y as number : 0);

            const originId = (node as any).id as string;
            const parentId = node.parent ? (node.parent as any).id as string : null;
            const state = chainState[originId] || { right: baseX + baseWidth, y: baseY, gap, parentId, anchorX: baseX, anchorY: baseY };
            // Reset state if parent changed OR original moved (x/y changed)
            if (state.parentId !== parentId || state.anchorX !== baseX || state.anchorY !== baseY) {
              state.right = baseX + baseWidth;
              state.y = baseY;
              state.parentId = parentId;
              state.gap = gap;
              state.anchorX = baseX;
              state.anchorY = baseY;
            }
            const targetX = state.right + state.gap;

            if ('x' in duplicated) (duplicated as any).x = targetX;
            if ('y' in duplicated) (duplicated as any).y = state.y;
            // Ensure it stays in same parent
            if (node.parent) {
              node.parent.appendChild(duplicated);
            }
            // Update chain state to the end of the new duplicate
            const dupRight = ('x' in duplicated && 'width' in duplicated) ? (duplicated as any).x + (duplicated as any).width : targetX + baseWidth;
            chainState[originId] = { right: dupRight, y: state.y, gap: state.gap, parentId, anchorX: state.anchorX, anchorY: state.anchorY };
            // Do NOT change selection to the new copy to avoid triggering heavy
            // selection-updated pipeline on the UI side (prevents lag spikes)
          }
        }
        figma.notify('Displacement effect applied successfully!');
        figma.ui.postMessage({ type: 'apply-success' });
      } catch (error) {
        console.error('Error creating image:', error);
        
        // Provide specific error messages for common issues
        let errorMessage = 'Failed to apply effect';
        if (error instanceof Error) {
          if (error.message.includes('Image is too large')) {
            errorMessage = 'Image is too large for Figma (max 4096px). The effect was downscaled but may need further size reduction.';
            figma.notify(errorMessage);
          } else if (error.message.includes('Image is too small')) {
            errorMessage = 'Generated image is too small';
            figma.notify(errorMessage);
          } else if (error.message.includes('Image type is unsupported')) {
            errorMessage = 'Generated image format is not supported';
            figma.notify(errorMessage);
          } else {
            figma.notify(`${errorMessage}: ${error.message}`);
          }
        } else {
          figma.notify(errorMessage);
        }
        
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

  // Handle messages from the UI
  figma.ui.onmessage = async (msg) => {
    const handler = messageHandlers[msg.type];
    if (handler) {
      await handler(msg);
    }
  };

  // Initial processing of selection
  await processSelectedImage();
}

main(); 