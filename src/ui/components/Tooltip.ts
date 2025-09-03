export interface TooltipConfig {
  content: string;
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
    this.tooltipElement.textContent = this.config.content;
    this.tooltipElement.setAttribute('role', 'tooltip');

    document.body.appendChild(this.tooltipElement);
    this.positionTooltip();

    // Force reflow for animation
    this.tooltipElement.offsetHeight;
    this.tooltipElement.classList.add('tooltip-visible');
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

  public updateContent(content: string) {
    this.config.content = content;
    if (this.tooltipElement) {
      this.tooltipElement.textContent = content;
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