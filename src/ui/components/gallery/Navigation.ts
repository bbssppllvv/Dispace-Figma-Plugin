export class NavigationController {
  constructor(private scrollContainer: HTMLElement, private wrapper: HTMLElement) {}

  private leftArrow!: HTMLButtonElement;
  private rightArrow!: HTMLButtonElement;

  init(): void {
    this.createArrows();
    this.scrollContainer.addEventListener('scroll', () => this.updateArrows());
    const ro = new ResizeObserver(() => this.updateArrows());
    ro.observe(this.scrollContainer);
    setTimeout(() => this.updateArrows(), 50);
  }

  private createArrows() {
    this.wrapper.querySelectorAll('.preset-nav-arrow').forEach(el => el.remove());
    this.leftArrow = document.createElement('button');
    this.leftArrow.className = 'preset-nav-arrow preset-nav-left';
    this.leftArrow.title = 'Scroll left';
    const leftSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    leftSvg.setAttribute('width', '16'); leftSvg.setAttribute('height', '16');
    leftSvg.setAttribute('viewBox', '0 0 24 24'); leftSvg.setAttribute('fill', 'none'); leftSvg.setAttribute('stroke', 'currentColor'); leftSvg.setAttribute('stroke-width', '2');
    const lp = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); lp.setAttribute('points', '15,18 9,12 15,6');
    leftSvg.appendChild(lp); this.leftArrow.appendChild(leftSvg);

    this.rightArrow = document.createElement('button');
    this.rightArrow.className = 'preset-nav-arrow preset-nav-right';
    this.rightArrow.title = 'Scroll right';
    const rightSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    rightSvg.setAttribute('width', '16'); rightSvg.setAttribute('height', '16');
    rightSvg.setAttribute('viewBox', '0 0 24 24'); rightSvg.setAttribute('fill', 'none'); rightSvg.setAttribute('stroke', 'currentColor'); rightSvg.setAttribute('stroke-width', '2');
    const rp = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); rp.setAttribute('points', '9,18 15,12 9,6');
    rightSvg.appendChild(rp); this.rightArrow.appendChild(rightSvg);

    this.wrapper.appendChild(this.leftArrow);
    this.wrapper.appendChild(this.rightArrow);

    this.leftArrow.addEventListener('click', () => this.scrollContainer.scrollBy({ left: -200, behavior: 'smooth' }));
    this.rightArrow.addEventListener('click', () => this.scrollContainer.scrollBy({ left: 200, behavior: 'smooth' }));
  }

  private updateArrows() {
    const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer;
    const atStart = scrollLeft <= 1;
    const atEnd = scrollLeft >= scrollWidth - clientWidth - 1;
    this.leftArrow.style.opacity = atStart ? '0' : '';
    this.leftArrow.style.pointerEvents = atStart ? 'none' : 'auto';
    this.rightArrow.style.opacity = atEnd ? '0' : '';
    this.rightArrow.style.pointerEvents = atEnd ? 'none' : 'auto';
  }
}


