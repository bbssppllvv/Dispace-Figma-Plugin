export interface PresetLayer {
  src: string; // URL or data URI (SVG/PNG)
  tiling: 'tiled' | 'stretched';
  scale?: number; // % (optional; falls back to preset.defaultScale)
  scaleMode?: 'uniform' | 'xOnly' | 'yOnly';
  opacity?: number; // 0..1
  blendMode?: GlobalCompositeOperation; // 'source-over' by default
  alignX?: 'left' | 'center' | 'right';
  alignY?: 'top' | 'center' | 'bottom';
  offsetX?: number; // px
  offsetY?: number; // px
}

export interface Preset {
  id: string;
  name: string;
  layers: PresetLayer[];
  defaultScale: number; // % (2‑150) — глобальный дефолт, если у слоя scale не задан
  defaultStrength: number; // -400‑400 (UI supports bipolar strength)
  premium?: boolean;
  category: string;
  order?: number; // optional ordering within a category
  isCustom?: boolean; // оставляем для менеджера пользовательских пресетов
  createdAt?: number;
}


