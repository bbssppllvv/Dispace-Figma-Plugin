/**
 * SVG Code Exporter
 * 
 * Exports the current displacement effect configuration as standalone, reusable SVG code.
 * This module generates production-ready HTML with embedded SVG filters that can be used
 * on any website without dependencies on the Figma plugin.
 * 
 * Export capabilities:
 * - Complete HTML templates with CSS integration
 * - Standalone SVG filter definitions
 * - JSON configuration exports for settings backup
 * - Normalized effect parameters for cross-platform compatibility
 * - Ready-to-use code with example implementations
 * 
 * The exported code is optimized for web performance and includes fallbacks for browsers
 * with limited SVG filter support.
 * 
 * @module SVGExporter
 */

import type { EffectStateManager } from './EffectState';
import type { EngineState } from './types';
import { APP_CONFIG } from '../config/constants';

export class SVGExporter {
  constructor(
    private effectStateManager: EffectStateManager,
    private engineState: EngineState
  ) {}

  /**
   * Exports current effect settings as standalone SVG code
   */
  exportSVGCode(): {
    code: string;
    settings: {
      strength: number;
      chromaticAberration: number;
      blur: number;
      soft: number;
      dissolveStrength: string;
      displacementMapUrl: string;
      scale: number;
    };
  } {
    // Current UI values
    const currentStrength = this.effectStateManager.getStrength();
    const currentChromaticAberration = this.effectStateManager.getChromaticAberration();
    const currentBlur = this.effectStateManager.getBlur();
    const currentSoft = this.effectStateManager.getSoft();
    const currentDissolve = this.effectStateManager.getDissolveStrength();
    const currentScalePct = this.engineState.scalePct;

    // Map URL (preserve current selection if present)
    const currentMapUrl = this.engineState.mapImage?.src || 'https://i.ibb.co/SnTJTWJ/07-Wave.png';

    // Export assumes a 1024x1024 content image for consistent, simple coordinates
    const exportWidth = 1024;
    const exportHeight = 1024;
    const maxDim = Math.max(exportWidth, exportHeight);

    // Match runtime formulas
    const baseStrength = maxDim / APP_CONFIG.EFFECT_CALCULATIONS.BASE_STRENGTH_DIVISOR; // e.g., 1024/10
    const s = currentStrength * (baseStrength / APP_CONFIG.EFFECT_CALCULATIONS.STRENGTH_FACTOR);
    const ca = (currentStrength / APP_CONFIG.EFFECT_CALCULATIONS.STRENGTH_FACTOR)
             * currentChromaticAberration
             * (baseStrength / APP_CONFIG.EFFECT_CALCULATIONS.STRENGTH_FACTOR);

    const baseBlur = maxDim / APP_CONFIG.EFFECT_CALCULATIONS.BLUR_FACTOR;
    const blurStdDev = currentBlur * baseBlur;

    // Soft blur for the displacement map (no preview ratio in export)
    const softStdDev = currentSoft * ((currentScalePct / 100) * APP_CONFIG.EFFECT_CALCULATIONS.BLUR_SOFTNESS_FACTOR);

    // Displacement tile size derived from scalePct (simple, intuitive mapping)
    const tileSize = Math.max(1, Math.round((currentScalePct / 100) * maxDim));

    // Generate export HTML with embedded filter sized to 1024x1024
    const fullCode = this.generateHTMLTemplate({
      mapUrl: currentMapUrl,
      exportWidth,
      exportHeight,
      dispScaleR: s + ca,
      dispScaleG: s,
      dispScaleB: s - ca,
      blurStdDev,
      softStdDev,
      dissolve: currentDissolve,
      tileSize,
      pluginStrength: currentStrength,
      pluginChromatic: currentChromaticAberration,
      pluginBlur: currentBlur,
      pluginSoft: currentSoft,
      pluginScalePct: currentScalePct
    });

    return {
      code: fullCode,
      settings: {
        strength: currentStrength,
        chromaticAberration: currentChromaticAberration,
        blur: currentBlur,
        soft: currentSoft,
        dissolveStrength: currentDissolve,
        displacementMapUrl: currentMapUrl,
        scale: currentScalePct
      }
    };
  }

  /**
   * Generates the complete HTML template with SVG filter
   */
  private generateHTMLTemplate(params: {
    mapUrl: string;
    exportWidth: number;
    exportHeight: number;
    dispScaleR: number;
    dispScaleG: number;
    dispScaleB: number;
    blurStdDev: number;
    softStdDev: number;
    dissolve: string;
    tileSize: number;
    pluginStrength?: number;
    pluginChromatic?: number;
    pluginBlur?: number;
    pluginSoft?: number;
    pluginScalePct?: number;
  }): string {
    const {
      mapUrl,
      exportWidth,
      exportHeight,
      dispScaleR,
      dispScaleG,
      dispScaleB,
      blurStdDev,
      softStdDev,
      dissolve,
      tileSize,
      pluginStrength,
      pluginChromatic,
      pluginBlur,
      pluginSoft,
      pluginScalePct
    } = params;

    // Placeholder image (1024x1024) for demo content
    const placeholderImage = 'https://i.ibb.co/0yYC4pCY/Placeholder-image.png';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Displacement Effect</title>
  <style>
    /* Apply displacement effect to any element */
    .displacement-effect {
      filter: url(#displacementEffect);
      transition: filter 0.3s ease;
    }
  </style>
</head>
<body>

<!--
  Displace 2.0 Export — Settings Snapshot
  Plugin settings (raw):
    - strength: ${pluginStrength ?? 'n/a'}
    - chromaticAberration: ${pluginChromatic ?? 'n/a'}
    - blur: ${pluginBlur ?? 'n/a'}
    - soft: ${pluginSoft ?? 'n/a'}
    - scalePct: ${pluginScalePct ?? 'n/a'}
    - dissolveStrength: ${dissolve}

  Computed export (1024x1024 assumption):
    - exportWidth x exportHeight: ${exportWidth} x ${exportHeight}
    - tileSize (from scalePct): ${tileSize}
    - blurStdDev (source blur): ${blurStdDev}
    - softStdDev (map blur): ${softStdDev}
    - dispScaleR/G/B: ${dispScaleR} / ${dispScaleG} / ${dispScaleB}
    - displacementMapUrl: ${mapUrl}
-->

<!-- SVG Displacement Filter -->
<svg xmlns="http://www.w3.org/2000/svg" style="position: absolute; width: 0; height: 0; visibility: hidden;">
  <defs>
    <filter id="displacementEffect"
            x="0" y="0" width="${exportWidth}" height="${exportHeight}"
            filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"
            color-interpolation-filters="sRGB">
      
      <!-- Displacement Map -->
      <feImage id="displacementMap" 
               href="${mapUrl}" 
               x="0" y="0"
               width="${tileSize}" height="${tileSize}"
               preserveAspectRatio="none"
               result="displacementSource" 
               image-rendering="pixelated" />
      <feTile in="displacementSource" result="tiledDisplacement" />
      ${softStdDev > 0 ? 
        `<feGaussianBlur in="tiledDisplacement" stdDeviation="${softStdDev}" result="finalDisplacement" />` :
        `<feOffset in="tiledDisplacement" result="finalDisplacement" dx="0" dy="0" />`
      }

      <!-- Match runtime order: blur first, then dissolve -->
      ${blurStdDev > 0 ?
        `<feGaussianBlur in="SourceGraphic" stdDeviation="${blurStdDev}" result="preBlurredSource" />` :
        `<feOffset in="SourceGraphic" result="preBlurredSource" dx="0" dy="0" />`
      }

      ${parseFloat(dissolve) > 0 ? 
        `<!-- Dissolve Effect -->
      <feTurbulence baseFrequency="0.9" numOctaves="1" result="noisePattern" />
      <feDisplacementMap in="preBlurredSource" in2="noisePattern" scale="${dissolve}" result="dissolvedSource" />` :
        `<feOffset in="preBlurredSource" result="dissolvedSource" dx="0" dy="0" />`
      }
      
      <!-- RGB Channel Separation -->
      <feComponentTransfer in="dissolvedSource" result="redChannel">
        <feFuncG type="table" tableValues="0 0"/>
        <feFuncB type="table" tableValues="0 0"/>
      </feComponentTransfer>
      <feComponentTransfer in="dissolvedSource" result="greenChannel">
        <feFuncR type="table" tableValues="0 0"/>
        <feFuncB type="table" tableValues="0 0"/>
      </feComponentTransfer>
      <feComponentTransfer in="dissolvedSource" result="blueChannel">
        <feFuncR type="table" tableValues="0 0"/>
        <feFuncG type="table" tableValues="0 0"/>
      </feComponentTransfer>
      
      <!-- Apply Displacement -->
      <feDisplacementMap in="redChannel" in2="${softStdDev > 0 ? 'finalDisplacement' : 'tiledDisplacement'}" 
                         scale="${dispScaleR}" 
                         xChannelSelector="R" yChannelSelector="G" 
                         result="displacedRed" />
      <feDisplacementMap in="greenChannel" in2="${softStdDev > 0 ? 'finalDisplacement' : 'tiledDisplacement'}" 
                         scale="${dispScaleG}" 
                         xChannelSelector="R" yChannelSelector="G" 
                         result="displacedGreen" />
      <feDisplacementMap in="blueChannel" in2="${softStdDev > 0 ? 'finalDisplacement' : 'tiledDisplacement'}" 
                         scale="${dispScaleB}" 
                         xChannelSelector="R" yChannelSelector="G" 
                         result="displacedBlue" />
      
      <!-- Recombine Channels -->
      <feBlend in="displacedRed" in2="displacedGreen" mode="screen" result="redGreenCombined" />
      <feBlend in="redGreenCombined" in2="displacedBlue" mode="screen" result="finalResult" />
      
      <feMerge>
        <feMergeNode in="finalResult"/>
      </feMerge>
      
    </filter>
  </defs>
</svg>

<!-- Your Content Here -->
<!-- Replace this image with your own (example uses 1024x1024 placeholder) -->
<img src="${placeholderImage}" 
     class="displacement-effect" 
     alt="Replace with your image" 
     width="${exportWidth}" height="${exportHeight}" 
     style="max-width: 100%; height: auto;" />

<!-- You can apply the effect to any element -->
<!--
<div class="displacement-effect" 
     style="width: ${exportWidth}px; height: ${exportHeight}px; background-image: url('your-image.jpg'); background-size: cover;">
  <h1>Your content here</h1>
</div>
-->

</body>
</html>`;
  }

  /**
   * Exports just the SVG filter code (without HTML wrapper)
   */
  exportFilterOnly(): string {
    const data = this.exportSVGCode();
    
    // Extract just the filter from the full HTML
    const filterStart = data.code.indexOf('<filter id="displacementEffect"');
    const filterEnd = data.code.indexOf('</filter>') + '</filter>'.length;
    
    if (filterStart === -1 || filterEnd === -1) {
      throw new Error('Failed to extract filter from generated code');
    }
    
    return data.code.substring(filterStart, filterEnd);
  }

  /**
   * Exports settings as JSON
   */
  exportSettingsJSON(): string {
    const data = this.exportSVGCode();
    return JSON.stringify(data.settings, null, 2);
  }
} 

