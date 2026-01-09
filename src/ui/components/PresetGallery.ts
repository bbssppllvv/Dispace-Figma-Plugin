import { PresetGalleryView } from './gallery/PresetGalleryView';

let view: PresetGalleryView | null = null;

export async function initPresetGallery() {
  if (view) return;
  view = new PresetGalleryView();
  await view.init();
}

export function refreshPresetGallery(): void {
  view?.refreshBadges();
}

import { appStore } from '../store/AppStore';

export async function refreshPresetsFromCDN(): Promise<void> {
  if (view) {
    await (view as any).store.refreshFromCDN();
    (view as any).render();
    
    // Re-sync the selected preset in AppStore with the fresh data
    // This ensures that if the currently selected preset was updated,
    // the new parameters (like grain) are applied immediately.
    const current = appStore.getState().selectedPreset;
    if (current) {
      const freshPreset = (view as any).store.getAllPresets().find((p: any) => p.id === current.id);
      if (freshPreset) {
        appStore.setSelectedPreset(freshPreset);
      }
    }
  }
}

import type { Preset } from '../presets';

// ... imports ...

export function getRandomPreset(): Preset | null {
  if (view) {
    const presets = (view as any).store.getAllPresets();
    if (presets && presets.length > 0) {
      return presets[Math.floor(Math.random() * presets.length)];
    }
  }
  return null;
}


