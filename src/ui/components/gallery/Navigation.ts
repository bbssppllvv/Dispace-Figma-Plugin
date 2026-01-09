export class NavigationController {
  private leftArrow!: HTMLButtonElement;
  private rightArrow!: HTMLButtonElement;
  private isDragging = false;
  private startX = 0;
  private startScrollLeft = 0;
  private isDragClick = false;
  
  constructor(private scrollContainer: HTMLElement, private wrapper: HTMLElement) {}

  init(): void {
    this.createArrows();
    this.setupInteractions();
    
    // Standard scroll/resize observers
    this.scrollContainer.addEventListener('scroll', () => this.updateArrows(), { passive: true });
    const ro = new ResizeObserver(() => this.updateArrows());
    ro.observe(this.scrollContainer);
    setTimeout(() => this.updateArrows(), 50);
  }

  private setupInteractions(): void {
    const container = this.scrollContainer;

    // Drag to scroll (Mouse)
    container.addEventListener('mousedown', (e) => {
      // Ignore right clicks or if we are clicking interactive elements directly (like buttons)
      // though for gallery items we want to allow drag
      if (e.button !== 0) return;
      
      this.isDragging = true;
      this.isDragClick = false;
      this.startX = e.pageX - container.offsetLeft;
      this.startScrollLeft = container.scrollLeft;
      
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - this.startX) * 1.5; // Scroll-fast multiplier
      const newScrollLeft = this.startScrollLeft - walk;
      
      // If we moved significantly, mark as drag operation to prevent click
      if (Math.abs(walk) > 5) {
        this.isDragClick = true;
      }

      container.scrollLeft = newScrollLeft;
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        container.style.cursor = '';
        container.style.removeProperty('user-select');
        
        // Reset drag flag after a short delay to allow click handlers to check it
        // However, capturing click phase is better
        setTimeout(() => {
          this.isDragClick = false;
        }, 50);
      }
    });

    // Capture clicks if we were dragging
    container.addEventListener('click', (e) => {
      if (this.isDragClick) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Wheel support - horizontal scrolling with vertical wheel
    container.addEventListener('wheel', (e) => {
      if (e.deltaY === 0) return;
      // If content is scrollable
      if (container.scrollWidth > container.clientWidth) {
        // Prevent page scroll if we are scrolling this container
        // Only prevent if we aren't at edges or if we are scrolling "inwards"
        const atStart = container.scrollLeft <= 0;
        const atEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth;
        
        const scrollingLeft = e.deltaY < 0;
        const scrollingRight = e.deltaY > 0;

        if ((atStart && scrollingLeft) || (atEnd && scrollingRight)) {
          return; // Let parent scroll handle it
        }

        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  private createArrows() {
    this.wrapper.querySelectorAll('.preset-nav-arrow').forEach(el => el.remove());
    this.leftArrow = document.createElement('button');
    this.leftArrow.className = 'preset-nav-arrow preset-nav-left';
    this.leftArrow.title = 'Scroll left';
    this.leftArrow.setAttribute('aria-label', 'Scroll left');
    const leftSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    leftSvg.setAttribute('width', '16'); leftSvg.setAttribute('height', '16');
    leftSvg.setAttribute('viewBox', '0 0 24 24'); leftSvg.setAttribute('fill', 'none'); leftSvg.setAttribute('stroke', 'currentColor'); leftSvg.setAttribute('stroke-width', '2');
    const lp = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); lp.setAttribute('points', '15,18 9,12 15,6');
    leftSvg.appendChild(lp); this.leftArrow.appendChild(leftSvg);

    this.rightArrow = document.createElement('button');
    this.rightArrow.className = 'preset-nav-arrow preset-nav-right';
    this.rightArrow.title = 'Scroll right';
    this.rightArrow.setAttribute('aria-label', 'Scroll right');
    const rightSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    rightSvg.setAttribute('width', '16'); rightSvg.setAttribute('height', '16');
    rightSvg.setAttribute('viewBox', '0 0 24 24'); rightSvg.setAttribute('fill', 'none'); rightSvg.setAttribute('stroke', 'currentColor'); rightSvg.setAttribute('stroke-width', '2');
    const rp = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); rp.setAttribute('points', '9,18 15,12 9,6');
    rightSvg.appendChild(rp); this.rightArrow.appendChild(rightSvg);

    this.wrapper.appendChild(this.leftArrow);
    this.wrapper.appendChild(this.rightArrow);

    // Improved scroll amount (approx 80% of view width)
    this.leftArrow.addEventListener('click', () => {
      const scrollAmount = this.scrollContainer.clientWidth * 0.8;
      this.scrollContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    this.rightArrow.addEventListener('click', () => {
      const scrollAmount = this.scrollContainer.clientWidth * 0.8;
      this.scrollContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
  }

  private updateArrows() {
    const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer;
    // Use a small epsilon for float comparisons if necessary, though scrollLeft is usually int/float
    const atStart = scrollLeft <= 2; 
    const atEnd = scrollLeft >= scrollWidth - clientWidth - 2;
    
    this.leftArrow.style.opacity = atStart ? '0' : '1';
    this.leftArrow.style.pointerEvents = atStart ? 'none' : 'auto';
    
    this.rightArrow.style.opacity = atEnd ? '0' : '1';
    this.rightArrow.style.pointerEvents = atEnd ? 'none' : 'auto';
  }
}
