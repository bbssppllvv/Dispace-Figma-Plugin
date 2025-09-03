export function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  function activateTab(targetId: string) {
      // Update button states with proper ARIA
      tabButtons.forEach((button) => {
          const b = button as HTMLButtonElement;
          if (b.dataset.target === targetId) {
              // Selected state - use our CSS class and ARIA
              b.classList.add('active');
              b.setAttribute('aria-selected', 'true');
              b.setAttribute('tabindex', '0');
          } else {
              // Unselected state - remove active class and ARIA
              b.classList.remove('active');
              b.setAttribute('aria-selected', 'false');
              b.setAttribute('tabindex', '-1');
          }
      });

      // Update content visibility with proper ARIA
      tabContents.forEach(content => {
          const c = content as HTMLElement;
          if (c.id === targetId) {
              c.classList.remove('hidden');
              c.setAttribute('aria-hidden', 'false');
          } else {
              c.classList.add('hidden');
              c.setAttribute('aria-hidden', 'true');
          }
      });
  }

  // Add click handlers
  tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
          activateTab((button as HTMLButtonElement).dataset.target!);
      });

      // Add keyboard navigation
      button.addEventListener('keydown', (e) => {
          const keyEvent = e as KeyboardEvent;
          let targetIndex = index;

          switch (keyEvent.key) {
              case 'ArrowRight':
              case 'ArrowDown':
                  e.preventDefault();
                  targetIndex = (index + 1) % tabButtons.length;
                  break;
              case 'ArrowLeft':
              case 'ArrowUp':
                  e.preventDefault();
                  targetIndex = (index - 1 + tabButtons.length) % tabButtons.length;
                  break;
              case 'Home':
                  e.preventDefault();
                  targetIndex = 0;
                  break;
              case 'End':
                  e.preventDefault();
                  targetIndex = tabButtons.length - 1;
                  break;
              case 'Enter':
              case ' ':
                  e.preventDefault();
                  activateTab((button as HTMLButtonElement).dataset.target!);
                  return;
              default:
                  return;
          }

          // Focus and activate the target tab
          const targetButton = tabButtons[targetIndex] as HTMLButtonElement;
          targetButton.focus();
          activateTab(targetButton.dataset.target!);
      });
  });

  // Activate the first tab by default (Presets)
  if (tabButtons.length > 0) {
      activateTab((tabButtons[0] as HTMLButtonElement).dataset.target!);
  } 
} 