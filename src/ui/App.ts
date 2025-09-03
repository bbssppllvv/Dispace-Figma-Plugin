/**
 * Main Application Controller
 * 
 * The central coordinator of the Figma displacement plugin UI. This class orchestrates all
 * user interactions, manages the displacement engine lifecycle, and handles communication
 * with the Figma plugin backend through secure message passing.
 * 
 * Key responsibilities:
 * - Initialize and coordinate all UI components (controls, presets, modals)
 * - Manage the displacement engine instance and its state
 * - Handle secure communication with Figma through FigmaService
 * - Coordinate between user inputs and visual effects
 * - Manage image selection states and error handling
 * 
 * The App maintains a clean separation between UI logic and effect processing, ensuring
 * that the complex displacement engine can operate independently while providing
 * a smooth, responsive user experience.
 * 
 * @class App
 */

import { PRESETS, Preset } from "./presets";
import { initDisplacementEngine, DisplacementEngine } from "./engine";
import { initTabs } from './components/Tabs';
import { initPresetGallery, PresetSelectedEvent, MapSelectedEvent, refreshPresetGallery } from "./components/PresetGallery";
import { initControls, SliderInstance } from "./components/Controls";
import { generateRandomizedValues } from "./randomizer";
import { setupModal } from "./utils/modal";
import { requireElement } from "./utils/dom";
import { initializeServices, figmaService, licenseService } from "./services";
import { APP_CONFIG } from './config/constants';
import { createElement, replaceContent } from "./utils/dom";
import { initDevTools } from "./components/DevTools";
import paywallHTML from './components/paywall.html?raw';
import copycodeHTML from './components/copycode.html?raw';
import copycodeFreeHTML from './components/copycode-free.html?raw';

type ControlsMap = {
  strength: SliderInstance;
  scale: SliderInstance;
  soft: SliderInstance;
  chromatic: SliderInstance;
  blur: SliderInstance;
  noise: SliderInstance;
  reflectOpacity: SliderInstance;
  reflectSharpness: SliderInstance;
  // Batch control methods
  setBatchMode: (enabled: boolean) => void;
  updateAllVisuals: () => void;
};

export class App {
  private engine: DisplacementEngine;
  private sliders: ControlsMap | null = null;
  private hasSelectedImage = false;
  private selectedPreset: Preset | null = null;
  private copyCodeModal: { showModal: () => void; hideModal: () => void; } | undefined;
  private copyCodeFreeModal: { showModal: () => void; hideModal: () => void; } | undefined;
  private unsubscribeLicense: (() => void) | null = null;

  // Batch rendering state for Shuffle operations
  private isShuffling = false;
  private shuffleTimeoutId: number | null = null;
  private readonly SHUFFLE_TIMEOUT_MS = 5000; // Recovery timeout

  // DOM elements
  private applyButton: HTMLButtonElement;
  private upgradeButton: HTMLButtonElement;
  private randomButton: HTMLButtonElement;
  private copyCodeButton: HTMLButtonElement;
  private loadingOverlay: HTMLElement;
  private hudOverlay: HTMLElement | null = null;
  private hudMessage: HTMLElement | null = null;
  private activeEffectSvg: SVGSVGElement | null = null;
  private presetEffectRafId: number | null = null;
  private presetEffectDwellTimeoutId: number | null = null;
  private isPresetEffectActive = false;
  private messageDiv: HTMLElement;
  private samplesContainer: HTMLElement | null = null;
  private samplesBottomContainer: HTMLElement | null = null;
  private controlsContainer: HTMLElement;
  private applyChevronButton: HTMLButtonElement;
  private applyMenu: HTMLElement;
  private applyMode: 'modify' | 'copy' = 'modify';
  private applySplitContainer: HTMLElement;
  private isApplying = false;
  private iconContainer: HTMLElement | null = null;

  constructor() {
    // Initialize services first (they provide infrastructure)
    initializeServices();
    
    // TODO: Add server-side license validation here
    // After Stripe integration, the next developer should:
    // 1. Validate user's license status with server on app startup
    // 2. Handle expired/cancelled subscriptions
    // 3. Sync license state across devices
    // 4. Add periodic license validation for long-running sessions
    
    // --- DOM references with safe utilities ---
    const previewContainer = requireElement<HTMLElement>(
      "#preview", 
      document, 
      "Preview container not found"
    );
    
    // Use safe utilities for required elements
    this.applyButton = requireElement<HTMLButtonElement>("#applyToFigma");
    this.applyChevronButton = requireElement<HTMLButtonElement>("#applyChevron");
    this.applyMenu = requireElement<HTMLElement>("#applyMenu");
    this.applySplitContainer = requireElement<HTMLElement>("#applySplitContainer");
    this.upgradeButton = requireElement<HTMLButtonElement>("#upgradeToPro");
    this.randomButton = requireElement<HTMLButtonElement>("#randomize");
    this.copyCodeButton = requireElement<HTMLButtonElement>("#copyCode");
    this.loadingOverlay = requireElement<HTMLElement>("#loadingOverlay");
    this.hudOverlay = document.getElementById('hudOverlay');
    this.hudMessage = document.getElementById('hudMessage');
    this.controlsContainer = requireElement<HTMLElement>("#controls-container");
    
    // Safe query for nested element with better error message
    this.messageDiv = requireElement<HTMLElement>(
      'div', 
      this.loadingOverlay, 
      "Message div not found in loading overlay"
    );
    
    // --- Initializations ---
    // Initialize displacement engine first (it needs the preview container)
    this.engine = initDisplacementEngine(previewContainer);
    if (!this.engine) {
      throw new Error("Failed to initialize displacement engine");
    }

    // Initialize controls with engine reference and batch rendering check
    this.sliders = initControls(this.engine);
    if (!this.sliders) {
      throw new Error("Failed to initialize sliders - required elements not found");
    }
    
    this.init();
    this.initModals();
    this.initDevTools();
    this.setupLicenseSubscription();

    // --- Initial state ---
    this.showPreviewMessage('Select any image fill');
    this.setControlsEnabled(false);
  }

  private async init() {
    initTabs();
    if (this.sliders) {
      await initPresetGallery();
      this.randomButton.addEventListener("click", () => this.randomize());
      this.copyCodeButton.addEventListener("click", () => this.onCopyCode());
      
      this.applyButton.addEventListener("click", () => this.onApply());
      this.setupApplySplitButton();
    }
    
    // ✅ ПОСЛЕ: Типизированные обработчики сообщений через сервис
    this.setupFigmaMessageHandlers();

    // Сообщаем backend, что UI готов: теперь слушатели установлены
    // Это гарантирует, что мы не пропустим ответ с текущим выделением/пресетами
    try {
      figmaService.sendMessage('ui-ready');
    } catch {}

    // Listen for custom events from components
    document.addEventListener(PresetSelectedEvent, (e) => this.onPresetSelected(e as CustomEvent));
    document.addEventListener(MapSelectedEvent, (e) => this.onMapSelected(e as CustomEvent));

    // HUD: slider interaction events
    document.addEventListener('slider:drag-start', () => {
      // If a preset effect is active, cancel it to prioritize slider HUD
      if (this.isPresetEffectActive) this.cancelPresetEffect();
      this.showHud();
    });
    document.addEventListener('slider:changing', (e) => {
      const ev = e as CustomEvent;
      const label = (ev.detail && ev.detail.label) || '';
      const formatted = (ev.detail && ev.detail.formatted) || '';
      if (this.isPresetEffectActive) return; // suppress while preset effect is active
      this.setHud(`${label}\n${formatted}`);
    });
    document.addEventListener('slider:drag-end', () => {
      if (this.isPresetEffectActive) return; // preset effect will control overlay
      this.hideHudSoon();
    });

    // Background prefetch for Popular presets to speed up first interactions
    this.prefetchPopularPresets();
  }

  private initModals() {
    // ✅ ПОСЛЕ: Безопасная вставка HTML модалей через временный контейнер
    const paywallTemplate = document.createElement('template');
    paywallTemplate.innerHTML = paywallHTML;
    const paywallContent = paywallTemplate.content.cloneNode(true);
    document.body.appendChild(paywallContent);
    
    // Pro copycode modal
    const copycodeTemplate = document.createElement('template');
    copycodeTemplate.innerHTML = copycodeHTML;
    const copycodeContent = copycodeTemplate.content.cloneNode(true);
    document.body.appendChild(copycodeContent);

    // Free copycode modal
    const copycodeFreeTemplate = document.createElement('template');
    copycodeFreeTemplate.innerHTML = copycodeFreeHTML;
    const copycodeFreeContent = copycodeFreeTemplate.content.cloneNode(true);
    document.body.appendChild(copycodeFreeContent);

    setupModal('paywall-overlay', 'close-paywall-button', 'upgradeToPro');
    this.copyCodeModal = setupModal('copycode-overlay', 'close-copycode-button');
    this.copyCodeFreeModal = setupModal('copycode-overlay-free', 'close-copycode-free-button');

    // Paywall button handlers
    const goProButton = document.getElementById('go-pro-button');
    if (goProButton) {
      goProButton.addEventListener('click', async () => {
        // TODO: This is where Stripe integration will happen
        // 1. The next developer should replace licenseService.upgradeToPro()
        //    with actual Stripe Checkout session creation
        // 2. Handle payment success/failure callbacks
        // 3. Update user's license status after successful payment
        
        try {
          await licenseService.upgradeToPro();
          
          // TODO: Remove this dev simulation when Stripe is integrated
          if (licenseService.isDevModeEnabled()) {
            console.log('🧪 Dev mode: Simulating upgrade success');
            licenseService.devSetLicense('pro');
          }
        } catch (error) {
          console.error('Upgrade failed:', error);
          // TODO: Add proper error handling for Stripe failures
          // - Network errors
          // - Payment declined
          // - User cancellation
        }
      });
    }

    // Free modal upgrade buttons - open paywall
    const upgradeFromCopycode = document.getElementById('upgrade-from-copycode');
    
    if (upgradeFromCopycode) {
      upgradeFromCopycode.addEventListener('click', () => {
        this.copyCodeFreeModal?.hideModal();
        const paywallModal = setupModal('paywall-overlay', 'close-paywall-button', 'upgradeToPro');
        if (paywallModal) {
          paywallModal.showModal();
        }
      });
    }

    // Pro modal copy to clipboard handler
    const copyToClipboardButton = document.getElementById('copyToClipboard');
    if (copyToClipboardButton) {
      copyToClipboardButton.addEventListener('click', async () => {
        const textarea = document.getElementById('codeOutput') as HTMLTextAreaElement;
        try {
          await navigator.clipboard.writeText(textarea.value);
          const originalText = copyToClipboardButton.textContent;
          copyToClipboardButton.textContent = 'Copied!';
          setTimeout(() => {
            copyToClipboardButton.textContent = originalText;
          }, 2000);
        } catch (err) {
          textarea.select();
          document.execCommand('copy');
          alert('Code copied to clipboard!');
        }
      });
    }
  }

  /** Prefetch displacement maps for Popular presets category (background). */
  private async prefetchPopularPresets() {
    try {
      const popular = PRESETS.filter(p => p.category === 'Popular');
      if (popular.length === 0) return;
      const { buildMapSourceFromPreset } = await import('./utils/maps');
      const mapSources = popular.map(p => buildMapSourceFromPreset(p));
      // Fire and forget; do not block UI
      this.engine.prefetchMapSources(mapSources).catch(() => {});
    } catch {}
  }

  private onPresetSelected(e: CustomEvent) {
    if (!this.sliders) return;
    const preset = e.detail.preset as Preset;
    this.selectedPreset = preset;
    this.updateUIMode();
    // HUD: play disperse effect with preset name
    this.playDisperseText(preset.name);
    // No global scaleMode anymore; per-layer scaleMode handled by engine via MapSource
    this.sliders.strength.setValue(preset.defaultStrength);
    this.sliders.scale.setValue(preset.defaultScale);
  }

  private onMapSelected(e: CustomEvent) {
    if (!this.engine) return;
    const map = e.detail.map as any;
    const presetIdFromEvent = (e.detail && (e.detail as any).presetId) as string | undefined;
    if (presetIdFromEvent && this.selectedPreset && presetIdFromEvent !== this.selectedPreset.id) {
      // Ignore stale map load from a previously clicked preset
      return;
    }
    this.engine.loadMap(map);
  }

  private updateUIMode() {
    const isPremiumPreset = this.selectedPreset?.premium ?? false;
    const canApplyPreset = licenseService.canApplyPreset(this.selectedPreset || {});

    if (isPremiumPreset && !canApplyPreset) {
      // Pro preset on Free plan: hide split button (with chevron), show upgrade
      this.applySplitContainer.style.display = "none";
      this.upgradeButton.style.display = "block";
    } else {
      // Free preset or Pro license: show split button, hide upgrade
      this.applySplitContainer.style.display = "block";
      this.upgradeButton.style.display = "none";
    }

    const disabled = !this.hasSelectedImage;
    this.applyButton.disabled = disabled;
    this.applyChevronButton.disabled = disabled;
  }

  private randomize() {
    console.log('🎲 [SHUFFLE] Starting randomize operation');
    
    // Prevent concurrent shuffle operations
    if (this.isShuffling || !this.sliders || !this.engine) {
      console.log('🚫 [SHUFFLE] Operation blocked - isShuffling:', this.isShuffling, 'sliders:', !!this.sliders, 'engine:', !!this.engine);
      return;
    }

    const availablePresets = PRESETS;
    if (availablePresets.length === 0) {
      console.log('🚫 [SHUFFLE] No presets available');
      return;
    }

    console.log('✅ [SHUFFLE] Starting shuffle operation with', availablePresets.length, 'presets');
    this.startShuffleOperation();

    const randomPreset = availablePresets[Math.floor(Math.random() * availablePresets.length)];
    this.selectedPreset = randomPreset;
    console.log('🎯 [SHUFFLE] Selected random preset:', randomPreset.name);

    // Dispatch event for UI feedback
    console.log('📨 [SHUFFLE] Dispatching preset:randomized event');
    document.dispatchEvent(new CustomEvent('preset:randomized', {
      detail: { presetName: randomPreset.name }
    }));

    // HUD: play disperse effect with randomized preset name
    this.playDisperseText(randomPreset.name);

    // Start async map loading and batch parameter updates
    console.log('🚀 [SHUFFLE] Starting performBatchedShuffle');
    this.performBatchedShuffle(randomPreset);
  }

  // --- HUD helpers ---
  private hudHideTimer: number | null = null;

  private showHud() {
    if (this.hudOverlay) this.hudOverlay.style.display = 'flex';
    if (this.hudHideTimer) { clearTimeout(this.hudHideTimer); this.hudHideTimer = null; }
  }

  private setHud(text: string) {
    if (!this.hudOverlay || !this.hudMessage) return;
    this.hudOverlay.style.display = 'flex';
    // Preserve new lines for multi-line layout
    this.hudMessage.innerText = text;
  }

  private hideHudSoon(delay = 800) {
    if (!this.hudOverlay) return;
    if (this.isPresetEffectActive) return; // keep overlay during preset effect
    if (this.hudHideTimer) clearTimeout(this.hudHideTimer);
    this.hudHideTimer = window.setTimeout(() => {
      if (this.hudOverlay) this.hudOverlay.style.display = 'none';
      this.hudHideTimer = null;
    }, delay);
  }

  private flashHud(text: string, duration = 1000) {
    this.setHud(text);
    this.hideHudSoon(duration);
  }

  private playDisperseText(text: string): void {
    if (!this.hudOverlay) return;
    // Cancel any previous preset effect to avoid overlap
    this.cancelPresetEffect();
    this.isPresetEffectActive = true;
    // Ensure overlay visible
    this.hudOverlay.style.display = 'flex';
    // Clear any slider HUD text to avoid visual overlap
    if (this.hudMessage) this.hudMessage.innerText = '';
    if (this.hudHideTimer) { clearTimeout(this.hudHideTimer); this.hudHideTimer = null; }

    // Clean previous effect if any
    if (this.activeEffectSvg && this.activeEffectSvg.parentNode) {
      this.activeEffectSvg.parentNode.removeChild(this.activeEffectSvg);
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 400 400');
    (svg.style as any).position = 'absolute';
    (svg.style as any).left = '0';
    (svg.style as any).top = '0';
    (svg.style as any).right = '0';
    (svg.style as any).bottom = '0';
    (svg.style as any).pointerEvents = 'none';

    const defs = document.createElementNS(SVG_NS, 'defs');
    const filter = document.createElementNS(SVG_NS, 'filter');
    const filterId = `hudDisperse_${Date.now()}`;
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');

    // Two independent turbulence nodes with random seeds: coarse + fine
    const seed1 = String(Math.floor(Math.random() * 1000) + 1);
    const seed2 = String(Math.floor(Math.random() * 1000) + 1);

    const coarse = document.createElementNS(SVG_NS, 'feTurbulence');
    coarse.setAttribute('type', 'fractalNoise');
    coarse.setAttribute('baseFrequency', '0.06'); // large blobs
    coarse.setAttribute('numOctaves', '4');
    coarse.setAttribute('seed', seed1);
    coarse.setAttribute('result', 'coarse');

    const fine = document.createElementNS(SVG_NS, 'feTurbulence');
    fine.setAttribute('type', 'fractalNoise');
    fine.setAttribute('baseFrequency', '0.9'); // fine grit
    fine.setAttribute('numOctaves', '4');
    fine.setAttribute('seed', seed2);
    fine.setAttribute('result', 'fine');

    const blend = document.createElementNS(SVG_NS, 'feBlend');
    blend.setAttribute('in', 'coarse');
    blend.setAttribute('in2', 'fine');
    blend.setAttribute('mode', 'multiply');
    blend.setAttribute('result', 'noise');

    const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'noise');
    disp.setAttribute('scale', '0');
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');

    filter.appendChild(coarse);
    filter.appendChild(fine);
    filter.appendChild(blend);
    filter.appendChild(disp);
    defs.appendChild(filter);
    svg.appendChild(defs);

    const textEl = document.createElementNS(SVG_NS, 'text');
    textEl.setAttribute('x', '200');
    textEl.setAttribute('y', '200');
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'middle');
    textEl.setAttribute('fill', 'var(--color-hud-text)');
    textEl.setAttribute('filter', `url(#${filterId})`);
    // Use UI font; inline style to allow CSS variables
    (textEl.style as any).fontFamily = 'var(--font-family)';
    textEl.setAttribute('font-size', '18');
    textEl.textContent = text;

    svg.appendChild(textEl);
    this.hudOverlay.appendChild(svg);
    this.activeEffectSvg = svg;

    // First: keep the text visible without effect, then animate disperse
    const dwellMs = 1000;
    const durationMs = 600; // faster dissolve
    const maxScale = 220;

    // Ensure initial visible state
    disp.setAttribute('scale', '0');
    (textEl.style as any).opacity = '1';

    // Ease-in then strong ease-out for maximal slow-down at the end
    const easeInOutStrongEnd = (t: number) => {
      if (t < 0.5) {
        const x = t * 2; // 0..1
        // Accelerate: easeInQuad
        return 0.5 * (x * x);
      } else {
        const x = (t - 0.5) * 2; // 0..1
        // Strong deceleration: easeOutQuint
        const out = 1 - Math.pow(1 - x, 5);
        return 0.5 + 0.5 * out;
      }
    };

    const startAnimation = () => {
      const start = performance.now();
      const tick = () => {
        const now = performance.now();
        let t = (now - start) / durationMs;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        const eased = easeInOutStrongEnd(t);
        const scale = (eased * maxScale).toFixed(1);
        disp.setAttribute('scale', scale);
        // Fade aligned with easing (slower at end)
        (textEl.style as any).opacity = String(1 - eased);

        if (t < 1) {
          this.presetEffectRafId = requestAnimationFrame(tick);
        } else {
          // Cleanup
          if (svg.parentNode) svg.parentNode.removeChild(svg);
          if (this.activeEffectSvg === svg) this.activeEffectSvg = null;
          this.presetEffectRafId = null;
          this.isPresetEffectActive = false;
          // Hide overlay if no other HUD text is visible
          if (this.hudMessage && this.hudMessage.innerText.trim().length === 0) {
            this.hudOverlay!.style.display = 'none';
          }
        }
      };
      this.presetEffectRafId = requestAnimationFrame(tick);
    };

    // Delay before starting disperse
    this.presetEffectDwellTimeoutId = window.setTimeout(startAnimation, dwellMs);
  }

  private cancelPresetEffect(): void {
    // Cancel pending dwell timeout
    if (this.presetEffectDwellTimeoutId) {
      clearTimeout(this.presetEffectDwellTimeoutId);
      this.presetEffectDwellTimeoutId = null;
    }
    // Cancel running RAF
    if (this.presetEffectRafId !== null) {
      cancelAnimationFrame(this.presetEffectRafId);
      this.presetEffectRafId = null;
    }
    // Remove existing SVG
    if (this.activeEffectSvg && this.activeEffectSvg.parentNode) {
      this.activeEffectSvg.parentNode.removeChild(this.activeEffectSvg);
      this.activeEffectSvg = null;
    }
    this.isPresetEffectActive = false;
  }

  private startShuffleOperation() {
    console.log('🔒 [SHUFFLE] Setting batch mode and locking shuffle');
    this.isShuffling = true;
    
    // Enable batch mode in engine to prevent individual renders
    console.log('🛡️ [SHUFFLE] Enabling batch mode in engine');
    this.engine.setBatchMode(true);
    
    // Enable batch mode for sliders to prevent visual updates
    console.log('🛡️ [SHUFFLE] Enabling batch mode for sliders');
    if (this.sliders) {
      this.sliders.setBatchMode(true);
    }
    
    // Set recovery timeout to prevent permanent freezing
    this.shuffleTimeoutId = window.setTimeout(() => {
      console.warn('⏰ [SHUFFLE] Operation timed out, forcing completion');
      this.endShuffleOperation();
    }, this.SHUFFLE_TIMEOUT_MS);

    // Disable button to provide visual feedback
    console.log('🔇 [SHUFFLE] Disabling shuffle button');
    this.randomButton.disabled = true;
  }

  private async performBatchedShuffle(preset: Preset) {
    console.log('🔄 [SHUFFLE] performBatchedShuffle started for preset:', preset.name);
    
    try {
      // Generate new random values
      console.log('🎲 [SHUFFLE] Generating random values');
      const randomValues = generateRandomizedValues();
      console.log('📊 [SHUFFLE] Generated values:', randomValues);
      
      // Step 1: Load map asynchronously (this takes the most time)
      console.log('🗺️ [SHUFFLE] Building MapSource from preset for async loading');
      const mapSource = (await import('./utils/maps')).buildMapSourceFromPreset(preset);
      const mapLoadStart = performance.now();
      await this.engine.loadMapAndWait(mapSource);
      const mapLoadEnd = performance.now();
      console.log('✅ [SHUFFLE] Map loaded in', (mapLoadEnd - mapLoadStart).toFixed(2), 'ms');
      
      // Step 2: Update all sliders (engine updates but no renders triggered due to batch mode)
      console.log('🎚️ [SHUFFLE] Updating sliders in batch mode');
      const slidersUpdateStart = performance.now();
      this.updateSliders(randomValues);
      const slidersUpdateEnd = performance.now();
      console.log('✅ [SHUFFLE] Sliders updated in', (slidersUpdateEnd - slidersUpdateStart).toFixed(2), 'ms');
      
      // Step 3: End batch mode and trigger single final render
      console.log('🎬 [SHUFFLE] Ending shuffle operation and triggering final render');
      this.endShuffleOperation();
      console.log('✨ [SHUFFLE] Shuffle operation completed successfully');
      
    } catch (error) {
      console.error('❌ [SHUFFLE] Shuffle operation failed:', error);
      this.endShuffleOperation();
    }
  }

  private endShuffleOperation() {
    console.log('🔓 [SHUFFLE] Ending shuffle operation');
    this.isShuffling = false;
    
    // Disable batch mode for sliders first (this will trigger visual updates)
    console.log('🛡️ [SHUFFLE] Disabling batch mode for sliders');
    if (this.sliders) {
      this.sliders.setBatchMode(false);
    }
    
    // Disable batch mode and trigger final render
    console.log('🛡️ [SHUFFLE] Disabling batch mode in engine');
    this.engine.setBatchMode(false);
    
    // Add a small delay to ensure slider visuals update before final render
    setTimeout(() => {
      console.log('🎨 [SHUFFLE] Triggering final batch update');
      this.engine.triggerBatchUpdate();
    }, 5);
    
    // Clear timeout
    if (this.shuffleTimeoutId) {
      clearTimeout(this.shuffleTimeoutId);
      this.shuffleTimeoutId = null;
      console.log('⏰ [SHUFFLE] Cleared timeout');
    }
    
    // Force update UI mode
    console.log('🎨 [SHUFFLE] Updating UI mode');
    this.updateUIMode();
    
    // Re-enable button
    console.log('🔇 [SHUFFLE] Re-enabling shuffle button');
    this.randomButton.disabled = false;
    
    console.log('🏁 [SHUFFLE] Shuffle operation fully completed');
  }

  // removed unused loadMapWithPromise

  private updateSliders(values: { [key: string]: number }) {
    console.log('🎚️ [SLIDERS] Starting updateSliders with values:', values);
    
    if (!this.sliders) {
      console.warn('⚠️ [SLIDERS] No sliders available');
      return;
    }
    
    let updateCount = 0;
    for (const key in values) {
      if (key in this.sliders) {
        console.log(`🎚️ [SLIDERS] Updating ${key}: ${values[key]}`);
        (this.sliders as any)[key].setValue(values[key]);
        updateCount++;
      } else {
        console.warn(`⚠️ [SLIDERS] Slider ${key} not found`);
      }
    }
    console.log(`✅ [SLIDERS] Updated ${updateCount} sliders`);
  }

  private async onCopyCode() {
    if (!this.engine) return;

    // Export to Code is always Pro-only
    if (!licenseService.canExportCode()) {
      if (!this.copyCodeFreeModal) return;
      this.copyCodeFreeModal.showModal();
      return;
    }

    // User has Pro access, show the full version modal with real code
    if (!this.copyCodeModal) return;

    try {
      const codeData = this.engine.exportSVGCode();
      const settingsContainer = document.getElementById('current-settings');
      if (settingsContainer) {
        // ✅ ПОСЛЕ: Безопасное создание настроек без innerHTML
        const strengthDiv = createElement('div', {
          textContent: `Strength: ${codeData.settings.strength}`
        });
        const chromaticDiv = createElement('div', {
          textContent: `Chromatic: ${codeData.settings.chromaticAberration}`
        });
        const blurDiv = createElement('div', {
          textContent: `Blur: ${codeData.settings.blur}`
        });
        const softDiv = createElement('div', {
          textContent: `Soft: ${codeData.settings.soft}`
        });
        
        replaceContent(settingsContainer, [strengthDiv, chromaticDiv, blurDiv, softDiv]);
      }

      const textarea = document.getElementById('codeOutput') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = codeData.code;
      }

      this.copyCodeModal.showModal();
    } catch (error) {
      console.error('Error generating code:', error);
      alert('Failed to generate code. Please try again.');
    }
  }

  private showPreviewMessage(message: string, opts?: { icon?: 'hint' | 'error' }) {
    // Build a small Samples UI when no image selected
    if (!this.samplesContainer) {
      // Container that holds icon + heading + hint + samples row; allow pointer events for clicks
      const container = document.createElement('div');
      container.className = 'flex flex-col items-center space-y-4';
      (container.style as any).pointerEvents = 'auto';

      // Icon container (variant can change depending on state)
      this.iconContainer = document.createElement('div');
      this.iconContainer.setAttribute('aria-hidden', 'true');
      container.appendChild(this.iconContainer);

      // Text message element (H1 heading style)
      const msgEl = document.createElement('div');
      msgEl.className = 'text-h1 text-center';
      container.appendChild(msgEl);

      // Bottom-anchored samples block (at the very bottom of overlay)
      if (!this.samplesBottomContainer) {
        const samplesWrap = document.createElement('div');
        samplesWrap.className = 'flex flex-col items-center space-y-2';
        samplesWrap.style.position = 'absolute';
        samplesWrap.style.left = '0';
        samplesWrap.style.right = '0';
        samplesWrap.style.bottom = '40px';
        (samplesWrap.style as any).pointerEvents = 'auto';

        const hintEl = document.createElement('div');
        hintEl.textContent = 'or try these sample images';
        hintEl.className = 'text-secondary text-sm';
        samplesWrap.appendChild(hintEl);

        const row = document.createElement('div');
        row.className = 'flex space-x-2';
        row.setAttribute('role', 'list');
        samplesWrap.appendChild(row);

        this.loadingOverlay.appendChild(samplesWrap);
        this.samplesBottomContainer = samplesWrap;
        this.samplesContainer = row;
      }

      // Replace previous message element with our container
      this.messageDiv.replaceWith(container);
      this.messageDiv = msgEl;
    }
    this.messageDiv.textContent = message;

    // Update icon based on state
    const variant = opts?.icon || 'hint';
    if (this.iconContainer) {
      if (variant === 'error') {
        this.iconContainer.innerHTML = `
<svg width="52" height="45" viewBox="0 0 52 45" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M48.3682 25.001C48.993 24.3761 50.007 24.3761 50.6318 25.001C51.2567 25.6258 51.2567 26.6398 50.6318 27.2646L43.5137 34.3828L50.6318 41.501C51.2567 42.1258 51.2567 43.1398 50.6318 43.7646C50.007 44.3895 48.993 44.3895 48.3682 43.7646L41.25 36.6465L34.1318 43.7646C33.507 44.3895 32.493 44.3895 31.8682 43.7646C31.2433 43.1398 31.2433 42.1258 31.8682 41.501L38.9863 34.3828L31.8682 27.2646C31.2433 26.6398 31.2433 25.6258 31.8682 25.001C32.493 24.3761 33.507 24.3761 34.1318 25.001L41.25 32.1191L48.3682 25.001ZM49.5996 0C50.4833 0 51.1992 0.715954 51.1992 1.59961V19.2998C51.1989 20.1832 50.4831 20.8994 49.5996 20.8994C48.7163 20.8992 48.0003 20.1831 48 19.2998V3.19922H3.19922V35.3994H25.5996C26.4833 35.3994 27.1992 36.1163 27.1992 37C27.1988 37.8833 26.483 38.5996 25.5996 38.5996H1.59961C0.716393 38.5994 0.000421096 37.8832 0 37V1.59961C0 0.716084 0.716133 0.00021102 1.59961 0H49.5996Z" fill="black"/>
</svg>`;
      } else {
        this.iconContainer.innerHTML = `
<svg width="70" height="56" viewBox="0 0 70 56" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M26.9424 21.8779C27.3464 21.3639 28.0229 21.1473 28.6504 21.3311L68.25 32.9307C69.0187 33.1558 69.5023 33.9151 69.3818 34.707C69.2613 35.4989 68.5734 36.0801 67.7725 36.0664L46.1455 35.6963L47.6924 53.7295C47.7564 54.4764 47.2933 55.1677 46.5781 55.3926C45.8629 55.6174 45.0877 55.3153 44.7129 54.666L26.8145 23.666C26.4878 23.0998 26.5385 22.3919 26.9424 21.8779ZM43.8896 46.8408L42.8057 34.2031C42.767 33.7521 42.9217 33.3055 43.2305 32.9746C43.5395 32.6437 43.975 32.4591 44.4277 32.4668L55.9541 32.6631L31.582 25.5234L43.8896 46.8408ZM49.7998 0.867188C50.6835 0.867188 51.3994 1.58314 51.3994 2.4668V20.167C51.3991 21.0504 50.6833 21.7666 49.7998 21.7666C48.9165 21.7664 48.2005 21.0502 48.2002 20.167V4.06641H3.39941V36.2666H25.7998C26.6835 36.2666 27.3994 36.9835 27.3994 37.8672C27.399 38.7505 26.6832 39.4668 25.7998 39.4668H1.7998C0.916589 39.4666 0.200616 38.7504 0.200195 37.8672V2.4668C0.200195 1.58327 0.916329 0.867399 1.7998 0.867188H49.7998Z" fill="black"/>
</svg>`;
      }
    }

    // Populate sample images
    if (this.samplesContainer) {
      this.samplesContainer.innerHTML = '';
      const samples = APP_CONFIG.SAMPLES.IMAGES;

      samples.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'preset-item hover-overlay';
        btn.style.width = '46px';
        btn.style.height = '46px';
        btn.style.borderRadius = '6px';
        btn.style.padding = '0';
        btn.style.overflow = 'hidden';
        btn.setAttribute('aria-label', `Load sample: ${s.alt}`);
        const img = document.createElement('img');
        img.src = s.url;
        img.alt = s.alt;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        btn.appendChild(img);
        btn.addEventListener('click', async () => {
          try {
            // Fetch and load into engine like a real selection
            const res = await fetch(s.url, { cache: 'force-cache' });
            const blob = await res.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            this.hidePreviewMessage();
            this.setControlsEnabled(true);
            await this.engine.loadSourceFromBytes(bytes);
            try {
              const evt = new CustomEvent('thumbnail:rerender');
              document.dispatchEvent(evt);
            } catch {}
            this.hasSelectedImage = true;
            this.updateUIMode();
          } catch (e) {
            console.error('Failed to load sample image', e);
            this.showPreviewMessage('Failed to load sample. Please try again.');
          }
        });
        this.samplesContainer!.appendChild(btn);
      });
    }
    this.loadingOverlay.style.display = 'flex';
  }

  private hidePreviewMessage() {
    this.loadingOverlay.style.display = 'none';
  }

  private setControlsEnabled(enabled: boolean) {
    if (enabled) {
      this.controlsContainer.classList.remove('disabled');
    } else {
      this.controlsContainer.classList.add('disabled');
    }
    this.applyButton.disabled = !enabled;
  }

  private async onApply() {
    if (!this.engine || this.isApplying) return;

    // Check if user can apply the current preset
    if (this.selectedPreset && !licenseService.canApplyPreset(this.selectedPreset)) {
      // Show paywall modal for Pro presets on Free account
      const paywallModal = setupModal('paywall-overlay', 'close-paywall-button', 'upgradeToPro');
      if (paywallModal) {
        paywallModal.showModal();
      }
      return;
    }

    try {
      this.isApplying = true;
      this.applyButton.textContent = "Processing...";
      this.applyButton.disabled = true;
      
      const imageBytes = await this.engine.getImageBytes();
      
      // Unified apply through FigmaService API
      await figmaService.applyDisplacementEffect(imageBytes, { mode: this.applyMode });
      
    } catch (error) {
      console.error('Error applying effect:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to apply effect. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('too large') || error.message.includes('Image is too large')) {
          errorMessage = 'Image is too large for Figma. Try reducing the image size or using a smaller displacement effect.';
        } else if (error.message.includes('Failed to load SVG')) {
          errorMessage = 'Failed to process the effect. Please check your settings and try again.';
        } else if (error.message.includes('Failed to create blob')) {
          errorMessage = 'Failed to generate the final image. Please try with different settings.';
        }
      }
      
      alert(errorMessage);
      
      this.applyButton.textContent = "Apply Effect";
      this.updateUIMode();
    } finally {
      this.isApplying = false;
    }
  }

  private setupApplySplitButton() {
    const openMenu = () => {
      this.applyMenu.classList.remove('hidden');
      // Close on outside click or Esc
      const onDocClick = (e: MouseEvent) => {
        const target = e.target as Node;
        const container = document.getElementById('applySplitContainer');
        if (container && !container.contains(target)) {
          closeMenu();
        }
      };
      const onEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeMenu();
      };
      const closeMenu = () => {
        this.applyMenu.classList.add('hidden');
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onEsc);
      };
      setTimeout(() => {
        document.addEventListener('click', onDocClick, { once: true });
        document.addEventListener('keydown', onEsc, { once: true });
      }, 0);
    };

    this.applyChevronButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.applyMenu.classList.contains('hidden')) {
        openMenu();
      } else {
        this.applyMenu.classList.add('hidden');
      }
    });

    const copyBtn = requireElement<HTMLButtonElement>('#applyOptionCopy');
    const modifyBtn = requireElement<HTMLButtonElement>('#applyOptionModify');

    const setModeOnly = (mode: 'copy' | 'modify') => {
      this.applyMode = mode;
      // Update visual selection with checkmarks
      const isCopy = mode === 'copy';
      copyBtn.classList.toggle('selected', isCopy);
      copyBtn.setAttribute('aria-checked', String(isCopy));
      modifyBtn.classList.toggle('selected', !isCopy);
      modifyBtn.setAttribute('aria-checked', String(!isCopy));
      this.applyMenu.classList.add('hidden');
    };

    copyBtn.addEventListener('click', () => setModeOnly('copy'));
    modifyBtn.addEventListener('click', () => setModeOnly('modify'));
  }

  /**
   * Настройка обработчиков сообщений от Figma через FigmaService
   */
  private setupFigmaMessageHandlers(): void {
    // Обработчик обновления выделения
    figmaService.onMessage('selection-updated', async (message) => {
      if (!this.engine) return;
      try {
        this.hidePreviewMessage();
        this.setControlsEnabled(true);
        
        // The ImageLoader now handles spinner internally, no need to show message here
        await this.engine.loadSourceFromBytes(message.imageBytes);
        // After a new image is loaded, ask gallery to re-render thumbnails with live effect
        try {
          const evt = new CustomEvent('thumbnail:rerender');
          document.dispatchEvent(evt);
        } catch {}
        
        this.hasSelectedImage = true;
        this.updateUIMode();
      } catch (error) {
        console.error('Error loading selected image:', error);
        
        // More specific error messages based on error type
        let errorMessage = 'Error loading image. Please try again.';
        if (error instanceof Error) {
          if (error.message.includes('too large')) {
            errorMessage = 'Image is too large. Please select a smaller image.';
          } else if (error.message.includes('No image data')) {
            errorMessage = 'No image data found. Please select a layer with an image fill.';
          } else if (error.message.includes('Preview container')) {
            errorMessage = 'Preview interface error. Please refresh the plugin.';
          }
        }
        
        this.showPreviewMessage(errorMessage);
        this.hasSelectedImage = false;
        this.setControlsEnabled(false);
      }
    });

    // Обработчик очистки выделения
    figmaService.onMessage('selection-cleared', () => {
      if (!this.engine) return;
      this.engine.clear();
      try {
        const evt = new CustomEvent('thumbnail:clear');
        document.dispatchEvent(evt);
      } catch {}
      this.showPreviewMessage('Select any image fill', { icon: 'hint' });
      this.hasSelectedImage = false;
      this.setControlsEnabled(false);
      this.updateUIMode();
    });

    // Обработчик неподдерживаемых узлов
    figmaService.onMessage('unsupported-node', (message) => {
      if (!this.engine) return;
      this.engine.clear();
      let reason = "This layer is not supported.";
      if (message.reason === 'multiple') {
        reason = "Please select a single layer.";
      } else if (message.reason === 'vector') {
        reason = "Please select a layer with an image fill, not a vector.";
      } else if (message.reason === 'no-image-fill') {
        reason = "The selected layer does not have an image fill.";
      }
      this.showPreviewMessage(reason, { icon: 'error' });
      this.hasSelectedImage = false;
      this.setControlsEnabled(false);
      this.updateUIMode();
    });

    // Обработчик успешного применения эффекта
    figmaService.onMessage('apply-success', () => {
      this.applyButton.textContent = "Apply Effect";
      this.updateUIMode();
    });

    // Обработчик ошибки применения эффекта
    figmaService.onMessage('apply-error', (message) => {
      alert(`Figma failed to apply the effect: ${message.error}`);
      this.applyButton.textContent = "Apply Effect";
      this.updateUIMode();
    });

    // Обработчик загрузки кастомных пресетов (пустой, но нужен для совместимости)
    figmaService.onMessage('custom-presets-loaded', () => {
      // Обрабатывается в customPresetsManager
    });
  }

  private initDevTools() {
    initDevTools();
  }

  private setupLicenseSubscription() {
    this.unsubscribeLicense = licenseService.onStateChange(() => {
      this.updateUIMode();
      // Refresh preset gallery to update PRO badges
      refreshPresetGallery();
    });
  }

  public destroy() {
    if (this.unsubscribeLicense) {
      this.unsubscribeLicense();
    }
  }
}
