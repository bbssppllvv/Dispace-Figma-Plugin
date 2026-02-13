/**
 * License Service
 *
 * Manages Free/Pro license state with Polar.sh License Keys.
 * Uses Polar's public API for activation/validation (no auth token needed).
 * License key + activation ID are stored in figma.clientStorage via code.ts bridge.
 *
 * Features:
 * - Polar License Key activation/validation
 * - Polar Checkout Link for purchases
 * - Dev mode for testing without server
 * - Automatic license validation on plugin open
 */

import { APP_CONFIG } from '../config/constants';
import { createStorageAdapter, type StorageAdapter } from './StorageAdapter';
import { figmaService } from './FigmaService';

const POLAR_API_BASE = 'https://api.polar.sh/v1/customer-portal/license-keys';

type LicenseState = 'free' | 'pro';
type LicenseChangeListener = (state: LicenseState) => void;

export class LicenseService {
  private currentState: LicenseState = 'free';
  private listeners: Set<LicenseChangeListener> = new Set();
  private isDevMode: boolean = false;
  private storage: StorageAdapter;
  private figmaUserId: string | null = null;
  private isValidating: boolean = false;
  private licenseKey: string | null = null;
  private activationId: string | null = null;

  constructor() {
    this.storage = createStorageAdapter();
    this.isDevMode = this.checkDevMode();
    this.loadSavedState();

    console.log(`LicenseService initialized - Dev mode: ${this.isDevMode}, State: ${this.currentState}`);
  }

  /**
   * Set Figma User ID (called when USER_CONTEXT message is received)
   */
  setUserId(userId: string | null): void {
    this.figmaUserId = userId;
    console.log(`LicenseService: User ID set to ${userId ? `${userId.substring(0, 8)}...` : 'null'}`);
  }

  /**
   * Get current Figma User ID
   */
  getUserId(): string | null {
    return this.figmaUserId;
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

  /**
   * Open Polar Checkout in external browser
   */
  openCheckout(): void {
    console.log('Opening Polar Checkout...');

    if (this.isDevMode) {
      console.log('Dev mode: Simulating checkout open');
      return;
    }

    const checkoutUrl = APP_CONFIG.LICENSE.POLAR_CHECKOUT_LINK_URL;
    figmaService.sendMessage('OPEN_EXTERNAL', { url: checkoutUrl });
  }

  /**
   * Activate a license key via Polar public API
   */
  async activateLicenseKey(key: string): Promise<void> {
    console.log('Activating license key...');

    if (this.isDevMode) {
      console.log('Dev mode: Simulating license activation');
      this.currentState = 'pro';
      this.saveState();
      this.notifyListeners();
      return;
    }

    const trimmedKey = key.trim();
    if (!trimmedKey) {
      throw new Error('Please enter a license key.');
    }

    const organizationId = APP_CONFIG.LICENSE.POLAR_ORGANIZATION_ID;
    const label = this.figmaUserId || 'figma-user';

    const response = await fetch(`${POLAR_API_BASE}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: trimmedKey,
        organization_id: organizationId,
        label,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // Polar returns detail as string or array of validation errors
      let message: string;
      if (typeof error.detail === 'string') {
        message = error.detail;
      } else if (Array.isArray(error.detail)) {
        message = error.detail.map((e: any) => e.msg || e.message).join('; ') || `Activation failed (${response.status})`;
      } else {
        message = error.error || `Activation failed (${response.status})`;
      }
      throw new Error(message);
    }

    const data = await response.json();
    const newActivationId = data.id;

    if (!newActivationId) {
      throw new Error('No activation ID received from Polar');
    }

    // Store key + activation ID in figma.clientStorage via code.ts
    this.licenseKey = trimmedKey;
    this.activationId = newActivationId;
    figmaService.sendMessage('STORE_LICENSE_KEY', {
      key: trimmedKey,
      activationId: newActivationId,
    });

    // Update state to Pro
    this.currentState = 'pro';
    this.saveState();
    this.notifyListeners();
    console.log('License activated successfully!');
  }

  /**
   * Validate stored license key via Polar public API
   */
  async validateStoredKey(): Promise<boolean> {
    if (this.isValidating) {
      console.log('License validation already in progress');
      return this.isPro();
    }

    if (this.isDevMode) {
      console.log('Dev mode: Skipping server validation');
      return this.isPro();
    }

    if (!this.licenseKey || !this.activationId) {
      console.log('No stored license key to validate');
      return false;
    }

    this.isValidating = true;
    console.log('Validating license with Polar...');

    try {
      const organizationId = APP_CONFIG.LICENSE.POLAR_ORGANIZATION_ID;

      const response = await fetch(`${POLAR_API_BASE}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: this.licenseKey,
          organization_id: organizationId,
          activation_id: this.activationId,
        }),
      });

      if (!response.ok) {
        console.error('Validation request failed:', response.status);
        return this.isPro();
      }

      const data = await response.json();
      const isValid = data.valid === true;

      console.log(`Polar validation result: ${isValid}`);

      if (isValid && this.currentState !== 'pro') {
        this.currentState = 'pro';
        this.saveState();
        this.notifyListeners();
        console.log('License validated — Pro!');
      } else if (!isValid) {
        // Clear invalid key from storage regardless of current state
        figmaService.sendMessage('CLEAR_LICENSE_KEY', {});
        this.licenseKey = null;
        this.activationId = null;
        if (this.currentState === 'pro') {
          this.currentState = 'free';
          this.saveState();
          this.notifyListeners();
        }
        console.log('License invalid — key cleared');
      }

      return isValid;
    } catch (error) {
      console.error('License validation failed:', error);
      // On network error, keep current state
      return this.isPro();
    } finally {
      this.isValidating = false;
    }
  }

  /**
   * Called from FigmaMessageHandler when stored license key is loaded from clientStorage
   */
  onLicenseKeyLoaded(key: string | null, activationId: string | null): void {
    console.log(`License key loaded: ${key ? 'present' : 'none'}`);
    this.licenseKey = key;
    this.activationId = activationId;

    if (key && activationId) {
      // Validate the stored key
      this.validateStoredKey().catch(err => {
        console.error('Auto-validation after load failed:', err);
      });
    }
  }

  /**
   * Deactivate license and clear stored key
   */
  async deactivateLicense(): Promise<void> {
    console.log('Deactivating license...');

    if (this.isDevMode) {
      console.log('Dev mode: Simulating deactivation');
      this.currentState = 'free';
      this.saveState();
      this.notifyListeners();
      return;
    }

    if (this.licenseKey && this.activationId) {
      try {
        const organizationId = APP_CONFIG.LICENSE.POLAR_ORGANIZATION_ID;
        await fetch(`${POLAR_API_BASE}/deactivate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: this.licenseKey,
            organization_id: organizationId,
            activation_id: this.activationId,
          }),
        });
      } catch (error) {
        console.error('Deactivation API call failed:', error);
      }
    }

    // Clear storage
    figmaService.sendMessage('CLEAR_LICENSE_KEY', {});
    this.licenseKey = null;
    this.activationId = null;
    this.currentState = 'free';
    this.saveState();
    this.notifyListeners();
    console.log('License deactivated');
  }

  private checkDevMode(): boolean {
    // Use config constant instead of hardcoded value
    const DEV_MODE_ENABLED = APP_CONFIG.LICENSE.DEV_MODE_ENABLED;

    if (!DEV_MODE_ENABLED) return false;

    // In Figma plugins check Vite dev mode or explicitly enable for development
    try {
      return (import.meta as any).env?.DEV || DEV_MODE_ENABLED;
    } catch {
      // If import.meta is unavailable, use flag
      return DEV_MODE_ENABLED;
    }
  }

  private async loadSavedState(): Promise<void> {
    if (!this.isDevMode) {
      // In production, license state comes from Polar validation
      // We start as free and will validate when license key is loaded from clientStorage
      return;
    }

    // Dev mode: load from storage adapter (may fail silently in Figma sandbox)
    try {
      const saved = await this.storage.getItem('license-dev');
      if (saved === 'pro' || saved === 'free') {
        this.currentState = saved;
      }
    } catch (error) {
      // Silently ignore storage errors - they're expected in Figma sandbox
    }
  }

  private async saveState(): Promise<void> {
    if (!this.isDevMode) {
      // In production, license state is determined by Polar validation
      return;
    }

    // Dev mode: save to storage adapter (may fail silently in Figma sandbox)
    try {
      await this.storage.setItem('license-dev', this.currentState);
    } catch (error) {
      // Silently ignore storage errors - they're expected in Figma sandbox
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
