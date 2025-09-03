/**
 * Secure DOM Manipulation Utilities
 * 
 * A collection of security-hardened DOM utilities that prevent XSS vulnerabilities and
 * provide safe alternatives to dangerous native DOM methods. This module is critical for
 * maintaining the plugin's security posture in the browser environment.
 * 
 * Security features:
 * - XSS-safe element creation without innerHTML
 * - Automatic HTML escaping for user-generated content  
 * - Safe DOM querying with meaningful error messages
 * - CSP-compatible DOM operations
 * - Memory-efficient batch DOM updates
 * 
 * All utilities in this module should be used instead of direct DOM manipulation
 * throughout the codebase to maintain security guarantees.
 * 
 * @module DOMUtils
 */

import { licenseService } from '../services';

/**
 * Safely create element with text content
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: {
    className?: string;
    textContent?: string;
    attributes?: Record<string, string>;
    styles?: Partial<CSSStyleDeclaration>;
  } = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  
  if (options.className) {
    element.className = options.className;
  }
  
  if (options.textContent) {
    element.textContent = options.textContent;
  }
  
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  if (options.styles) {
    Object.assign(element.style, options.styles);
  }
  
  return element;
}

/**
 * Safely append multiple children to parent
 */
export function appendChildren(
  parent: Element, 
  children: (Element | string)[]
): void {
  children.forEach(child => {
    if (typeof child === 'string') {
      parent.appendChild(document.createTextNode(child));
    } else {
      parent.appendChild(child);
    }
  });
}

/**
 * Replace element content safely
 */
export function replaceContent(
  element: Element,
  newContent: Element | Element[] | string
): void {
  // Clear existing content
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  
  // Add new content
  if (typeof newContent === 'string') {
    element.textContent = newContent;
  } else if (Array.isArray(newContent)) {
    newContent.forEach(child => element.appendChild(child));
  } else {
    element.appendChild(newContent);
  }
}

/**
 * Find element with error handling
 */
export function safeQuerySelector<T extends Element = Element>(
  selector: string,
  context: Document | Element = document
): T | null {
  try {
    return context.querySelector<T>(selector);
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return null;
  }
}

/**
 * Find element or throw helpful error
 */
export function requireElement<T extends Element = Element>(
  selector: string,
  context: Document | Element = document,
  errorMessage?: string
): T {
  const element = safeQuerySelector<T>(selector, context);
  if (!element) {
    throw new Error(
      errorMessage || `Required element not found: ${selector}`
    );
  }
  return element;
}

/**
 * Safe event listener with cleanup
 */
export function addEventListenerWithCleanup<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  element.addEventListener(type, listener, options);
  return () => element.removeEventListener(type, listener, options);
}

/**
 * Batch DOM updates for performance
 */
export function batchDOMUpdates(updates: () => void): void {
  // Use requestAnimationFrame for smooth updates
  requestAnimationFrame(() => {
    updates();
  });
}

/**
 * Safe HTML escaping (for when you really need to set HTML)
 */
export function escapeHTML(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Create preset item safely (replaces innerHTML usage in PresetGallery)
 */
export function createPresetItem(
  preset: { name: string; premium?: boolean },
  isCustom: boolean = false
): HTMLElement {
  const item = createElement('div', {
    className: `preset-item${isCustom ? ' custom-preset' : ''}`,
    attributes: { 'data-preset-name': preset.name }
  });

  // Skeleton placeholder (never show displacement map image by default)
  const skeleton = createElement('div', {
    className: 'thumb-skeleton w-full h-full',
    styles: {
      background: 'linear-gradient(90deg, rgba(230,230,230,0.6) 25%, rgba(245,245,245,0.9) 37%, rgba(230,230,230,0.6) 63%)',
      backgroundSize: '400% 100%',
      animation: 'thumbShimmer 1.2s ease-in-out infinite'
    }
  });

  // Create overlay
  const overlay = createElement('div', {
    className: 'absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all'
  });

  // Create selection ring
  const selectionRing = createElement('div', {
    className: 'selection-ring absolute inset-0 ring-2 ring-inset ring-transparent'
  });

  // Add children
  appendChildren(item, [skeleton, overlay, selectionRing]);

  // Add pro badge if needed (show badge when user doesn't have Pro access)
  if (!isCustom && preset.premium && !licenseService.isPro()) {
    const proBadge = createElement('div', {
      className: 'preset-pro-badge',
      textContent: 'PRO'
    });
    item.appendChild(proBadge);
  }

  return item;
} 