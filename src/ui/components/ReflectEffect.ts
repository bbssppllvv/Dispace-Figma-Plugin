export interface ReflectEffect {
  setOpacity(opacity: number): void;
  setSharpness(sharpness: number): void;
  // No-op in SVG-only pipeline; kept for API compatibility
  updateTexture(textureDataUrl: string, width: number, height: number): void;
  setSoftBlur(stdDeviation: number): void;
  setBatchMode(enabled: boolean): void;
  triggerBatchUpdate(): void;
  setFinalBatchUpdate(enabled: boolean): void;
  destroy(): void;
}

export function createReflectEffect(container: HTMLElement): ReflectEffect {
  // Find the SVG filter in displacement engine
  const svg = container.querySelector('#svgRoot') as SVGSVGElement;
  const filterEl = container.querySelector('#f') as SVGFilterElement;
  
  if (!svg || !filterEl) {
    throw new Error('SVG elements not found for reflect effect');
  }

  // Create reflect chain elements (SVG-only pipeline)
  // 1) Grayscale from existing blurred map (fileMapSoft)
  const reflectGrayElement = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
  reflectGrayElement.id = 'reflectGray';
  reflectGrayElement.setAttribute('type', 'matrix');
  // Standard luminance coefficients, preserve alpha
  reflectGrayElement.setAttribute('values', '0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0');
  reflectGrayElement.setAttribute('in', 'fileMapSoft');
  reflectGrayElement.setAttribute('result', 'reflectGray');

  // 2) Optional blur to match Soft (controlled externally via setSoftBlur)
  const reflectMapBlurElement = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  reflectMapBlurElement.id = 'reflectMapBlur';
  reflectMapBlurElement.setAttribute('in', 'reflectGray');
  reflectMapBlurElement.setAttribute('stdDeviation', '0');
  reflectMapBlurElement.setAttribute('result', 'reflectGrayBlurred');

  // 3) Contrast/black point adjustment (maps from Sharpness)
  const reflectContrastElement = document.createElementNS('http://www.w3.org/2000/svg', 'feComponentTransfer');
  reflectContrastElement.id = 'reflectContrast';
  reflectContrastElement.setAttribute('in', 'reflectGrayBlurred');
  reflectContrastElement.setAttribute('result', 'reflectAdjusted');
  const rcR = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncR');
  rcR.setAttribute('type', 'table');
  rcR.setAttribute('tableValues', '0 1'); // identity by default
  const rcG = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncG');
  rcG.setAttribute('type', 'table');
  rcG.setAttribute('tableValues', '0 1');
  const rcB = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncB');
  rcB.setAttribute('type', 'table');
  rcB.setAttribute('tableValues', '0 1');
  reflectContrastElement.appendChild(rcR);
  reflectContrastElement.appendChild(rcG);
  reflectContrastElement.appendChild(rcB);

  // 4) Opacity application
  const reflectOpacityElement = document.createElementNS('http://www.w3.org/2000/svg', 'feComponentTransfer');
  reflectOpacityElement.id = 'reflectOpacity';
  reflectOpacityElement.setAttribute('in', 'reflectAdjusted');
  reflectOpacityElement.setAttribute('result', 'reflectMapWithOpacity');
  const opacityFunc = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncA');
  opacityFunc.setAttribute('type', 'table');
  opacityFunc.setAttribute('tableValues', '0 0');
  reflectOpacityElement.appendChild(opacityFunc);

  // 5) Blend reflect over original displaced image
  const reflectBlendElement = document.createElementNS('http://www.w3.org/2000/svg', 'feBlend');
  reflectBlendElement.id = 'reflectBlend';
  reflectBlendElement.setAttribute('mode', 'screen');
  reflectBlendElement.setAttribute('in2', 'reflectMapWithOpacity');
  reflectBlendElement.setAttribute('result', 'reflectedResult');

  // Update blend to use map with opacity (set above)

  // Effect state
  let opacity = 0; // 0-100
  let sharpness = 50; // 0-100 UI, where 50 = normal effect (internal 100)
  let originalMergeInput = 'clippedResult'; // Remember original input
  
  // Batch mode state
  let isBatchMode = false;
  let isFinalBatchUpdate = false; // Special flag for final batch texture updates
  // pendingTextureUpdate removed (not used in SVG-only pipeline)
  let pendingOpacityUpdate: number | null = null;
  let pendingSharpnessUpdate: number | null = null;

  function insertReflectElements() {
    // Find the last feMerge element to insert before it
    const mergeElement = filterEl.querySelector('feMerge');
    if (mergeElement) {
      const mergeNode = mergeElement.querySelector('feMergeNode');
      if (mergeNode) {
        originalMergeInput = mergeNode.getAttribute('in') || 'clippedResult';
      }
      
      // Insert our elements before feMerge in proper order:
      // gray -> blur -> contrast -> opacity -> blend
      filterEl.insertBefore(reflectGrayElement, mergeElement);
      filterEl.insertBefore(reflectMapBlurElement, mergeElement);
      filterEl.insertBefore(reflectContrastElement, mergeElement);
      filterEl.insertBefore(reflectOpacityElement, mergeElement);
      filterEl.insertBefore(reflectBlendElement, mergeElement);
    }
  }

  function updateEffect() {
    const mergeElement = filterEl.querySelector('feMerge');
    const mergeNode = mergeElement?.querySelector('feMergeNode');
    const normalizedOpacity = opacity / 100;
    
    // Update opacity
    opacityFunc.setAttribute('tableValues', `0 ${normalizedOpacity}`);
    
    if (mergeNode) {
      if (opacity > 0) {
        // Enable effect: use the result of reflect blend
        reflectBlendElement.setAttribute('in', originalMergeInput);
        mergeNode.setAttribute('in', 'reflectedResult');
      } else {
        // Disable effect: return to original input
        mergeNode.setAttribute('in', originalMergeInput);
      }
    }
  }

  // Initialization
  insertReflectElements();
  updateEffect(); // Apply initial state

  // No canvas preprocessing in SVG-only pipeline

  return {
    setSoftBlur(stdDeviation: number) {
      try {
        reflectMapBlurElement.setAttribute('stdDeviation', String(Math.max(0, stdDeviation)));
      } catch {}
    },
    setOpacity(newOpacity: number) {
      console.log('🪞 [REFLECT] setOpacity called:', opacity, '=>', newOpacity, 'batch mode:', isBatchMode);
      
      const clampedOpacity = Math.max(0, Math.min(100, newOpacity));
      
      if (isBatchMode) {
        console.log('🛡️ [REFLECT] Deferring opacity update due to batch mode');
        pendingOpacityUpdate = clampedOpacity;
        return;
      }
      
      opacity = clampedOpacity;
      console.log('🪞 [REFLECT] Calling updateEffect - this may cause visual update');
      updateEffect();
    },

    setSharpness(newSharpness: number) {
      console.log('🪞 [REFLECT] setSharpness called:', sharpness, '=>', newSharpness, 'batch mode:', isBatchMode);
      
      const clampedSharpness = Math.max(0, Math.min(100, newSharpness));
      
      if (isBatchMode) {
        console.log('🛡️ [REFLECT] Deferring sharpness update due to batch mode');
        pendingSharpnessUpdate = clampedSharpness;
        return;
      }
      
      sharpness = clampedSharpness;
      // LUT: порог хайлайтов + поджатие верхов к белому
      const t = sharpness / 100;               // 0..1
      const threshold = 0.60 + 0.35 * t;       // 0.60..0.95 — выше t → жестче отсечка тёмного/середины
      const gamma = 1.0 - 0.5 * t;             // 1.0..0.5 — ниже → быстрее тянет к белому вверху
      const samples = 21;                      // сглаженность кривой (16–33 ок)
      const values: string[] = [];
      for (let i = 0; i < samples; i++) {
        const x = i / (samples - 1); // вход [0..1]
        const y = x < threshold ? 0 : Math.pow((x - threshold) / (1 - threshold || 1e-6), gamma);
        values.push(String(Math.max(0, Math.min(1, y))));
      }
      const table = values.join(' ');
      rcR.setAttribute('type', 'table'); rcR.setAttribute('tableValues', table);
      rcG.setAttribute('type', 'table'); rcG.setAttribute('tableValues', table);
      rcB.setAttribute('type', 'table'); rcB.setAttribute('tableValues', table);
    },

    // No-op in SVG-only pipeline; reflect uses existing fileMapSoft
    updateTexture(_textureDataUrl: string, _width: number, _height: number) {},

    setBatchMode(enabled: boolean) {
      console.log('🛡️ [REFLECT] setBatchMode:', isBatchMode, '=>', enabled);
      isBatchMode = enabled;
      
      if (!enabled) {
        // Exiting batch mode - apply any pending updates immediately
        console.log('🛡️ [REFLECT] Exiting batch mode, applying pending updates');
        
        // Apply pending opacity update
        if (pendingOpacityUpdate !== null) {
          console.log('🪞 [REFLECT] Applying deferred opacity update:', pendingOpacityUpdate);
          opacity = pendingOpacityUpdate;
          pendingOpacityUpdate = null;
          updateEffect();
        }
        
        // Apply pending sharpness update  
        if (pendingSharpnessUpdate !== null) {
          console.log('🪞 [REFLECT] Applying deferred sharpness update:', pendingSharpnessUpdate);
          sharpness = pendingSharpnessUpdate;
          pendingSharpnessUpdate = null;
          // Note: triggerBatchUpdate will handle texture reprocessing with new sharpness
        }
      }
    },

    triggerBatchUpdate() {
      console.log('🪞 [REFLECT] triggerBatchUpdate called');
      // Apply pending param updates at once
      if (pendingOpacityUpdate !== null) {
        opacity = pendingOpacityUpdate;
        pendingOpacityUpdate = null;
      }
      if (pendingSharpnessUpdate !== null) {
        sharpness = pendingSharpnessUpdate;
        pendingSharpnessUpdate = null;
        const t = sharpness / 100;
        const threshold = 0.60 + 0.35 * t;
        const gamma = 1.0 - 0.5 * t;
        const samples = 21;
        const values: string[] = [];
        for (let i = 0; i < samples; i++) {
          const x = i / (samples - 1);
          const y = x < threshold ? 0 : Math.pow((x - threshold) / (1 - threshold || 1e-6), gamma);
          values.push(String(Math.max(0, Math.min(1, y))));
        }
        const table = values.join(' ');
        rcR.setAttribute('type', 'table'); rcR.setAttribute('tableValues', table);
        rcG.setAttribute('type', 'table'); rcG.setAttribute('tableValues', table);
        rcB.setAttribute('type', 'table'); rcB.setAttribute('tableValues', table);
      }
      updateEffect();
    },

    setFinalBatchUpdate(enabled: boolean) {
      isFinalBatchUpdate = enabled;
      console.log('🪞 [REFLECT] setFinalBatchUpdate called:', isFinalBatchUpdate);
    },

    destroy() {
      // Remove our elements
      reflectGrayElement.remove();
      reflectMapBlurElement.remove();
      reflectContrastElement.remove();
      reflectOpacityElement.remove();
      reflectBlendElement.remove();
      
      // Restore original feMerge
      const mergeElement = filterEl.querySelector('feMerge');
      const mergeNode = mergeElement?.querySelector('feMergeNode');
      if (mergeNode) {
        mergeNode.setAttribute('in', originalMergeInput);
      }
    }
  };
} 