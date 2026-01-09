import { DisplacementEngine } from "../engine";
import { createElement } from "../utils/dom";

/**
 * Interactive drag handle for controlling light position in Reflect effect.
 */
export class LightPositionHandle {
  private handle: HTMLElement;
  private isDragging = false;
  private x = 0.3; // normalized 0..1
  private y = 0.3; // normalized 0..1

  constructor(
    private container: HTMLElement,
    private engine: DisplacementEngine
  ) {
    this.handle = this.createHandle();
    this.container.appendChild(this.handle);
    this.initEvents();
    this.updatePosition();
  }

  private createHandle(): HTMLElement {
    const handle = createElement('div', {
      className: 'light-handle',
      styles: {
        position: 'absolute',
        width: '24px',
        height: '24px',
        background: 'rgba(255, 255, 255, 0.2)',
        border: '2px solid white',
        borderRadius: '50%',
        cursor: 'grab',
        zIndex: '20',
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
        pointerEvents: 'auto',
        display: 'none'
      }
    });

    // Inner dot
    const dot = createElement('div', {
      styles: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '4px',
        height: '4px',
        background: 'white',
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)'
      }
    });
    handle.appendChild(dot);

    return handle;
  }

  private initEvents(): void {
    this.handle.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.handle.setPointerCapture(e.pointerId);
      this.handle.style.cursor = 'grabbing';
      
      // Dispatch drag start for HUD
      document.dispatchEvent(new CustomEvent('slider:drag-start'));
      
      e.stopPropagation();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      this.handleMove(e);
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.handle.style.cursor = 'grab';
      
      // Dispatch drag end for HUD
      document.dispatchEvent(new CustomEvent('slider:drag-end'));
    });

    // Toggle visibility based on active tab
    document.addEventListener('tab:changed', (e: any) => {
      const activeTab = e.detail.target;
      this.handle.style.display = activeTab === 'reflect-controls' ? 'block' : 'none';
    });
  }

  private handleMove(e: PointerEvent): void {
    const rect = this.container.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    this.x = x;
    this.y = y;
    
    this.updatePosition();
    this.engine.setReflectLightPosition(x, y);
    this.engine.triggerUpdate();

    // HUD update
    const event = new CustomEvent('slider:changing', {
      detail: { 
        label: 'Light Position', 
        formatted: `${Math.round(x * 100)}, ${Math.round(y * 100)}` 
      }
    });
    document.dispatchEvent(event);
  }

  private updatePosition(): void {
    this.handle.style.left = `${this.x * 100}%`;
    this.handle.style.top = `${this.y * 100}%`;
  }

  /**
   * Update the internal state and visuals from external changes (e.g. presets)
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.updatePosition();
  }
}

