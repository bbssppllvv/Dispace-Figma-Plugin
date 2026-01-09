import { useStore, useSortedCategories } from '@/hooks/useStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Image, Sparkles, ChevronDown, Settings, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function PresetForm() {
  const { currentPreset, updatePreset, addLayer, removeLayer, updateLayer, openAssetModal, openCategoryModal, assets, isResourceMissing } = useStore()
  const categories = useSortedCategories()
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (!currentPreset) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <h2 className="text-base font-medium text-zinc-400 mb-1">No Preset Selected</h2>
          <p className="text-xs text-zinc-500">Select or create a preset</p>
        </div>
      </div>
    )
  }

  const getAssetName = (src: string) => {
    if (!src) return 'Select...'
    if (src.startsWith('resource://')) {
      const id = src.replace('resource://', '')
      const asset = assets.find(a => a.id === id)
      return asset?.name || id
    }
    return src.split('/').pop() || src
  }

  const getAssetPreviewUrl = (src: string) => {
    if (!src) return null
    if (src.startsWith('resource://')) {
      const id = src.replace('resource://', '')
      const asset = assets.find(a => a.id === id)
      return asset?.url || null
    }
    return null
  }

  return (
    <div className="w-full max-w-xl space-y-3 text-xs">
      {/* Header */}
      <div className="pb-2 border-b border-zinc-800">
        <h2 className="text-lg font-semibold">{currentPreset.name}</h2>
        <p className="text-zinc-500 text-[11px]">ID: {currentPreset.id}</p>
      </div>

      {/* Basic Info */}
      <section className="space-y-1.5">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Basic</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-zinc-400">ID</Label>
            <Input
              value={currentPreset.id}
              onChange={e => updatePreset({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-') })}
              className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5"
            />
          </div>
          <div>
            <Label className="text-[10px] text-zinc-400">Name</Label>
            <Input
              value={currentPreset.name}
              onChange={e => updatePreset({ name: e.target.value })}
              className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5"
            />
          </div>
        </div>

        {/* Category Row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-zinc-400">Category</Label>
              <button 
                onClick={openCategoryModal}
                className="text-[9px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5"
              >
                <Settings className="w-2.5 h-2.5" /> Manage
              </button>
            </div>
            <Select
              value={currentPreset.category}
              onValueChange={v => updatePreset({ category: v })}
            >
              <SelectTrigger className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
                {categories.length === 0 && (
                  <SelectItem value="custom" disabled>No categories</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 pt-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="popular"
                checked={currentPreset.popular || false}
                onCheckedChange={checked => updatePreset({ popular: !!checked })}
                className="h-3 w-3"
              />
              <Label htmlFor="popular" className="text-[10px] text-amber-400 cursor-pointer">⭐ Popular</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="premium"
                checked={currentPreset.premium || false}
                onCheckedChange={checked => updatePreset({ premium: !!checked })}
                className="h-3 w-3"
              />
              <Label htmlFor="premium" className="text-[10px] text-zinc-400 cursor-pointer">👑 Premium</Label>
            </div>
          </div>
        </div>
      </section>

      {/* Default Settings */}
      <section className="space-y-1.5">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Defaults</h3>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] text-zinc-400">Scale %</Label>
            <Input
              type="number" min={1} max={300}
              value={currentPreset.defaultScale ?? 100}
              onChange={e => updatePreset({ defaultScale: parseInt(e.target.value) || 100 })}
              className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-zinc-400">Tex Scale</Label>
            <Select
              value={String(currentPreset.textureScale ?? 1)}
              onValueChange={v => updatePreset({ textureScale: parseFloat(v) })}
            >
              <SelectTrigger className="h-6 text-[11px] bg-zinc-900 border-zinc-700 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.5, 2, 3, 4, 5, 10].map(v => (
                  <SelectItem key={v} value={String(v)}>{v}x</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1 mt-1">
              {[0.5, 1, 2].map(v => (
                <button
                  key={v}
                  onClick={() => updatePreset({ textureScale: v })}
                  className={cn(
                    "flex-1 h-4 text-[9px] rounded border border-zinc-800 transition-colors",
                    currentPreset.textureScale === v ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "bg-zinc-900 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  {v}x
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-zinc-400">Strength</Label>
            <Input
              type="number" min={-600} max={600}
              value={currentPreset.defaultStrength ?? 150}
              onChange={e => updatePreset({ defaultStrength: parseInt(e.target.value) || 0 })}
              className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5"
            />
          </div>
        </div>
      </section>

      {/* Advanced Effect Settings */}
      <section className="space-y-1.5">
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-400"
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform", !showAdvanced && "-rotate-90")} />
          Advanced Effects
        </button>
        
        {showAdvanced && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div>
              <Label className="text-[10px] text-zinc-400">Chromatic</Label>
              <Input type="number" min={0} max={100}
                value={currentPreset.chromaticAberration ?? 0}
                onChange={e => updatePreset({ chromaticAberration: parseInt(e.target.value) || 0 })}
                className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Blur</Label>
              <Input type="number" min={0} max={50}
                value={currentPreset.blur ?? 0}
                onChange={e => updatePreset({ blur: parseInt(e.target.value) || 0 })}
                className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Soft</Label>
              <Input type="number" min={0} max={50}
                value={currentPreset.soft ?? 0}
                onChange={e => updatePreset({ soft: parseInt(e.target.value) || 0 })}
                className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Dissolve</Label>
              <Input type="number" min={0} max={100}
                value={currentPreset.dissolveStrength ?? 0}
                onChange={e => updatePreset({ dissolveStrength: parseInt(e.target.value) || 0 })}
                className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Grain</Label>
              <Input type="number" min={0} max={100}
                value={currentPreset.grain ?? 0}
                onChange={e => updatePreset({ grain: parseInt(e.target.value) || 0 })}
                className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Grain Size</Label>
              <Input type="number" min={1} max={100}
                value={currentPreset.grainSize ?? 50}
                onChange={e => updatePreset({ grainSize: parseInt(e.target.value) || 50 })}
                className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Reflect Op</Label>
              <Input type="number" min={0} max={100}
                value={currentPreset.reflectOpacity ?? 0}
                onChange={e => updatePreset({ reflectOpacity: parseInt(e.target.value) || 0 })}
                className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5" />
            </div>
            <div>
              <Label className="text-[10px] text-zinc-400">Reflect Sharp</Label>
              <Input type="number" min={0} max={100}
                value={currentPreset.reflectSharpness ?? 0}
                onChange={e => updatePreset({ reflectSharpness: parseInt(e.target.value) || 0 })}
                className="h-6 text-[11px] bg-zinc-900 border-zinc-700 mt-0.5" />
            </div>
          </div>
        )}
      </section>

      {/* Layers */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Layers ({currentPreset.layers?.length || 0})
          </h3>
          <Button size="sm" onClick={addLayer} className="h-5 text-[10px] px-2">
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>

        {(!currentPreset.layers || currentPreset.layers.length === 0) ? (
          <div className="border border-dashed border-zinc-700 rounded p-3 text-center">
            <Image className="w-5 h-5 text-zinc-600 mx-auto mb-1" />
            <p className="text-zinc-500 text-[10px]">No layers</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentPreset.layers.map((layer, index) => {
              const isMissing = isResourceMissing(layer.src)
              const isVisible = layer.visible !== false
              const previewUrl = getAssetPreviewUrl(layer.src)
              return (
              <div key={index} className={cn(
                "bg-zinc-900/50 border rounded p-2 transition-opacity",
                isMissing ? "border-red-500/50 bg-red-950/20" : "border-zinc-800",
                !isVisible && "opacity-50"
              )}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => updateLayer(index, 'visible', !isVisible)}
                      className={cn(
                        "p-0.5 rounded transition-colors",
                        isVisible 
                          ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10" 
                          : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700/50"
                      )}
                      title={isVisible ? "Hide layer" : "Show layer"}
                    >
                      {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <span className={cn(
                      "text-[10px] font-medium",
                      isVisible ? "text-zinc-400" : "text-zinc-600"
                    )}>Layer {index + 1}</span>
                    {isMissing && (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Resource not found! Select a valid asset.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <button onClick={() => removeLayer(index)} className="p-0.5 text-zinc-500 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Asset selector with preview */}
                <div className="flex gap-2 mb-1.5">
                  {/* Texture preview thumbnail */}
                  {previewUrl && (
                    <div className={cn(
                      "w-10 h-10 rounded border flex-shrink-0 overflow-hidden bg-zinc-800",
                      isMissing ? "border-red-500/50" : "border-zinc-700"
                    )}>
                      <img 
                        src={previewUrl} 
                        alt="Texture preview" 
                        className="w-full h-full object-cover"
                        style={{ imageRendering: 'auto' }}
                      />
                    </div>
                  )}
                  
                  <Button variant="outline" size="sm"
                    className={cn(
                      "flex-1 justify-start h-10 text-[10px]",
                      isMissing 
                        ? "bg-red-950/30 border-red-500/50 text-red-300 hover:bg-red-950/50" 
                        : "bg-zinc-800 border-zinc-700"
                    )}
                    onClick={() => openAssetModal(index)}
                  >
                    {isMissing ? (
                      <AlertTriangle className="w-3 h-3 mr-1 text-red-400" />
                    ) : !previewUrl ? (
                      <Image className="w-3 h-3 mr-1 text-zinc-500" />
                    ) : null}
                    <span className="truncate">{getAssetName(layer.src)}</span>
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-1 mb-1.5">
                  <Select value={layer.tiling || 'tiled'} onValueChange={v => updateLayer(index, 'tiling', v)}>
                    <SelectTrigger className="h-5 text-[10px] bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiled">Tiled</SelectItem>
                      <SelectItem value="stretched">Stretch</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={layer.scaleMode || 'uniform'} onValueChange={v => updateLayer(index, 'scaleMode', v)}>
                    <SelectTrigger className="h-5 text-[10px] bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uniform">Uniform</SelectItem>
                      <SelectItem value="xOnly">X Only</SelectItem>
                      <SelectItem value="yOnly">Y Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={layer.blendMode || 'normal'} onValueChange={v => updateLayer(index, 'blendMode', v === 'normal' ? undefined : v)}>
                    <SelectTrigger className="h-5 text-[10px] bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="multiply">Multiply</SelectItem>
                      <SelectItem value="screen">Screen</SelectItem>
                      <SelectItem value="overlay">Overlay</SelectItem>
                      <SelectItem value="color-burn">Burn</SelectItem>
                      <SelectItem value="hard-light">Hard</SelectItem>
                      <SelectItem value="soft-light">Soft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-zinc-400 w-10">Opacity</span>
                  <Slider min={0} max={100} step={1} value={[(layer.opacity ?? 1) * 100]}
                    onValueChange={([v]) => updateLayer(index, 'opacity', v / 100)} className="flex-1" />
                  <span className="text-[10px] text-zinc-500 w-7 text-right">{Math.round((layer.opacity ?? 1) * 100)}%</span>
                </div>

                <div className="grid grid-cols-2 gap-1 mb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 w-6">AlnX</span>
                    <Select value={layer.alignX || 'left'} onValueChange={v => updateLayer(index, 'alignX', v)}>
                      <SelectTrigger className="h-5 text-[10px] bg-zinc-800 border-zinc-700 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 w-6">AlnY</span>
                    <Select value={layer.alignY || 'top'} onValueChange={v => updateLayer(index, 'alignY', v)}>
                      <SelectTrigger className="h-5 text-[10px] bg-zinc-800 border-zinc-700 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="bottom">Bottom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 mb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 w-6">ScMlt</span>
                    <Input type="number" step="0.1" min="0.1" max="3" placeholder="1.0" value={layer.scaleMultiplier ?? ''}
                      onChange={e => updateLayer(index, 'scaleMultiplier', e.target.value === '' ? undefined : (parseFloat(e.target.value) || 1.0))}
                      className="h-5 text-[10px] bg-zinc-800 border-zinc-700 flex-1" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 w-6">OffX</span>
                    <Input type="number" value={layer.offsetX ?? 0}
                      onChange={e => updateLayer(index, 'offsetX', parseInt(e.target.value) || 0)}
                      className="h-5 text-[10px] bg-zinc-800 border-zinc-700 flex-1" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 w-6">OffY</span>
                    <Input type="number" value={layer.offsetY ?? 0}
                      onChange={e => updateLayer(index, 'offsetY', parseInt(e.target.value) || 0)}
                      className="h-5 text-[10px] bg-zinc-800 border-zinc-700 flex-1" />
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </section>
    </div>
  )
}
