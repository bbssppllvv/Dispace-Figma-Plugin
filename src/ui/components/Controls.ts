import { DisplacementEngine } from "../engine";
import { createTooltip } from './Tooltip.js';
import { createElement, appendChildren } from "../utils/dom";

// Define the public API for a slider instance.
export interface SliderInstance {
  setValue(newValue: number): void;
  getValue(): number;
  container: HTMLElement;
  // Add batch mode support
  setBatchMode?(enabled: boolean): void;
  updateVisuals?(): void;
}

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
  // ✅ ПОСЛЕ: Безопасное создание DOM элементов
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
      trackFill.style.left = `${Math.min(percent, zeroPercent)}%`;
      trackFill.style.width = `${Math.abs(percent - zeroPercent)}%`;
    } else {
      trackFill.style.left = '0%';
      trackFill.style.width = `${percent}%`;
    }

    // Update ARIA attributes
    container.setAttribute('aria-valuenow', v.toString());
    container.setAttribute('aria-valuetext', `${v.toFixed(step < 1 ? 1 : 0)}`);
  }

  // --- Interaction Logic ---
  let isDragging = false;
  
  const handleInteraction = (e: MouseEvent | TouchEvent) => {
    e.preventDefault(); // Prevent default browser actions like text selection
    const rect = container.getBoundingClientRect();
    
    // Prevent division by zero
    if (rect.width <= 0) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percent = (x / rect.width);
    
    const rawValue = min + percent * (max - min);
    
    // Prevent division by zero in step calculation
    const steppedValue = step > 0 ? Math.round(rawValue / step) * step : rawValue;
    
    value = Math.max(min, Math.min(max, steppedValue));
    updateVisuals(value);
    onValueChange(value);

    // Emit HUD update during live interaction when not batching
    if (!isInBatchMode) {
      const labelEl = document.querySelector(`label[for="${container.id}"]`) as HTMLElement | null;
      const labelText = labelEl ? labelEl.textContent || container.id : container.id;
      const formatted = (step < 1 ? value.toFixed(1) : Math.round(value).toString());
      const evt = new CustomEvent('slider:changing', {
        detail: {
          id: container.id,
          label: labelText,
          value,
          formatted
        }
      });
      document.dispatchEvent(evt);
    }
  };

  const startDragging = (e: MouseEvent | TouchEvent) => {
    isDragging = true;
    container.focus();
    // Signal drag start for HUD
    if (!isInBatchMode) {
      const evt = new CustomEvent('slider:drag-start', { detail: { id: container.id } });
      document.dispatchEvent(evt);
    }
    handleInteraction(e); // Call once to handle initial click
    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('touchmove', handleInteraction);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchend', stopDragging);
  };

  const stopDragging = () => {
    if (!isDragging) return;
    isDragging = false;

    if (isBipolar && snapThreshold && Math.abs(value) <= snapThreshold) {
      value = 0;
      updateVisuals(value);
      onValueChange(value);
    }
    
    window.removeEventListener('mousemove', handleInteraction);
    window.removeEventListener('touchmove', handleInteraction);
    window.removeEventListener('mouseup', stopDragging);
    window.removeEventListener('touchend', stopDragging);

    // Signal drag end for HUD
    if (!isInBatchMode) {
      const evt = new CustomEvent('slider:drag-end', { detail: { id: container.id } });
      document.dispatchEvent(evt);
    }
  };

  // --- Keyboard Navigation ---
  container.addEventListener('keydown', (e) => {
    const keyEvent = e as KeyboardEvent;
    let newValue = value;
    const stepSize = step;
    const largeStepSize = (max - min) / 10; // 10% steps for Page Up/Down

    switch (keyEvent.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        newValue = Math.min(max, value + stepSize);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        newValue = Math.max(min, value - stepSize);
        break;
      case 'PageUp':
        e.preventDefault();
        newValue = Math.min(max, value + largeStepSize);
        break;
      case 'PageDown':
        e.preventDefault();
        newValue = Math.max(min, value - largeStepSize);
        break;
      case 'Home':
        e.preventDefault();
        newValue = min;
        break;
      case 'End':
        e.preventDefault();
        newValue = max;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        // Reset to zero for bipolar sliders, or middle value for regular sliders
        newValue = isBipolar ? 0 : (min + max) / 2;
        break;
      default:
        return;
    }

    if (newValue !== value) {
      value = newValue;
      updateVisuals(value);
      onValueChange(value);

      // Emit HUD update on keyboard adjustments when not batching
      if (!isInBatchMode) {
        const labelEl = document.querySelector(`label[for="${container.id}"]`) as HTMLElement | null;
        const labelText = labelEl ? labelEl.textContent || container.id : container.id;
        const formatted = (step < 1 ? value.toFixed(1) : Math.round(value).toString());
        const evt = new CustomEvent('slider:changing', {
          detail: { id: container.id, label: labelText, value, formatted }
        });
        document.dispatchEvent(evt);
      }
    }
  });

  container.addEventListener('mousedown', startDragging);
  container.addEventListener('touchstart', startDragging);

  // --- Public API ---
  const instance: SliderInstance = {
    setValue(newValue: number) {
      const oldValue = value;
      value = Math.max(min, Math.min(max, newValue));
      console.log(`🎚️ [SLIDER] setValue called on ${container.id || 'unknown'}: ${oldValue} => ${value}, batch mode: ${isInBatchMode}`);
      
      if (isInBatchMode) {
        // In batch mode, store the value but don't update visuals yet
        pendingValue = value;
        console.log(`🛡️ [SLIDER] Visual update deferred for ${container.id || 'unknown'}`);
      } else {
        // Normal mode - update visuals immediately
        updateVisuals(value);
      }
      
      // Always update the engine state
      console.log(`⚙️ [SLIDER] Calling onValueChange for ${container.id || 'unknown'}`);
      onValueChange(value);
    },
    
    setBatchMode(enabled: boolean) {
      console.log(`🛡️ [SLIDER] setBatchMode ${enabled} for ${container.id || 'unknown'}`);
      isInBatchMode = enabled;
      
      // If exiting batch mode and we have a pending visual update, apply it now
      if (!enabled && pendingValue !== null) {
        console.log(`🎨 [SLIDER] Applying deferred visual update for ${container.id || 'unknown'}: ${pendingValue}`);
        updateVisuals(pendingValue);
        pendingValue = null;
      }
    },
    
    updateVisuals() {
      console.log(`🎨 [SLIDER] Manual updateVisuals called for ${container.id || 'unknown'}: ${value}`);
      updateVisuals(value);
    },
    
    getValue: () => value,
    container,
  };

  instance.setValue(value);
  return instance;
}

/**
 * Initializes all custom sliders and returns their instances.
 */
export function initControls(engine: DisplacementEngine) {
  if (!engine) return null;

  // Get all slider elements with null checks
  const strengthEl = document.getElementById('strength');
  const scaleEl = document.getElementById('scale');
  const softEl = document.getElementById('soft');
  const chromaticEl = document.getElementById('chromatic');
  const blurEl = document.getElementById('blur');
  const noiseEl = document.getElementById('noise');
  const reflectOpacityEl = document.getElementById('reflect-opacity');
  const reflectSharpnessEl = document.getElementById('reflect-sharpness');

  // Check if all required elements exist
  if (!strengthEl || !scaleEl || !softEl || !chromaticEl || 
      !blurEl || !noiseEl || !reflectOpacityEl || !reflectSharpnessEl) {
    console.error('Required slider elements not found in DOM');
    return null;
  }

  const sliders = {
    strength: createSlider(strengthEl, (v) => engine.setStrength(v)),
    scale: createSlider(scaleEl, (v) => engine.setScale(v)),
    soft: createSlider(softEl, (v) => engine.setSoft(v)),
    chromatic: createSlider(chromaticEl, (v) => engine.setChromaticAberration(v)),
    blur: createSlider(blurEl, (v) => engine.setBlur(v)),
    noise: createSlider(noiseEl, (v) => engine.setDissolveStrength(v)),
    reflectOpacity: createSlider(reflectOpacityEl, (v) => engine.setReflectOpacity(v)),
    reflectSharpness: createSlider(reflectSharpnessEl, (v) => engine.setReflectSharpness(v)),
  };
  
  // Add batch mode control methods to the sliders object
  const slidersWithBatchControl = {
    ...sliders,
    setBatchMode(enabled: boolean) {
      console.log(`🛡️ [CONTROLS] Setting batch mode: ${enabled} for all sliders`);
      Object.values(sliders).forEach(slider => {
        if (slider.setBatchMode) {
          slider.setBatchMode(enabled);
        }
      });
    },
    updateAllVisuals() {
      console.log(`🎨 [CONTROLS] Updating all slider visuals`);
      Object.values(sliders).forEach(slider => {
        if (slider.updateVisuals) {
          slider.updateVisuals();
        }
      });
    }
  };
  
  // Initialize tooltips
  initTooltips();
  
  return slidersWithBatchControl;
}

/**
 * Initializes tooltips for all labels with data-tooltip attributes
 */
function initTooltips() {
  const labelsWithTooltips = document.querySelectorAll('label[data-tooltip]');
  
  labelsWithTooltips.forEach((label) => {
    const element = label as HTMLElement;
    const tooltipContent = element.getAttribute('data-tooltip');
    
    if (tooltipContent) {
      createTooltip(element, {
        content: tooltipContent,
        delay: 300
      });
    }
  });
} 