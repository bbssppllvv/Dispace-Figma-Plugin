// Re-export existing types first
export type { Preset } from '../presets';
export type { CustomPreset } from '../customPresets';
export type { SliderInstance } from '../components/Controls';
export type { DisplacementEngine } from '../engine';

// Import types for internal use
import type { Preset } from '../presets';
import type { MapSource } from '../engine/types';
import type { CustomPreset } from '../customPresets';

// Core application types
export interface AppState {
  hasSelectedImage: boolean;
  selectedPreset: Preset | null;
}

// Effect-related types
export interface EffectSettings {
  strength: number;
  scale: number;
  soft: number;
  chromatic: number;
  blur: number;
  noise: number;
  reflectOpacity: number;
  reflectSharpness: number;
}

// Event types for better type safety
export interface AppEvents {
  'preset:selected': { preset: Preset };
  'map:selected': { map: MapSource };
  'effect:changed': Partial<EffectSettings>;
  'image:selected': { imageBytes: Uint8Array };
  'image:cleared': void;
}

// Figma message types
export interface FigmaMessage {
  type: string;
  [key: string]: any;
}

export interface FigmaMessageHandlers {
  'selection-updated': (msg: { imageBytes: Uint8Array }) => void;
  'selection-cleared': (msg: void) => void;
  'unsupported-node': (msg: { reason: string }) => void;
  'apply-success': (msg: void) => void;
  'apply-error': (msg: { error: string }) => void;
  'custom-presets-loaded': (msg: { presets: CustomPreset[] }) => void;
} 