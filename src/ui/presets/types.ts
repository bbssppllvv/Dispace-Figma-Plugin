export interface PresetLayer {
  src: string; // URL or data URI (SVG/PNG)
  tiling: 'tiled' | 'stretched';
  scaleMultiplier?: number; // multiplier for global scale (default 1.0, range 0.1-3.0)
  scaleMode?: 'uniform' | 'xOnly' | 'yOnly';
  opacity?: number; // 0..1
  blendMode?: GlobalCompositeOperation; // 'source-over' by default
  alignX?: 'left' | 'center' | 'right';
  alignY?: 'top' | 'center' | 'bottom';
  offsetX?: number; // px
  offsetY?: number; // px
}

export interface PresetCategory {
  id: string; // unique identifier
  name: string; // display name
  order: number; // sort order (1 = first)
  description?: string; // optional description
  color?: string; // optional color theme
  icon?: string; // optional icon
}

export interface Preset {
  id: string;
  name: string;
  layers: PresetLayer[];
  defaultScale: number; // % (2‑300) — global default if layer scale is not set
  textureScale?: number; // multiplier for global scale (default 1.0)
  defaultStrength: number; // -600‑600 (UI supports bipolar strength)
  
  premium?: boolean;
  categories: string[]; // array of category IDs (supports multiple categories)
  order?: number; // optional ordering within categories
  isCustom?: boolean; // keep for custom preset manager
  createdAt?: number;
  
  // Legacy support - automatically filled from categories[0] for compatibility
  category?: string; // deprecated: use categories instead
}

export interface SampleImage {
  id: string;
  name: string;
  url: string;
  order: number;
}

export interface TooltipData {
  id: string;
  label: string;
  description: string;
  imageUrl?: string;
}


