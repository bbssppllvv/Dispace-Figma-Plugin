export function setupModal(
  overlayId: string,
  closeButtonId: string,
  openButtonId?: string,
) {
  const overlay = document.getElementById(overlayId);
  const closeButton = document.getElementById(closeButtonId);
  const openButton = openButtonId ? document.getElementById(openButtonId) : null;

  if (!overlay || !closeButton) {
    console.error(`Modal setup failed for ${overlayId}.`);
    return;
  }

  const showModal = () => {
    overlay.classList.remove('hidden');
    document.addEventListener('keydown', handleKeydown);
  };

  const hideModal = () => {
    overlay.classList.add('hidden');
    document.removeEventListener('keydown', handleKeydown);
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideModal();
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === overlay) {
      hideModal();
    }
  };

  if (openButton) {
    openButton.addEventListener('click', showModal);
  }

  closeButton.addEventListener('click', hideModal);
  overlay.addEventListener('click', handleBackdropClick);

  return { showModal, hideModal };
} 