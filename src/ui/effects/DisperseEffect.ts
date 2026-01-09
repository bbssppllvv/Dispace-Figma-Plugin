/**
 * Disperse Text Effect
 * 
 * Handles the "Disperse" SVG filter animation for preset names.
 */
export class DisperseEffect {
  private overlay: HTMLElement;
  private activeSvg: SVGSVGElement | null = null;
  private rafId: number | null = null;
  private dwellTimeoutId: number | null = null;

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;
  }

  /**
   * Play the disperse animation for the given text
   */
  play(text: string, onComplete?: () => void): void {
    // Cancel any existing effect first
    this.cancel();

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 400 400');
    
    const style = svg.style;
    style.position = 'absolute';
    style.left = '0';
    style.top = '0';
    style.right = '0';
    style.bottom = '0';
    style.pointerEvents = 'none';

    const defs = document.createElementNS(SVG_NS, 'defs');
    const filter = document.createElementNS(SVG_NS, 'filter');
    const filterId = `hudDisperse_${Date.now()}`;
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');

    // Two independent turbulence nodes with random seeds: coarse + fine
    const seed1 = String(Math.floor(Math.random() * 1000) + 1);
    const seed2 = String(Math.floor(Math.random() * 1000) + 1);

    const coarse = document.createElementNS(SVG_NS, 'feTurbulence');
    coarse.setAttribute('type', 'fractalNoise');
    coarse.setAttribute('baseFrequency', '0.06'); // large blobs
    coarse.setAttribute('numOctaves', '4');
    coarse.setAttribute('seed', seed1);
    coarse.setAttribute('result', 'coarse');

    const fine = document.createElementNS(SVG_NS, 'feTurbulence');
    fine.setAttribute('type', 'fractalNoise');
    fine.setAttribute('baseFrequency', '0.9'); // fine grit
    fine.setAttribute('numOctaves', '4');
    fine.setAttribute('seed', seed2);
    fine.setAttribute('result', 'fine');

    const blend = document.createElementNS(SVG_NS, 'feBlend');
    blend.setAttribute('in', 'coarse');
    blend.setAttribute('in2', 'fine');
    blend.setAttribute('mode', 'multiply');
    blend.setAttribute('result', 'noise');

    const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'noise');
    disp.setAttribute('scale', '0');
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');

    filter.appendChild(coarse);
    filter.appendChild(fine);
    filter.appendChild(blend);
    filter.appendChild(disp);
    defs.appendChild(filter);
    svg.appendChild(defs);

    const textEl = document.createElementNS(SVG_NS, 'text');
    textEl.setAttribute('x', '200');
    textEl.setAttribute('y', '200');
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'middle');
    textEl.setAttribute('fill', 'var(--color-hud-text)');
    textEl.setAttribute('filter', `url(#${filterId})`);
    
    // Use UI font; inline style to allow CSS variables
    textEl.style.setProperty('font-family', 'var(--font-family)');
    textEl.setAttribute('font-size', '18');
    textEl.textContent = text;

    svg.appendChild(textEl);
    this.overlay.appendChild(svg);
    this.activeSvg = svg;

    // Animation parameters
    const dwellMs = 1000;
    const durationMs = 600; // faster dissolve
    const maxScale = 220;

    // Ensure initial visible state
    disp.setAttribute('scale', '0');
    textEl.style.opacity = '1';

    // Ease-in then strong ease-out for maximal slow-down at the end
    const easeInOutStrongEnd = (t: number) => {
      if (t < 0.5) {
        const x = t * 2; // 0..1
        // Accelerate: easeInQuad
        return 0.5 * (x * x);
      } else {
        const x = (t - 0.5) * 2; // 0..1
        // Strong deceleration: easeOutQuint
        const out = 1 - Math.pow(1 - x, 5);
        return 0.5 + 0.5 * out;
      }
    };

    const startAnimation = () => {
      const start = performance.now();
      const tick = () => {
        const now = performance.now();
        let t = (now - start) / durationMs;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        
        const eased = easeInOutStrongEnd(t);
        const scale = (eased * maxScale).toFixed(1);
        disp.setAttribute('scale', scale);
        
        // Fade aligned with easing (slower at end)
        textEl.style.opacity = String(1 - eased);

        if (t < 1) {
          this.rafId = requestAnimationFrame(tick);
        } else {
          // Cleanup
          this.cleanupSvg();
          this.rafId = null;
          
          if (onComplete) {
            onComplete();
          }
        }
      };
      this.rafId = requestAnimationFrame(tick);
    };

    // Delay before starting disperse
    this.dwellTimeoutId = window.setTimeout(startAnimation, dwellMs);
  }

  /**
   * Cancel any active effect
   */
  cancel(): void {
    if (this.dwellTimeoutId) {
      clearTimeout(this.dwellTimeoutId);
      this.dwellTimeoutId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.cleanupSvg();
  }

  /**
   * Check if effect is currently active
   */
  isActive(): boolean {
    return this.activeSvg !== null;
  }

  private cleanupSvg(): void {
    if (this.activeSvg && this.activeSvg.parentNode) {
      this.activeSvg.parentNode.removeChild(this.activeSvg);
    }
    this.activeSvg = null;
  }
}

