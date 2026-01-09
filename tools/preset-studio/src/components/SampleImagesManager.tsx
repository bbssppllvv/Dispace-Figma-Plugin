import { useState, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, Upload, ChevronUp, ChevronDown } from 'lucide-react'

export function SampleImagesManager() {
  const { 
    sampleImages, 
    updateSampleImage, 
    reorderSampleImages, 
    uploadNewSample,
    removeSampleAsset,
  } = useStore()
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      await uploadNewSample(file, file.name)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const sortedSamples = [...sampleImages].sort((a, b) => a.order - b.order)

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return
    const newSamples = [...sortedSamples]
    const temp = newSamples[idx]
    newSamples[idx] = newSamples[idx - 1]
    newSamples[idx - 1] = temp
    
    // Update orders
    const updated = newSamples.map((s, i) => ({ ...s, order: i + 1 }))
    reorderSampleImages(updated)
  }

  const handleMoveDown = (idx: number) => {
    if (idx === sortedSamples.length - 1) return
    const newSamples = [...sortedSamples]
    const temp = newSamples[idx]
    newSamples[idx] = newSamples[idx + 1]
    newSamples[idx + 1] = temp
    
    // Update orders
    const updated = newSamples.map((s, i) => ({ ...s, order: i + 1 }))
    reorderSampleImages(updated)
  }

  const handleDelete = (sample: typeof sampleImages[0]) => {
    // Extract filename from URL or use id
    const urlParts = sample.url.split('/')
    const filename = urlParts[urlParts.length - 1]
    removeSampleAsset(filename)
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Sample Images</h1>
          <p className="text-sm text-zinc-500">
            These images are shown in the plugin's Empty State.
          </p>
        </div>
        
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <Button 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto pb-8">
        {sortedSamples.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-800 rounded-lg text-zinc-500">
            No sample images added yet.
          </div>
        ) : (
          sortedSamples.map((sample, idx) => (
            <Card key={sample.id} className="bg-zinc-900 border-zinc-800 group relative">
              <CardContent className="p-3 space-y-3">
                <div className="aspect-square bg-zinc-950 rounded overflow-hidden relative">
                  <img 
                    src={sample.url} 
                    alt={sample.name} 
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      size="icon" 
                      variant="destructive" 
                      className="h-7 w-7"
                      onClick={() => handleDelete(sample)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono w-4">#{sample.order}</span>
                    <Input
                      value={sample.name}
                      onChange={(e) => updateSampleImage(sample.id, { name: e.target.value })}
                      className="h-7 text-xs bg-zinc-800 border-zinc-700 focus:border-zinc-500"
                    />
                  </div>
                  
                  <div className="flex justify-between items-center pt-1">
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6" 
                        disabled={idx === 0}
                        onClick={() => handleMoveUp(idx)}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        disabled={idx === sortedSamples.length - 1}
                        onClick={() => handleMoveDown(idx)}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono truncate max-w-[120px]">
                      {sample.id}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

