/**
 * UI Manager
 * 
 * Handles DOM element creation and simple UI updates.
 * Separates view logic from business logic.
 */

import { appStore } from '../store/AppStore';
import { Hud } from '../components/Hud';
import { DisperseEffect } from '../effects/DisperseEffect';

/**
 * UI Manager for DOM operations
 */
export class UIManager {
  private hud: Hud | null = null;
  private disperseEffect: DisperseEffect | null = null;

  /**
   * Initialize HUD elements
   */
  initHUD(hudOverlay: HTMLElement | null, hudMessage: HTMLElement | null) {
    this.hud = new Hud(hudOverlay, hudMessage);
    if (hudOverlay) {
      this.disperseEffect = new DisperseEffect(hudOverlay);
    }
  }

  /**
   * Show preview message with optional icon
   * HIGHEST PRIORITY: Hides HUD overlay when showing loading message
   */
  showPreviewMessage(
    container: HTMLElement,
    messageDiv: HTMLElement,
    iconContainer: HTMLElement | null,
    message: string,
    opts?: { icon?: 'hint' | 'error' }
  ): void {
    // HIGHEST PRIORITY: Hide HUD overlay when showing loading message
    this.hideHudImmediately();
    
    messageDiv.textContent = message;

    container.style.display = 'flex';
  }

  /**
   * Hide preview message
   */
  hidePreviewMessage(container: HTMLElement): void {
    container.style.display = 'none';
  }

  /**
   * Set controls enabled/disabled state
   */
  setControlsEnabled(container: HTMLElement, enabled: boolean): void {
    if (enabled) {
      container.classList.remove('disabled');
    } else {
      container.classList.add('disabled');
    }
  }

  /**
   * Update apply button state
   */
  updateApplyButton(
    button: HTMLButtonElement,
    enabled: boolean,
    text?: string
  ): void {
    button.disabled = !enabled;
    if (text) {
      button.textContent = text;
    }
  }

  /**
   * Update UI mode based on preset and license
   */
  updateUIMode(
    applySplitContainer: HTMLElement,
    upgradeButton: HTMLButtonElement,
    applyButton: HTMLButtonElement,
    applyChevronButton: HTMLButtonElement,
    hasSelectedImage: boolean,
    isPremiumPreset: boolean,
    canApplyPreset: boolean
  ): void {
    if (isPremiumPreset && !canApplyPreset) {
      // Pro preset on Free plan: hide split button, show upgrade
      applySplitContainer.style.display = 'none';
      upgradeButton.style.display = 'block';
    } else {
      // Free preset or Pro license: show split button, hide upgrade
      applySplitContainer.style.display = 'block';
      upgradeButton.style.display = 'none';
    }

    const disabled = !hasSelectedImage;
    applyButton.disabled = disabled;
    applyChevronButton.disabled = disabled;
  }

  // --- HUD Methods ---

  /**
   * Show HUD overlay (for slider values)
   * MEDIUM PRIORITY: Only shows if no loading overlay is visible
   */
  showHud() {
    // Don't show HUD if loading overlay is visible (check via store state)
    if (!appStore.hasSelectedImage) return; // Loading overlay takes priority
    
    this.hud?.show();
  }

  /**
   * Set HUD text (for slider values)
   * MEDIUM PRIORITY: Only shows if no loading overlay is visible
   */
  setHud(text: string) {
    // Don't show HUD if loading overlay is visible
    if (!appStore.hasSelectedImage) return; // Loading overlay takes priority
    
    this.hud?.setText(text);
  }

  /**
   * Hide HUD with delay
   */
  hideHudSoon(delay = 800) {
    if (appStore.isPresetEffectActive) return; // keep overlay during preset effect
    this.hud?.hideSoon(delay);
  }

  /**
   * Hide HUD immediately (no delay)
   */
  public hideHudImmediately(): void {
    this.hud?.hideImmediately();
    // Cancel any preset effect when hiding HUD
    this.cancelPresetEffect();
  }

  flashHud(text: string, duration = 1000) {
    this.setHud(text);
    this.hideHudSoon(duration);
  }

  /**
   * Play preset name animation effect
   * MEDIUM PRIORITY: Only shows if image is selected (no loading overlay)
   */
  playDisperseText(text: string): void {
    if (!this.disperseEffect || !this.hud) return;
    
    // Don't show preset effect if loading overlay is visible
    if (!appStore.hasSelectedImage) return; // Loading overlay takes priority
    
    // Cancel any previous preset effect to avoid overlap
    this.cancelPresetEffect();
    appStore.setIsPresetEffectActive(true);

    // Ensure overlay visible
    this.hud.show();
    this.hud.clearText();
    
    // Play the effect
    this.disperseEffect.play(text, () => {
      appStore.setIsPresetEffectActive(false);
      // Hide overlay if no other HUD text is visible
      if (!this.hud?.hasText()) {
        this.hud?.hideImmediately();
      }
    });
  }

  cancelPresetEffect(): void {
    this.disperseEffect?.cancel();
    appStore.setIsPresetEffectActive(false);
  }
}

// Singleton instance
export const uiManager = new UIManager();
