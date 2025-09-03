import { initDisplacementEngine, DisplacementEngine } from '../../engine';
import { buildMapSourceFromPreset } from '../../utils/maps';
import type { Preset } from '../../presets';
import { APP_CONFIG } from '../../config/constants';

type Quality = 'low' | 'high';

export class ThumbnailRenderer {
  private engine: DisplacementEngine | null = null;
  private container: HTMLElement | null = null;
  private lastTextureId: string | null = null;
  private lastW: number | null = null;
  private lastH: number | null = null;
  private worker: Worker | null = null;
  private renderQueue: Promise<void> = Promise.resolve();
  private generation = 0;
  private cache: Map<string, string> = new Map();
  private maxConcurrent = Math.max(4, Math.min(8, (navigator as any).hardwareConcurrency || 6));
  private inFlight = 0;
  private pending: Array<() => void> = [];
  private thumbProxyUrl: string | null = null;
  private readonly proxyMaxSide = 512;

  private log(...args: any[]): void {
    if (APP_CONFIG.LICENSE.DEV_MODE_ENABLED) {
      // eslint-disable-next-line no-console
      console.log('[THUMB]', ...args);
    }
  }

  constructor() { this.log('init'); }

  ensure(container?: HTMLElement): void {
    if (!this.engine || !this.container) {
      const div = container || this.createHiddenContainer();
      this.container = div;
      // Use the same filter margin percent as Live Preview; set per-engine previewMax via init option
      this.engine = initDisplacementEngine(div, { enableReflectEffect: false, filterMarginPercent: APP_CONFIG.FILTER_MARGIN_PERCENT, cnvMax: 512 });
    }
    if (!this.worker) {
      try {
        // Vite will inline worker via new URL pattern
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.worker = new Worker(new URL('./ThumbnailRenderer.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        this.worker = null;
      }
    }
  }

  private createHiddenContainer(): HTMLElement {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.left = '-10000px';
    div.style.top = '-10000px';
    div.style.width = '128px';
    div.style.height = '128px';
    div.setAttribute('aria-hidden', 'true');
    document.body.appendChild(div);
    return div;
  }

  private getLiveSliderValue(id: string, fallback = 0): number {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const raw = el.getAttribute('aria-valuenow');
    const v = raw != null ? parseFloat(raw) : NaN;
    return Number.isFinite(v) ? v : fallback;
  }

  bumpGeneration(): void {
    this.generation++;
    // Invalidate previous generation cache to avoid memory growth
    this.cache.clear();
    // Drop any pending outdated tasks to avoid head-of-line blocking
    this.pending = [];
    // Reset proxy so it will be rebuilt for the new image
    this.thumbProxyUrl = null;
    this.log('generation.bump', { generation: this.generation });
  }

  private schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        this.inFlight++;
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e as any);
        } finally {
          this.inFlight--;
          this.drain();
        }
      };
      if (this.inFlight < this.maxConcurrent) {
        task();
      } else {
        this.pending.push(task);
      }
    });
  }

  private drain(): void {
    while (this.inFlight < this.maxConcurrent && this.pending.length > 0) {
      const next = this.pending.shift();
      if (next) next();
    }
  }

  async prefetchPresets(presets: Preset[]): Promise<void> {
    this.ensure(); if (!this.engine) return;
    try {
      const sources = presets.map(p => buildMapSourceFromPreset(p));
      await (this.engine as any).prefetchMapSources(sources);
    } catch {}
  }

  async syncSourceFromPreview(previewTexture: string, width: number, height: number): Promise<void> {
    this.ensure();
    if (!this.engine) return;
    const needsUpdate = previewTexture !== this.lastTextureId || width !== this.lastW || height !== this.lastH || !this.thumbProxyUrl;
    if (!needsUpdate) return;
    const t0 = performance.now();
    this.log('syncSource.start', { width, height });
    // Build fixed-size proxy from current preview texture (already mirrored by main engine)
    try {
      const img = await this.dataUrlToImage(previewTexture);
      const maxSide = Math.max(img.width, img.height);
      const scale = maxSide > this.proxyMaxSide ? (this.proxyMaxSide / maxSide) : 1;
      const outW = Math.max(1, Math.round(img.width * scale));
      const outH = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = outW; c.height = outH;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = true; // @ts-ignore
      if ((ctx as any).imageSmoothingQuality) (ctx as any).imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, outW, outH);
      this.thumbProxyUrl = c.toDataURL('image/png');
      this.log('syncSource.proxy.built', { outW, outH, ms: (performance.now() - t0).toFixed(1) });
    } catch {
      // Fallback: use original preview texture if proxy build fails
      this.thumbProxyUrl = previewTexture;
      this.log('syncSource.proxy.fallback', { ms: (performance.now() - t0).toFixed(1) });
    }
    // Keep coordinate system of the original viewBox; only the texture is downscaled
    this.engine.setSourceTextureFromPreview(this.thumbProxyUrl!, width, height);
    this.lastTextureId = previewTexture; this.lastW = width; this.lastH = height;
    this.log('syncSource.done', { ms: (performance.now() - t0).toFixed(1) });
  }

  async renderPresetThumbnail(preset: Preset, target: HTMLElement, quality: Quality = 'high'): Promise<void> {
    return this.schedule(async () => {
      const startGen = this.generation;
      const t0 = performance.now();
      this.log('render.start', { preset: preset.id, generation: startGen, inFlight: this.inFlight, pending: this.pending.length });
      this.ensure(); if (!this.engine) return;
      // Avoid batch mode here to let triggerUpdate run immediately for each tile
      this.engine.setBatchMode(false);
      const mapSource = buildMapSourceFromPreset(preset);
      const tLoad0 = performance.now();
      await (this.engine as any).loadMapAndWait(mapSource);
      this.log('render.map.loaded', { preset: preset.id, ms: (performance.now() - tLoad0).toFixed(1) });
      // Apply scale BEFORE soft so stdDeviation is computed with correct base
      this.engine.setScale(preset.defaultScale);
      this.engine.setStrength(preset.defaultStrength);

      // Thumbnails must reflect only displacement map with default strength/scale
      // Ignore chromatic/blur/soft/dissolve to avoid mismatch and noise
      this.engine.setChromaticAberration(0);
      this.engine.setBlur(0);
      this.engine.setSoft(0);
      this.engine.setDissolveStrength(0);
      // Immediate update for small canvas
      this.engine.triggerBatchUpdate();
      this.engine.forceRedraw();
      // Ensure feImg uses the freshly drawn map (avoid async toBlob race)
      try { (this.engine as any).inlineDisplacementTextureForExport(); } catch {}

      // If a new image/preview source was synced meanwhile, cancel this render
      if (startGen !== this.generation) return;

      const cropFactor = 2.0; // simple 2x center crop
      const outSize = 200; // restore size for crisper thumbnails

      // Cache key capturing generation and preset defaults only
      const key = `${startGen}|${preset.id}|${preset.defaultScale}|${preset.defaultStrength}|${outSize}`;
      const cached = this.cache.get(key);
      if (cached) {
        this.log('render.cache.hit', { preset: preset.id });
        const skeleton = target.querySelector('.thumb-skeleton') as HTMLElement | null;
        if (skeleton) skeleton.style.opacity = '0';
        target.style.backgroundImage = `url(${cached})`;
        target.style.backgroundSize = 'cover';
        target.style.backgroundPosition = 'center';
        target.style.backgroundRepeat = 'no-repeat';
        (target as any).dataset.thumbReady = '1';
        (target as any).dataset.thumbStale = '0';
        (target as HTMLElement).style.opacity = '1';
        this.log('render.done.cached', { preset: preset.id, ms: (performance.now() - t0).toFixed(1) });
        return;
      }
      // Render bigger snapshot before crop to preserve quality (no upscaling artifacts)
      const tSnap0 = performance.now();
      const bytes = await this.engine.getThumbnailBytes(Math.round(outSize * cropFactor));
      this.log('render.snapshot.bytes', { preset: preset.id, ms: (performance.now() - tSnap0).toFixed(1) });

      const applyDataUrl = (dataUrl: string) => {
        if (!dataUrl) return;
        // Guards: ensure still the same preset element and same generation
        if (startGen !== this.generation) return;
        if ((target as any).dataset.presetName && (target as any).dataset.presetName !== preset.name) return;
        target.style.backgroundImage = `url(${dataUrl})`;
        target.style.backgroundSize = 'cover';
        target.style.backgroundPosition = 'center';
        target.style.backgroundRepeat = 'no-repeat';
        const skeleton = target.querySelector('.thumb-skeleton') as HTMLElement | null;
        if (skeleton) skeleton.style.opacity = '0';
        (target as any).dataset.thumbReady = '1';
        (target as any).dataset.thumbStale = '0';
        (target as HTMLElement).style.opacity = '1';
        // Save into in-memory cache for this generation
        this.cache.set(key, dataUrl);
        this.log('render.done', { preset: preset.id, ms: (performance.now() - t0).toFixed(1) });
      };

      if (this.worker && 'OffscreenCanvas' in window) {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let handled = false;
        const onMsg = (e: MessageEvent) => {
          if (e.data && e.data.id === id && startGen === this.generation) {
            this.worker?.removeEventListener('message', onMsg as any);
            handled = true;
            applyDataUrl(e.data.dataUrl);
          }
        };
        this.worker.addEventListener('message', onMsg as any);
        this.worker.postMessage({ id, bytes, size: outSize, cropFactor });
        // Fallback timeout in case worker stalls
        setTimeout(async () => {
          if (handled || startGen !== this.generation) return;
          this.log('render.worker.timeout.fallback', { preset: preset.id });
          try {
            const blob = new Blob([bytes], { type: 'image/png' });
            const img = await this.blobToImage(blob);
            const c = document.createElement('canvas');
            c.width = outSize; c.height = outSize; const ctx = c.getContext('2d')!;
            const srcW = img.width, srcH = img.height;
            const cw = srcW / cropFactor, ch = srcH / cropFactor;
            const sx = Math.max(0, (srcW - cw) / 2); const sy = Math.max(0, (srcH - ch) / 2);
            ctx.imageSmoothingEnabled = true; // @ts-ignore
            if ((ctx as any).imageSmoothingQuality) (ctx as any).imageSmoothingQuality = 'high';
            ctx.drawImage(img, sx, sy, cw, ch, 0, 0, outSize, outSize);
            applyDataUrl(c.toDataURL('image/png'));
            this.worker?.removeEventListener('message', onMsg as any);
          } catch {}
        }, 1500);
        return;
      }

      // Fallback: do crop on main thread
      const blob = new Blob([bytes], { type: 'image/png' });
      let img: HTMLImageElement;
      try { img = await this.blobToImage(blob); } catch { return; }
      const c = document.createElement('canvas');
      c.width = outSize; c.height = outSize; const ctx = c.getContext('2d')!;
      const srcW = img.width, srcH = img.height;
      const cw = srcW / cropFactor, ch = srcH / cropFactor;
      const sx = Math.max(0, (srcW - cw) / 2); const sy = Math.max(0, (srcH - ch) / 2);
      ctx.imageSmoothingEnabled = true; // @ts-ignore
      if ((ctx as any).imageSmoothingQuality) (ctx as any).imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, cw, ch, 0, 0, outSize, outSize);
      applyDataUrl(c.toDataURL('image/png'));
    });
  }

  private blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
      img.src = url;
    });
  }

  private dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = dataUrl;
    });
  }
}


