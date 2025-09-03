import { EVENTS } from "../config/constants";
export const PresetSelectedEvent = EVENTS.PRESET_SELECTED;
export const MapSelectedEvent = EVENTS.MAP_SELECTED;

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


