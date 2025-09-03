/**
 * License Service
 * 
 * Простое управление Free/Pro состоянием для Figma плагина.
 * 
 * TODO: This service will need Stripe integration for production:
 * - Replace upgradeToPro() with real Stripe Checkout
 * - Add server-side license validation
 * - Implement webhook handling for subscription updates
 * - Add license expiration checking
 */

import { APP_CONFIG } from '../config/constants';
import { createStorageAdapter, type StorageAdapter } from './StorageAdapter';

type LicenseState = 'free' | 'pro';
type LicenseChangeListener = (state: LicenseState) => void;

export class LicenseService {
  private currentState: LicenseState = 'free';
  private listeners: Set<LicenseChangeListener> = new Set();
  private isDevMode: boolean = false;
  private storage: StorageAdapter;

  constructor() {
    this.storage = createStorageAdapter();
    this.isDevMode = this.checkDevMode();
    this.loadSavedState();
    
    console.log(`🧪 LicenseService initialized - Dev mode: ${this.isDevMode}, State: ${this.currentState}`);
  }

  isPro(): boolean {
    return this.currentState === 'pro';
  }

  isFree(): boolean {
    return this.currentState === 'free';
  }

  getState(): LicenseState {
    return this.currentState;
  }

  canAccessPreset(preset: { premium?: boolean }): boolean {
    return !preset.premium || this.isPro();
  }

  canApplyPreset(preset: { premium?: boolean }): boolean {
    return this.canAccessPreset(preset);
  }

  canExportCode(): boolean {
    return this.isPro();
  }

  devToggleLicense(): void {
    if (!this.isDevMode) return;
    this.currentState = this.currentState === 'free' ? 'pro' : 'free';
    this.saveState();
    this.notifyListeners();
  }

  devSetLicense(state: LicenseState): void {
    if (!this.isDevMode) return;
    this.currentState = state;
    this.saveState();
    this.notifyListeners();
  }

  isDevModeEnabled(): boolean {
    return this.isDevMode;
  }

  onStateChange(listener: LicenseChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async upgradeToPro(): Promise<void> {
    // TODO: Integrate with Stripe Checkout
    // 1. Create Stripe checkout session with user/plugin info
    // 2. Redirect to Stripe or open popup
    // 3. Handle success webhook on server
    // 4. Update user license status on server
    // 5. Refresh local license state
    
    console.log('🚀 Upgrade to Pro flow - TODO: Implement Stripe integration');
    
    // TODO: Remove this dev simulation when Stripe is integrated
    if (this.isDevMode) {
      console.log('🧪 Dev mode: Simulating Stripe success');
      // In dev mode, we simulate upgrade success for testing
      return Promise.resolve();
    }
    
    // TODO: Replace with actual Stripe integration
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * TODO: Add method for server-side license validation
   * This should be called periodically to verify subscription status
   */
  async validateLicenseWithServer(): Promise<boolean> {
    // TODO: Implement server-side license validation
    // 1. Get user ID or session token
    // 2. Call backend API to check subscription status
    // 3. Handle expired/cancelled subscriptions
    // 4. Update local state accordingly
    
    console.log('🔄 License validation - TODO: Implement server check');
    return this.isPro(); // Temporary fallback
  }

  private checkDevMode(): boolean {
    // Use config constant instead of hardcoded value
    const DEV_MODE_ENABLED = APP_CONFIG.LICENSE.DEV_MODE_ENABLED;
    
    if (!DEV_MODE_ENABLED) return false;
    
    // В Figma плагинах проверяем Vite dev режим или явно включаем для разработки
    try {
      return (import.meta as any).env?.DEV || DEV_MODE_ENABLED;
    } catch {
      // Если import.meta недоступен, используем флаг
      return DEV_MODE_ENABLED;
    }
  }

  private async loadSavedState(): Promise<void> {
    if (!this.isDevMode) {
      // TODO: In production, load license state from:
      // 1. Server API call with user authentication
      // 2. Validate with Stripe subscription status
      // 3. Handle offline/network error cases
      return;
    }

    // Dev mode: load from storage adapter
    try {
      const saved = await this.storage.getItem('license-dev');
      if (saved === 'pro' || saved === 'free') {
        this.currentState = saved;
      }
    } catch (error) {
      console.warn('Failed to load dev license state:', error);
    }
  }

  private async saveState(): Promise<void> {
    if (!this.isDevMode) {
      // TODO: In production, save license state to:
      // 1. Server database with user ID
      // 2. Sync across user's devices
      // 3. Handle network failures gracefully
      return;
    }

    // Dev mode: save to storage adapter
    try {
      await this.storage.setItem('license-dev', this.currentState);
    } catch (error) {
      console.warn('Failed to save dev license state:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('License listener error:', error);
      }
    });
  }
}

export const licenseService = new LicenseService(); 