/**
 * Presets Main Export
 * 
 * Загружает пресеты динамически с CDN через PresetService.
 * Простая система без legacy кода.
 */

import type { Preset } from './types';
import { presetService } from '../services/PresetService';

/**
 * Асинхронные функции для работы с пресетами
 */
export async function getPresetsByCategory(categoryId: string): Promise<Preset[]> {
  return presetService.getPresetsByCategory(categoryId);
}

export async function getUniqueCategories(): Promise<string[]> {
  return presetService.getCategories();
}

export async function refreshPresets(): Promise<Preset[]> {
  return presetService.refreshPresets();
}

// Экспортируем сервис для прямого использования
export { presetService } from '../services/PresetService';

export type { Preset } from './types';
export type { PresetLayer } from './types';


