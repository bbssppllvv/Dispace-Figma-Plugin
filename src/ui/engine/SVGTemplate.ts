/**
 * SVG Template Generator
 * 
 * Generates the complex SVG filter structure required for displacement effects. This module
 * creates a sophisticated filter chain that separates image channels (RGB), applies displacement
 * maps independently to each channel, and recombines them to create chromatic aberration effects.
 * 
 * The generated SVG includes:
 * - Channel separation filters (RGB split)
 * - Displacement mapping with tiled textures
 * - Gaussian blur and dissolve effects
 * - Masking to prevent edge artifacts
 * - Optimized filter regions for performance
 * 
 * This template-based approach ensures consistent filter structure while allowing dynamic
 * parameter updates through DOM manipulation.
 * 
 * @module SVGTemplate
 */

import { APP_CONFIG } from '../config/constants';
import type { SVGElements } from './types';

/**
 * Generates the SVG template for displacement effects
 */
export function createSVGTemplate(): string {
  const initialSize = APP_CONFIG.INITIAL_SIZE;
  const filterMarginPercent = APP_CONFIG.FILTER_MARGIN_PERCENT;
  const initialFilterMargin = Math.round(initialSize * filterMarginPercent / 100);
  const NS = "http://www.w3.org/2000/svg";

  return `
    <svg id="svgRoot" xmlns="${NS}" viewBox="0 0 ${initialSize} ${initialSize}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="image-rendering: pixelated; image-rendering: crisp-edges;">
      <defs>
        <!-- Mask to hide mirrored edges -->
        <mask id="imageMask">
          <rect id="maskRect" x="0" y="0" width="${initialSize}" height="${initialSize}" fill="white"/>
        </mask>
        
        <filter id="f" x="${-initialFilterMargin}" y="${-initialFilterMargin}" width="${initialSize + initialFilterMargin * 2}" height="${initialSize + initialFilterMargin * 2}" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse">
          <!-- Source image, loaded via JS -->
          <feImage id="feSourceImg" result="sourceImage" width="${initialSize}" height="${initialSize}" x="0" y="0" href="" image-rendering="pixelated" />
          
          <!-- Displacement map, loaded via JS, which will be tiled -->
          <feImage id="feImg" x="0" y="0" width="${initialSize}" height="${initialSize}" result="fileMap" image-rendering="pixelated" />

          <!-- Soft blur applied to displacement map (controlled via EffectStateManager.setSoft) -->
          <feGaussianBlur id="feMapGaussianBlur" in="fileMap" stdDeviation="0" result="fileMapSoft" />
          
          <!-- Generative dissolve map -->
          <feImage id="noiseTexture" width="128" height="128" result="noiseTile" />
          <feTile in="noiseTile" result="noiseMap" />

          <!-- Pre-blur the source image (controlled via EffectStateManager.setBlur) -->
          <feGaussianBlur id="feSourceGaussianBlur" in="sourceImage" stdDeviation="0" result="BlurredSource" />

          <!-- STEP 1.5: Apply dissolve effect after blur but before main displacement -->
          <feDisplacementMap in="BlurredSource" in2="noiseMap" scale="0" xChannelSelector="R" yChannelSelector="G" result="DissolvedSource"/>

          <!-- STEP 1: Separate dissolved image into R, G, B channels -->
          <feComponentTransfer in="DissolvedSource" result="R_channel">
            <feFuncG type="table" tableValues="0 0"/>
            <feFuncB type="table" tableValues="0 0"/>
          </feComponentTransfer>
          <feComponentTransfer in="DissolvedSource" result="G_channel">
            <feFuncR type="table" tableValues="0 0"/>
            <feFuncB type="table" tableValues="0 0"/>
          </feComponentTransfer>
          <feComponentTransfer in="DissolvedSource" result="B_channel">
            <feFuncR type="table" tableValues="0 0"/>
            <feFuncG type="table" tableValues="0 0"/>
          </feComponentTransfer>

          <!-- STEP 2: Displace each channel independently based on blurred fileMap -->
          <feDisplacementMap in="R_channel" in2="fileMapSoft" scale="0" xChannelSelector="R" yChannelSelector="G" result="displaced_R" />
          <feDisplacementMap in="G_channel" in2="fileMapSoft" scale="0" xChannelSelector="R" yChannelSelector="G" result="displaced_G" />
          <feDisplacementMap in="B_channel" in2="fileMapSoft" scale="0" xChannelSelector="R" yChannelSelector="G" result="displaced_B" />

          <!-- STEP 3: Recombine the displaced channels -->
          <feBlend in="displaced_R" in2="displaced_G" mode="screen" result="RG_displaced" />
          <feBlend in="RG_displaced" in2="displaced_B" mode="screen" result="FinalDisplaced" />

          <!-- STEP 4: Pass-through to preserve result while keeping named handle for ReflectEffect -->
          <feOffset in="FinalDisplaced" dx="0" dy="0" result="clippedResult" />

          <feMerge>
            <feMergeNode in="clippedResult"/>
          </feMerge>
        </filter>
      </defs>
      <rect id="outputRect" x="0" y="0" width="${initialSize}" height="${initialSize}" filter="url(#f)" mask="url(#imageMask)"/>
    </svg>
  `;
}

/**
 * Initializes SVG in container and returns DOM element references
 */
export function initializeSVG(container: HTMLElement): SVGElements {
  // Add a guard to prevent re-initialization
  if (container.querySelector("#svgRoot")) {
    throw new Error("Displacement engine already initialized on this element");
  }

  container.innerHTML = createSVGTemplate();

  // Get all SVG element references
  const svg = container.querySelector("#svgRoot") as SVGSVGElement;
  const filterEl = container.querySelector("#f") as SVGFilterElement;
  const feImg = container.querySelector("#feImg") as SVGImageElement;
  const feSourceImg = container.querySelector("#feSourceImg") as SVGImageElement;
  
  // Get displacement maps to update their scales
  const feDispMapR = container.querySelector('[result="displaced_R"]') as SVGFEDisplacementMapElement;
  const feDispMapG = container.querySelector('[result="displaced_G"]') as SVGFEDisplacementMapElement;
  const feDispMapB = container.querySelector('[result="displaced_B"]') as SVGFEDisplacementMapElement;
  const feDispMapDissolve = container.querySelector('[in2="noiseMap"]') as SVGFEDisplacementMapElement;
  const feGaussianBlur = container.querySelector('#feSourceGaussianBlur') as SVGFEGaussianBlurElement;
  const feMapGaussianBlur = container.querySelector('#feMapGaussianBlur') as SVGFEGaussianBlurElement;
  const outputRect = container.querySelector("#outputRect") as SVGRectElement;
  const maskRect = container.querySelector("#maskRect") as SVGRectElement;
  const noiseTexture = container.querySelector('#noiseTexture') as SVGImageElement;

  // Validate critical elements
  if (!svg || !filterEl || !feImg || !feSourceImg) {
    throw new Error("Failed to create required SVG elements");
  }

  return {
    svg,
    filterEl,
    feImg,
    feSourceImg,
    feDispMapR,
    feDispMapG,
    feDispMapB,
    feDispMapDissolve,
    feGaussianBlur,
    feMapGaussianBlur,
    outputRect,
    maskRect,
    noiseTexture
  };
}

/**
 * Initializes noise texture for dissolve effects
 */
export function initializeNoiseTexture(noiseTexture: SVGImageElement): void {
  if (!noiseTexture) return;
  
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 128;
  noiseCanvas.height = 128;
  const noiseCtx = noiseCanvas.getContext('2d')!;
  const noiseImageData = noiseCtx.createImageData(128, 128);
  const data = noiseImageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.random() * 255;
    data[i + 1] = Math.random() * 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
  
  noiseCtx.putImageData(noiseImageData, 0, 0);
  noiseTexture.setAttribute('href', noiseCanvas.toDataURL());
} 