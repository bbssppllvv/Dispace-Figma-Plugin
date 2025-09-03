/**
 * Reusable Spinner Component Utility
 * 
 * Creates consistent loading indicators across the application.
 * Supports customizable size, colors, and overlay options.
 */

import { createElement } from '../utils/dom';

export interface SpinnerOptions {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  overlay?: boolean;
  className?: string;
}

/**
 * Creates a spinner element with optional text and overlay
 */
export function createSpinner(options: SpinnerOptions = {}): HTMLElement {
  const {
    size = 'medium',
    text = '',
    overlay = false,
    className = ''
  } = options;

  // Size mappings
  const sizeClasses = {
    small: 'h-3 w-3',
    medium: 'h-4 w-4', 
    large: 'h-6 w-6'
  };

  // Container element
  const container = createElement('div', {
    className: `flex items-center justify-center ${overlay ? 'absolute inset-0 bg-black bg-opacity-50 rounded-lg' : ''} ${className}`,
    attributes: { 'data-spinner': 'true' }
  });

  // Spinner element
  const spinner = createElement('div', {
    className: `animate-spin ${sizeClasses[size]} border-2 border-white rounded-full border-t-transparent`
  });

  container.appendChild(spinner);

  // Add text if provided
  if (text) {
    const textElement = createElement('span', {
      className: 'ml-2 text-white text-sm'
    });
    textElement.textContent = text;
    container.appendChild(textElement);
  }

  return container;
}

/**
 * Shows spinner in target element with overlay
 */
export function showSpinner(target: HTMLElement, options: SpinnerOptions = {}): () => void {
  // Remove any existing spinner
  hideSpinner(target);
  
  const spinner = createSpinner({
    ...options,
    overlay: true
  });
  
  target.appendChild(spinner);
  
  // Return cleanup function
  return () => hideSpinner(target);
}

/**
 * Hides spinner in target element
 */
export function hideSpinner(target: HTMLElement): void {
  const existingSpinner = target.querySelector('[data-spinner="true"]');
  if (existingSpinner) {
    existingSpinner.remove();
  }
}

/**
 * Shows spinner with text during async operation
 */
export async function withSpinner<T>(
  target: HTMLElement,
  operation: () => Promise<T>,
  options: SpinnerOptions = {}
): Promise<T> {
  const cleanup = showSpinner(target, options);
  
  try {
    return await operation();
  } finally {
    cleanup();
  }
} 