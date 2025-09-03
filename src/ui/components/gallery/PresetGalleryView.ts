import { PresetStore } from './PresetStore';
import { NavigationController } from './Navigation';
import { ThumbnailRenderer } from './ThumbnailRenderer';
import { createElement, appendChildren, replaceContent } from '../../utils/dom';
import { licenseService } from '../../services';
import type { Preset } from '../../presets';
import { eventBus, emitDocumentEvent } from '../../core/EventBus';
import { EVENTS } from '../../config/constants';
import { buildMapSourceFromPreset } from '../../utils/maps';

export class PresetGalleryView {
  private store: PresetStore;
  private thumbs: ThumbnailRenderer;
  private container: HTMLElement;
  private scrollContainer: HTMLElement;
  private wrapper: HTMLElement;
  private nav: NavigationController;
  private observer: IntersectionObserver | null = null;
  private isDisabled = true;

  constructor() {
    this.store = new PresetStore();
    this.thumbs = new ThumbnailRenderer();
    this.container = document.getElementById('presetGrid')!;
    this.scrollContainer = document.getElementById('presetGridContainer')!;
    this.wrapper = document.querySelector('.preset-gallery-wrapper') as HTMLElement;
    this.nav = new NavigationController(this.scrollContainer, this.wrapper);
  }

  async init(): Promise<void> {
    await this.store.loadAll();
    this.render();
    this.nav.init();
    // Initial state: disabled until an image is selected
    this.setThumbnailsDisabled(true);
    // Re-render badges on license change
    licenseService.onStateChange(() => this.refreshBadges());
    // Image change -> rerender thumbs
    document.addEventListener('thumbnail:rerender', () => { this.setThumbnailsDisabled(false); this.rerenderVisibleThumbs(); });
    // Selection cleared -> reset all thumbs to skeleton
    document.addEventListener('thumbnail:clear', () => this.setThumbnailsDisabled(true));
    // Update selection ring on randomize from App
    document.addEventListener('preset:randomized', (e) => {
      const presetName = (e as CustomEvent).detail?.presetName as string | undefined;
      if (!presetName) return;
      const preset = this.store.getAllPresets().find(p => p.name === presetName);
      if (!preset) return;
      const items = this.container.querySelectorAll('.selection-ring');
      items.forEach(r => { r.classList.remove('ring-black'); r.classList.add('ring-transparent'); });
      const parent = Array.from(this.container.querySelectorAll('.preset-item')).find(el => (el as HTMLElement).dataset.presetName === preset.name);
      const ring = parent?.querySelector('.selection-ring');
      ring?.classList.remove('ring-transparent'); ring?.classList.add('ring-black');
    });
  }

  private render(): void {
    replaceContent(this.container, []);
    for (const category of this.store.getCategories()) {
      const group = document.createElement('div');
      group.className = 'preset-category-group';
      const header = document.createElement('div'); header.className = 'category-header'; header.textContent = category.name;
      const grid = document.createElement('div'); grid.className = 'preset-category-grid';
      // Virtualized batch rendering per category
      let start = 0;
      const BATCH = 60;
      const sentinel = document.createElement('div');
      sentinel.style.width = '1px'; sentinel.style.height = '1px';
      grid.appendChild(sentinel);
      let observer: IntersectionObserver | null = null;
      const renderBatch = () => {
        const end = Math.min(category.presets.length, start + BATCH);
        for (let i = start; i < end; i++) {
          grid.appendChild(this.createPresetItem(category.presets[i]));
        }
        if (category.name === 'Custom' && end === category.presets.length && !grid.querySelector('.preset-item input[type="file"]')) {
          grid.appendChild(this.createCustomMapButton());
        }
        start = end;
        if (start >= category.presets.length) {
          if (sentinel.parentElement) observer?.unobserve(sentinel);
          try { sentinel.remove(); } catch {}
        }
        // Ensure PRO badges are applied for newly appended items
        this.refreshBadges();
      };
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            renderBatch();
            this.setupLazyObserver();
          }
        }
      }, { root: this.scrollContainer, rootMargin: '400px' });
      observer.observe(sentinel);
      // initial batch paint
      renderBatch();
      group.appendChild(header); group.appendChild(grid);
      this.container.appendChild(group);
    }
    this.setupLazyObserver();
    // Final pass to apply PRO badges after initial layout
    this.refreshBadges();
  }

  private createPresetItem(preset: Preset): HTMLElement {
    const item = createElement('div', { className: 'preset-item' });
    (item as any).dataset.presetName = preset.name;
    (item as any).dataset.thumbReady = '0';
    (item as any).dataset.thumbStale = '0';
    const ring = createElement('div', { className: 'selection-ring absolute inset-0 ring-transparent' });
    // Skeleton overlay (shimmer) - visible until thumb ready
    const skeleton = createElement('div', { className: 'thumb-skeleton absolute inset-0' });
    const sk = skeleton as HTMLElement;
    sk.style.opacity = '1';
    sk.style.pointerEvents = 'none';
    // Use existing @keyframes thumbShimmer from CSS
    sk.style.backgroundImage = 'linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 37%, rgba(0,0,0,0.06) 63%)';
    sk.style.backgroundSize = '400% 100%';
    sk.style.animation = 'thumbShimmer 1.2s ease-in-out infinite';
    item.appendChild(ring);
    item.appendChild(skeleton);
    item.addEventListener('click', () => this.applyPreset(preset));
    // Apply disabled visuals if needed
    if (this.isDisabled) this.applyDisabledVisuals(item);
    return item;
  }

  private createCustomMapButton(): HTMLElement {
    const item = createElement('div', { className: 'preset-item bg-[#E5E5E5] dark:bg-[#3A3A3A] flex items-center justify-center' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('class', 'text-black dark:text-white');
    const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p1.setAttribute('d', 'M12 5V19'); p1.setAttribute('stroke', 'currentColor'); p1.setAttribute('stroke-width', '2'); p1.setAttribute('stroke-linecap', 'round'); p1.setAttribute('stroke-linejoin', 'round');
    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p2.setAttribute('d', 'M5 12H19'); p2.setAttribute('stroke', 'currentColor'); p2.setAttribute('stroke-width', '2'); p2.setAttribute('stroke-linecap', 'round'); p2.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p1); svg.appendChild(p2);
    const selectionRing = createElement('div', { className: 'selection-ring absolute inset-0' });
    const fileInput = createElement('input', { attributes: { type: 'file', accept: 'image/*' }, className: 'hidden' }) as HTMLInputElement;
    appendChildren(item, [svg, selectionRing, fileInput]);
    item.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const shouldSave = confirm('Save this image as a custom preset?');
      if (shouldSave) {
        await this.store.saveCustomPreset(file);
        this.render();
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const img = document.createElement('img');
          img.src = reader.result as string;
          img.className = 'absolute inset-0 w-full h-full object-cover';
          item.prepend(img);
        };
        reader.readAsDataURL(file);
        eventBus.emit(EVENTS.MAP_SELECTED as any, { map: file } as any);
      }
    });
    return item;
  }

  private setupLazyObserver(): void {
    if (this.observer) this.observer.disconnect();
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        if ((el as any).dataset.thumbReady === '1') { this.observer!.unobserve(el); continue; }
        const name = el.dataset.presetName;
        const preset = this.store.getAllPresets().find(p => p.name === name);
        if (preset) {
          this.renderThumb(el, preset);
        }
        this.observer!.unobserve(el);
      }
    }, { root: this.scrollContainer, rootMargin: '200px', threshold: 0.1 });
    this.container.querySelectorAll('.preset-item').forEach(el => this.observer!.observe(el));
  }

  private async renderThumb(el: HTMLElement, preset: Preset): Promise<void> {
    // Sync source from live preview svg
    const previewRoot = document.getElementById('preview');
    const mainFe = previewRoot?.querySelector('#feSourceImg') as SVGImageElement | null;
    const mainSvg = previewRoot?.querySelector('#svgRoot') as SVGSVGElement | null;
    const previewTexture = mainFe?.getAttribute('href') || null;
    if (!previewTexture) return;
    // Always extract the real viewBox to sync dimensions exactly
    let width = 512, height = 512;
    if (mainSvg) {
      const vb = mainSvg.getAttribute('viewBox');
      if (vb) {
        const parts = vb.trim().split(/\s+/);
        if (parts.length === 4) {
          const w = parseFloat(parts[2]);
          const h = parseFloat(parts[3]);
          if (!Number.isNaN(w) && !Number.isNaN(h) && w > 0 && h > 0) {
            width = Math.round(w);
            height = Math.round(h);
          }
        }
      }
    }
    await this.thumbs.syncSourceFromPreview(previewTexture, width, height);
    await this.thumbs.renderPresetThumbnail(preset, el, 'high');
  }

  private applyPreset(preset: Preset): void {
    const items = this.container.querySelectorAll('.selection-ring');
    items.forEach(r => { r.classList.remove('ring-black'); r.classList.add('ring-transparent'); });
    const parent = Array.from(this.container.querySelectorAll('.preset-item')).find(el => (el as HTMLElement).dataset.presetName === preset.name);
    const ring = parent?.querySelector('.selection-ring');
    ring?.classList.remove('ring-transparent'); ring?.classList.add('ring-black');
    document.dispatchEvent(new CustomEvent('preset:randomized', { detail: { presetName: preset.name } }));
    emitDocumentEvent('preset:selected' as any, { preset } as any);
    emitDocumentEvent('map:selected' as any, { map: buildMapSourceFromPreset(preset) } as any);
  }

  public refreshBadges(): void {
    const presetItems = this.container.querySelectorAll('.preset-item:not(.custom-preset)');
    presetItems.forEach(item => {
      const presetElement = item as HTMLElement;
      const presetName = presetElement.dataset.presetName; if (!presetName) return;
      const preset = this.store.getAllPresets().find(p => p.name === presetName); if (!preset) return;
      const existingBadge = presetElement.querySelector('.preset-pro-badge');
      const shouldShow = preset.premium && !licenseService.isPro();
      if (shouldShow && !existingBadge) {
        const proBadge = createElement('div', { className: 'preset-pro-badge', textContent: 'PRO' });
        presetElement.appendChild(proBadge);
      } else if (!shouldShow && existingBadge) {
        existingBadge.remove();
      }
    });
  }

  private rerenderVisibleThumbs(): void {
    // Start a new generation so all following renders are consistent
    this.thumbs.bumpGeneration();
    // For items that уже имели миниатюру: показать «stale» (полупрозрачность + скелетон)
    // Для ещё не загруженных — оставить их в исходном скелетоне без изменения прозрачности
    this.container.querySelectorAll('.preset-item').forEach(el => {
      const h = el as HTMLElement;
      const data = (h as any).dataset;
      const skeleton = h.querySelector('.thumb-skeleton') as HTMLElement | null;
      if (this.isDisabled) {
        // In disabled state do not mark as stale; keep disabled visuals
        this.applyDisabledVisuals(h);
      } else if (data.thumbReady === '1') {
        data.thumbReady = '0';
        data.thumbStale = '1';
        h.style.opacity = '0.6';
        if (skeleton) skeleton.style.opacity = '1';
      } else {
        // Not ready yet: ensure skeleton visible, keep normal opacity
        data.thumbReady = '0';
        data.thumbStale = '0';
        h.style.opacity = '1';
        if (skeleton) skeleton.style.opacity = '1';
      }
    });
    this.setupLazyObserver();
  }

  private resetAllThumbs(): void {
    this.thumbs.bumpGeneration();
    // Clear all backgrounds and show skeletons (fresh state)
    this.container.querySelectorAll('.preset-item').forEach(el => {
      const h = el as HTMLElement;
      (h as any).dataset.thumbReady = '0';
      (h as any).dataset.thumbStale = '0';
      h.style.opacity = '1';
      h.style.backgroundImage = '';
      const skeleton = h.querySelector('.thumb-skeleton') as HTMLElement | null;
      if (skeleton) skeleton.style.opacity = '1';
    });
    this.setupLazyObserver();
  }

  private setThumbnailsDisabled(disabled: boolean): void {
    this.isDisabled = disabled;
    if (disabled) {
      if (this.observer) { try { this.observer.disconnect(); } catch {} }
    }
    this.container.querySelectorAll('.preset-item').forEach(el => {
      const h = el as HTMLElement;
      if (disabled) {
        this.applyDisabledVisuals(h);
      } else {
        this.clearDisabledVisuals(h);
        // reset state to trigger lazy load
        (h as any).dataset.thumbReady = '0';
        const skeleton = h.querySelector('.thumb-skeleton') as HTMLElement | null;
        if (skeleton) skeleton.style.opacity = '1';
      }
    });
    if (!disabled) this.setupLazyObserver();
  }

  private applyDisabledVisuals(el: HTMLElement): void {
    (el as any).dataset.disabled = '1';
    (el as any).dataset.thumbReady = '0';
    (el as any).dataset.thumbStale = '0';
    // Clear any previous thumbnail image completely
    el.style.backgroundImage = '';
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.style.backgroundRepeat = '';
    // Solid disabled background to avoid halo artifacts
    el.style.backgroundColor = 'var(--color-disabled-bg)';
  }

  private clearDisabledVisuals(el: HTMLElement): void {
    delete (el as any).dataset.disabled;
    el.style.backgroundColor = '';
  }
}


