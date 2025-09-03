/**
 * Development Tools
 * 
 * Простая dev кнопка 8x8px для переключения Free/Pro режима в разработке.
 * Легко отключается для продакшена в LicenseService.ts (DEV_MODE_ENABLED = false).
 * 
 * Архитектура:
 * - Модульный компонент с четкой ответственностью  
 * - Инкапсулированное состояние
 * - Чистая интеграция через services
 * - Не нарушает существующую структуру
 */

import { licenseService } from '../services';
import { refreshPresetsFromCDN } from './PresetGallery';
import { createElement } from '../utils/dom';

export class DevTools {
  private toggleButton: HTMLElement | null = null;
  private refreshButton: HTMLElement | null = null;

  constructor() {
    if (licenseService.isDevModeEnabled()) {
      this.createSimpleToggle();
      this.createRefreshButton();
    }
  }

  private createSimpleToggle(): void {
    console.log('🧪 Creating dev toggle button');
    
    this.toggleButton = createElement('button', {
      textContent: '',
      styles: {
        position: 'fixed',
        top: '8px',
        left: '8px',
        width: '8px',
        height: '8px',
        background: licenseService.isPro() ? '#10b981' : '#f59e0b',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '2px',
        cursor: 'pointer',
        zIndex: '10000',
        opacity: '0.8'
      }
    });

    this.toggleButton.addEventListener('click', () => {
      console.log('🧪 Dev toggle clicked');
      licenseService.devToggleLicense();
      this.updateButton();
    });

    // Обновляем цвет при изменении лицензии
    licenseService.onStateChange(() => {
      this.updateButton();
    });

    document.body.appendChild(this.toggleButton);
    console.log('🧪 Dev toggle button added to DOM');
  }

  private createRefreshButton(): void {
    console.log('🧪 Creating preset refresh button');
    
    this.refreshButton = createElement('button', {
      textContent: '🔄',
      styles: {
        position: 'fixed',
        top: '8px',
        left: '20px',
        width: '16px',
        height: '16px',
        background: '#3b82f6',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '2px',
        cursor: 'pointer',
        zIndex: '10000',
        opacity: '0.8',
        fontSize: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }
    });

    this.refreshButton.addEventListener('click', async () => {
      console.log('🔄 Refreshing presets from CDN...');
      this.refreshButton!.textContent = '⏳';
      this.refreshButton!.style.opacity = '0.5';
      
      try {
        await refreshPresetsFromCDN();
        console.log('✅ Presets refreshed successfully');
        this.refreshButton!.textContent = '✅';
        setTimeout(() => {
          this.refreshButton!.textContent = '🔄';
          this.refreshButton!.style.opacity = '0.8';
        }, 2000);
      } catch (error) {
        console.error('❌ Failed to refresh presets:', error);
        this.refreshButton!.textContent = '❌';
        setTimeout(() => {
          this.refreshButton!.textContent = '🔄';
          this.refreshButton!.style.opacity = '0.8';
        }, 2000);
      }
    });

    document.body.appendChild(this.refreshButton);
  }

  private updateButton(): void {
    if (this.toggleButton) {
      this.toggleButton.style.background = licenseService.isPro() ? '#10b981' : '#f59e0b';
    }
  }

  public destroy(): void {
    if (this.toggleButton) {
      document.body.removeChild(this.toggleButton);
      this.toggleButton = null;
    }
  }
}

// Простая инициализация
export function initDevTools(): DevTools | null {
  if (licenseService.isDevModeEnabled()) {
    return new DevTools();
  }
  return null;
} 