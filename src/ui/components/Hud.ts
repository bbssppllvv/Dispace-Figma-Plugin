/**
 * HUD Component
 * 
 * Manages the Heads-Up Display overlay for showing slider values and messages.
 */
export class Hud {
  private overlay: HTMLElement | null = null;
  private message: HTMLElement | null = null;
  private hideTimer: number | null = null;

  constructor(overlay: HTMLElement | null, message: HTMLElement | null) {
    this.overlay = overlay;
    this.message = message;
  }

  /**
   * Show the HUD overlay
   */
  show(): void {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
    }
    this.clearHideTimer();
  }

  /**
   * Set the text content of the HUD
   */
  setText(text: string): void {
    if (!this.overlay || !this.message) return;
    this.overlay.style.display = 'flex';
    this.message.innerText = text;
  }

  /**
   * Clear the HUD text
   */
  clearText(): void {
    if (this.message) {
      this.message.innerText = '';
    }
  }

  /**
   * Hide the HUD after a delay
   */
  hideSoon(delay = 800): void {
    if (!this.overlay) return;
    
    this.clearHideTimer();
    this.hideTimer = window.setTimeout(() => {
      if (this.overlay) {
        this.overlay.style.display = 'none';
      }
      this.hideTimer = null;
    }, delay);
  }

  /**
   * Hide the HUD immediately
   */
  hideImmediately(): void {
    this.clearHideTimer();
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }

  /**
   * Check if HUD is currently visible
   */
  isVisible(): boolean {
    return this.overlay ? this.overlay.style.display !== 'none' : false;
  }

  /**
   * Check if HUD has text content
   */
  hasText(): boolean {
    return this.message ? this.message.innerText.trim().length > 0 : false;
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}

