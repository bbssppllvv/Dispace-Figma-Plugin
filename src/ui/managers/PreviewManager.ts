/**
 * Preview Manager
 * 
 * Handles the preview overlay state:
 * - Empty state messages ("Select any layer")
 * - Error messages
 * - Sample image loading
 */

import { APP_CONFIG } from '../config/constants';
import { uiManager } from './UIManager';
import { presetService } from '../services/PresetService';
import type { SampleImage } from '../presets/types';

export interface PreviewManagerDependencies {
  loadingOverlay: HTMLElement;
  messageDiv?: HTMLElement; // Optional initial message div
  onSampleSelected?: (bytes: Uint8Array) => Promise<void>;
}

/**
 * Manages preview overlay and sample images
 */
export class PreviewManager {
  private iconContainer: HTMLElement | null = null;
  private messageDiv: HTMLElement | null = null;
  private samplesContainer: HTMLElement | null = null;
  private samplesBottomContainer: HTMLElement | null = null;
  private onSampleSelected: ((bytes: Uint8Array) => Promise<void>) | null = null;

  constructor(private deps: PreviewManagerDependencies) {
    this.onSampleSelected = deps.onSampleSelected || null;
    
    // Listen for preset updates to refresh sample images
    document.addEventListener('presets:updated', () => this.refreshSamples());
    document.addEventListener('presets:refreshed', () => this.refreshSamples());
  }

  /**
   * Set callback for sample selection
   */
  setOnSampleSelected(callback: (bytes: Uint8Array) => Promise<void>): void {
    this.onSampleSelected = callback;
  }

  /**
   * Refresh sample images (called when presets are updated)
   */
  public refreshSamples(): void {
    if (this.samplesContainer) {
      this.samplesContainer.innerHTML = '';
      this.loadAndRenderSamples();
    }
  }

  /**
   * Show preview message with optional icon
   */
  showPreviewMessage(message: string, opts?: { icon?: 'hint' | 'error' }): void {
    // Build a small Samples UI when no image selected
    if (!this.samplesContainer) {
      // Container that holds icon + heading + hint + samples row; allow pointer events for clicks
      const container = document.createElement('div');
      container.className = 'flex flex-col items-center space-y-4';
      (container.style as any).pointerEvents = 'auto';

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

        this.deps.loadingOverlay.appendChild(samplesWrap);
        this.samplesBottomContainer = samplesWrap;
        this.samplesContainer = row;
      }

      // Replace previous message element with our container
      // Use provided messageDiv if available, otherwise find or create one
      if (this.deps.messageDiv) {
        this.deps.messageDiv.replaceWith(container);
      } else {
        const existingMessage = this.deps.loadingOverlay.querySelector('div.text-h1');
        if (existingMessage) {
          existingMessage.replaceWith(container);
        } else {
          this.deps.loadingOverlay.appendChild(container);
        }
      }
      this.messageDiv = msgEl;
    }
    
    // Use UIManager for basic message display
    if (this.messageDiv) {
      uiManager.showPreviewMessage(
        this.deps.loadingOverlay,
        this.messageDiv,
        null,
        message,
        opts
      );
    }

    // Populate sample images (needs engine access, so kept here)
    if (this.samplesContainer) {
      this.samplesContainer.innerHTML = '';
      
      this.loadAndRenderSamples();
    }
  }

  /**
   * Load samples from PresetService or fallback to static ones
   */
  private async loadAndRenderSamples(): Promise<void> {
    if (!this.samplesContainer) return;

    try {
      let samples = await presetService.getSampleImages();
      
      // Fallback to static samples if none loaded or empty
      if (!samples || samples.length === 0) {
        samples = APP_CONFIG.SAMPLES.IMAGES.map((s, i) => ({
          id: `static-${i}`,
          name: s.alt,
          url: s.url,
          order: i + 1
        }));
      }

      const GITHUB_BASE = 'https://raw.githubusercontent.com/bbssppllvv/Dispace-Figma-Plugin/main/assets';

      samples.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'sample-image-btn';
        btn.setAttribute('aria-label', `Load sample: ${s.name}`);
        
        const img = document.createElement('img');
        // Handle relative paths
        let url = s.url;
        if (url.startsWith('/')) {
          url = `${GITHUB_BASE}${url}`;
        }
        
        img.src = url;
        img.alt = s.name;
        img.className = 'sample-image-thumb';
        btn.appendChild(img);
        
        btn.addEventListener('click', async () => {
          try {
            if (this.onSampleSelected) {
              const res = await fetch(url, { cache: 'force-cache' });
              const blob = await res.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);
              
              await this.onSampleSelected(bytes);
            }
          } catch (e) {
            console.error('Failed to load sample image', e);
            this.showPreviewMessage('Failed to load sample. Please try again.');
          }
        });
        this.samplesContainer!.appendChild(btn);
      });
    } catch (error) {
      console.error('Error loading sample images:', error);
    }
  }

  /**
   * Hide preview message
   */
  hidePreviewMessage(): void {
    uiManager.hidePreviewMessage(this.deps.loadingOverlay);
  }
}
