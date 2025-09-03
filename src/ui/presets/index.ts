/**
 * Presets Main Export
 * 
 * Теперь загружает пресеты динамически с CDN через PresetService.
 * Это позволяет обновлять пресеты без пересборки плагина.
 */

import type { Preset } from './types';
import { presetService } from '../services/PresetService';

// Legacy поддержка для разработки
let legacyPresets: Preset[] = [];
if (import.meta.env.DEV) {
  // В dev режиме подгружаем локальные пресеты для fallback
  try {
    const combinedModules = import.meta.glob('./items/combinedPresets.ts', { eager: true });
    const mod: any = Object.values(combinedModules)[0];
    const exported = mod?.default;
    legacyPresets = Array.isArray(exported)
      ? (exported as Preset[])
      : exported
      ? [exported as Preset]
      : [];
  } catch (error) {
    console.warn('Could not load legacy presets:', error);
  }
}

// Инициализация пресетов из CDN
let presetsPromise: Promise<Preset[]> | null = null;

/**
 * Асинхронная загрузка пресетов с CDN
 */
export async function loadPresets(): Promise<Preset[]> {
  if (!presetsPromise) {
    presetsPromise = presetService.loadPresets();
  }
  return presetsPromise;
}

/**
 * Синхронный доступ к пресетам (для backward compatibility)
 * В dev режиме возвращает legacy пресеты, в prod - пустой массив до загрузки
 */
export const PRESETS: Preset[] = import.meta.env.DEV ? legacyPresets : [];

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
  presetsPromise = null; // Сброс кэша
  return presetService.refreshPresets();
}

// Экспортируем сервис для прямого использования
export { presetService } from '../services/PresetService';

export type { Preset } from './types';
export type { PresetLayer } from './types';


