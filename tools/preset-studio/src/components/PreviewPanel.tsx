import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { ImageIcon, RefreshCw, FlaskConical, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Layer } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Min preview size for small screens
const MIN_PREVIEW_SIZE = 200
// Max preview size for large screens
const MAX_PREVIEW_SIZE = 360

// Cache for loaded layer images - stores index to get fresh layer data during render
interface LayerImage {
  image: HTMLImageElement
  layerIndex: number  // Index into currentPreset.layers for fresh data lookup
}

export function PreviewPanel() {
  const { 
    currentPreset, 
    assets,
    sampleImages,
    isLoading,
    previewColorSpace,
    previewUseSvgFilter,
    setPreviewColorSpace,
    setPreviewUseSvgFilter 
  } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const mapPreviewRef = useRef<HTMLCanvasElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [strength, setStrength] = useState(150)
  const [scale, setScale] = useState(100)
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null)
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null)
  const [layerImages, setLayerImages] = useState<LayerImage[]>([])
  const [showExperimentalPanel, setShowExperimentalPanel] = useState(false)
  const [previewSize, setPreviewSize] = useState(MIN_PREVIEW_SIZE)

  // Dynamically calculate preview size based on container
  useLayoutEffect(() => {
    const container = previewContainerRef.current
    if (!container) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      // Use the smaller dimension minus padding, clamped to min/max
      const availableSize = Math.min(rect.width, rect.height) - 16 // 16px padding
      const newSize = Math.max(MIN_PREVIEW_SIZE, Math.min(MAX_PREVIEW_SIZE, availableSize))
      setPreviewSize(newSize)
    }

    // Initial measurement
    updateSize()

    // Observe resize
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  // Load sample image
  const loadSample = useCallback((url: string, id: string) => {
    const img = new Image()
    img.onload = () => {
      setSourceImg(img)
      setActiveSampleId(id)
    }
    img.src = url
  }, [])

  // Initial load
  useEffect(() => {
    if (sampleImages.length > 0 && !activeSampleId) {
      const sorted = [...sampleImages].sort((a, b) => a.order - b.order)
      const firstSample = sorted[0]
      loadSample(firstSample.url, firstSample.id)
    } else if (sampleImages.length === 0 && !sourceImg && !isLoading) {
      // Fallback if no samples managed yet
      const img = new Image()
      img.onload = () => setSourceImg(img)
      img.src = '/samples/sample01.png'
    }
  }, [sampleImages, loadSample, activeSampleId, sourceImg, isLoading])

  // Sync sliders with preset
  useEffect(() => {
    if (currentPreset) {
      setStrength(currentPreset.defaultStrength ?? 150)
      setScale(currentPreset.defaultScale ?? 100)
    }
  }, [currentPreset?.id, currentPreset?.defaultStrength, currentPreset?.defaultScale])

  // Resolve asset URL
  const resolveAssetUrl = useCallback((src: string): string | null => {
    if (!src) return null
    if (src.startsWith('resource://')) {
      const id = src.replace('resource://', '')
      const asset = assets.find(a => a.id === id)
      return asset?.url || null
    }
    return src
  }, [assets])

  // Load ALL visible layers (skip hidden layers where visible === false)
  // Store layerIndex instead of layer object to allow fresh data lookup during render
  useEffect(() => {
    if (!currentPreset?.layers?.length) {
      setLayerImages([])
      return
    }

    const loadImages = async () => {
      const loaded: LayerImage[] = []
      
      for (let i = 0; i < currentPreset.layers.length; i++) {
        const layer = currentPreset.layers[i]
        // Skip hidden layers (visible: false)
        if (layer.visible === false) continue
        
        const url = resolveAssetUrl(layer.src)
        if (!url) continue

        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image()
            image.crossOrigin = 'anonymous'
            image.onload = () => resolve(image)
            image.onerror = reject
            image.src = url
          })
          loaded.push({ image: img, layerIndex: i })
        } catch {
          // Skip failed layers
        }
      }
      
      setLayerImages(loaded)
    }

    loadImages()
  }, [currentPreset?.layers, resolveAssetUrl])

  // Draw a single layer with all its properties (tiling, scale, blend mode, opacity, alignment)
  // UNIFIED LOGIC: matches FilterRenderer.ts in the plugin
  const drawLayer = useCallback((
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    image: HTMLImageElement,
    layer: Layer,
    globalScale: number,
    textureScale: number
  ) => {
    ctx.save()
    
    // Apply opacity
    ctx.globalAlpha = typeof layer.opacity === 'number' ? Math.max(0, Math.min(1, layer.opacity)) : 1
    
    // Apply blend mode (map 'normal' to 'source-over')
    const blendMode = layer.blendMode || 'source-over'
    ctx.globalCompositeOperation = blendMode === 'normal' ? 'source-over' : blendMode as GlobalCompositeOperation
    
    // scaleMultiplier modifies how fast this layer responds to global scale slider
    const layerMultiplier = typeof layer.scaleMultiplier === 'number' ? layer.scaleMultiplier : 1.0
    const layerScale = globalScale * textureScale * layerMultiplier
    
    // UNIFIED: Calculate baseScale like plugin's cachedBaseScale
    // Plugin: cachedBaseScale = max(imageWidth, imageHeight) / max(mapWidth, mapHeight)
    // Here: canvasMaxDim (previewSize) represents the "image" dimension
    const mapMaxDim = Math.max(image.width, image.height)
    const baseScale = canvasW / mapMaxDim  // canvasW === canvasH === previewSize
    const s = (layerScale / 100) * baseScale
    
    if (layer.tiling === 'stretched') {
      // Stretched mode - draw image to fill entire canvas
      const offsetX = layer.offsetX || 0
      const offsetY = layer.offsetY || 0
      if (offsetX !== 0 || offsetY !== 0) {
        ctx.translate(offsetX, offsetY)
      }
      ctx.drawImage(image, 0, 0, canvasW, canvasH)
    } else {
      // Tiled mode with alignment support
      // UNIFIED: Apply baseScale to tile dimensions (matching plugin logic)
      let w = Math.max(1, image.width * s)
      let h = Math.max(1, image.height * s)
      
      const scaleMode = layer.scaleMode || 'uniform'
      if (scaleMode === 'xOnly') h = canvasH
      else if (scaleMode === 'yOnly') w = canvasW
      
      // Calculate origin based on alignment
      let originX = 0, originY = 0
      const alignX = layer.alignX || 'left'
      const alignY = layer.alignY || 'top'
      
      if (alignX === 'center') originX = Math.floor((canvasW - w) / 2)
      else if (alignX === 'right') originX = canvasW - w
      if (alignY === 'center') originY = Math.floor((canvasH - h) / 2)
      else if (alignY === 'bottom') originY = canvasH - h
      
      originX += (layer.offsetX || 0)
      originY += (layer.offsetY || 0)
      
      // Tile the image
      const startI = Math.floor((0 - originX) / w) - 1
      const startJ = Math.floor((0 - originY) / h) - 1
      const endI = Math.ceil((canvasW - originX) / w) + 1
      const endJ = Math.ceil((canvasH - originY) / h) + 1
      
      for (let i = startI; i <= endI; i++) {
        for (let j = startJ; j <= endJ; j++) {
          const x = originX + i * w
          const y = originY + j * h
          if (x > canvasW || y > canvasH || x + w < 0 || y + h < 0) continue
          ctx.drawImage(image, x, y, w, h)
        }
      }
    }
    
    ctx.restore()
  }, [])

  // Render with all layers and blend modes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Update canvas size
    canvas.width = previewSize
    canvas.height = previewSize
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#27272a'
    ctx.fillRect(0, 0, previewSize, previewSize)

    if (!sourceImg) return

    const ratio = sourceImg.width / sourceImg.height
    let w = previewSize, h = previewSize
    if (ratio > 1) h = previewSize / ratio
    else w = previewSize * ratio
    const x = (previewSize - w) / 2
    const y = (previewSize - h) / 2

    if (!layerImages.length || !currentPreset?.layers?.length) {
      ctx.drawImage(sourceImg, x, y, w, h)
      return
    }

    // Prepare source canvas
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = srcCanvas.height = previewSize
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.fillStyle = '#27272a'
    srcCtx.fillRect(0, 0, previewSize, previewSize)
    srcCtx.drawImage(sourceImg, x, y, w, h)

    // Render ALL layers with blend modes to a single map canvas
    const mapCanvas = document.createElement('canvas')
    mapCanvas.width = mapCanvas.height = previewSize
    const mapCtx = mapCanvas.getContext('2d')!
    mapCtx.fillStyle = '#808080' // neutral gray for displacement
    mapCtx.fillRect(0, 0, previewSize, previewSize)
    
    // Draw each layer with its blend mode - look up fresh layer data for scaleMultiplier
    for (const { image, layerIndex } of layerImages) {
      const layer = currentPreset.layers[layerIndex]
      if (!layer) continue
      drawLayer(mapCtx, previewSize, previewSize, image, layer, scale, currentPreset.textureScale ?? 1)
    }

    // Apply displacement
    const srcData = srcCtx.getImageData(0, 0, previewSize, previewSize)
    const mapData = mapCtx.getImageData(0, 0, previewSize, previewSize)
    const out = ctx.createImageData(previewSize, previewSize)
    const str = strength / 8
    const chrom = (currentPreset.chromaticAberration ?? 0) / 100

    for (let py = 0; py < previewSize; py++) {
      for (let px = 0; px < previewSize; px++) {
        const i = (py * previewSize + px) * 4
        
        // Displacement values from map (R for X, G for Y)
        const mapX = (mapData.data[i] / 255 - 0.5)
        const mapY = (mapData.data[i + 1] / 255 - 0.5)
        
        // Green channel (center)
        const gx = Math.round(px + mapX * str)
        const gy = Math.round(py + mapY * str)
        
        // Red and Blue channels shifted for chromatic aberration
        const rx = Math.round(px + mapX * str * (1 + chrom))
        const ry = Math.round(py + mapY * str * (1 + chrom))
        const bx = Math.round(px + mapX * str * (1 - chrom))
        const by = Math.round(py + mapY * str * (1 - chrom))

        // Sample channels
        if (rx >= 0 && rx < previewSize && ry >= 0 && ry < previewSize) {
          out.data[i] = srcData.data[(ry * previewSize + rx) * 4]
        } else {
          out.data[i] = 39
        }
        
        if (gx >= 0 && gx < previewSize && gy >= 0 && gy < previewSize) {
          const gi = (gy * previewSize + gx) * 4
          out.data[i + 1] = srcData.data[gi + 1]
          // Alpha from green channel position
          out.data[i + 3] = srcData.data[gi + 3]
        } else {
          out.data[i + 1] = 39
          out.data[i + 3] = 255
        }
        
        if (bx >= 0 && bx < previewSize && by >= 0 && by < previewSize) {
          out.data[i + 2] = srcData.data[(by * previewSize + bx) * 4 + 2]
        } else {
          out.data[i + 2] = 42
        }
      }
    }
    ctx.putImageData(out, 0, 0)
    
    // Apply grain
    const grain = currentPreset.grain ?? 0
    if (grain > 0) {
      const grainSize = currentPreset.grainSize ?? 50
      const noiseCanvas = document.createElement('canvas')
      noiseCanvas.width = noiseCanvas.height = 64
      const nCtx = noiseCanvas.getContext('2d')!
      const nData = nCtx.createImageData(64, 64)
      for (let i = 0; i < nData.data.length; i += 4) {
        const v = Math.random() * 255
        nData.data[i] = nData.data[i + 1] = nData.data[i + 2] = v
        nData.data[i + 3] = 255
      }
      nCtx.putImageData(nData, 0, 0)
      
      ctx.save()
      ctx.globalAlpha = grain / 100
      ctx.globalCompositeOperation = 'overlay'
      
      const pattern = ctx.createPattern(noiseCanvas, 'repeat')
      if (pattern) {
        ctx.fillStyle = pattern
        // Scale grain based on grainSize
        const gScale = 1 + (grainSize / 100) * 2
        ctx.scale(gScale, gScale)
        ctx.fillRect(0, 0, previewSize / gScale, previewSize / gScale)
      }
      ctx.restore()
    }
    
    // Apply blur and other CSS filters
    const blur = currentPreset.blur ?? 0
    canvas.style.filter = blur > 0 ? `blur(${blur / 2}px)` : ''
    
  }, [sourceImg, layerImages, strength, scale, currentPreset?.layers, currentPreset?.textureScale, currentPreset?.chromaticAberration, currentPreset?.blur, currentPreset?.grain, currentPreset?.grainSize, drawLayer, previewSize])

  // Displacement map preview thumbnail - responsive size
  const mapThumbnailSize = Math.round(previewSize * 0.5) // 50% of preview size
  
  useEffect(() => {
    const mapPreviewCanvas = mapPreviewRef.current
    if (!mapPreviewCanvas) return
    
    // Update thumbnail canvas size
    mapPreviewCanvas.width = mapThumbnailSize
    mapPreviewCanvas.height = mapThumbnailSize
    
    const mapPreviewCtx = mapPreviewCanvas.getContext('2d')
    if (!mapPreviewCtx) return

    const size = mapThumbnailSize
    
    // Draw checkerboard for transparency
    const checkSize = 10
    for (let y = 0; y < size; y += checkSize) {
      for (let x = 0; x < size; x += checkSize) {
        mapPreviewCtx.fillStyle = ((x / checkSize + y / checkSize) % 2 === 0) ? '#18181b' : '#09090b'
        mapPreviewCtx.fillRect(x, y, checkSize, checkSize)
      }
    }

    if (!layerImages.length || !currentPreset?.layers?.length) return

    // Create full-size map canvas (without neutral gray background for "true colors")
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = tempCanvas.height = previewSize
    const tempCtx = tempCanvas.getContext('2d')!

    // Draw each layer - look up fresh layer data for scaleMultiplier
    for (const { image, layerIndex } of layerImages) {
      const layer = currentPreset.layers[layerIndex]
      if (!layer) continue
      drawLayer(tempCtx, previewSize, previewSize, image, layer, scale, currentPreset.textureScale ?? 1)
    }

    // Copy to thumbnail
    mapPreviewCtx.drawImage(tempCanvas, 0, 0, size, size)
  }, [layerImages, scale, currentPreset?.layers, currentPreset?.textureScale, drawLayer, previewSize, mapThumbnailSize])

  // SVG Filter-based preview (experimental)
  useEffect(() => {
    if (!previewUseSvgFilter) return
    const container = svgContainerRef.current
    if (!container || !sourceImg || !layerImages.length) return

    // Create displacement map canvas
    const mapCanvas = document.createElement('canvas')
    mapCanvas.width = mapCanvas.height = previewSize
    const mapCtx = mapCanvas.getContext('2d')!
    mapCtx.fillStyle = '#808080'
    mapCtx.fillRect(0, 0, previewSize, previewSize)
    
    // Draw layers to map - look up fresh layer data for scaleMultiplier
    for (const { image, layerIndex } of layerImages) {
      const layer = currentPreset?.layers[layerIndex]
      if (!layer) continue
      drawLayer(mapCtx, previewSize, previewSize, image, layer, scale, currentPreset?.textureScale ?? 1)
    }
    
    const mapDataUrl = mapCanvas.toDataURL('image/png')
    
    // Create source image canvas
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = srcCanvas.height = previewSize
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.fillStyle = '#27272a'
    srcCtx.fillRect(0, 0, previewSize, previewSize)
    
    const ratio = sourceImg.width / sourceImg.height
    let w = previewSize, h = previewSize
    if (ratio > 1) h = previewSize / ratio
    else w = previewSize * ratio
    const x = (previewSize - w) / 2
    const y = (previewSize - h) / 2
    srcCtx.drawImage(sourceImg, x, y, w, h)
    const srcDataUrl = srcCanvas.toDataURL('image/png')
    
    // Calculate displacement scale (matching plugin logic)
    const str = strength / 8
    const chrom = (currentPreset?.chromaticAberration ?? 0) / 100
    const dispScaleR = str * (1 + chrom)
    const dispScaleG = str
    const dispScaleB = str * (1 - chrom)
    
    // Create SVG with filter
    const svgNS = 'http://www.w3.org/2000/svg'
    
    // Clean up previous SVG
    container.innerHTML = ''
    
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('width', String(previewSize))
    svg.setAttribute('height', String(previewSize))
    svg.setAttribute('viewBox', `0 0 ${previewSize} ${previewSize}`)
    svg.style.borderRadius = '4px'
    svg.style.border = '1px solid #27272a'
    
    const defs = document.createElementNS(svgNS, 'defs')
    
    // Create filter with configurable color-interpolation-filters
    const filter = document.createElementNS(svgNS, 'filter')
    filter.setAttribute('id', 'displacementFilter')
    filter.setAttribute('x', '0')
    filter.setAttribute('y', '0')
    filter.setAttribute('width', String(previewSize))
    filter.setAttribute('height', String(previewSize))
    filter.setAttribute('filterUnits', 'userSpaceOnUse')
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse')
    // KEY: This is what we're testing!
    filter.setAttribute('color-interpolation-filters', previewColorSpace)
    
    // feImage for displacement map
    const feImg = document.createElementNS(svgNS, 'feImage')
    feImg.setAttribute('href', mapDataUrl)
    feImg.setAttribute('x', '0')
    feImg.setAttribute('y', '0')
    feImg.setAttribute('width', String(previewSize))
    feImg.setAttribute('height', String(previewSize))
    feImg.setAttribute('result', 'dispMap')
    feImg.setAttribute('preserveAspectRatio', 'none')
    filter.appendChild(feImg)
    
    // Source image
    const feSourceImg = document.createElementNS(svgNS, 'feImage')
    feSourceImg.setAttribute('href', srcDataUrl)
    feSourceImg.setAttribute('x', '0')
    feSourceImg.setAttribute('y', '0')
    feSourceImg.setAttribute('width', String(previewSize))
    feSourceImg.setAttribute('height', String(previewSize))
    feSourceImg.setAttribute('result', 'sourceImg')
    feSourceImg.setAttribute('preserveAspectRatio', 'none')
    filter.appendChild(feSourceImg)
    
    // Channel separation (R)
    const feCompR = document.createElementNS(svgNS, 'feComponentTransfer')
    feCompR.setAttribute('in', 'sourceImg')
    feCompR.setAttribute('result', 'redChannel')
    const funcGR = document.createElementNS(svgNS, 'feFuncG')
    funcGR.setAttribute('type', 'table')
    funcGR.setAttribute('tableValues', '0 0')
    const funcBR = document.createElementNS(svgNS, 'feFuncB')
    funcBR.setAttribute('type', 'table')
    funcBR.setAttribute('tableValues', '0 0')
    feCompR.appendChild(funcGR)
    feCompR.appendChild(funcBR)
    filter.appendChild(feCompR)
    
    // Channel separation (G)
    const feCompG = document.createElementNS(svgNS, 'feComponentTransfer')
    feCompG.setAttribute('in', 'sourceImg')
    feCompG.setAttribute('result', 'greenChannel')
    const funcRG = document.createElementNS(svgNS, 'feFuncR')
    funcRG.setAttribute('type', 'table')
    funcRG.setAttribute('tableValues', '0 0')
    const funcBG = document.createElementNS(svgNS, 'feFuncB')
    funcBG.setAttribute('type', 'table')
    funcBG.setAttribute('tableValues', '0 0')
    feCompG.appendChild(funcRG)
    feCompG.appendChild(funcBG)
    filter.appendChild(feCompG)
    
    // Channel separation (B)
    const feCompB = document.createElementNS(svgNS, 'feComponentTransfer')
    feCompB.setAttribute('in', 'sourceImg')
    feCompB.setAttribute('result', 'blueChannel')
    const funcRB = document.createElementNS(svgNS, 'feFuncR')
    funcRB.setAttribute('type', 'table')
    funcRB.setAttribute('tableValues', '0 0')
    const funcGB = document.createElementNS(svgNS, 'feFuncG')
    funcGB.setAttribute('type', 'table')
    funcGB.setAttribute('tableValues', '0 0')
    feCompB.appendChild(funcRB)
    feCompB.appendChild(funcGB)
    filter.appendChild(feCompB)
    
    // Displacement for R channel
    const feDispR = document.createElementNS(svgNS, 'feDisplacementMap')
    feDispR.setAttribute('in', 'redChannel')
    feDispR.setAttribute('in2', 'dispMap')
    feDispR.setAttribute('scale', String(dispScaleR))
    feDispR.setAttribute('xChannelSelector', 'R')
    feDispR.setAttribute('yChannelSelector', 'G')
    feDispR.setAttribute('result', 'dispR')
    filter.appendChild(feDispR)
    
    // Displacement for G channel
    const feDispG = document.createElementNS(svgNS, 'feDisplacementMap')
    feDispG.setAttribute('in', 'greenChannel')
    feDispG.setAttribute('in2', 'dispMap')
    feDispG.setAttribute('scale', String(dispScaleG))
    feDispG.setAttribute('xChannelSelector', 'R')
    feDispG.setAttribute('yChannelSelector', 'G')
    feDispG.setAttribute('result', 'dispG')
    filter.appendChild(feDispG)
    
    // Displacement for B channel
    const feDispB = document.createElementNS(svgNS, 'feDisplacementMap')
    feDispB.setAttribute('in', 'blueChannel')
    feDispB.setAttribute('in2', 'dispMap')
    feDispB.setAttribute('scale', String(dispScaleB))
    feDispB.setAttribute('xChannelSelector', 'R')
    feDispB.setAttribute('yChannelSelector', 'G')
    feDispB.setAttribute('result', 'dispB')
    filter.appendChild(feDispB)
    
    // Blend R + G
    const feBlendRG = document.createElementNS(svgNS, 'feBlend')
    feBlendRG.setAttribute('in', 'dispR')
    feBlendRG.setAttribute('in2', 'dispG')
    feBlendRG.setAttribute('mode', 'screen')
    feBlendRG.setAttribute('result', 'rgCombined')
    filter.appendChild(feBlendRG)
    
    // Blend (R+G) + B
    const feBlendRGB = document.createElementNS(svgNS, 'feBlend')
    feBlendRGB.setAttribute('in', 'rgCombined')
    feBlendRGB.setAttribute('in2', 'dispB')
    feBlendRGB.setAttribute('mode', 'screen')
    feBlendRGB.setAttribute('result', 'final')
    filter.appendChild(feBlendRGB)
    
    defs.appendChild(filter)
    svg.appendChild(defs)
    
    // Apply filter to a rect
    const rect = document.createElementNS(svgNS, 'rect')
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', String(previewSize))
    rect.setAttribute('height', String(previewSize))
    rect.setAttribute('filter', 'url(#displacementFilter)')
    svg.appendChild(rect)
    
    container.appendChild(svg)
    
  }, [previewUseSvgFilter, previewColorSpace, sourceImg, layerImages, strength, scale, currentPreset?.textureScale, currentPreset?.chromaticAberration, drawLayer, previewSize])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => setSourceImg(img)
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-2 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-400">Preview</span>
        <Button
          variant="ghost"
          size="sm"
          className={`h-5 px-1.5 text-[10px] ${showExperimentalPanel ? 'text-amber-400' : 'text-zinc-500'}`}
          title="Toggle experimental settings"
          onClick={() => setShowExperimentalPanel(!showExperimentalPanel)}
        >
          <FlaskConical className="w-3 h-3" />
        </Button>
      </div>

      {/* Displacement Map Preview - responsive size */}
      <div className="px-2 pt-2 flex justify-center">
        <canvas
          ref={mapPreviewRef}
          width={mapThumbnailSize}
          height={mapThumbnailSize}
          className="rounded border border-zinc-700 bg-zinc-900 shadow-lg"
        />
      </div>

      <div ref={previewContainerRef} className="flex-1 flex items-center justify-center p-2">
        {/* Canvas preview (default) */}
        <canvas
          ref={canvasRef}
          width={previewSize}
          height={previewSize}
          className="rounded border border-zinc-800"
          style={{ display: previewUseSvgFilter ? 'none' : 'block' }}
        />
        {/* SVG Filter preview (experimental) */}
        <div 
          ref={svgContainerRef}
          style={{ 
            display: previewUseSvgFilter ? 'block' : 'none',
            width: previewSize, 
            height: previewSize 
          }}
        />
      </div>

      {/* Experimental panel */}
      {showExperimentalPanel && (
        <div className="p-2 border-t border-amber-900/50 bg-amber-950/20 space-y-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-medium text-amber-400">Color Space Testing</span>
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-zinc-400">Use SVG Filter</Label>
            <button
              onClick={() => setPreviewUseSvgFilter(!previewUseSvgFilter)}
              className={`w-8 h-4 rounded-full transition-colors ${
                previewUseSvgFilter ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
            >
              <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${
                previewUseSvgFilter ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          
          {previewUseSvgFilter && (
            <div className="space-y-1">
              <Label className="text-[10px] text-zinc-400">color-interpolation-filters</Label>
              <div className="flex gap-1">
                <Button
                  variant={previewColorSpace === 'sRGB' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 h-5 text-[10px] ${previewColorSpace === 'sRGB' ? 'bg-zinc-700' : ''}`}
                  onClick={() => setPreviewColorSpace('sRGB')}
                >
                  sRGB
                </Button>
                <Button
                  variant={previewColorSpace === 'linearRGB' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 h-5 text-[10px] ${previewColorSpace === 'linearRGB' ? 'bg-amber-600' : ''}`}
                  onClick={() => setPreviewColorSpace('linearRGB')}
                >
                  linearRGB
                </Button>
              </div>
              <p className="text-[9px] text-zinc-500 leading-tight mt-1">
                {previewColorSpace === 'sRGB' 
                  ? 'Current plugin behavior. 128 = neutral (correct).'
                  : '⚠️ Wrong for current maps! 128→0.216, shifts image.'}
              </p>
            </div>
          )}
          
          {/* Pixel Inspector */}
          <div className="mt-2 pt-2 border-t border-amber-900/30">
            <Label className="text-[10px] text-zinc-400">Displacement Map Pixel Inspector</Label>
            <p className="text-[9px] text-zinc-500 mb-1">
              Check if neutral gray (#808080) renders as exactly R=128, G=128
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-5 text-[9px] mt-1"
              onClick={() => {
                if (!layerImages.length) {
                  alert('No displacement map loaded')
                  return
                }
                // Create analysis canvas
                const mapCanvas = document.createElement('canvas')
                mapCanvas.width = mapCanvas.height = previewSize
                const mapCtx = mapCanvas.getContext('2d')!
                mapCtx.fillStyle = '#808080'
                mapCtx.fillRect(0, 0, previewSize, previewSize)
                
                for (const { image, layerIndex } of layerImages) {
                  const layer = currentPreset?.layers[layerIndex]
                  if (!layer) continue
                  drawLayer(mapCtx, previewSize, previewSize, image, layer, scale, currentPreset?.textureScale ?? 1)
                }
                
                // Sample center pixel
                const centerX = Math.floor(previewSize / 2)
                const centerY = Math.floor(previewSize / 2)
                const imageData = mapCtx.getImageData(0, 0, previewSize, previewSize)
                
                // Analyze pixel distribution
                let minR = 255, maxR = 0, minG = 255, maxG = 0
                let sumR = 0, sumG = 0, count = 0
                const rValues = new Map<number, number>()
                const gValues = new Map<number, number>()
                
                for (let y = 0; y < previewSize; y++) {
                  for (let x = 0; x < previewSize; x++) {
                    const i = (y * previewSize + x) * 4
                    const r = imageData.data[i]
                    const g = imageData.data[i + 1]
                    minR = Math.min(minR, r)
                    maxR = Math.max(maxR, r)
                    minG = Math.min(minG, g)
                    maxG = Math.max(maxG, g)
                    sumR += r
                    sumG += g
                    count++
                    rValues.set(r, (rValues.get(r) || 0) + 1)
                    gValues.set(g, (gValues.get(g) || 0) + 1)
                  }
                }
                
                const avgR = Math.round(sumR / count)
                const avgG = Math.round(sumG / count)
                
                // Find most common values
                const topR = [...rValues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
                const topG = [...gValues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
                
                // Center pixel
                const ci = (centerY * previewSize + centerX) * 4
                const centerR = imageData.data[ci]
                const centerG = imageData.data[ci + 1]
                
                const report = `
═══ DISPLACEMENT MAP ANALYSIS ═══

Center pixel (${centerX}, ${centerY}):
  R: ${centerR} (expected 128 for neutral)
  G: ${centerG} (expected 128 for neutral)
  Deviation: R=${centerR - 128}, G=${centerG - 128}

Range:
  R: ${minR} - ${maxR} (${maxR - minR} span)
  G: ${minG} - ${maxG} (${maxG - minG} span)

Average:
  R: ${avgR} (deviation from 128: ${avgR - 128})
  G: ${avgG} (deviation from 128: ${avgG - 128})

Most common R values:
${topR.map(([v, c]) => `  ${v}: ${c} pixels (${(c/count*100).toFixed(1)}%)`).join('\n')}

Most common G values:
${topG.map(([v, c]) => `  ${v}: ${c} pixels (${(c/count*100).toFixed(1)}%)`).join('\n')}

═══════════════════════════════════

If neutral areas show values ≠ 128, 
this explains displacement offset!
`.trim()
                
                console.log(report)
                alert(report)
              }}
            >
              🔍 Analyze Pixel Values
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full h-5 text-[9px] mt-1"
              onClick={() => {
                // Test: Create pure #808080 SVG and check how browser renders it
                const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
                  <rect width="100" height="100" fill="#808080"/>
                </svg>`
                
                const blob = new Blob([testSvg], { type: 'image/svg+xml' })
                const url = URL.createObjectURL(blob)
                
                const img = new Image()
                img.onload = () => {
                  const canvas = document.createElement('canvas')
                  canvas.width = canvas.height = 100
                  const ctx = canvas.getContext('2d')!
                  ctx.drawImage(img, 0, 0)
                  
                  const data = ctx.getImageData(50, 50, 1, 1).data
                  const r = data[0]
                  const g = data[1]
                  const b = data[2]
                  
                  URL.revokeObjectURL(url)
                  
                  const report = `
═══ BROWSER SVG RENDER TEST ═══

SVG fill="#808080" renders as:
  R: ${r} (expected 128, diff: ${r - 128})
  G: ${g} (expected 128, diff: ${g - 128})
  B: ${b} (expected 128, diff: ${b - 128})

${r === 128 && g === 128 && b === 128 
  ? '✅ Browser renders #808080 correctly!'
  : '❌ Browser modifies color values!'}

This tests if browser applies any
color management to SVG rendering.
═══════════════════════════════════
`.trim()
                  
                  console.log(report)
                  alert(report)
                }
                img.src = url
              }}
            >
              🧪 Test #808080 Render
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full h-5 text-[9px] mt-1"
              onClick={() => {
                // Test SVG gradient interpolation
                const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="10">
                  <defs>
                    <linearGradient id="testGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stop-color="#008080"/>
                      <stop offset="0.5" stop-color="#808080"/>
                      <stop offset="1" stop-color="#FF8080"/>
                    </linearGradient>
                  </defs>
                  <rect width="256" height="10" fill="url(#testGrad)"/>
                </svg>`
                
                const blob = new Blob([testSvg], { type: 'image/svg+xml' })
                const url = URL.createObjectURL(blob)
                
                const img = new Image()
                img.onload = () => {
                  const canvas = document.createElement('canvas')
                  canvas.width = 256
                  canvas.height = 10
                  const ctx = canvas.getContext('2d')!
                  ctx.drawImage(img, 0, 0)
                  
                  const data = ctx.getImageData(0, 0, 256, 1).data
                  
                  // Sample key positions
                  const samples = [
                    { pos: 0, expected: 0, name: 'Start (offset=0)' },
                    { pos: 64, expected: 64, name: '25% (offset=0.25)' },
                    { pos: 128, expected: 128, name: 'Center (offset=0.5)' },
                    { pos: 192, expected: 192, name: '75% (offset=0.75)' },
                    { pos: 255, expected: 255, name: 'End (offset=1)' },
                  ]
                  
                  const results = samples.map(s => {
                    const r = data[s.pos * 4]
                    const diff = r - s.expected
                    return `${s.name}:\n  R=${r} (expected ~${s.expected}, diff: ${diff >= 0 ? '+' : ''}${diff})`
                  })
                  
                  const report = `
═══ SVG GRADIENT INTERPOLATION TEST ═══

Testing linear gradient #008080 → #808080 → #FF8080:

${results.join('\n\n')}

If center ≠ 128, browser uses non-linear
interpolation (possibly sRGB gamma)!
═══════════════════════════════════════
`.trim()
                  
                  console.log(report)
                  alert(report)
                }
                img.src = url
              }}
            >
              📈 Test Gradient Interpolation
            </Button>
          </div>
        </div>
      )}

      <div className="p-2 border-t border-zinc-800 space-y-2">
        <div className="flex gap-1">
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" id="prev-img" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-6 text-[10px]"
              >
                <LayoutGrid className="w-3 h-3 mr-1" />
                Samples
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-300">
              {sampleImages.length === 0 ? (
                <DropdownMenuItem disabled>No samples found</DropdownMenuItem>
              ) : (
                [...sampleImages].sort((a, b) => a.order - b.order).map(s => (
                  <DropdownMenuItem 
                    key={s.id} 
                    onClick={() => loadSample(s.url, s.id)}
                    className={cn(
                      "text-[10px] gap-2",
                      activeSampleId === s.id && "bg-zinc-800 text-white"
                    )}
                  >
                    <img src={s.url} className="w-4 h-4 rounded-sm object-cover" alt="" />
                    {s.name}
                  </DropdownMenuItem>
                ))
              )}
              <div className="h-px bg-zinc-800 my-1" />
              <DropdownMenuItem 
                onClick={() => document.getElementById('prev-img')?.click()}
                className="text-[10px]"
              >
                <ImageIcon className="w-3 h-3 mr-2" />
                Upload Custom...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="h-6 px-1.5"
            title="Sync with Form defaults"
            onClick={() => {
              if (currentPreset) {
                setStrength(currentPreset.defaultStrength ?? 150)
                setScale(currentPreset.defaultScale ?? 100)
              }
            }}
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>

        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Strength</span>
            <span className="tabular-nums">{strength}</span>
          </div>
          <Slider min={-600} max={600} step={1} value={[strength]} onValueChange={([v]) => setStrength(v)} className="py-0.5" />
        </div>

        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Scale</span>
            <span className="tabular-nums">{scale}%</span>
          </div>
          <Slider min={10} max={300} step={1} value={[scale]} onValueChange={([v]) => setScale(v)} className="py-0.5" />
        </div>
      </div>
    </div>
  )
}
