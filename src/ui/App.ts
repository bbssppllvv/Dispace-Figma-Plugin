/**
 * Main Application Controller
 * 
 * The central coordinator of the Figma displacement plugin UI. This class orchestrates all
 * user interactions, manages the displacement engine lifecycle, and handles communication
 * with the Figma plugin backend through secure message passing.
 */

import type { Preset } from "./presets";
import { initDisplacementEngine, DisplacementEngine } from "./engine";
import { initTabs } from './components/Tabs';
import { initPresetGallery, refreshPresetGallery } from "./components/PresetGallery";
import { initControls, SliderInstance } from "./components/Controls";
import { requireElement } from "./utils/dom";
import { initializeServices, figmaService, licenseService, presetService } from "./services";
import { APP_CONFIG } from './config/constants';
import { createElement, replaceContent } from "./utils/dom";
import { initDevTools } from "./components/DevTools";
import { appStore } from "./store/AppStore";
import { uiManager } from "./managers/UIManager";
import { RandomizerManager } from "./managers/RandomizerManager";
import { FigmaMessageHandler } from "./managers/FigmaMessageHandler";
import { ModalManager } from "./managers/ModalManager";
import { PreviewManager } from "./managers/PreviewManager";
import { ImageSessionManager } from "./managers/ImageSessionManager";

type ControlsMap = {
  strength: SliderInstance;
  scale: SliderInstance;
  soft: SliderInstance;
  chromatic: SliderInstance;
  blur: SliderInstance;
  noise: SliderInstance;
  grain: SliderInstance;
  grainSize: SliderInstance;
  reflectStrength: SliderInstance;
  reflectSoft: SliderInstance;
  reflectSharp: SliderInstance;
  updateTooltips: (tooltips: any[]) => void;
  setBatchMode: (enabled: boolean) => void;
  updateAllVisuals: () => void;
};

export class App {
  private engine: DisplacementEngine;
  private sliders: ControlsMap | null = null;
  private randomizerManager: RandomizerManager | null = null;
  private unsubscribeLicense: (() => void) | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private isInitializing = true;
  
  private lastSelectedPreset: Preset | null = null;
  private lastMapSourceRef: { current: any } = { current: null };
  private isUpdatingStore = false;

  private modalManager: ModalManager;
  private previewManager: PreviewManager;
  private messageHandler: FigmaMessageHandler;
  private sessionManager: ImageSessionManager;

  private applyButton: HTMLButtonElement;
  private upgradeButton: HTMLButtonElement;
  private randomButton: HTMLButtonElement;
  private copyCodeButton: HTMLButtonElement;
  private loadingOverlay: HTMLElement;
  private controlsContainer: HTMLElement;
  private applyChevronButton: HTMLButtonElement;
  private applyMenu: HTMLElement;
  private applySplitContainer: HTMLElement;

  constructor() {
    initializeServices();
    
    const previewContainer = requireElement<HTMLElement>("#preview");
    
    this.applyButton = requireElement<HTMLButtonElement>("#applyToFigma");
    this.applyChevronButton = requireElement<HTMLButtonElement>("#applyChevron");
    this.applyMenu = requireElement<HTMLElement>("#applyMenu");
    this.applySplitContainer = requireElement<HTMLElement>("#applySplitContainer");
    this.upgradeButton = requireElement<HTMLButtonElement>("#upgradeToPro");
    this.randomButton = requireElement<HTMLButtonElement>("#randomize");
    this.copyCodeButton = requireElement<HTMLButtonElement>("#copyCode");
    this.loadingOverlay = requireElement<HTMLElement>("#loadingOverlay");
    
    const hudOverlay = document.getElementById('hudOverlay');
    const hudMessage = document.getElementById('hudMessage');
    uiManager.initHUD(hudOverlay, hudMessage);
    
    this.controlsContainer = requireElement<HTMLElement>("#controls-container");
    
    this.engine = initDisplacementEngine(previewContainer);
    this.sliders = initControls(this.engine) as unknown as ControlsMap;
    
    this.randomizerManager = new RandomizerManager(
      this.engine,
      this.sliders,
      this.randomButton,
      () => this.updateUIMode()
    );
    
    this.modalManager = new ModalManager();
    this.modalManager.init();
    
    const messageDiv = requireElement<HTMLElement>('div', this.loadingOverlay);
    this.previewManager = new PreviewManager({
      loadingOverlay: this.loadingOverlay,
      messageDiv: messageDiv
    });

    this.sessionManager = new ImageSessionManager({
      engine: this.engine,
      controlsContainer: this.controlsContainer,
      previewManager: this.previewManager,
      onRestoreControls: () => this.restoreControlsToEngine(),
      onUpdateUIMode: () => this.updateUIMode(),
      lastMapSourceRef: this.lastMapSourceRef
    });

    this.previewManager.setOnSampleSelected(async (bytes) => {
      await this.sessionManager.loadSession(bytes);
    });
    
    this.messageHandler = new FigmaMessageHandler({
      sessionManager: this.sessionManager,
      applyButton: this.applyButton,
      updateUIMode: () => this.updateUIMode()
    });
    
    this.init();
    this.initDevTools();
    this.setupLicenseSubscription();

    this.previewManager.showPreviewMessage('Select any layer');
    uiManager.setControlsEnabled(this.controlsContainer, false);
    
    // Set initial has-image state
    this.updatePreviewContainerClass();
  }

  private updatePreviewContainerClass() {
    const previewContainer = document.getElementById('preview');
    if (previewContainer) {
      previewContainer.classList.toggle('has-image', appStore.hasSelectedImage);
    }
  }

  private async init() {
    initTabs();
    
    // Load tooltips and update controls
    try {
      const tooltips = await presetService.getTooltips();
      if (tooltips.length > 0 && this.sliders) {
        this.sliders.updateTooltips(tooltips);
      }
    } catch (e) {
      console.warn('Failed to load tooltips:', e);
    }

    this.unsubscribeStore = appStore.subscribe(() => {
      this.handleStoreChange();
    });

    document.addEventListener('slider:drag-start', () => {
      if (appStore.isApplying || appStore.isShuffling || !appStore.hasSelectedImage) return;
      if (appStore.isPresetEffectActive) uiManager.cancelPresetEffect();
      uiManager.showHud();
    });
    document.addEventListener('slider:changing', (e) => {
      if (appStore.isApplying || appStore.isShuffling || !appStore.hasSelectedImage) return;
      const ev = e as CustomEvent;
      const label = (ev.detail && ev.detail.label) || '';
      const formatted = (ev.detail && ev.detail.formatted) || '';
      if (appStore.isPresetEffectActive) return;
      uiManager.setHud(`${label}\n${formatted}`);
    });
    document.addEventListener('slider:drag-end', () => {
      if (appStore.isApplying) return;
      if (appStore.isPresetEffectActive) return;
      uiManager.hideHudSoon();
    });

    if (this.sliders) {
      await initPresetGallery();
      this.randomButton.addEventListener("click", () => this.randomize());
      this.copyCodeButton.addEventListener("click", () => this.onCopyCode());
      this.applyButton.addEventListener("click", () => this.onApply());
      this.setupApplySplitButton();
    }
    
    this.isInitializing = false;
    this.messageHandler.init();
    try { figmaService.sendMessage('ui-ready'); } catch {}
    this.prefetchPopularPresets();
  }

  private handleStoreChange(): void {
    if (this.isUpdatingStore) return;
    const state = appStore.getState();
    try {
      this.isUpdatingStore = true;
      const currentPreset = state.selectedPreset;
      const currentMap = state.activeMapSource;
      const isMapChanging = currentMap && this.engine && currentMap !== this.lastMapSourceRef.current;
      const shouldLoadMap = isMapChanging && (!currentPreset || this.isMapForPreset(currentMap, currentPreset));

      if (shouldLoadMap) this.engine.setBatchMode(true);
      
      if (currentPreset && this.sliders && currentPreset !== this.lastSelectedPreset) {
        this.lastSelectedPreset = currentPreset;
        this.updateUIMode();
        if (!this.isInitializing && !appStore.isApplying && appStore.hasSelectedImage) {
          setTimeout(() => uiManager.playDisperseText(currentPreset.name), 0);
        }
        this.engine.setTextureScale(currentPreset.textureScale ?? 1);
        this.engine.setEffectSettings({
          strength: currentPreset.defaultStrength,
          scale: currentPreset.defaultScale
        });
        this.sliders.strength.setValue(currentPreset.defaultStrength, false);
        this.sliders.scale.setValue(currentPreset.defaultScale, false);
      }
      
      if (shouldLoadMap) {
        this.lastMapSourceRef.current = currentMap;
        this.engine.loadMapAndWait(currentMap).finally(() => {
          this.engine.setBatchMode(false);
          this.engine.triggerBatchUpdate();
        });
      }
    } finally {
      this.isUpdatingStore = false;
    }
  }

  private isMapForPreset(map: any, preset: Preset): boolean {
    if (map instanceof File || map instanceof HTMLImageElement) return false;
    return true;
  }

  private async prefetchPopularPresets() {
    try {
      const { getPresetsByCategory } = await import('./presets');
      const popular = await getPresetsByCategory('Popular');
      if (popular.length === 0) return;
      const { buildMapSourceFromPreset } = await import('./utils/maps');
      const mapSources = popular.map((p: Preset) => buildMapSourceFromPreset(p));
      this.engine.prefetchMapSources(mapSources).catch(() => {});
    } catch {}
  }

  private updateUIMode() {
    const selectedPreset = appStore.selectedPreset;
    const hasSelectedImage = appStore.hasSelectedImage;
    const isPremiumPreset = selectedPreset?.premium ?? false;
    const canApplyPreset = licenseService.canApplyPreset(selectedPreset || {});

    this.updatePreviewContainerClass();

    uiManager.updateUIMode(
      this.applySplitContainer,
      this.upgradeButton,
      this.applyButton,
      this.applyChevronButton,
      hasSelectedImage,
      isPremiumPreset,
      canApplyPreset
    );
  }

  private restoreControlsToEngine(): void {
    if (!this.sliders || !this.engine) return;
    this.engine.setEffectSettings({
      scale: this.sliders.scale.getValue(),
      strength: this.sliders.strength.getValue(),
      soft: this.sliders.soft.getValue(),
      chromaticAberration: this.sliders.chromatic.getValue(),
      blur: this.sliders.blur.getValue(),
      dissolveStrength: this.sliders.noise.getValue(),
      grain: this.sliders.grain.getValue(),
      grainSize: this.sliders.grainSize.getValue()
    });
  }

  private async randomize() {
    if (this.randomizerManager) await this.randomizerManager.randomize();
  }

  private async onCopyCode() {
    if (!this.engine) return;
    if (!licenseService.canExportCode()) {
      this.modalManager.showCopyCodeFreeModal();
      return;
    }
    try {
      const codeData = this.engine.exportSVGCode();
      const textarea = document.getElementById('codeOutput') as HTMLTextAreaElement;
      if (textarea) textarea.value = codeData.code;
      this.modalManager.showCopyCodeModal();
    } catch (error) {
      console.error('Error generating code:', error);
    }
  }

  private async onApply() {
    if (!this.engine || appStore.isApplying) return;
    const selectedPreset = appStore.selectedPreset;
    if (selectedPreset && !licenseService.canApplyPreset(selectedPreset)) return;

    try {
      appStore.setIsApplying(true);
      uiManager.updateApplyButton(this.applyButton, false, "Processing...");
      uiManager.setControlsEnabled(this.controlsContainer, false);
      uiManager.hideHudImmediately();
      const imageBytes = await this.engine.getImageBytes();
      await figmaService.applyDisplacementEffect(imageBytes, { mode: appStore.applyMode });
    } catch (error) {
      console.error('Error applying effect:', error);
      alert('Failed to apply effect. Please try again.');
      uiManager.updateApplyButton(this.applyButton, true, "Apply Effect");
      this.updateUIMode();
    } finally {
      uiManager.setControlsEnabled(this.controlsContainer, true);
      appStore.setIsApplying(false);
    }
  }

  private setupApplySplitButton() {
    const openMenu = () => {
      this.applyMenu.classList.remove('hidden');
      const closeMenu = () => {
        this.applyMenu.classList.add('hidden');
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onEsc);
      };
      const onDocClick = (e: MouseEvent) => {
        if (!this.applySplitContainer.contains(e.target as Node)) closeMenu();
      };
      const onEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeMenu();
      };
      setTimeout(() => {
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onEsc);
      }, 0);
    };

    this.applyChevronButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.applyMenu.classList.contains('hidden')) openMenu();
      else this.applyMenu.classList.add('hidden');
    });

    const copyBtn = requireElement<HTMLButtonElement>('#applyOptionCopy');
    const modifyBtn = requireElement<HTMLButtonElement>('#applyOptionModify');

    const setModeOnly = (mode: 'copy' | 'modify') => {
      appStore.setApplyMode(mode);
      const isCopy = appStore.applyMode === 'copy';
      copyBtn.classList.toggle('selected', isCopy);
      modifyBtn.classList.toggle('selected', !isCopy);
      this.applyMenu.classList.add('hidden');
    };

    copyBtn.addEventListener('click', () => setModeOnly('copy'));
    modifyBtn.addEventListener('click', () => setModeOnly('modify'));
  }

  private initDevTools() { initDevTools(); }
  private setupLicenseSubscription() {
    this.unsubscribeLicense = licenseService.onStateChange(() => {
      this.updateUIMode();
      refreshPresetGallery();
    });
  }

  public destroy() {
    this.unsubscribeLicense?.();
    this.unsubscribeStore?.();
    this.messageHandler?.destroy();
    this.engine?.dispose();
  }
}
