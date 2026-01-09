import { create } from 'zustand'
import type { Preset, Asset, Category, AssetFilters, SampleImage, TooltipData } from '@/lib/types'
import { 
  fetchPresets, 
  fetchAssets, 
  savePresets as apiSavePresets, 
  uploadAsset, 
  deleteAsset,
  validatePresetResources,
  formatValidationErrors,
  extractResourceId,
  uploadSampleImage as apiUploadSampleImage,
  deleteSampleImage as apiDeleteSampleImage,
  uploadTooltipImage as apiUploadTooltipImage,
  deleteTooltipImage as apiDeleteTooltipImage,
  type ValidationResult
} from '@/lib/api'

interface StudioState {
  // Data
  presets: Preset[]
  assets: Asset[]
  categories: Category[]
  sampleImages: SampleImage[]
  tooltips: TooltipData[]
  
  // UI state
  currentPreset: Preset | null
  isLoading: boolean
  isSaving: boolean
  hasUnsavedChanges: boolean
  assetModalOpen: boolean
  categoryModalOpen: boolean
  currentLayerIndex: number | null
  
  // Preview settings (experimental)
  previewColorSpace: 'sRGB' | 'linearRGB'
  previewUseSvgFilter: boolean
  
  // Asset filters
  assetFilters: AssetFilters
  
  // Validation
  validationResult: ValidationResult | null
  
  // Status
  error: string | null
  
  // Actions
  loadPresets: () => Promise<void>
  loadAssets: () => Promise<void>
  selectPreset: (id: string) => void
  createPreset: () => void
  updatePreset: (updates: Partial<Preset>) => void
  duplicatePreset: (id: string) => void
  deletePreset: (id: string) => void
  savePresets: () => Promise<boolean>
  
  // Layer actions
  addLayer: () => void
  removeLayer: (index: number) => void
  updateLayer: (index: number, prop: string, value: unknown) => void
  
  // Category actions
  addCategory: (name: string) => void
  updateCategory: (id: string, updates: Partial<Category>) => void
  deleteCategory: (id: string) => void
  reorderCategory: (id: string, newOrder: number) => void
  openCategoryModal: () => void
  closeCategoryModal: () => void
  
  // Asset modal
  openAssetModal: (layerIndex: number) => void
  closeAssetModal: () => void
  selectAsset: (assetId: string) => void
  setAssetFilters: (filters: Partial<AssetFilters>) => void
  uploadNewAsset: (file: File, name: string) => Promise<void>
  removeAsset: (filename: string) => Promise<void>

  // Sample Images actions
  addSampleImage: (asset: Asset) => void
  updateSampleImage: (id: string, updates: Partial<SampleImage>) => void
  deleteSampleImage: (id: string) => void
  reorderSampleImages: (newSamples: SampleImage[]) => void
  uploadNewSample: (file: File, name: string) => Promise<void>
  removeSampleAsset: (filename: string) => Promise<void>
  
  // Tooltip actions
  updateTooltip: (id: string, updates: Partial<TooltipData>) => void
  uploadTooltipImage: (file: File, id: string) => Promise<void>
  deleteTooltipImage: (id: string) => Promise<void>
  
  // Utils
  clearError: () => void
  setUnsavedChanges: (value: boolean) => void
  
  // Preview settings
  setPreviewColorSpace: (space: 'sRGB' | 'linearRGB') => void
  setPreviewUseSvgFilter: (use: boolean) => void
  
  // Validation
  validateResources: () => ValidationResult
  isResourceMissing: (src: string) => boolean
  clearValidation: () => void
}

function generateUniqueId(base: string, existingIds: Set<string>): string {
  let id = base.toLowerCase().replace(/[^a-z0-9-_]/g, '-')
  let counter = 1
  let candidate = id
  
  while (existingIds.has(candidate)) {
    candidate = `${id}-${counter}`
    counter++
  }
  
  return candidate
}

export const useStore = create<StudioState>((set, get) => ({
   // Initial state
  presets: [],
  assets: [],
  categories: [],
  sampleImages: [],
  tooltips: [],
  currentPreset: null,
  isLoading: false,
  isSaving: false,
  hasUnsavedChanges: false,
  assetModalOpen: false,
  categoryModalOpen: false,
  currentLayerIndex: null,
  
  // Preview settings (experimental)
  previewColorSpace: 'sRGB',
  previewUseSvgFilter: false,
  
  assetFilters: {
    search: '',
    type: '',
    sortField: 'name',
    sortDirection: 'asc',
  },
  validationResult: null,
  error: null,
  
  // Load presets from API
  loadPresets: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await fetchPresets()
      // Ensure categories have order
      const categories = (data.categories || []).map((cat: Category, i: number) => ({
        ...cat,
        order: cat.order ?? i * 10
      }))
      // Normalize presets: ensure categories[] array exists and syncs with category
      // Also sync popular flag with categories array
      const presets = (data.presets || []).map((p: Preset) => {
        const cats = p.categories?.length ? p.categories : (p.category ? [p.category] : [])
        const isPopular = p.popular || cats.includes('popular')
        return {
          ...p,
          categories: cats,
          category: p.category || (cats.find(c => c !== 'popular') ?? 'custom'),
          popular: isPopular
        }
      })
      set({ 
        presets, 
        categories,
        sampleImages: data.sampleImages || [],
        tooltips: data.tooltips || [],
        isLoading: false 
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  // Load assets from API
  loadAssets: async () => {
    try {
      const assets = await fetchAssets()
      set({ assets })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
  
  // Select a preset for editing
  selectPreset: (id: string) => {
    const { presets } = get()
    const preset = presets.find(p => p.id === id)
    if (preset) {
      set({ currentPreset: { ...preset }, hasUnsavedChanges: false })
    }
  },
  
  // Create a new preset
  createPreset: () => {
    const { presets, categories } = get()
    const existingIds = new Set(presets.map(p => p.id))
    const id = generateUniqueId('new-preset', existingIds)
    
    // Use first category or 'Custom'
    const defaultCategory = categories.length > 0 ? categories[0].id : 'custom'
    
    const newPreset: Preset = {
      id,
      name: 'New Preset',
      category: defaultCategory,
      categories: [defaultCategory],
      popular: false,
      defaultScale: 100,
      textureScale: 1,
      defaultStrength: 150,
      layers: [],
    }
    
    set({ 
      presets: [...presets, newPreset], 
      currentPreset: { ...newPreset },
      hasUnsavedChanges: true,
    })
  },
  
  // Update current preset
  updatePreset: (updates: Partial<Preset>) => {
    const { currentPreset, presets } = get()
    if (!currentPreset) return
    
    // Validate ID uniqueness if ID is being changed
    if (updates.id && updates.id !== currentPreset.id) {
      const idExists = presets.some(p => p.id === updates.id && p.id !== currentPreset.id)
      if (idExists) {
        set({ error: `Preset ID "${updates.id}" already exists` })
        return
      }
    }
    
    // Sync category and categories
    if (updates.category && !updates.categories) {
      updates.categories = [updates.category]
    } else if (updates.categories && updates.categories.length > 0 && !updates.category) {
      updates.category = updates.categories[0]
    }
    
    // Sync popular flag with categories array
    // If popular is set, ensure 'popular' is in categories array
    // If popular is unset, remove 'popular' from categories array
    if (updates.popular !== undefined) {
      const currentCategories = updates.categories || currentPreset.categories || []
      if (updates.popular && !currentCategories.includes('popular')) {
        updates.categories = [...currentCategories, 'popular']
      } else if (!updates.popular && currentCategories.includes('popular')) {
        updates.categories = currentCategories.filter(c => c !== 'popular')
      }
    }
    
    const updated = { ...currentPreset, ...updates }
    const newPresets = presets.map(p => p.id === currentPreset.id ? updated : p)
    
    set({ 
      currentPreset: updated, 
      presets: newPresets,
      hasUnsavedChanges: true,
    })
  },
  
  // Duplicate a preset
  duplicatePreset: (id: string) => {
    const { presets } = get()
    const original = presets.find(p => p.id === id)
    if (!original) return
    
    const existingIds = new Set(presets.map(p => p.id))
    const newId = generateUniqueId(`${original.id}-copy`, existingIds)
    
    const duplicate: Preset = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
    }
    
    set({ 
      presets: [...presets, duplicate], 
      currentPreset: { ...duplicate },
      hasUnsavedChanges: true,
    })
  },
  
  // Delete a preset
  deletePreset: (id: string) => {
    const { presets, currentPreset } = get()
    const preset = presets.find(p => p.id === id)
    if (!preset) return
    
    if (!window.confirm(`Are you sure you want to delete preset "${preset.name}"?`)) {
      return
    }
    
    const newPresets = presets.filter(p => p.id !== id)
    
    set({ 
      presets: newPresets,
      currentPreset: currentPreset?.id === id ? null : currentPreset,
      hasUnsavedChanges: true,
    })
  },
  
  // Save all presets (with validation)
  savePresets: async () => {
    const { presets, categories, assets, sampleImages, tooltips } = get()
    set({ isSaving: true, error: null })
    
    // Validate resources before saving
    const validation = validatePresetResources(presets, assets)
    set({ validationResult: validation })
    
    if (!validation.valid) {
      const errorMessage = formatValidationErrors(validation.errors)
      set({ error: errorMessage, isSaving: false })
      return false
    }
    
    try {
      await apiSavePresets(presets, categories, sampleImages, tooltips)
      set({ isSaving: false, hasUnsavedChanges: false, validationResult: null })
      return true
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false })
      return false
    }
  },
  
  // Layer management
  addLayer: () => {
    const { currentPreset } = get()
    if (!currentPreset) return
    
    const newLayer = {
      src: '',
      tiling: 'tiled' as const,
      scaleMode: 'uniform' as const,
    }
    
    get().updatePreset({
      layers: [...(currentPreset.layers || []), newLayer],
    })
  },
  
  removeLayer: (index: number) => {
    const { currentPreset } = get()
    if (!currentPreset) return
    
    const newLayers = [...(currentPreset.layers || [])]
    newLayers.splice(index, 1)
    
    get().updatePreset({ layers: newLayers })
  },
  
  updateLayer: (index: number, prop: string, value: unknown) => {
    const { currentPreset } = get()
    if (!currentPreset) return
    
    const newLayers = [...(currentPreset.layers || [])]
    newLayers[index] = { ...newLayers[index], [prop]: value }
    
    get().updatePreset({ layers: newLayers })
  },
  
  // Category management
  addCategory: (name: string) => {
    const { categories } = get()
    const existingIds = new Set(categories.map(c => c.id))
    const id = generateUniqueId(name, existingIds)
    const maxOrder = Math.max(0, ...categories.map(c => c.order))
    
    const newCategory: Category = {
      id,
      name,
      order: maxOrder + 10,
    }
    
    set({
      categories: [...categories, newCategory],
      hasUnsavedChanges: true,
    })
  },
  
  updateCategory: (id: string, updates: Partial<Category>) => {
    const { categories } = get()
    const newCategories = categories.map(c => 
      c.id === id ? { ...c, ...updates } : c
    )
    set({ categories: newCategories, hasUnsavedChanges: true })
  },
  
  deleteCategory: (id: string) => {
    const { categories, presets, currentPreset } = get()
    // Move presets from deleted category to first available or 'custom'
    const remainingCats = categories.filter(c => c.id !== id)
    const fallbackCat = remainingCats[0]?.id || 'custom'
    
    const updatedPresets = presets.map(p => {
      if (p.category === id) {
        // Update both category and categories array
        const newCategories = (p.categories || []).filter(c => c !== id)
        if (newCategories.length === 0) newCategories.push(fallbackCat)
        return { 
          ...p, 
          category: newCategories[0], 
          categories: newCategories 
        }
      }
      // Also clean up categories array even if main category is different
      if (p.categories?.includes(id)) {
        return {
          ...p,
          categories: p.categories.filter(c => c !== id)
        }
      }
      return p
    })
    
    // Update current preset if affected
    let updatedCurrentPreset = currentPreset
    if (currentPreset && (currentPreset.category === id || currentPreset.categories?.includes(id))) {
      updatedCurrentPreset = updatedPresets.find(p => p.id === currentPreset.id) || null
    }
    
    set({
      categories: remainingCats,
      presets: updatedPresets,
      currentPreset: updatedCurrentPreset,
      hasUnsavedChanges: true,
    })
  },
  
  reorderCategory: (id: string, newOrder: number) => {
    const { categories } = get()
    const newCategories = categories.map(c => 
      c.id === id ? { ...c, order: newOrder } : c
    )
    set({ categories: newCategories, hasUnsavedChanges: true })
  },
  
  openCategoryModal: () => set({ categoryModalOpen: true }),
  closeCategoryModal: () => set({ categoryModalOpen: false }),
  
  // Asset modal
  openAssetModal: (layerIndex: number) => {
    set({ assetModalOpen: true, currentLayerIndex: layerIndex })
  },
  
  closeAssetModal: () => {
    set({ assetModalOpen: false, currentLayerIndex: null })
  },
  
  selectAsset: (assetId: string) => {
    const { currentLayerIndex } = get()
    if (currentLayerIndex === null) return
    
    get().updateLayer(currentLayerIndex, 'src', `resource://${assetId}`)
    get().closeAssetModal()
  },
  
  setAssetFilters: (filters: Partial<AssetFilters>) => {
    set(state => ({
      assetFilters: { ...state.assetFilters, ...filters },
    }))
  },
  
  uploadNewAsset: async (file: File, name: string) => {
    try {
      const result = await uploadAsset(file, name)
      if (result.success && result.asset) {
        const { assets } = get()
        set({ assets: [...assets, result.asset] })
      }
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
  
  removeAsset: async (filename: string) => {
    try {
      const success = await deleteAsset(filename)
      if (success) {
        const { assets } = get()
        const id = filename.replace(/\.[^/.]+$/, '')
        set({ assets: assets.filter(a => a.id !== id) })
      }
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  // Sample Images management
  addSampleImage: (asset: Asset) => {
    const { sampleImages } = get()
    const maxOrder = Math.max(0, ...sampleImages.map(s => s.order))
    const newSample: SampleImage = {
      id: asset.id,
      name: asset.name.replace(/\.[^/.]+$/, ''),
      url: asset.url,
      order: maxOrder + 1,
    }
    set({ 
      sampleImages: [...sampleImages, newSample],
      hasUnsavedChanges: true 
    })
  },

  updateSampleImage: (id: string, updates: Partial<SampleImage>) => {
    const { sampleImages } = get()
    set({
      sampleImages: sampleImages.map(s => s.id === id ? { ...s, ...updates } : s),
      hasUnsavedChanges: true,
    })
  },

  deleteSampleImage: (id: string) => {
    const { sampleImages } = get()
    set({
      sampleImages: sampleImages.filter(s => s.id !== id),
      hasUnsavedChanges: true,
    })
  },

  reorderSampleImages: (newSamples: SampleImage[]) => {
    set({
      sampleImages: newSamples,
      hasUnsavedChanges: true,
    })
  },

  uploadNewSample: async (file: File, name: string) => {
    try {
      const result = await apiUploadSampleImage(file, name)
      if (result.success && result.asset) {
        get().addSampleImage(result.asset)
      }
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  removeSampleAsset: async (filename: string) => {
    try {
      const success = await apiDeleteSampleImage(filename)
      if (success) {
        const id = filename.replace(/\.[^/.]+$/, '')
        get().deleteSampleImage(id)
      }
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  // Tooltip management
  updateTooltip: (id: string, updates: Partial<TooltipData>) => {
    const { tooltips } = get()
    // If tooltip doesn't exist yet, it's a new one (though we usually have a predefined list)
    const exists = tooltips.some(t => t.id === id)
    
    if (exists) {
      set({
        tooltips: tooltips.map(t => t.id === id ? { ...t, ...updates } : t),
        hasUnsavedChanges: true
      })
    } else {
      const newTooltip: TooltipData = {
        id,
        label: updates.label || '',
        description: updates.description || '',
        imageUrl: updates.imageUrl
      }
      set({
        tooltips: [...tooltips, newTooltip],
        hasUnsavedChanges: true
      })
    }
  },

  uploadTooltipImage: async (file: File, id: string) => {
    try {
      const result = await apiUploadTooltipImage(file, id)
      if (result.success && result.url) {
        get().updateTooltip(id, { imageUrl: result.url })
      }
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  deleteTooltipImage: async (id: string) => {
    try {
      const success = await apiDeleteTooltipImage(id)
      if (success) {
        get().updateTooltip(id, { imageUrl: undefined })
      }
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
  
  // Utils
  clearError: () => set({ error: null }),
  setUnsavedChanges: (value: boolean) => set({ hasUnsavedChanges: value }),
  
  // Preview settings
  setPreviewColorSpace: (space: 'sRGB' | 'linearRGB') => set({ previewColorSpace: space }),
  setPreviewUseSvgFilter: (use: boolean) => set({ previewUseSvgFilter: use }),
  
  // Validation
  validateResources: () => {
    const { presets, assets } = get()
    const result = validatePresetResources(presets, assets)
    set({ validationResult: result })
    return result
  },
  
  isResourceMissing: (src: string) => {
    const { assets } = get()
    const resourceId = extractResourceId(src)
    if (!resourceId) return false
    return !assets.some(a => a.id === resourceId)
  },
  
  clearValidation: () => set({ validationResult: null }),
}))

// Selector hooks
export const usePresets = () => useStore(state => state.presets)
export const useAssets = () => useStore(state => state.assets)
export const useCategories = () => useStore(state => state.categories)
export const useSampleImages = () => useStore(state => state.sampleImages)
export const useTooltips = () => useStore(state => state.tooltips)
export const useCurrentPreset = () => useStore(state => state.currentPreset)
export const useAssetFilters = () => useStore(state => state.assetFilters)
export const useCategoryModalOpen = () => useStore(state => state.categoryModalOpen)

// Sorted categories helper (by order)
export const useSortedCategories = () => {
  const categories = useCategories()
  return [...categories].sort((a, b) => a.order - b.order)
}
