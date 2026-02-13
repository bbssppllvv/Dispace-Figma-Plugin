/**
 * Modal Manager
 * 
 * Handles initialization and interaction for all UI modals:
 * - Paywall modal
 * - Copy Code modal (Pro)
 * - Copy Code modal (Free)
 */

import { setupModal } from '../utils/modal';
import { licenseService } from '../services';
import paywallHTML from '../components/paywall.html?raw';
import copycodeHTML from '../components/copycode.html?raw';
import copycodeFreeHTML from '../components/copycode-free.html?raw';

export interface ModalManagerAPI {
  showCopyCodeModal: () => void;
  showCopyCodeFreeModal: () => void;
  hideCopyCodeModal: () => void;
  hideCopyCodeFreeModal: () => void;
}

/**
 * Manages all modal dialogs
 */
export class ModalManager implements ModalManagerAPI {
  private copyCodeModal: { showModal: () => void; hideModal: () => void; } | undefined;
  private copyCodeFreeModal: { showModal: () => void; hideModal: () => void; } | undefined;

  /**
   * Initialize all modals
   */
  init(): void {
    // Safe HTML modal injection via temporary container
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
      goProButton.addEventListener('click', () => {
        // In dev mode, simulate upgrade success
        if (licenseService.isDevModeEnabled()) {
          console.log('Dev mode: Simulating upgrade success');
          licenseService.devSetLicense('pro');
          const paywallOverlay = document.getElementById('paywall-overlay');
          paywallOverlay?.classList.add('hidden');
          return;
        }

        // Open Polar Checkout in external browser
        licenseService.openCheckout();
      });
    }

    // Activate license key button handler
    const activateKeyButton = document.getElementById('activate-key-button');
    const licenseKeyInput = document.getElementById('license-key-input') as HTMLInputElement | null;
    if (activateKeyButton && licenseKeyInput) {
      activateKeyButton.addEventListener('click', async () => {
        const key = licenseKeyInput.value;
        if (!key.trim()) {
          alert('Please enter a license key.');
          return;
        }

        activateKeyButton.setAttribute('disabled', 'true');
        const originalText = activateKeyButton.textContent;
        activateKeyButton.textContent = 'Activating...';

        try {
          await licenseService.activateLicenseKey(key);
          licenseKeyInput.value = '';

          // Show success state in the right panel
          const rightPanel = document.querySelector('#paywall-overlay .modal-panel-right') as HTMLElement | null;
          if (rightPanel) {
            const originalContent = rightPanel.innerHTML;
            rightPanel.innerHTML = `
              <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;text-align:center;">
                <div style="font-size:36px;line-height:1;">&#10003;</div>
                <div class="text-heading">Pro Activated</div>
                <div class="text-body" style="color:var(--color-text-secondary);">You're all set.</div>
              </div>
            `;
            setTimeout(() => {
              const paywallOverlay = document.getElementById('paywall-overlay');
              paywallOverlay?.classList.add('hidden');
              rightPanel.innerHTML = originalContent;
            }, 1800);
          } else {
            const paywallOverlay = document.getElementById('paywall-overlay');
            paywallOverlay?.classList.add('hidden');
          }
        } catch (error) {
          console.error('Activation failed:', error);
          const message = error instanceof Error ? error.message : 'Invalid key. Check and try again.';
          alert(message);
        } finally {
          activateKeyButton.removeAttribute('disabled');
          activateKeyButton.textContent = originalText;
        }
      });

      // Allow Enter key to activate
      licenseKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          activateKeyButton.click();
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

  showCopyCodeModal(): void {
    this.copyCodeModal?.showModal();
  }

  showCopyCodeFreeModal(): void {
    this.copyCodeFreeModal?.showModal();
  }

  hideCopyCodeModal(): void {
    this.copyCodeModal?.hideModal();
  }

  hideCopyCodeFreeModal(): void {
    this.copyCodeFreeModal?.hideModal();
  }
}



