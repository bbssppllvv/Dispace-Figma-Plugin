import { useRef, useState } from 'react'
import { useStore, useTooltips } from '@/hooks/useStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Trash2, Info, Image as ImageIcon } from 'lucide-react'

const DEFAULT_TOOLTIPS = [
  { id: 'strength', label: 'Distortion Intensity', description: 'Controls how much the image is displaced by the map.' },
  { id: 'scale', label: 'Map Scale', description: 'Adjusts the size of the displacement map texture relative to the image.' },
  { id: 'soft', label: 'Softness', description: 'Applies a blur to the displacement map itself for smoother transitions.' },
  { id: 'chromatic', label: 'Chromatic Aberration', description: 'Separates color channels based on displacement intensity.' },
  { id: 'blur', label: 'Blur', description: 'Blurs the final displaced image.' },
  { id: 'noise', label: 'Dissolve Noise', description: 'Adds a noise-based dissolve effect to alpha channel.' },
  { id: 'grain', label: 'Grain', description: 'Adds film grain noise texture to the image.' },
  { id: 'grain-size', label: 'Grain Size', description: 'Controls the coarseness of the grain particles.' },
  { id: 'reflect-strength', label: 'Reflect Strength', description: 'Controls the intensity of the reflection highlights.' },
  { id: 'reflect-soft', label: 'Reflect Softness', description: 'Controls how much the light spreads over the surface.' },
  { id: 'reflect-sharp', label: 'Reflect Sharpness', description: 'Controls how focused the reflection highlights are.' }
]

export function TooltipManager() {
  const tooltips = useTooltips()
  const { updateTooltip, uploadTooltipImage, deleteTooltipImage } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Merge loaded tooltips with defaults to ensure all 11 are present
  const allTooltips = DEFAULT_TOOLTIPS.map(def => {
    const existing = tooltips.find(t => t.id === def.id)
    return existing || { ...def }
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeId) return

    setIsUploading(true)
    try {
      await uploadTooltipImage(file, activeId)
    } finally {
      setIsUploading(false)
      setActiveId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const triggerUpload = (id: string) => {
    setActiveId(id)
    fileInputRef.current?.click()
  }

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Tooltip Manager</h1>
          <p className="text-sm text-zinc-500">
            Configure the tooltips shown in the plugin's control panel.
          </p>
        </div>
        
        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <Info className="w-4 h-4 text-amber-500" />
          <div className="text-[11px] text-zinc-400">
            <span className="font-bold text-zinc-200">Recommended Image:</span> 200×120px (5:3), PNG/JPG/GIF
          </div>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-auto pb-12">
        {allTooltips.map((tooltip) => (
          <Card key={tooltip.id} className="bg-zinc-900 border-zinc-800 flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-zinc-800 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-zinc-300">
                {tooltip.id.charAt(0).toUpperCase() + tooltip.id.slice(1).replace('-', ' ')}
              </CardTitle>
              <span className="text-[10px] font-mono text-zinc-600 px-1.5 py-0.5 bg-zinc-950 rounded">
                ID: {tooltip.id}
              </span>
            </CardHeader>
            <CardContent className="p-4 flex gap-4">
              <div className="flex-1 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Label</label>
                  <Input
                    value={tooltip.label}
                    onChange={(e) => updateTooltip(tooltip.id, { label: e.target.value })}
                    placeholder="Tooltip Title"
                    className="h-8 bg-zinc-800 border-zinc-700 text-xs"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Description</label>
                  <Textarea
                    value={tooltip.description}
                    onChange={(e) => updateTooltip(tooltip.id, { description: e.target.value })}
                    placeholder="Explain what this control does..."
                    className="min-h-[80px] bg-zinc-800 border-zinc-700 text-xs resize-none"
                  />
                </div>
              </div>

              <div className="w-40 flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Preview Image</label>
                <div className="aspect-[5/3] bg-zinc-950 rounded-md border border-zinc-800 overflow-hidden relative group">
                  {tooltip.imageUrl ? (
                    <>
                      <img 
                        src={tooltip.imageUrl} 
                        alt={tooltip.label}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                          onClick={() => triggerUpload(tooltip.id)}
                          disabled={isUploading}
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-red-400 hover:text-red-400 hover:bg-red-400/20"
                          onClick={() => deleteTooltipImage(tooltip.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <button 
                      onClick={() => triggerUpload(tooltip.id)}
                      disabled={isUploading}
                      className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 transition-all"
                    >
                      <ImageIcon className="w-6 h-6" />
                      <span className="text-[10px] font-medium">Upload Image</span>
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-zinc-600 leading-tight">
                  Will be shown above the description in the tooltip.
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}


