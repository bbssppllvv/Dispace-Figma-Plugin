/**
 * Application State Store
 * 
 * Centralized state management for the application.
 * Manages UI state, selection state, and application flags.
 */

import type { Preset } from '../presets/types';
import type { MapSource } from '../engine/types';

export interface AppState {
  // Image selection state
  hasSelectedImage: boolean;
  imageVersion: number; // Increments when image changes to trigger gallery updates
  selectedPreset: Preset | null;
  activeMapSource: MapSource | null; // Current displacement map being used
  
  // UI state
  isApplying: boolean;
  applyMode: 'modify' | 'copy';
  
  // Batch/shuffle state
  isShuffling: boolean;
  
  // Preset effect state
  isPresetEffectActive: boolean;
}

/**
 * Application state store
 */
export class AppStore {
  private state: AppState = {
    hasSelectedImage: false,
    imageVersion: 0,
    selectedPreset: null,
    activeMapSource: null,
    isApplying: false,
    applyMode: 'modify',
    isShuffling: false,
    isPresetEffectActive: false,
  };

  private listeners: Set<() => void> = new Set();

  /**
   * Subscribe to state changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get current state
   */
  getState(): Readonly<AppState> {
    return { ...this.state };
  }

  /**
   * Update state
   */
  setState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  // Convenience getters
  get hasSelectedImage(): boolean {
    return this.state.hasSelectedImage;
  }

  get imageVersion(): number {
    return this.state.imageVersion;
  }

  get selectedPreset(): Preset | null {
    return this.state.selectedPreset;
  }

  get activeMapSource(): MapSource | null {
    return this.state.activeMapSource;
  }

  get isApplying(): boolean {
    return this.state.isApplying;
  }

  get applyMode(): 'modify' | 'copy' {
    return this.state.applyMode;
  }

  get isShuffling(): boolean {
    return this.state.isShuffling;
  }

  get isPresetEffectActive(): boolean {
    return this.state.isPresetEffectActive;
  }

  // Convenience setters
  setHasSelectedImage(value: boolean): void {
    this.setState({ hasSelectedImage: value });
  }

  /**
   * Notify that a new image has been loaded.
   * Increments imageVersion to trigger gallery thumbnail updates.
   */
  notifyImageLoaded(): void {
    this.setState({ 
      hasSelectedImage: true,
      imageVersion: this.state.imageVersion + 1 
    });
  }

  /**
   * Notify that the image selection has been cleared.
   * Increments imageVersion to ensure UI updates.
   */
  notifyImageCleared(): void {
    this.setState({ 
      hasSelectedImage: false,
      // Bump version even on clear to ensure UI updates
      imageVersion: this.state.imageVersion + 1 
    });
  }

  setSelectedPreset(preset: Preset | null): void {
    this.setState({ selectedPreset: preset });
  }

  setActiveMapSource(map: MapSource | null): void {
    this.setState({ activeMapSource: map });
  }

  /**
   * Set both preset and map atomically to ensure they stay in sync.
   * This prevents race conditions where preset changes but map doesn't.
   */
  setPresetAndMap(preset: Preset | null, map: MapSource | null): void {
    this.setState({ 
      selectedPreset: preset,
      activeMapSource: map 
    });
  }

  setIsApplying(value: boolean): void {
    this.setState({ isApplying: value });
  }

  setApplyMode(mode: 'modify' | 'copy'): void {
    this.setState({ applyMode: mode });
  }

  setIsShuffling(value: boolean): void {
    this.setState({ isShuffling: value });
  }

  setIsPresetEffectActive(value: boolean): void {
    this.setState({ isPresetEffectActive: value });
  }
}

// Singleton instance
export const appStore = new AppStore();

