/**
 * Presets Main Export
 * 
 * Теперь использует централизованный PresetRegistry для управления всеми пресетами.
 * Автоматически подключает как legacy пресеты из combinedPresets.ts,
 * так и новые пресеты из definitions/*.ts файлов.
 */

import type { Preset } from './types';
import { PRESETS as REGISTRY_PRESETS, presetRegistry, getPresetsByCategory as registryGetByCategory, getUniqueCategories as registryGetCategories } from './registry';

// Подгружаем legacy пресеты из старой системы для обратной совместимости
if (import.meta.env.DEV) {
  (globalThis as any).__devPresetsWatch = import.meta.glob('./items/**/*.{ts,svg,png}', { eager: false });
}

let legacyPresets: Preset[] = [];
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

// Добавляем legacy пресеты в реестр (если они еще не там)
legacyPresets.forEach(preset => {
  if (!presetRegistry.getPreset(preset.id)) {
    presetRegistry.addPreset(preset);
  }
});

// Экспортируем объединенные пресеты из реестра
export const PRESETS: Preset[] = presetRegistry.getAllPresets();

// Backward compatibility functions
export function getPresetsByCategory(categoryId: string): Preset[] {
  return registryGetByCategory(categoryId);
}

export function getUniqueCategories(): string[] {
  return registryGetCategories();
}

// Экспортируем реестр для прямого использования
export { presetRegistry } from './registry';

export type { Preset } from './types';
export type { PresetLayer } from './types';


