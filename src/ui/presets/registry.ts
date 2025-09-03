/**
 * Preset Registry - Централизованный реестр всех пресетов
 * 
 * Единая точка управления всеми пресетами в системе.
 * Автоматически собирает пресеты из всех definition файлов
 * и предоставляет удобный API для работы с ними.
 */

import type { Preset } from './types';

// Автоматический импорт всех definition файлов
const definitionModules = import.meta.glob('./definitions/*.ts', { eager: true });

// Собираем все пресеты из definition файлов
const allPresets: Preset[] = [];

Object.entries(definitionModules).forEach(([path, module]) => {
  const presets = (module as any).default;
  if (Array.isArray(presets)) {
    allPresets.push(...presets);
  } else if (presets && typeof presets === 'object') {
    allPresets.push(presets);
  }
});

// Сортировка по категориям и приоритету
const categoryPriority: Record<string, number> = {
  'Popular': 1,
  'Ribbed glass': 2,
  'Fabric': 3,
  'Geometric': 4,
  'Organic': 5,
  'Custom': 100
};

allPresets.sort((a, b) => {
  const pa = categoryPriority[a.category] ?? 999;
  const pb = categoryPriority[b.category] ?? 999;
  if (pa !== pb) return pa - pb;
  const oa = a.order ?? 9999;
  const ob = b.order ?? 9999;
  if (oa !== ob) return oa - ob;
  return a.name.localeCompare(b.name);
});

/**
 * Основной экспорт - все пресеты в системе
 */
export const PRESETS: Preset[] = allPresets;

/**
 * Preset Registry API
 */
export class PresetRegistry {
  private static instance: PresetRegistry;
  private presets = new Map<string, Preset>();
  private categories = new Set<string>();

  constructor() {
    this.loadPresets();
  }

  static getInstance(): PresetRegistry {
    if (!PresetRegistry.instance) {
      PresetRegistry.instance = new PresetRegistry();
    }
    return PresetRegistry.instance;
  }

  private loadPresets() {
    allPresets.forEach(preset => {
      this.presets.set(preset.id, preset);
      this.categories.add(preset.category);
    });
  }

  /**
   * Получить все пресеты
   */
  getAllPresets(): Preset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Получить пресет по ID
   */
  getPreset(id: string): Preset | undefined {
    return this.presets.get(id);
  }

  /**
   * Получить пресеты по категории
   */
  getPresetsByCategory(category: string): Preset[] {
    return Array.from(this.presets.values())
      .filter(preset => preset.category === category);
  }

  /**
   * Получить все категории
   */
  getCategories(): string[] {
    return Array.from(this.categories);
  }

  /**
   * Поиск пресетов
   */
  searchPresets(query: string): Preset[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.presets.values())
      .filter(preset => 
        preset.name.toLowerCase().includes(searchTerm) ||
        preset.category.toLowerCase().includes(searchTerm) ||
        preset.id.toLowerCase().includes(searchTerm)
      );
  }

  /**
   * Добавить новый пресет (для динамического добавления)
   */
  addPreset(preset: Preset): void {
    this.presets.set(preset.id, preset);
    this.categories.add(preset.category);
  }

  /**
   * Обновить существующий пресет
   */
  updatePreset(id: string, updates: Partial<Preset>): boolean {
    const existing = this.presets.get(id);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    this.presets.set(id, updated);
    this.categories.add(updated.category);
    return true;
  }

  /**
   * Удалить пресет
   */
  removePreset(id: string): boolean {
    return this.presets.delete(id);
  }

  /**
   * Экспорт всех пресетов для сохранения
   */
  exportPresets(): {
    presets: Preset[];
    categories: string[];
    stats: {
      total: number;
      byCategory: Record<string, number>;
      premium: number;
      custom: number;
    };
  } {
    const presets = this.getAllPresets();
    const byCategory: Record<string, number> = {};
    let premium = 0;
    let custom = 0;

    presets.forEach(preset => {
      byCategory[preset.category] = (byCategory[preset.category] || 0) + 1;
      if (preset.premium) premium++;
      if (preset.isCustom) custom++;
    });

    return {
      presets,
      categories: this.getCategories(),
      stats: {
        total: presets.length,
        byCategory,
        premium,
        custom
      }
    };
  }
}

// Singleton instance для удобного использования
export const presetRegistry = PresetRegistry.getInstance();

// Backward compatibility exports
export function getPresetsByCategory(categoryId: string): Preset[] {
  return presetRegistry.getPresetsByCategory(categoryId);
}

export function getUniqueCategories(): string[] {
  return presetRegistry.getCategories();
}
