/**
 * Effect State Manager
 * 
 * Manages the internal state of all visual effects (strength, chromatic aberration, blur, etc.)
 * and automatically updates the corresponding SVG filter parameters. This module encapsulates
 * the complex math behind effect calculations while providing a clean, simple API.
 * 
 * Key responsibilities:
 * - Store current effect parameter values
 * - Calculate displacement scales based on image dimensions
 * - Apply changes to SVG filter elements in real-time
 * - Provide read-only access to current settings for export/debugging
 * 
 * The manager automatically handles the relationship between effect strength and image size,
 * ensuring consistent visual results across different image dimensions.
 * 
 * @module EffectStateManager
 */

import { APP_CONFIG } from '../config/constants';
import type { EffectSettings, SVGElements, EngineState } from './types';

export class EffectStateManager {
  private settings: EffectSettings = {
    strength: 0,
    chromaticAberration: 0,
    blur: 0,
    soft: 0,
    scale: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.scale
  };

  constructor(
    private svgElements: SVGElements,
    private engineState: EngineState
  ) {}

  // Setters for individual effects
  setStrength(value: number): void {
    this.settings.strength = value;
    this.updateDisplacementScales();
  }

  setChromaticAberration(value: number): void {
    this.settings.chromaticAberration = value;
    this.updateDisplacementScales();
  }

  setBlur(value: number): void {
    this.settings.blur = value;
    this.updateBlur();
  }

  setSoft(value: number): void {
    this.settings.soft = value;
    // Soft now controls Gaussian blur on displacement map (feMapGaussianBlur)
    const feMapGaussianBlur = (this.svgElements as any).feMapGaussianBlur as SVGFEGaussianBlurElement | undefined;
    if (feMapGaussianBlur) {
      const previewRatio = Math.min(1, this.engineState.previewMax / Math.max(this.engineState.imageWidth, this.engineState.imageHeight));
      const baseSoftness = (this.engineState.scalePct / 100) * APP_CONFIG.EFFECT_CALCULATIONS.BLUR_SOFTNESS_FACTOR * previewRatio;
      const stdDeviation = value * baseSoftness;
      feMapGaussianBlur.setAttribute('stdDeviation', String(stdDeviation));
    }
  }

  setScale(value: number): void {
    this.settings.scale = value;
    this.engineState.scalePct = value;
    // Scale is handled in FilterRenderer during redraw
  }

  setDissolveStrength(value: number): void {
    if (this.svgElements.feDispMapDissolve) {
      this.svgElements.feDispMapDissolve.setAttribute('scale', String(value));
    }
  }

  // Getters
  getSettings(): Readonly<EffectSettings> {
    return { ...this.settings };
  }

  getStrength(): number {
    return this.settings.strength;
  }

  getChromaticAberration(): number {
    return this.settings.chromaticAberration;
  }

  getBlur(): number {
    return this.settings.blur;
  }

  getSoft(): number {
    return this.settings.soft;
  }

  getScale(): number {
    return this.settings.scale;
  }

  getDissolveStrength(): string {
    return this.svgElements.feDispMapDissolve?.getAttribute('scale') || '0';
  }

  // Private update methods
  private updateDisplacementScales(): void {
    const { imageWidth, imageHeight } = this.engineState;
    const baseStrength = Math.max(imageWidth, imageHeight) / APP_CONFIG.EFFECT_CALCULATIONS.BASE_STRENGTH_DIVISOR;
    const s = this.settings.strength * (baseStrength / APP_CONFIG.EFFECT_CALCULATIONS.STRENGTH_FACTOR);
    const ca = (this.settings.strength / APP_CONFIG.EFFECT_CALCULATIONS.STRENGTH_FACTOR) * 
               this.settings.chromaticAberration * 
               (baseStrength / APP_CONFIG.EFFECT_CALCULATIONS.STRENGTH_FACTOR);

    if (this.svgElements.feDispMapR) {
      this.svgElements.feDispMapR.setAttribute("scale", String(s + ca));
    }
    if (this.svgElements.feDispMapG) {
      this.svgElements.feDispMapG.setAttribute("scale", String(s));
    }
    if (this.svgElements.feDispMapB) {
      this.svgElements.feDispMapB.setAttribute("scale", String(s - ca));
    }
  }

  private updateBlur(): void {
    if (this.svgElements.feGaussianBlur) {
      const { imageWidth, imageHeight } = this.engineState;
      const baseBlur = Math.max(imageWidth, imageHeight) / APP_CONFIG.EFFECT_CALCULATIONS.BLUR_FACTOR;
      this.svgElements.feGaussianBlur.setAttribute('stdDeviation', String(this.settings.blur * baseBlur));
    }
  }

  // Update image dimensions (called when new image is loaded)
  updateImageDimensions(width: number, height: number): void {
    // Skip if dimensions have not changed to avoid redundant DOM updates
    if (this.engineState.imageWidth === width && this.engineState.imageHeight === height) {
      return;
    }
    this.engineState.imageWidth = width;
    this.engineState.imageHeight = height;
    
    // Reapply current effects with new dimensions
    this.updateDisplacementScales();
    this.updateBlur();
  }

  // Clear all effects
  clear(): void {
    this.settings = {
      strength: 0,
      chromaticAberration: 0,
      blur: 0,
      soft: 0,
      scale: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.scale
    };
    
    this.updateDisplacementScales();
    this.updateBlur();
    this.setDissolveStrength(0);
  }
} 