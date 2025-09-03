import type { AppEvents } from '../types';

// Simple typed event bus
export class EventBus {
  private listeners: Map<keyof AppEvents, Set<Function>> = new Map();

  // Subscribe to event
  on<K extends keyof AppEvents>(
    event: K,
    callback: (data: AppEvents[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  // Unsubscribe from event
  off<K extends keyof AppEvents>(
    event: K,
    callback: (data: AppEvents[K]) => void
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  // Emit event
  emit<K extends keyof AppEvents>(event: K, data: AppEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${String(event)}":`, error);
        }
      });
    }
  }

  // Clear all listeners (for cleanup)
  clear(): void {
    this.listeners.clear();
  }

  // Get listener count (for debugging)
  getListenerCount(event: keyof AppEvents): number {
    return this.listeners.get(event)?.size || 0;
  }
}

// Global event bus instance (singleton pattern)
export const eventBus = new EventBus();

// Helper functions for backward compatibility with existing document events
export function emitDocumentEvent<K extends keyof AppEvents>(
  event: K,
  data: AppEvents[K]
): void {
  // Emit both through our EventBus and legacy document events
  eventBus.emit(event, data);
  
  // Legacy support - keep existing document.dispatchEvent calls working
  document.dispatchEvent(
    new CustomEvent(event, { detail: data })
  );
}

export function listenToDocumentEvent<K extends keyof AppEvents>(
  event: K,
  callback: (data: AppEvents[K]) => void
): () => void {
  // Listen to our EventBus
  const unsubscribe = eventBus.on(event, callback);
  
  // Also listen to legacy document events for backward compatibility
  const legacyHandler = (e: CustomEvent) => callback(e.detail);
  document.addEventListener(event, legacyHandler as EventListener);
  
  return () => {
    unsubscribe();
    document.removeEventListener(event, legacyHandler as EventListener);
  };
} 