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
    scale: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.scale,
    dissolveStrength: 0,
    grain: 0,
    grainSize: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.grainSize,
    reflectStrength: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectStrength,
    reflectSoftness: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectSoftness,
    reflectSharpness: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectSharpness,
    reflectLightX: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectLightX,
    reflectLightY: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectLightY
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
    this.settings.dissolveStrength = value;
    if (this.svgElements.feDispMapDissolve) {
      this.svgElements.feDispMapDissolve.setAttribute('scale', String(value));
    }
  }

  setGrain(value: number): void {
    this.settings.grain = value;
    if (this.svgElements.feGrainAlpha) {
      // Map 0-100 to 0-5.0 slope for opacity (5x stronger for better visibility)
      this.svgElements.feGrainAlpha.setAttribute('slope', String((value / 100) * 5.0));
    }
  }

  setGrainSize(value: number): void {
    this.settings.grainSize = value;
    if (this.svgElements.feGrainTurbulence) {
      const minFreq = APP_CONFIG.EFFECT_CALCULATIONS.GRAIN_MIN_FREQ;
      const maxFreq = APP_CONFIG.EFFECT_CALCULATIONS.GRAIN_MAX_FREQ;
      const t = value / 100;
      const freq = maxFreq - t * (maxFreq - minFreq);
      this.svgElements.feGrainTurbulence.setAttribute('baseFrequency', String(freq));
    }
  }

  // Reflect Effect Setters
  setReflectStrength(value: number): void {
    this.settings.reflectStrength = value;
    if (this.svgElements.feSpecularLighting) {
      const specularConstant = (value / 100) * APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MAX_SPECULAR;
      this.svgElements.feSpecularLighting.setAttribute('specularConstant', String(specularConstant));
      
      // If strength is 0, we can effectively "disable" the blend by setting result to clippedResult
      // but simpler to just let the specularConstant handle the brightness.
      // For performance, we could swap feMergeNode in, but specularConstant=0 is very cheap.
    }
  }

  setReflectSoftness(value: number): void {
    this.settings.reflectSoftness = value;
    if (this.svgElements.feReflectBlur) {
      const minBlur = APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MIN_BLUR;
      const maxBlur = APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MAX_BLUR;
      const stdDev = minBlur + (value / 100) * (maxBlur - minBlur);
      this.svgElements.feReflectBlur.setAttribute('stdDeviation', String(stdDev));
    }
  }

  setReflectSharpness(value: number): void {
    this.settings.reflectSharpness = value;
    if (this.svgElements.feSpecularLighting) {
      const minExp = APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MIN_EXPONENT;
      const maxExp = APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MAX_EXPONENT;
      const exponent = minExp + (value / 100) * (maxExp - minExp);
      this.svgElements.feSpecularLighting.setAttribute('specularExponent', String(exponent));
    }
  }

  setReflectLightPosition(x: number, y: number): void {
    this.settings.reflectLightX = x;
    this.settings.reflectLightY = y;
    if (this.svgElements.fePointLight) {
      const svgX = x * this.engineState.imageWidth;
      const svgY = y * this.engineState.imageHeight;
      this.svgElements.fePointLight.setAttribute('x', String(svgX));
      this.svgElements.fePointLight.setAttribute('y', String(svgY));
    }
  }

  // Batch update for all settings
  setAll(settings: Partial<EffectSettings>): void {
    let shouldUpdateScales = false;
    let shouldUpdateBlur = false;

    if (settings.strength !== undefined) {
      this.settings.strength = settings.strength;
      shouldUpdateScales = true;
    }
    if (settings.chromaticAberration !== undefined) {
      this.settings.chromaticAberration = settings.chromaticAberration;
      shouldUpdateScales = true;
    }
    if (settings.blur !== undefined) {
      this.settings.blur = settings.blur;
      shouldUpdateBlur = true;
    }
    if (settings.soft !== undefined) {
      this.setSoft(settings.soft);
    }
    if (settings.scale !== undefined) {
      this.settings.scale = settings.scale;
      this.engineState.scalePct = settings.scale;
    }
    if (settings.grain !== undefined) {
      this.setGrain(settings.grain);
    }
    if (settings.grainSize !== undefined) {
      this.setGrainSize(settings.grainSize);
    }
    if (settings.dissolveStrength !== undefined) {
      this.setDissolveStrength(settings.dissolveStrength);
    }
    if (settings.reflectStrength !== undefined) {
      this.setReflectStrength(settings.reflectStrength);
    }
    if (settings.reflectSoftness !== undefined) {
      this.setReflectSoftness(settings.reflectSoftness);
    }
    if (settings.reflectSharpness !== undefined) {
      this.setReflectSharpness(settings.reflectSharpness);
    }
    if (settings.reflectLightX !== undefined && settings.reflectLightY !== undefined) {
      this.setReflectLightPosition(settings.reflectLightX, settings.reflectLightY);
    }

    if (shouldUpdateScales) this.updateDisplacementScales();
    if (shouldUpdateBlur) this.updateBlur();
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
    return String(this.settings.dissolveStrength);
  }

  getGrain(): number {
    return this.settings.grain;
  }

  getGrainSize(): number {
    return this.settings.grainSize;
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
    this.engineState.imageWidth = width;
    this.engineState.imageHeight = height;
    this.updateDisplacementScales();
    this.updateBlur();
    
    // Update light position if it exists
    this.setReflectLightPosition(this.settings.reflectLightX, this.settings.reflectLightY);
  }

  // Clear all effects
  clear(): void {
    this.settings = {
      strength: 0,
      chromaticAberration: 0,
      blur: 0,
      soft: 0,
      scale: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.scale,
      dissolveStrength: 0,
      grain: 0,
      grainSize: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.grainSize,
      reflectStrength: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectStrength,
      reflectSoftness: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectSoftness,
      reflectSharpness: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectSharpness,
      reflectLightX: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectLightX,
      reflectLightY: APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectLightY
    };
    
    this.updateDisplacementScales();
    this.updateBlur();
    this.setDissolveStrength(0);
    this.setGrain(0);
    this.setGrainSize(APP_CONFIG.DEFAULT_EFFECT_SETTINGS.grainSize);
    this.setReflectStrength(APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectStrength);
    this.setReflectSoftness(APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectSoftness);
    this.setReflectSharpness(APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectSharpness);
    this.setReflectLightPosition(APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectLightX, APP_CONFIG.DEFAULT_EFFECT_SETTINGS.reflectLightY);
  }
}
