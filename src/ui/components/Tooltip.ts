export interface TooltipConfig {
  content: string;
  image?: string;
  delay?: number;
}

/**
 * Creates a tooltip component that shows on hover
 */
export class Tooltip {
  private element: HTMLElement;
  private tooltipElement: HTMLElement | null = null;
  private config: TooltipConfig;
  private showTimeout: number | null = null;
  private hideTimeout: number | null = null;

  constructor(element: HTMLElement, config: TooltipConfig) {
    this.element = element;
    this.config = { delay: 300, ...config };
    this.init();
  }

  private init() {
    // Add event listeners
    this.element.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.element.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.element.addEventListener('focus', this.handleFocus.bind(this));
    this.element.addEventListener('blur', this.handleBlur.bind(this));
  }

  private handleMouseEnter() {
    this.clearTimeouts();
    this.showTimeout = window.setTimeout(() => {
      this.show();
    }, this.config.delay);
  }

  private handleMouseLeave() {
    this.clearTimeouts();
    this.hideTimeout = window.setTimeout(() => {
      this.hide();
    }, 100);
  }

  private handleFocus() {
    this.clearTimeouts();
    this.show();
  }

  private handleBlur() {
    this.clearTimeouts();
    this.hide();
  }

  private clearTimeouts() {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private show() {
    if (this.tooltipElement) return;

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'tooltip';
    this.tooltipElement.setAttribute('role', 'tooltip');

    // Add image if present
    if (this.config.image) {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'tooltip-image-container';
      const img = document.createElement('img');
      img.src = this.config.image;
      img.className = 'tooltip-image';
      img.alt = 'Effect preview';
      
      // Ensure we reposition once the image loads and affects layout
      img.onload = () => {
        if (this.tooltipElement) {
            this.positionTooltip();
        }
      };
      
      imgContainer.appendChild(img);
      this.tooltipElement.appendChild(imgContainer);
    }

    const text = document.createElement('div');
    text.className = 'tooltip-content';
    text.textContent = this.config.content;
    this.tooltipElement.appendChild(text);

    document.body.appendChild(this.tooltipElement);
    
    // Initial position attempt
    this.positionTooltip();

    // Defer visibility to ensure layout is calculated correctly
    requestAnimationFrame(() => {
      if (this.tooltipElement) {
        // Re-calculate position after browser has had a chance to perform layout
        this.positionTooltip();
        
        // Force reflow for animation
        this.tooltipElement.offsetHeight;
        this.tooltipElement.classList.add('tooltip-visible');
      }
    });
  }

  private hide() {
    if (!this.tooltipElement) return;

    this.tooltipElement.classList.remove('tooltip-visible');
    
    setTimeout(() => {
      if (this.tooltipElement) {
        document.body.removeChild(this.tooltipElement);
        this.tooltipElement = null;
      }
    }, 150);
  }

  private positionTooltip() {
    if (!this.tooltipElement) return;

    const elementRect = this.element.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    
    // Position above the element by default
    let top = elementRect.top - tooltipRect.height - 8;
    let left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
    
    // Check if tooltip would go off screen and adjust
    if (top < 8) {
      // Position below if not enough space above
      top = elementRect.bottom + 8;
      this.tooltipElement.classList.add('tooltip-below');
    }
    
    if (left < 8) {
      left = 8;
    } else if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    this.tooltipElement.style.top = `${top}px`;
    this.tooltipElement.style.left = `${left}px`;
  }

  public updateContent(content: string, image?: string) {
    this.config.content = content;
    if (image !== undefined) {
      this.config.image = image;
    }
    
    if (this.tooltipElement) {
      const textEl = this.tooltipElement.querySelector('.tooltip-content');
      if (textEl) textEl.textContent = content;
      
      // Handle image update if needed - simpler to recreate if structure changes
      // but for now assuming structure is stable if image existed
      if (this.config.image) {
        let img = this.tooltipElement.querySelector('img');
        if (img) {
          img.src = this.config.image;
        } else {
          // Re-render if image was added
          this.hide();
          this.show();
        }
      }
      
      this.positionTooltip();
    }
  }

  public destroy() {
    this.clearTimeouts();
    this.hide();
    this.element.removeEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.element.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.element.removeEventListener('focus', this.handleFocus.bind(this));
    this.element.removeEventListener('blur', this.handleBlur.bind(this));
  }
}

/**
 * Helper function to create a tooltip for an element
 */
export function createTooltip(element: HTMLElement, config: TooltipConfig): Tooltip {
  return new Tooltip(element, config);
} 