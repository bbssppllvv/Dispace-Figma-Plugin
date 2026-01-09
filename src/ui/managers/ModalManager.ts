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



