import type { Preset, Asset, Category, Layer, SampleImage, TooltipData } from './types'

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/bbssppllvv/Dispace-Figma-Plugin/main'

// === Resource Validation ===

export interface ValidationError {
  presetId: string
  presetName: string
  layerIndex: number
  resourceId: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * Extract resource ID from layer src
 * Returns null if src is not a resource:// reference
 */
export function extractResourceId(src: string): string | null {
  if (!src || !src.startsWith('resource://')) return null
  return src.replace('resource://', '')
}

/**
 * Validate that all resource:// references in presets point to existing assets
 */
export function validatePresetResources(presets: Preset[], assets: Asset[]): ValidationResult {
  const assetIds = new Set(assets.map(a => a.id))
  const errors: ValidationError[] = []

  for (const preset of presets) {
    if (!preset.layers || preset.layers.length === 0) continue

    preset.layers.forEach((layer: Layer, index: number) => {
      const resourceId = extractResourceId(layer.src)
      if (resourceId && !assetIds.has(resourceId)) {
        errors.push({
          presetId: preset.id,
          presetName: preset.name,
          layerIndex: index,
          resourceId,
          message: `Resource "${resourceId}" not found in assets`
        })
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return ''
  
  const grouped = errors.reduce((acc, err) => {
    if (!acc[err.presetId]) {
      acc[err.presetId] = { name: err.presetName, resources: [] }
    }
    acc[err.presetId].resources.push(err.resourceId)
    return acc
  }, {} as Record<string, { name: string; resources: string[] }>)

  const lines = Object.entries(grouped).map(([, data]) => {
    return `• "${data.name}": missing ${data.resources.join(', ')}`
  })

  return `The following presets have missing resources:\n\n${lines.join('\n')}\n\nPlease fix or delete these presets before saving.`
}

export async function fetchPresets(): Promise<{ presets: Preset[], categories: Category[], sampleImages?: SampleImage[], tooltips?: TooltipData[] }> {
  // Try local file first (faster, no rate limits)
  try {
    const response = await fetch('/api/local-presets')
    if (response.ok) {
      console.log('✅ Loaded presets from local file')
      return response.json()
    }
  } catch (e) {
    console.warn('Local presets not available, trying CDN')
  }

  // Fallback to CDN
  const url = '/api/cdn/presets.json'
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch presets: ${response.status}`)
  }
  
  return response.json()
}

export async function fetchAssets(): Promise<Asset[]> {
  // Try loading from local assets directory first (faster, no rate limits)
  try {
    const response = await fetch('/api/local-assets')
    if (response.ok) {
      const files = await response.json()
      return files.map((file: { name: string; size?: number }) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'svg'
        return {
          id: file.name.replace(/\.[^/.]+$/, ''),
          name: file.name,
          type: ext === 'jpg' ? 'jpeg' : ext as 'svg' | 'png' | 'jpeg',
          size: file.size,
          url: `/api/asset/${file.name}`,
        }
      })
    }
  } catch (e) {
    console.warn('Local assets not available, trying GitHub API')
  }

  // Fallback to GitHub API (may hit rate limits)
  try {
    const response = await fetch('/api/github/assets/displacement-maps/svg', {
      headers: { 'Accept': 'application/json' }
    })
    
    if (!response.ok) {
      console.warn(`GitHub API returned ${response.status}, returning empty assets`)
      return []
    }
    
    const files = await response.json()
    
    return files
      .filter((file: { type: string; name: string }) => 
        file.type === 'file' && 
        /\.(svg|png|jpe?g)$/i.test(file.name)
      )
      .map((file: { name: string; size?: number; sha?: string }) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'svg'
        return {
          id: file.name.replace(/\.[^/.]+$/, ''),
          name: file.name,
          type: ext === 'jpg' ? 'jpeg' : ext as 'svg' | 'png' | 'jpeg',
          size: file.size,
          url: `${GITHUB_RAW_BASE}/assets/displacement-maps/svg/${file.name}`,
          hash: file.sha,
        }
      })
  } catch (e) {
    console.warn('GitHub API failed, returning empty assets:', e)
    return []
  }
}

export async function savePresets(presets: Preset[], categories: Category[], sampleImages: SampleImage[], tooltips: TooltipData[]): Promise<boolean> {
  const data = {
    version: '1.0.0',
    updated: new Date().toISOString(),
    categories,
    presets,
    sampleImages,
    tooltips,
  }
  
  const response = await fetch('/api/save-presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    throw new Error('Failed to save presets')
  }
  
  return true
}

export async function fetchSampleImages(): Promise<Asset[]> {
  try {
    const response = await fetch('/api/local-samples')
    if (response.ok) {
      const files = await response.json()
      return files.map((file: { name: string; size?: number }) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
        return {
          id: file.name.replace(/\.[^/.]+$/, ''),
          name: file.name,
          type: (ext === 'jpg' || ext === 'jpeg') ? 'jpeg' : ext as 'svg' | 'png' | 'jpeg',
          size: file.size,
          url: `/api/sample/${file.name}`,
        }
      })
    }
  } catch (e) {
    console.warn('Local samples not available')
  }
  return []
}

export async function uploadSampleImage(file: File, name: string): Promise<{ success: boolean; asset?: Asset }> {
  const reader = new FileReader()
  
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const response = await fetch('/api/upload-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            content: reader.result,
          }),
        })
        
        const result = await response.json()
        if (result.success) {
          const ext = name.split('.').pop()?.toLowerCase() || 'png'
          resolve({
            success: true,
            asset: {
              id: name.replace(/\.[^/.]+$/, ''),
              name,
              type: (ext === 'jpg' || ext === 'jpeg') ? 'jpeg' : ext as 'svg' | 'png' | 'jpeg',
              url: `/samples/${name}`,
            }
          })
        } else {
          reject(new Error(result.error))
        }
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function deleteSampleImage(filename: string): Promise<boolean> {
  const response = await fetch('/api/delete-sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  })
  
  const result = await response.json()
  return result.success
}

export async function uploadAsset(file: File, name: string): Promise<{ success: boolean; asset?: Asset }> {
  const reader = new FileReader()
  
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const response = await fetch('/api/upload-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            content: reader.result,
          }),
        })
        
        const result = await response.json()
        if (result.success) {
          const ext = name.split('.').pop()?.toLowerCase() || 'svg'
          resolve({
            success: true,
            asset: {
              id: name.replace(/\.[^/.]+$/, ''),
              name,
              type: ext === 'jpg' ? 'jpeg' : ext as 'svg' | 'png' | 'jpeg',
              url: `/api/asset/${name}`,
            }
          })
        } else {
          reject(new Error(result.error))
        }
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function deleteAsset(filename: string): Promise<boolean> {
  const response = await fetch('/api/delete-asset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  })
  
  const result = await response.json()
  return result.success
}

export async function uploadTooltipImage(file: File, tooltipId: string): Promise<{ success: boolean; url?: string }> {
  const reader = new FileReader()
  
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const response = await fetch('/api/upload-tooltip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: tooltipId,
            content: reader.result,
          }),
        })
        
        const result = await response.json()
        if (result.success) {
          resolve({
            success: true,
            url: result.url
          })
        } else {
          reject(new Error(result.error))
        }
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function deleteTooltipImage(tooltipId: string): Promise<boolean> {
  const response = await fetch('/api/delete-tooltip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: tooltipId }),
  })
  
  const result = await response.json()
  return result.success
}
