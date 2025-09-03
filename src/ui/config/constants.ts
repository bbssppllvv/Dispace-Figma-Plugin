/**
 * Application Configuration Constants
 * 
 * Centralized configuration file containing all magic numbers, timing values, and 
 * application-wide constants. This module eliminates hard-coded values throughout
 * the codebase and provides a single place to tune performance and behavior.
 * 
 * Configuration categories:
 * - Performance: Canvas sizes, debounce delays, cache limits
 * - UI: Animation timings, default values, size constraints  
 * - Rendering: Filter margins, initial dimensions, quality settings
 * - Network: Request timeouts, retry attempts
 * - Events: Centralized event name constants for type safety
 * 
 * Modifying values here affects the entire application, making it easy to optimize
 * performance or adjust behavior without hunting through multiple files.
 * 
 * @module AppConfig
 */

// App-wide constants
export const APP_CONFIG = {
  // Engine settings
  INITIAL_SIZE: 512,
  FILTER_MARGIN_PERCENT: 20,
  CNV_MAX: 1024,
  CHUNK_SIZE: 0x8000,
  
  // Performance settings  
  DEBOUNCE_DELAY: 20,
  SLIDER_DEBOUNCE_DELAY: 20,
  MAX_CACHE_SIZE: 60,
  
  // Object pooling and memory optimization
  PERFORMANCE: {
    // Object pool settings
    ENABLE_OBJECT_POOLING: true,
    XML_SERIALIZER_POOL_SIZE: 2,
    FILE_READER_POOL_SIZE: 3,
    IMAGE_POOL_SIZE: 5,
    
    // Memory management
    FORCE_GC_AFTER_RENDER: false,
    AUTO_CLEANUP_URLS: true,
    REUSE_CANVAS_BUFFERS: true,
    
    // Live Preview optimization (safe - doesn't affect final render quality)
    ENABLE_PREVIEW_OPTIMIZATION: true,
    PREVIEW_MAX_SIZE: 500,             // Slightly larger than 400x400 container for crisp display
    
    // Image cache settings (for faster loading, NOT for quality optimization)
    IMAGE_CACHE_MAX_SIZE: 10,        // Cache last 10 processed images
    IMAGE_CACHE_TTL: 300000,         // 5 minutes TTL
  },
  
  // Quality and rendering settings
  QUALITY: {
    // Image smoothing disabled for pixel-perfect displacement maps
    IMAGE_SMOOTHING_ENABLED: false,
    
    // Enable high-DPI rendering for crisp results on retina displays
    USE_DEVICE_PIXEL_RATIO: true,
    
    // Figma's absolute maximum (don't change this - it's hardcoded in Figma)
    FIGMA_ABSOLUTE_LIMIT: 4096,
    
    // Device pixel ratio bounds for edge case protection
    DPR_MIN_BOUND: 0.1,
    DPR_MAX_BOUND: 10,
    // Export behavior: false = use HQ original source for final render (preferred);
    // true = force exact visual parity with Live Preview
    MATCH_PREVIEW_ON_EXPORT: false,
  },
  
  // Effect calculation constants
  EFFECT_CALCULATIONS: {
    // Base strength calculation
    BASE_STRENGTH_DIVISOR: 10,
    STRENGTH_FACTOR: 100,
    
    // Blur calculations  
    BLUR_FACTOR: 500,
    BLUR_SOFTNESS_FACTOR: 10.5,
  },
  
  // SVG export normalization values
  SVG_EXPORT: {
    BASE_DISPLACEMENT: 50,
    CHROMATIC_OFFSET_SCALE: 10,
    BLUR_SCALE: 5,
    SOFT_CONVERSION_FACTOR: 2,
  },
  
  // Effect defaults
  DEFAULT_EFFECT_SETTINGS: {
    strength: 0,
    scale: 20,
    soft: 0,
    chromatic: 0,
    blur: 0,
    noise: 0,
    reflectOpacity: 0,
    reflectSharpness: 50,
  },
  
  // Preset defaults
  DEFAULT_PRESET_STRENGTH: 50,
  DEFAULT_PRESET_SCALE: 20,
  
  // UI settings
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 2000,
  REQUEST_TIMEOUT: 5000,
  
  // External URLs (for security audit)
  ALLOWED_DOMAINS: [
    'https://i.ibb.co',
    'https://unpkg.com',
    'https://rsms.me',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com'
  ],

  // Built-in samples for empty state demo (UI-only usage)
  SAMPLES: {
    IMAGES: [
      { url: 'https://i.ibb.co/1YbSKdL1/sample01.png', alt: 'Sample image' },
      { url: 'https://i.ibb.co/1YbSKdL1/sample01.png', alt: 'Sample image' },
      { url: 'https://i.ibb.co/1YbSKdL1/sample01.png', alt: 'Sample image' },
      { url: 'https://i.ibb.co/1YbSKdL1/sample01.png', alt: 'Sample image' },
    ] as const,
  },
  
  // Storage limits
  STORAGE_LIMIT: 5 * 1024 * 1024, // 5MB

  // License/Pro model settings
  LICENSE: {
    // Dev mode control - set to false for production
    DEV_MODE_ENABLED: true, //Do not edit it! Only manual change by admin!
    
    // Dev mode shortcuts
    DEV_TOGGLE_SHORTCUT: 'Ctrl+L', // or Cmd+L on Mac
    
    // Feature availability (for documentation)
    FREE_FEATURES: [
      'All effects and settings',
      'Free presets', 
      'Preview and tweak Pro presets',
      'Custom maps'
    ],
    PRO_FEATURES: [
      'Apply Pro presets to canvas',
      'Export to Code (always Pro-only)',
      'Premium preset library'
    ]
  }
} as const;

// Event names for consistency
export const EVENTS = {
  PRESET_SELECTED: 'preset:selected',
  MAP_SELECTED: 'map:selected', 
  EFFECT_CHANGED: 'effect:changed',
  IMAGE_SELECTED: 'image:selected',
  IMAGE_CLEARED: 'image:cleared',
} as const;

// CSS class names (для избежания опечаток)
export const CSS_CLASSES = {
  PRESET_ITEM: 'preset-item',
  CUSTOM_PRESET: 'custom-preset',
  SELECTION_RING: 'selection-ring',
  DELETE_BTN: 'delete-btn',
  TAB_BUTTON: 'tab-button',
  SLIDER: 'slider',
  BIPOLAR_SLIDER: 'bipolar-slider',
} as const; 