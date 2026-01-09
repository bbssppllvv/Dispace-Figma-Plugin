import { APP_CONFIG } from '../config/constants';

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number = APP_CONFIG.SLIDER_DEBOUNCE_DELAY
): (...args: Parameters<T>) => void {
  let timer: number | undefined;

  return (...args: Parameters<T>) => {
    // Clear the previous timer (if any) and schedule a new one
    if (timer) {
      window.clearTimeout(timer);
    }
    
    timer = window.setTimeout(() => {
      fn(...args);
    }, delay);
  };
} 