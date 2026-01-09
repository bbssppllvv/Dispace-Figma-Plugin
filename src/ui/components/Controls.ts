import { DisplacementEngine } from "../engine";
import { createTooltip } from './Tooltip.js';
import { createElement, appendChildren } from "../utils/dom";
import { LightPositionHandle } from './LightPositionHandle';
import type { TooltipData } from '../presets/types';

// Define the public API for a slider instance.
export interface SliderInstance {
  setValue(newValue: number, triggerCallback?: boolean): void;
  getValue(): number;
  container: HTMLElement;
  // Add batch mode support
  setBatchMode?(enabled: boolean): void;
  updateVisuals?(): void;
}

export type ControlsMap = {
  strength: SliderInstance;
  scale: SliderInstance;
  soft: SliderInstance;
  chromatic: SliderInstance;
  blur: SliderInstance;
  noise: SliderInstance;
  grain: SliderInstance;
  grainSize: SliderInstance;
  reflectStrength: SliderInstance;
  reflectSoft: SliderInstance;
  reflectSharp: SliderInstance;
  lightHandle: LightPositionHandle;
  updateTooltips: (tooltips: TooltipData[]) => void;
  // Batch control methods
  setBatchMode: (enabled: boolean) => void;
  updateAllVisuals: () => void;
};

/**
 * Creates a custom, accessible, and reliable slider component.
 */
function createSlider(
  container: HTMLElement,
  onValueChange: (value: number) => void
): SliderInstance {
  // --- Configuration ---
  const min = parseFloat(container.dataset.min || '0');
  const max = parseFloat(container.dataset.max || '100');
  const step = parseFloat(container.dataset.step || '1');
  const isBipolar = container.classList.contains('bipolar-slider');
  const snapThreshold = parseFloat(container.dataset.snapThreshold || '0');
  let value = parseFloat(container.dataset.initialValue || (isBipolar ? '0' : String(min)));
  
  // Batch mode support
  let isInBatchMode = false;
  let pendingValue: number | null = null;

  // --- DOM elements ---
      // AFTER: Safe creation of DOM elements
  const trackFill = createElement('div', { className: 'track-fill' });
  const thumb = createElement('div', { className: 'thumb' });
  
  appendChildren(container, [trackFill, thumb]);

  // Validate DOM elements were created
  if (!trackFill || !thumb) {
    throw new Error('Failed to create slider DOM elements');
  }

  // --- Update Function ---
  function updateVisuals(v: number) {
    const percent = ((v - min) / (max - min)) * 100;
    thumb.style.left = `${percent}%`;
    
    if (isBipolar) {
      const zeroPercent = ((0 - min) / (max - min)) * 100;
      if (v >= 0) {
        trackFill.style.left = `${zeroPercent}%`;
        trackFill.style.width = `${percent - zeroPercent}%`;
      } else {
        trackFill.style.left = `${percent}%`;
        trackFill.style.width = `${zeroPercent - percent}%`;
      }
    } else {
      trackFill.style.width = `${percent}%`;
    }
  }

  function updateValue(newValue: number, triggerCallback = true) {
    // Constrain value
    newValue = Math.max(min, Math.min(max, newValue));
    
    // Snap to 0 if bipolar and within threshold
    if (isBipolar && Math.abs(newValue) < snapThreshold) {
      newValue = 0;
    }

    // Round to step
    if (step > 0) {
      newValue = Math.round(newValue / step) * step;
    }
    
    // Fix floating point errors
    newValue = parseFloat(newValue.toFixed(2));

    // Only update if value changed or forced
    if (value !== newValue) {
      value = newValue;
      
      // In batch mode, we update internal value but defer visual update
      if (isInBatchMode) {
        // Visuals deferred
        pendingValue = value;
        // console.log('🛡️ [SLIDER] Visual update deferred for', container.id);
      } else {
        updateVisuals(value);
      }
      
      if (triggerCallback) {
        onValueChange(value);
        
        // Dispatch event for HUD
        const label = container.parentElement?.querySelector('label')?.textContent || '';
        const event = new CustomEvent('slider:changing', {
          detail: { label, formatted: value.toString() }
        });
        document.dispatchEvent(event);
      }
    }
  }

  // Initial update
  updateVisuals(value);

  // --- Interaction Handlers ---
  let isDragging = false;

  const onPointerDown = (e: PointerEvent) => {
    isDragging = true;
    container.classList.add('active');
    container.setPointerCapture(e.pointerId);
    handleMove(e);
    
    // Dispatch start event for HUD
    document.dispatchEvent(new CustomEvent('slider:drag-start'));
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    handleMove(e);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    container.classList.remove('active');
    container.releasePointerCapture(e.pointerId);
    
    // Dispatch end event for HUD
    document.dispatchEvent(new CustomEvent('slider:drag-end'));
  };

  const handleMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const range = max - min;
    const newValue = min + range * percent;
    updateValue(newValue, true);
  };

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp); // Handle cancellation

  return {
    setValue: (v: number, triggerCallback = true) => updateValue(v, triggerCallback), // programmatic update
    getValue: () => value,
    container,
    setBatchMode: (enabled: boolean) => {
      isInBatchMode = enabled;
      if (!enabled && pendingValue !== null) {
        updateVisuals(pendingValue);
        pendingValue = null;
      }
    },
    updateVisuals: () => updateVisuals(value)
  };
}

/**
 * Initializes all sliders and connects them to the engine.
 */
export function initControls(engine: DisplacementEngine, tooltipsData?: TooltipData[]): ControlsMap | null {
  // Safe selector helper
  const getSlider = (id: string): HTMLElement | null => document.getElementById(id);

  // Required sliders
  const strengthEl = getSlider('strength');
  const scaleEl = getSlider('scale');
  const softEl = getSlider('soft');
  const chromaticEl = getSlider('chromatic');
  const blurEl = getSlider('blur');
  const noiseEl = getSlider('noise');
  const grainEl = getSlider('grain');
  const grainSizeEl = getSlider('grain-size');
  const reflectStrengthEl = getSlider('reflect-strength');
  const reflectSoftEl = getSlider('reflect-soft');
  const reflectSharpEl = getSlider('reflect-sharp');

  // Validate presence
  if (!strengthEl || !scaleEl || !softEl || !chromaticEl || !blurEl || !noiseEl || !grainEl || !grainSizeEl || !reflectStrengthEl || !reflectSoftEl || !reflectSharpEl) {
    console.error("One or more slider elements not found");
    return null;
  }

  // --- Create Sliders ---
  
  // Track batch mode state for triggerUpdate
  let isControlsBatchMode = false;
  
  // Define a debounced trigger update helper
  const triggerUpdate = () => {
    // Skip triggerUpdate in batch mode - updates will be triggered manually via triggerBatchUpdate
    if (isControlsBatchMode) {
      return;
    }
    
    // We can use engine.triggerUpdate which handles debouncing internally
    // or relies on requestAnimationFrame.
    // For sliders, we might want to be slightly more aggressive than
    // standard debounce if we want smooth 60fps, but the engine handles it.
    if (engine.triggerUpdate) {
      engine.triggerUpdate();
    }
  };

  const strength = createSlider(strengthEl, (v) => {
    engine.setStrength(v);
    triggerUpdate();
  });

  const scale = createSlider(scaleEl, (v) => {
    engine.setScale(v);
    triggerUpdate();
  });

  const soft = createSlider(softEl, (v) => {
    engine.setSoft(v);
    triggerUpdate();
  });

  const chromatic = createSlider(chromaticEl, (v) => {
    engine.setChromaticAberration(v);
    triggerUpdate();
  });

  const blur = createSlider(blurEl, (v) => {
    engine.setBlur(v);
    triggerUpdate();
  });

  const noise = createSlider(noiseEl, (v) => {
    engine.setDissolveStrength(v);
    triggerUpdate();
  });

  const grain = createSlider(grainEl, (v) => {
    engine.setGrain(v);
    triggerUpdate();
  });

  const grainSize = createSlider(grainSizeEl, (v) => {
    engine.setGrainSize(v);
    triggerUpdate();
  });

  const reflectStrength = createSlider(reflectStrengthEl, (v) => {
    engine.setReflectStrength(v);
    triggerUpdate();
  });

  const reflectSoft = createSlider(reflectSoftEl, (v) => {
    engine.setReflectSoftness(v);
    triggerUpdate();
  });

  const reflectSharp = createSlider(reflectSharpEl, (v) => {
    engine.setReflectSharpness(v);
    triggerUpdate();
  });

  // --- Light Position Handle ---
  const previewContainer = document.getElementById('preview');
  if (!previewContainer) {
    console.error("Preview container not found");
    return null;
  }
  const lightHandle = new LightPositionHandle(previewContainer, engine);

  // --- Tooltips ---
  const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg width='200' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%232c2c2c'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' font-family='sans-serif' font-size='14' text-anchor='middle' dy='.3em'%3EPreview%3C/text%3E%3C/svg%3E";
  const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/bbssppllvv/Dispace-Figma-Plugin/main';
  
  const tooltipInstances: Record<string, any> = {};

  const attachTooltip = (id: string, defaultContent: string, data?: TooltipData[]) => {
    const label = document.querySelector(`label[for="${id}"]`) as HTMLElement;
    if (label) {
      const customData = (data || tooltipsData)?.find(t => t.id === id);
      const content = customData?.description || defaultContent;
      let image = PLACEHOLDER_IMG;
      
      if (customData?.imageUrl) {
        if (customData.imageUrl.startsWith('/api/tooltip/')) {
          const fileName = customData.imageUrl.replace('/api/tooltip/', '');
          image = `${GITHUB_RAW_BASE}/assets/tooltip-images/${fileName}`;
        } else {
          image = customData.imageUrl;
        }
      }
      
      if (tooltipInstances[id]) {
        tooltipInstances[id].updateContent(content, image);
      } else {
        tooltipInstances[id] = createTooltip(label, { content, image });
      }
    }
  };

  const initAllTooltips = (data?: TooltipData[]) => {
    attachTooltip('strength', "Distortion Intensity - Controls how much the image is displaced by the map.", data);
    attachTooltip('scale', "Map Scale - Adjusts the size of the displacement map texture relative to the image.", data);
    attachTooltip('soft', "Softness - Applies a blur to the displacement map itself for smoother transitions.", data);
    attachTooltip('chromatic', "Chromatic Aberration - Separates color channels based on displacement intensity.", data);
    attachTooltip('blur', "Blur - Blurs the final displaced image.", data);
    attachTooltip('noise', "Dissolve Noise - Adds a noise-based dissolve effect to alpha channel.", data);
    attachTooltip('grain', "Grain - Adds film grain noise texture to the image.", data);
    attachTooltip('grain-size', "Grain Size - Controls the coarseness of the grain particles.", data);
    attachTooltip('reflect-strength', "Reflect Strength - Controls the intensity of the reflection highlights.", data);
    attachTooltip('reflect-soft', "Reflect Softness - Controls how much the light spreads over the surface.", data);
    attachTooltip('reflect-sharp', "Reflect Sharpness - Controls how focused the reflection highlights are.", data);
  };

  initAllTooltips();

  const updateTooltips = (data: TooltipData[]) => {
    initAllTooltips(data);
  };

  // --- Interaction State Handling ---
  // Progressive rendering optimization: lower resolution while dragging
  document.addEventListener('slider:drag-start', () => {
    if (engine.setInteractionState) {
      engine.setInteractionState(true);
    }
  });

  document.addEventListener('slider:drag-end', () => {
    if (engine.setInteractionState) {
      engine.setInteractionState(false);
    }
  });

  // Batch control helper
  const setBatchMode = (enabled: boolean) => {
    isControlsBatchMode = enabled;
    [strength, scale, soft, chromatic, blur, noise, grain, grainSize, reflectStrength, reflectSoft, reflectSharp].forEach(s => {
      if ((s as SliderInstance).setBatchMode) (s as SliderInstance).setBatchMode!(enabled);
    });
  };

  const updateAllVisuals = () => {
    [strength, scale, soft, chromatic, blur, noise, grain, grainSize, reflectStrength, reflectSoft, reflectSharp].forEach(s => {
      if ((s as SliderInstance).updateVisuals) (s as SliderInstance).updateVisuals!();
    });
    
    // Also update light handle from engine state
    const settings = engine.getCurrentEffectSettings();
    lightHandle.setPosition(settings.reflectLightX, settings.reflectLightY);
  };

  return {
    strength,
    scale,
    soft,
    chromatic,
    blur,
    noise,
    grain,
    grainSize,
    reflectStrength,
    reflectSoft,
    reflectSharp,
    lightHandle,
    updateTooltips,
    setBatchMode,
    updateAllVisuals
  };
}
