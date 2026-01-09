/**
 * SVG Code Exporter
 * 
 * Exports the current displacement effect configuration as standalone, reusable SVG code.
 * This module generates production-ready HTML with embedded SVG filters that can be used
 * on any website without dependencies on the Figma plugin.
 * 
 * @module SVGExporter
 */

import type { EffectStateManager } from './EffectState';
import type { EngineState } from './types';
import { APP_CONFIG } from '../config/constants';
import { appStore } from '../store/AppStore';
import { resourceManager } from '../services/ResourceManager';

export class SVGExporter {
  constructor(
    private effectStateManager: EffectStateManager,
    private engineState: EngineState,
    _reflectEffect: unknown = null // Placeholder for future implementation
  ) {}

  /**
   * Rounds a number to specified decimal places for cleaner SVG output
   */
  private roundValue(val: number, decimals: number = 2): number {
    return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

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
      grain?: number;
      grainSize?: number;
      reflectStrength?: number;
      reflectSoftness?: number;
      reflectSharpness?: number;
      reflectLightX?: number;
      reflectLightY?: number;
    };
  } {
    // Current UI values
    const settings = this.effectStateManager.getSettings();
    const currentStrength = settings.strength;
    const currentChromaticAberration = settings.chromaticAberration;
    const currentBlur = settings.blur;
    const currentSoft = settings.soft;
    const currentDissolve = this.effectStateManager.getDissolveStrength();
    const currentScalePct = this.engineState.scalePct;
    const currentGrain = settings.grain;
    const currentGrainSize = settings.grainSize;
    
    // Reflect values
    const reflectStrength = settings.reflectStrength;
    const reflectSoftness = settings.reflectSoftness;
    const reflectSharpness = settings.reflectSharpness;
    const reflectLightX = settings.reflectLightX;
    const reflectLightY = settings.reflectLightY;

    // Resolve map URL: use CDN for presets, placeholder for custom maps
    let currentMapUrl: string;
    let isCustomMapPlaceholder = false;
    const selectedPreset = appStore.selectedPreset;
    
    if (selectedPreset && selectedPreset.layers && selectedPreset.layers.length > 0) {
      const firstLayer = selectedPreset.layers[0];
      if (typeof firstLayer.src === 'string' && firstLayer.src.startsWith('resource://')) {
        const resourceId = firstLayer.src.replace('resource://', '');
        const cdnUrl = resourceManager.resolveResource(resourceId);
        if (cdnUrl) {
          currentMapUrl = cdnUrl;
        } else {
          currentMapUrl = 'path/to/your/map.svg';
          isCustomMapPlaceholder = true;
        }
      } else {
        currentMapUrl = typeof firstLayer.src === 'string' ? firstLayer.src : 'path/to/your/map.svg';
        if (currentMapUrl === 'path/to/your/map.svg') {
          isCustomMapPlaceholder = true;
        }
      }
    } else {
      const mapSrc = this.engineState.mapImage?.src;
      if (mapSrc && mapSrc.startsWith('data:')) {
        currentMapUrl = 'path/to/your/custom-map.svg';
        isCustomMapPlaceholder = true;
      } else if (mapSrc && (mapSrc.startsWith('http://') || mapSrc.startsWith('https://'))) {
        currentMapUrl = mapSrc;
      } else {
        currentMapUrl = 'path/to/your/map.svg';
        isCustomMapPlaceholder = true;
      }
    }

    const exportWidth = 1024;
    const exportHeight = 1024;
    const maxDim = Math.max(exportWidth, exportHeight);

    const baseStrength = maxDim / APP_CONFIG.EFFECT_CALCULATIONS.BASE_STRENGTH_DIVISOR;
    const s = currentStrength * (baseStrength / APP_CONFIG.EFFECT_CALCULATIONS.STRENGTH_FACTOR);
    const ca = (currentStrength / APP_CONFIG.EFFECT_CALCULATIONS.STRENGTH_FACTOR)
             * currentChromaticAberration
             * (baseStrength / APP_CONFIG.EFFECT_CALCULATIONS.STRENGTH_FACTOR);

    const baseBlur = maxDim / APP_CONFIG.EFFECT_CALCULATIONS.BLUR_FACTOR;
    const blurStdDev = currentBlur * baseBlur;
    const softStdDev = currentSoft * ((currentScalePct / 100) * APP_CONFIG.EFFECT_CALCULATIONS.BLUR_SOFTNESS_FACTOR);
    const tileSize = Math.max(1, Math.round((currentScalePct / 100) * maxDim));
    
    // Computed Reflect values
    const reflectSpecularConstant = (reflectStrength / 100) * APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MAX_SPECULAR;
    const reflectMapBlur = APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MIN_BLUR + (reflectSoftness / 100) * (APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MAX_BLUR - APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MIN_BLUR);
    const reflectExponent = APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MIN_EXPONENT + (reflectSharpness / 100) * (APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MAX_EXPONENT - APP_CONFIG.EFFECT_CALCULATIONS.REFLECT_MIN_EXPONENT);
    const reflectLightXPos = reflectLightX * exportWidth;
    const reflectLightYPos = reflectLightY * exportHeight;

    const fullCode = this.generateHTMLTemplate({
      mapUrl: currentMapUrl,
      isCustomMap: isCustomMapPlaceholder,
      exportWidth,
      exportHeight,
      dispScaleR: this.roundValue(s + ca, 2),
      dispScaleG: this.roundValue(s, 2),
      dispScaleB: this.roundValue(s - ca, 2),
      blurStdDev: this.roundValue(blurStdDev, 2),
      softStdDev: this.roundValue(softStdDev, 2),
      dissolve: currentDissolve,
      tileSize,
      pluginStrength: currentStrength,
      pluginChromatic: currentChromaticAberration,
      pluginBlur: currentBlur,
      pluginSoft: currentSoft,
      pluginScalePct: currentScalePct,
      grain: currentGrain,
      grainSize: currentGrainSize,
      // Reflect export params
      reflectStrength: reflectStrength,
      reflectSpecularConstant: this.roundValue(reflectSpecularConstant, 2),
      reflectMapBlur: this.roundValue(reflectMapBlur, 2),
      reflectExponent: this.roundValue(reflectExponent, 2),
      reflectLightX: this.roundValue(reflectLightXPos, 2),
      reflectLightY: this.roundValue(reflectLightYPos, 2)
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
        scale: currentScalePct,
        grain: currentGrain > 0 ? currentGrain : undefined,
        grainSize: currentGrain > 0 ? currentGrainSize : undefined,
        reflectStrength: reflectStrength > 0 ? reflectStrength : undefined,
        reflectSoftness: reflectStrength > 0 ? reflectSoftness : undefined,
        reflectSharpness: reflectStrength > 0 ? reflectSharpness : undefined,
        reflectLightX: reflectStrength > 0 ? reflectLightX : undefined,
        reflectLightY: reflectStrength > 0 ? reflectLightY : undefined
      }
    };
  }

  /**
   * Generates the complete HTML template with SVG filter
   */
  private generateHTMLTemplate(params: {
    mapUrl: string;
    isCustomMap: boolean;
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
    grain?: number;
    grainSize?: number;
    // Reflect params
    reflectStrength?: number;
    reflectSpecularConstant?: number;
    reflectMapBlur?: number;
    reflectExponent?: number;
    reflectLightX?: number;
    reflectLightY?: number;
  }): string {
    const {
      mapUrl,
      isCustomMap,
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
      pluginScalePct,
      grain = 0,
      grainSize = 50,
      reflectStrength = 0,
      reflectSpecularConstant = 0,
      reflectMapBlur = 2,
      reflectExponent = 30,
      reflectLightX = 0,
      reflectLightY = 0
    } = params;

    const grainSlope = (grain / 100) * 5.0;
    const minFreq = APP_CONFIG.EFFECT_CALCULATIONS.GRAIN_MIN_FREQ;
    const maxFreq = APP_CONFIG.EFFECT_CALCULATIONS.GRAIN_MAX_FREQ;
    const t = grainSize / 100;
    const grainFreq = maxFreq - t * (maxFreq - minFreq);

    const placeholderImage = APP_CONFIG.SAMPLES.IMAGES[0]?.url || 'https://i.ibb.co/1YbSKdL1/sample01.png';
    const mapUrlComment = isCustomMap ? `\n      <!-- TODO: Replace "${mapUrl}" with your custom displacement map URL -->` : '';
    
    const dispMapInput = softStdDev > 0 ? 'finalDisplacement' : 'tiledDisplacement';
    const sourceInput = blurStdDev > 0 ? 'preBlurredSource' : 'SourceGraphic';
    const channelSepInput = parseFloat(dissolve) > 0 ? 'dissolvedSource' : sourceInput;
    const postDisplacement = 'finalResult';
    const postGrain = grain > 0 ? 'grainResult' : postDisplacement;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Displacement Effect</title>
    <style>
    .displacement-effect {
      filter: url(#displacementEffect);
      transition: filter 0.3s ease;
      will-change: filter;
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
    - grain: ${grain} (size: ${grainSize})

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
      
      <!-- Displacement Map -->${mapUrlComment}
      <feImage id="displacementMap" 
               href="${mapUrl}" 
               crossorigin="anonymous"
               x="0" y="0"
               width="${tileSize}" height="${tileSize}"
               preserveAspectRatio="none"
               result="displacementSource" 
               image-rendering="auto" />
      <feTile in="displacementSource" result="tiledDisplacement" />${softStdDev > 0 ? `
      <!-- Map Softness -->
      <feGaussianBlur in="tiledDisplacement" stdDeviation="${softStdDev}" result="finalDisplacement" />` : ''}${blurStdDev > 0 ? `
      <!-- Source Blur -->
      <feGaussianBlur in="SourceGraphic" stdDeviation="${blurStdDev}" result="preBlurredSource" />` : ''}${parseFloat(dissolve) > 0 ? `
      <!-- Dissolve Effect -->
      <feTurbulence baseFrequency="0.9" numOctaves="1" result="noisePattern" />
      <feDisplacementMap in="${sourceInput}" in2="noisePattern" scale="${dissolve}" result="dissolvedSource" />` : ''}
      <!-- RGB Channel Separation -->
      <feComponentTransfer in="${channelSepInput}" result="redChannel">
        <feFuncG type="table" tableValues="0 0"/>
        <feFuncB type="table" tableValues="0 0"/>
      </feComponentTransfer>
      <feComponentTransfer in="${channelSepInput}" result="greenChannel">
        <feFuncR type="table" tableValues="0 0"/>
        <feFuncB type="table" tableValues="0 0"/>
      </feComponentTransfer>
      <feComponentTransfer in="${channelSepInput}" result="blueChannel">
        <feFuncR type="table" tableValues="0 0"/>
        <feFuncG type="table" tableValues="0 0"/>
      </feComponentTransfer>
      
      <!-- Apply Displacement -->
      <feDisplacementMap in="redChannel" in2="${dispMapInput}" 
                         scale="${dispScaleR}" 
                         xChannelSelector="R" yChannelSelector="G" 
                         result="displacedRed" />
      <feDisplacementMap in="greenChannel" in2="${dispMapInput}" 
                         scale="${dispScaleG}" 
                         xChannelSelector="R" yChannelSelector="G" 
                         result="displacedGreen" />
      <feDisplacementMap in="blueChannel" in2="${dispMapInput}" 
                         scale="${dispScaleB}" 
                         xChannelSelector="R" yChannelSelector="G" 
                         result="displacedBlue" />
      
      <!-- Recombine Channels -->
      <feBlend in="displacedRed" in2="displacedGreen" mode="screen" result="redGreenCombined" />
      <feBlend in="redGreenCombined" in2="displacedBlue" mode="screen" result="finalResult" />${grain > 0 ? `
      
      <!-- Grain Effect -->
      <feTurbulence type="fractalNoise" baseFrequency="${grainFreq}" numOctaves="3" seed="0" stitchTiles="stitch" result="grainRaw" />
      <feColorMatrix type="saturate" values="0" in="grainRaw" result="grainGray" />
      <feComponentTransfer in="grainGray" result="grainAdjusted">
        <feFuncA type="linear" slope="${grainSlope}" intercept="0"/>
      </feComponentTransfer>
      <feBlend in="grainAdjusted" in2="finalResult" mode="overlay" result="grainResult" />` : ''}${reflectStrength > 0 ? `

      <!-- Reflect Effect -->
      <feGaussianBlur in="displacementSource" stdDeviation="${reflectMapBlur}" result="reflectMapBlur"/>
      <feSpecularLighting in="reflectMapBlur" result="reflectLight"
          lighting-color="white" surfaceScale="1.5"
          specularConstant="${reflectSpecularConstant}" specularExponent="${reflectExponent}">
        <fePointLight x="${reflectLightX}" y="${reflectLightY}" z="150"/>
      </feSpecularLighting>
      <feComposite in="reflectLight" in2="SourceAlpha" operator="in" result="maskedLight"/>
      <feBlend in="${postGrain}" in2="maskedLight" mode="screen" result="reflectedResult" />` : ''}
      <feMerge>
        <feMergeNode in="${reflectStrength > 0 ? 'reflectedResult' : postGrain}"/>
      </feMerge>
      
    </filter>
  </defs>
</svg>

<!-- Your Content Here -->
<img src="${placeholderImage}" 
     class="displacement-effect" 
     alt="Replace with your image" 
     width="${exportWidth}" height="${exportHeight}" 
     style="max-width: 100%; height: auto;" />

</body>
</html>`;
  }

  /**
   * Exports just the SVG filter code (without HTML wrapper)
   */
  exportFilterOnly(): string {
    const data = this.exportSVGCode();
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
