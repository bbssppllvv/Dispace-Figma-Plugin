import type { Preset } from '../types';

/**
 * Glass Effects Presets
 * All displacement maps are loaded from CDN via ResourceManager
 */
const glassEffects: Preset[] = [
  {
    id: 'horizontal-glass',
    name: 'Horizontal Glass',
    category: 'Ribbed glass',
    defaultScale: 32,
    defaultStrength: 133,
    layers: [
      {
        src: 'resource://horizontal-bands', // Resource reference instead of inline data
        tiling: 'tiled',
        scaleMode: 'xOnly',
        alignX: 'center',
        alignY: 'center'
      }
    ]
  },
  
  {
    id: 'vertical-glass',
    name: 'Vertical Glass', 
    category: 'Ribbed glass',
    defaultScale: 39,
    defaultStrength: 133,
    layers: [
      {
        src: 'resource://vertical-ripple',
        tiling: 'tiled',
        scaleMode: 'yOnly',
        alignX: 'center',
        alignY: 'center'
      }
    ]
  },

  {
    id: 'complex-glass',
    name: 'Complex Glass',
    category: 'Ribbed glass', 
    defaultScale: 32,
    defaultStrength: 200,
    premium: true,
    layers: [
      {
        src: 'resource://vertical-ripple',
        tiling: 'tiled',
        scaleMode: 'yOnly',
        alignX: 'center',
        alignY: 'center'
      },
      {
        src: 'resource://horizontal-bands',
        tiling: 'tiled',
        scaleMode: 'xOnly',
        blendMode: 'overlay',
        alignX: 'center',
        alignY: 'center'
      }
    ]
  }
];

export default glassEffects;
