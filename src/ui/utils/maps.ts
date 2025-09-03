import type { Preset } from '../presets';
import type { MapSource, MultiLayerMapSource } from '../engine/types';

/**
 * Builds a map source (single or composite) from a preset definition and optional image cache.
 * - If the preset has `compositeMap`, returns a CompositeMapSource with both layers.
 * - Otherwise returns a string URL or cached HTMLImageElement if present.
 */
export function buildMapSourceFromPreset(
  preset: Preset,
  _presetImageCache?: Record<string, HTMLImageElement>
): MapSource {
  // Convert layers[] to MultiLayerMapSource
  const layers = preset.layers.map(l => ({
    src: l.src,
    tiling: l.tiling,
    // IMPORTANT: do NOT inject preset.defaultScale here. Leave undefined so the global engineState.scalePct applies.
    scale: typeof l.scale === 'number' ? l.scale : undefined,
    scaleMode: l.scaleMode,
    opacity: typeof l.opacity === 'number' ? l.opacity : 1,
    blendMode: l.blendMode || 'source-over',
    alignX: (l as any).alignX,
    alignY: (l as any).alignY,
    offsetX: (l as any).offsetX,
    offsetY: (l as any).offsetY
  }));
  return { layers } as MultiLayerMapSource;
}


