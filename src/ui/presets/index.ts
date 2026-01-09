/**
 * Presets Main Export
 * 
 * Loads presets dynamically from CDN via PresetService.
 * Simple system without legacy code.
 */

import type { Preset, PresetCategory } from './types';
import { presetService } from '../services/PresetService';

/**
 * Async functions for working with presets
 */
export async function getPresetsByCategory(categoryId: string): Promise<Preset[]> {
  return presetService.getPresetsByCategory(categoryId);
}

export async function getUniqueCategories(): Promise<string[]> {
  return presetService.getCategories();
}

export async function getCategoriesData(): Promise<PresetCategory[]> {
  return presetService.getCategoriesData();
}

export async function getCategoryById(id: string): Promise<PresetCategory | undefined> {
  return presetService.getCategoryById(id);
}

export async function refreshPresets(): Promise<Preset[]> {
  return presetService.refreshPresets();
}

// Export service for direct use
export { presetService } from '../services/PresetService';

export type { Preset } from './types';
export type { PresetLayer } from './types';
export type { PresetCategory } from './types';


