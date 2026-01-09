export interface Layer {
  src: string
  tiling: 'tiled' | 'stretched'
  scaleMode: 'uniform' | 'xOnly' | 'yOnly'
  blendMode?: string
  opacity?: number
  alignX?: 'left' | 'center' | 'right'
  alignY?: 'top' | 'center' | 'bottom'
  offsetX?: number
  offsetY?: number
  scaleMultiplier?: number // multiplier for global scale (default 1.0, range 0.1-3.0)
  visible?: boolean // Layer visibility toggle (undefined = true)
}

export interface Preset {
  id: string
  name: string
  category: string // Main category ID (legacy compatibility)
  categories: string[] // Multi-category support
  popular?: boolean // Flag to show in "Popular" virtual category
  premium?: boolean
  defaultScale: number
  textureScale?: number
  defaultStrength: number
  chromaticAberration?: number
  blur?: number
  soft?: number
  dissolveStrength?: number
  grain?: number
  grainSize?: number
  reflectOpacity?: number
  reflectSharpness?: number
  layers: Layer[]
}

export interface Category {
  id: string
  name: string
  order: number // Display order (lower = higher in list)
  description?: string
}

export interface Asset {
  id: string
  name: string
  type: 'svg' | 'png' | 'jpeg'
  size?: number
  url: string
  hash?: string
  category?: string
  createdAt?: string
}

export type SortField = 'name' | 'type' | 'size' | 'date'
export type SortDirection = 'asc' | 'desc'

export interface AssetFilters {
  search: string
  type: string
  sortField: SortField
  sortDirection: SortDirection
}

export interface SampleImage {
  id: string
  name: string
  url: string
  order: number
}

export interface TooltipData {
  id: string           // "strength", "scale", etc.
  label: string        // "Distortion Intensity"
  description: string  // Full tooltip text
  imageUrl?: string    // URL изображения (если загружено)
}
