/**
 * Selection and node manipulation logic
 */

/**
 * Get the currently selected node, or null if selection is invalid
 */
export function getSelectedNode(): SceneNode | null {
  const selection = figma.currentPage.selection;
  console.log('[DEBUG] getSelectedNode called, selection length:', selection.length);
  if (selection.length === 0) {
    console.log('[DEBUG] Selection empty, sending selection-cleared');
    figma.ui.postMessage({ type: 'selection-cleared' });
    return null;
  }
  if (selection.length > 1) {
    console.log('[DEBUG] Multiple nodes selected, sending unsupported-node');
    figma.ui.postMessage({ type: 'unsupported-node', reason: 'multiple' });
    return null;
  }
  return selection[0];
}

/**
 * Get the currently selected image node (backward compatibility)
 * @deprecated Use getSelectedNode instead
 */
export function getSelectedImageNode(): SceneNode | null {
  return getSelectedNode();
}

/**
 * Calculate smart scale factor to ensure exported image fits within maxSize
 * Default increased to 4096 (Figma's absolute limit) for better quality
 */
function calculateSmartScale(width: number, height: number, maxSize: number = 4096): number {
  const maxDimension = Math.max(width, height);
  if (maxDimension <= maxSize) {
    return 1; // No scaling needed
  }
  return maxSize / maxDimension;
}

/**
 * Process the selected image and send it to the UI
 * Handles both nodes with image fills and generic nodes (frames, text, etc.)
 */
export async function processSelectedImage(): Promise<void> {
  console.log('[DEBUG] processSelectedImage called');
  const node = getSelectedNode();
  console.log('[DEBUG] selected node:', node ? node.type : 'null');
  if (!node) {
    return;
  }

  try {
    let imageBytes: Uint8Array;

    // Check if node has an image fill
    if ('fills' in node && node.fills !== figma.mixed) {
      const imageFill = (node.fills as readonly Paint[]).find(
        (fill: Paint): fill is ImagePaint => fill.type === 'IMAGE'
      );

      if (imageFill && imageFill.imageHash) {
        // Case 1: Node has image fill - use existing image
        console.log('[DEBUG] Node has image fill, retrieving image by hash');
        const image = figma.getImageByHash(imageFill.imageHash);
        if (!image) {
          throw new Error('Image not found by hash');
        }
        imageBytes = await image.getBytesAsync();
        console.log('[DEBUG] Got image bytes from hash, length:', imageBytes.length);
      } else {
        // Case 2: Node has fills but no image fill - rasterize the node
        console.log('[DEBUG] Node has fills but no image fill, rasterizing');
        imageBytes = await rasterizeNode(node);
        console.log('[DEBUG] Rasterized node, bytes length:', imageBytes.length);
      }
    } else {
      // Case 3: Node without fills (text, frame, group, etc.) - rasterize the node
      console.log('[DEBUG] Node without fills, rasterizing');
      imageBytes = await rasterizeNode(node);
      console.log('[DEBUG] Rasterized node, bytes length:', imageBytes.length);
    }

    // Send the image data to the UI
    console.log('[DEBUG] Sending selection-updated message to UI');
    figma.ui.postMessage({
      type: 'selection-updated',
      imageBytes
    });
  } catch (error) {

    console.error('[DEBUG] Error processing selection:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    figma.notify('Error processing selection: ' + errorMessage);
    
    // Send error to UI - but don't send unsupported-node with no-image-fill
    // since we now support all node types
    figma.ui.postMessage({ 
      type: 'error', 
      message: `Error processing ${node.type}: ${errorMessage}` 
    });
  }
}

/**
 * Rasterize a node using exportAsync with smart scaling
 */
async function rasterizeNode(node: SceneNode): Promise<Uint8Array> {
  // Get node dimensions - handle nodes that might not have width/height
  let width = 100;
  let height = 100;
  
  if ('width' in node && typeof (node as any).width === 'number') {
    width = (node as any).width as number;
  }
  if ('height' in node && typeof (node as any).height === 'number') {
    height = (node as any).height as number;
  }

  // Ensure minimum dimensions
  if (width <= 0) width = 100;
  if (height <= 0) height = 100;

  // Calculate smart scale to fit within 2048x2048px (performance best practice)
  const scale = calculateSmartScale(width, height, 2048);

  try {
    // Export the node as PNG
    const imageBytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale }
    });

    return imageBytes;
  } catch (error) {
    console.error('Error rasterizing node:', error, 'Node type:', node.type);
    throw new Error(`Failed to rasterize ${node.type}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Chain placement state for "apply as copy" mode
 */
export interface ChainState {
  right: number;
  y: number;
  gap: number;
  parentId: string | null;
  anchorX: number;
  anchorY: number;
}

/**
 * Create or update a new rectangle with image fill at viewport center
 */
export async function createNewImageRectangle(imageBytes: Uint8Array): Promise<void> {
  const newImage = figma.createImage(imageBytes);
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
}

/**
 * Check if node has an image fill
 */
function hasImageFill(node: SceneNode): boolean {
  if (!('fills' in node) || node.fills === figma.mixed) {
    return false;
  }
  return (node.fills as readonly Paint[]).some(
    (fill: Paint) => fill.type === 'IMAGE'
  );
}

/**
 * Create an image overlay rectangle aligned with the source node
 */
export function createImageOverlay(node: SceneNode, imageBytes: Uint8Array): RectangleNode {
  const newImage = figma.createImage(imageBytes);
  const rect = figma.createRectangle();
  
  // Match the original node's dimensions
  if ('width' in node && 'height' in node) {
    rect.resize((node as any).width as number, (node as any).height as number);
  }
  
  // Apply image fill
  const imgFill: ImagePaint = {
    type: 'IMAGE',
    scaleMode: 'FILL',
    imageHash: newImage.hash,
  };
  rect.fills = [imgFill];
  
  // Match position and transform
  if ('x' in node && 'y' in node) {
    rect.x = (node as any).x as number;
    rect.y = (node as any).y as number;
  }
  
  // Match rotation if applicable
  if ('rotation' in node) {
    rect.rotation = (node as any).rotation as number;
  }
  
  // Place in the same parent
  if (node.parent) {
    node.parent.appendChild(rect);
  } else {
    figma.currentPage.appendChild(rect);
  }
  
  return rect;
}

/**
 * Modify existing node with new image fill
 * For nodes without image fills, creates an overlay rectangle instead
 */
export function modifyNodeWithImage(node: SceneNode, imageBytes: Uint8Array): void {
  if (hasImageFill(node)) {
    // Case 1: Node has image fill - update the fill
    const newImage = figma.createImage(imageBytes);
    const newFills = ((node as any).fills as readonly Paint[]).map((fill: Paint) => {
      if (fill.type === 'IMAGE') {
        const newFill = JSON.parse(JSON.stringify(fill));
        (newFill as any).imageHash = newImage.hash;
        return newFill as Paint;
      }
      return fill;
    });
    (node as any).fills = newFills;
  } else {
    // Case 2: Node doesn't have image fill - create overlay rectangle on top
    createImageOverlay(node, imageBytes);
  }
}

/**
 * Duplicate a generic node as an image rectangle and place it next to the original
 */
export function duplicateAsImage(
  node: SceneNode,
  imageBytes: Uint8Array,
  chainState: Record<string, ChainState>
): void {
  const newImage = figma.createImage(imageBytes);
  const rect = figma.createRectangle();
  
  // Match the original node's dimensions
  const baseWidth = ('width' in node ? (node as any).width as number : 100);
  const baseHeight = ('height' in node ? (node as any).height as number : 100);
  rect.resize(baseWidth, baseHeight);
  
  // Apply image fill
  const imgFill: ImagePaint = {
    type: 'IMAGE',
    scaleMode: 'FILL',
    imageHash: newImage.hash,
  };
  rect.fills = [imgFill];
  
  // Calculate placement (same logic as duplicateNodeWithImage)
  const paddingRatio = 0.1; // 10%
  const gap = Math.round(baseWidth * paddingRatio);
  const baseX = ('x' in node ? (node as any).x as number : 0);
  const baseY = ('y' in node ? (node as any).y as number : 0);

  const originId = (node as any).id as string;
  const parentId = node.parent ? (node.parent as any).id as string : null;
  const state = chainState[originId] || {
    right: baseX + baseWidth,
    y: baseY,
    gap,
    parentId,
    anchorX: baseX,
    anchorY: baseY
  };

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
  rect.x = targetX;
  rect.y = state.y;

  // Place in the same parent
  if (node.parent) {
    node.parent.appendChild(rect);
  } else {
    figma.currentPage.appendChild(rect);
  }

  // Update chain state to the end of the new duplicate
  const dupRight = targetX + baseWidth;
  chainState[originId] = {
    right: dupRight,
    y: state.y,
    gap: state.gap,
    parentId,
    anchorX: state.anchorX,
    anchorY: state.anchorY
  };

  // Do NOT change selection to the new copy to avoid triggering heavy
  // selection-updated pipeline on the UI side (prevents lag spikes)
}

/**
 * Duplicate node and place it to the right with spacing
 * For nodes without image fills, uses duplicateAsImage instead
 */
export function duplicateNodeWithImage(
  node: SceneNode,
  imageBytes: Uint8Array,
  chainState: Record<string, ChainState>
): void {
  if (hasImageFill(node)) {
    // Case 1: Node has image fill - duplicate and update fill
    const newImage = figma.createImage(imageBytes);
    const newFills = ((node as any).fills as readonly Paint[]).map((fill: Paint) => {
      if (fill.type === 'IMAGE') {
        const newFill = JSON.parse(JSON.stringify(fill));
        (newFill as any).imageHash = newImage.hash;
        return newFill as Paint;
      }
      return fill;
    });

    // Duplicate the node, place to the right with 10% padding
    // Check if node supports cloning (most nodes with fills do)
    let duplicated: SceneNode;
    if ('clone' in node && typeof node.clone === 'function') {
      duplicated = (node as any).clone();
    } else {
      // Fallback: create a rectangle with the same dimensions
      duplicated = figma.createRectangle();
      if ('width' in node && 'height' in node) {
        (duplicated as any).resize((node as any).width, (node as any).height);
      }
    }
    (duplicated as any).fills = newFills as Paint[];
    const paddingRatio = 0.1; // 10%
    const baseWidth = ('width' in node ? (node as any).width as number : 0);
    const gap = Math.round(baseWidth * paddingRatio);
    const baseX = ('x' in node ? (node as any).x as number : 0);
    const baseY = ('y' in node ? (node as any).y as number : 0);

    const originId = (node as any).id as string;
    const parentId = node.parent ? (node.parent as any).id as string : null;
    const state = chainState[originId] || {
      right: baseX + baseWidth,
      y: baseY,
      gap,
      parentId,
      anchorX: baseX,
      anchorY: baseY
    };

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
    const dupRight = ('x' in duplicated && 'width' in duplicated)
      ? (duplicated as any).x + (duplicated as any).width
      : targetX + baseWidth;
    chainState[originId] = {
      right: dupRight,
      y: state.y,
      gap: state.gap,
      parentId,
      anchorX: state.anchorX,
      anchorY: state.anchorY
    };

    // Do NOT change selection to the new copy to avoid triggering heavy
    // selection-updated pipeline on the UI side (prevents lag spikes)
  } else {
    // Case 2: Node doesn't have image fill - create new rectangle next to original
    duplicateAsImage(node, imageBytes, chainState);
  }
}

