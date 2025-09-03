import { PRESETS, Preset } from '../../presets';
import { customPresetsManager, CustomPreset } from '../../customPresets';
import { eventBus } from '../../core/EventBus';

export type PresetCategory = {
  name: string;
  presets: Preset[];
};

export class PresetStore {
  private allPresets: Preset[] = [];
  private isLoaded = false;

  async loadAll(): Promise<void> {
    // Non-blocking: do not await initialization to avoid deadlock with ui-ready
    if (customPresetsManager.isReady()) {
      const custom = await customPresetsManager.loadCustomPresets();
      this.allPresets = [...PRESETS, ...custom];
    } else {
      this.allPresets = [...PRESETS];
    }
    this.isLoaded = true;
  }

  getAllPresets(): Preset[] {
    return this.allPresets;
  }

  getCategories(): PresetCategory[] {
    const map = new Map<string, Preset[]>();
    for (const p of this.allPresets) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    if (!map.has('Custom')) {
      map.set('Custom', []);
    }
    return Array.from(map.entries()).map(([name, presets]) => ({ name, presets }));
  }

  isReady(): boolean {
    return this.isLoaded;
  }

  async deleteCustomPreset(id: string): Promise<void> {
    await customPresetsManager.deleteCustomPreset(id);
    await this.loadAll();
  }

  async saveCustomPreset(file: File): Promise<CustomPreset> {
    const preset = await customPresetsManager.saveCustomPreset(file);
    await this.loadAll();
    return preset;
  }
}


