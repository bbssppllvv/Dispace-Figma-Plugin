/**
 * Development Tools
 * 
 * Dev buttons to toggle Free/Pro mode and refresh presets.
 * Easily disabled for production in LicenseService.ts (DEV_MODE_ENABLED = false).
 * 
 * Architecture:
 * - Modular component with clear responsibility  
 * - Encapsulated state
 * - Clean integration via services
 * - Does not disrupt existing structure
 */

import { licenseService } from '../services';
import { refreshPresetsFromCDN } from './PresetGallery';
import { createElement } from '../utils/dom';

export class DevTools {
  private toggleButton: HTMLElement | null = null;
  private refreshButton: HTMLElement | null = null;
  private toggleSvg: SVGElement | null = null;

  constructor() {
    if (licenseService.isDevModeEnabled()) {
      this.createSimpleToggle();
      this.createRefreshButton();
    }
  }

  private createSimpleToggle(): void {
    console.log('🧪 Creating dev toggle button');
    
    const isPro = licenseService.isPro();
    
    this.toggleButton = createElement('button', {
      styles: {
        position: 'fixed',
        top: '6px',
        left: '6px',
        width: '24px',
        height: '24px',
        background: isPro 
          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
          : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        zIndex: '10000',
        opacity: '0.9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isPro 
          ? '0 2px 8px rgba(16, 185, 129, 0.4)' 
          : '0 2px 8px rgba(245, 158, 11, 0.4)',
        transition: 'all 0.2s ease'
      }
    });

    // Create SVG crown icon
    this.toggleSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.toggleSvg.setAttribute('width', '14');
    this.toggleSvg.setAttribute('height', '14');
    this.toggleSvg.setAttribute('viewBox', '0 0 24 24');
    this.toggleSvg.setAttribute('fill', 'white');
    this.toggleSvg.style.transition = 'transform 0.2s ease';
    
    // Crown path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06l-3.73.99-3.5-6.03c-.4-.7-1.4-.7-1.8 0l-3.5 6.03-3.73-.99c-.8-.22-1.63.26-1.84 1.06-.21.8.26 1.62 1.06 1.84l4.5 1.19c.54.14 1.12-.08 1.43-.55L12 8.03l2.88 4.09c.31.47.89.69 1.43.55l4.5-1.19c.8-.22 1.27-1.04 1.06-1.84z');
    this.toggleSvg.appendChild(path);
    
    this.toggleButton.appendChild(this.toggleSvg);
    
    // Hover effects
    this.toggleButton.addEventListener('mouseenter', () => {
      this.toggleButton!.style.opacity = '1';
      this.toggleButton!.style.transform = 'scale(1.05)';
      this.toggleSvg!.style.transform = 'scale(1.1)';
    });
    
    this.toggleButton.addEventListener('mouseleave', () => {
      this.toggleButton!.style.opacity = '0.9';
      this.toggleButton!.style.transform = 'scale(1)';
      this.toggleSvg!.style.transform = 'scale(1)';
    });

    this.toggleButton.addEventListener('click', () => {
      console.log('🧪 Dev toggle clicked');
      licenseService.devToggleLicense();
      this.updateButton();
    });

    // Update color on license change
    licenseService.onStateChange(() => {
      this.updateButton();
    });

    document.body.appendChild(this.toggleButton);
    console.log('🧪 Dev toggle button added to DOM');
  }

  private createRefreshButton(): void {
    console.log('🧪 Creating preset refresh button');
    
    this.refreshButton = createElement('button', {
      styles: {
        position: 'fixed',
        top: '6px',
        left: '36px',
        width: '24px',
        height: '24px',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        zIndex: '10000',
        opacity: '0.9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
        transition: 'all 0.2s ease'
      }
    });

    // Create SVG refresh icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'white');
    svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.transition = 'transform 0.3s ease';
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8');
    svg.appendChild(path);
    
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '21 3 21 8 16 8');
    svg.appendChild(polyline);
    
    this.refreshButton.appendChild(svg);
    
    // Hover effects
    this.refreshButton.addEventListener('mouseenter', () => {
      this.refreshButton!.style.opacity = '1';
      this.refreshButton!.style.transform = 'scale(1.05)';
      this.refreshButton!.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.5)';
    });
    
    this.refreshButton.addEventListener('mouseleave', () => {
      this.refreshButton!.style.opacity = '0.9';
      this.refreshButton!.style.transform = 'scale(1)';
      this.refreshButton!.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.4)';
    });

    this.refreshButton.addEventListener('click', async () => {
      console.log('🔄 Refreshing presets & samples from CDN...');
      
      // Animate rotation
      svg.style.transform = 'rotate(360deg)';
      this.refreshButton!.style.opacity = '0.6';
      this.refreshButton!.style.pointerEvents = 'none';
      
      try {
        await refreshPresetsFromCDN();
        console.log('✅ Presets & samples refreshed successfully');
        
        // Success flash
        this.refreshButton!.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        this.refreshButton!.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.5)';
        
        setTimeout(() => {
          svg.style.transform = 'rotate(0deg)';
          this.refreshButton!.style.opacity = '0.9';
          this.refreshButton!.style.pointerEvents = 'auto';
          this.refreshButton!.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
          this.refreshButton!.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.4)';
        }, 1500);
      } catch (error) {
        console.error('❌ Failed to refresh:', error);
        
        // Error flash
        this.refreshButton!.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        this.refreshButton!.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.5)';
        
        setTimeout(() => {
          svg.style.transform = 'rotate(0deg)';
          this.refreshButton!.style.opacity = '0.9';
          this.refreshButton!.style.pointerEvents = 'auto';
          this.refreshButton!.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
          this.refreshButton!.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.4)';
        }, 2000);
      }
    });

    document.body.appendChild(this.refreshButton);
  }

  private updateButton(): void {
    if (this.toggleButton) {
      const isPro = licenseService.isPro();
      this.toggleButton.style.background = isPro 
        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      this.toggleButton.style.boxShadow = isPro 
        ? '0 2px 8px rgba(16, 185, 129, 0.4)' 
        : '0 2px 8px rgba(245, 158, 11, 0.4)';
    }
  }

  public destroy(): void {
    if (this.toggleButton) {
      document.body.removeChild(this.toggleButton);
      this.toggleButton = null;
    }
    if (this.refreshButton) {
      document.body.removeChild(this.refreshButton);
      this.refreshButton = null;
    }
  }
}

// Simple initialization
export function initDevTools(): DevTools | null {
  if (licenseService.isDevModeEnabled()) {
    return new DevTools();
  }
  return null;
} 