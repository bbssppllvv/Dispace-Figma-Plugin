import { useState, useMemo } from 'react'
import { useStore } from '@/hooks/useStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Upload, X, Loader2, FileImage, MousePointer2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Asset } from '@/lib/types'

export function AssetModal() {
  const { 
    assets, 
    assetModalOpen, 
    closeAssetModal, 
    selectAsset, 
    uploadNewAsset, 
    removeAsset,
    currentPreset,
    currentLayerIndex
  } = useStore()
  
  const [search, setSearch] = useState('')
  const [type, setType] = useState<string>('all')
  const [sort, setSort] = useState<'name' | 'size'>('name')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null)

  // Derive current asset ID from store
  const currentAssetSrc = useMemo(() => {
    if (currentPreset && currentLayerIndex !== null) {
      return currentPreset.layers[currentLayerIndex]?.src || ''
    }
    return ''
  }, [currentPreset, currentLayerIndex])

  const currentAssetId = useMemo(() => {
    if (currentAssetSrc.startsWith('resource://')) {
      return currentAssetSrc.replace('resource://', '')
    }
    return ''
  }, [currentAssetSrc])

  const filtered = useMemo(() => {
    let result = [...assets]
    if (search) result = result.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    if (type !== 'all') result = result.filter(a => a.type === type)
    result.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : (b.size || 0) - (a.size || 0))
    return result
  }, [assets, search, type, sort])

  const hoveredAsset = useMemo(() => 
    assets.find(a => a.id === hoveredAssetId) || assets.find(a => a.id === currentAssetId),
  [assets, hoveredAssetId, currentAssetId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setIsUploading(true)
    setUploadProgress({ current: 0, total: files.length })
    
    // Upload files sequentially to avoid overwhelming the server
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadProgress({ current: i + 1, total: files.length })
      try {
        await uploadNewAsset(file, file.name)
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
      }
    }
    
    setIsUploading(false)
    setUploadProgress({ current: 0, total: 0 })
    e.target.value = ''
  }

  return (
    <Dialog open={assetModalOpen} onOpenChange={closeAssetModal}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-zinc-900 border-zinc-700 p-0">
        <DialogHeader className="p-3 border-b border-zinc-800">
          <DialogTitle className="text-sm font-medium">Select Asset</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col border-r border-zinc-800">
            {/* Filters */}
            <div className="flex gap-2 p-2 border-b border-zinc-800 bg-zinc-900/50">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <Input
                  placeholder="Search assets..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-7 h-7 text-xs bg-zinc-800 border-zinc-700 focus-visible:ring-blue-500"
                />
              </div>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-24 h-7 text-xs bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="svg">SVG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v: 'name' | 'size') => setSort(v)}>
                <SelectTrigger className="w-24 h-7 text-xs bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="size">Sort by Size</SelectItem>
                </SelectContent>
              </Select>
              <input type="file" accept=".svg,.png,.jpg" onChange={handleUpload} className="hidden" id="asset-up" multiple />
              <Button 
                size="sm" 
                variant="secondary"
                className="h-7 text-xs px-2" 
                onClick={() => document.getElementById('asset-up')?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    {uploadProgress.current}/{uploadProgress.total}
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3 mr-1" />
                    Upload
                  </>
                )}
              </Button>
            </div>

            <div className="text-[10px] text-zinc-500 px-3 py-1.5 bg-zinc-900/30 flex justify-between items-center">
              <span>{filtered.length} assets found</span>
              {currentAssetId && <span className="text-blue-400">Layer {currentLayerIndex !== null ? currentLayerIndex + 1 : ''} active</span>}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-3">
              <div className="grid grid-cols-4 gap-3">
                {filtered.map(asset => {
                  const isSelected = asset.id === currentAssetId;
                  const isHovered = asset.id === hoveredAssetId;
                  
                  return (
                    <div
                      key={asset.id}
                      onClick={() => selectAsset(asset.id)}
                      onMouseEnter={() => setHoveredAssetId(asset.id)}
                      onMouseLeave={() => setHoveredAssetId(null)}
                      className={cn(
                        "group relative aspect-square bg-zinc-800/50 rounded-lg cursor-pointer transition-all duration-200",
                        "border-2",
                        isSelected ? "border-blue-500 bg-blue-500/5" : "border-transparent hover:border-zinc-600 hover:bg-zinc-800"
                      )}
                    >
                      <img src={asset.url} alt={asset.name} className="w-full h-full object-contain p-2" loading="lazy" />
                      
                      {/* Selection Overlay */}
                      {isSelected && (
                        <div className="absolute top-1 left-1 bg-blue-500 text-[8px] font-bold px-1.5 py-0.5 rounded text-white shadow-lg">
                          CURRENT
                        </div>
                      )}

                      {/* Hover Info */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg">
                        <div className="text-[9px] text-white truncate font-medium">{asset.name}</div>
                      </div>

                      <button
                        onClick={e => { e.stopPropagation(); removeAsset(asset.name) }}
                        className="absolute top-1 right-1 w-5 h-5 bg-zinc-900/80 hover:bg-red-500 text-zinc-400 hover:text-white rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                        title="Delete asset"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <FileImage className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs">No assets found</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Preview */}
          <div className="w-72 bg-zinc-900/50 flex flex-col border-l border-zinc-800 overflow-y-auto">
            {hoveredAsset ? (
              <div className="p-4 flex flex-col h-full">
                <div className="aspect-square bg-zinc-800 rounded-lg border border-zinc-700 mb-4 overflow-hidden flex items-center justify-center p-4">
                  <img src={hoveredAsset.url} alt={hoveredAsset.name} className="max-w-full max-h-full object-contain drop-shadow-2xl" />
                </div>
                
                <div className="space-y-4 flex-1">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                      <Info className="w-3 h-3" /> Asset Details
                    </h3>
                    <div className="bg-zinc-800/50 rounded-md p-2 space-y-2">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">Name</span>
                        <span className="text-zinc-300 truncate ml-4 max-w-[140px]" title={hoveredAsset.name}>{hoveredAsset.name}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">Type</span>
                        <span className="text-zinc-300 uppercase">{hoveredAsset.type}</span>
                      </div>
                      {hoveredAsset.size && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-zinc-500">Size</span>
                          <span className="text-zinc-300">{(hoveredAsset.size / 1024).toFixed(1)} KB</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button 
                      className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                      onClick={() => selectAsset(hoveredAsset.id)}
                    >
                      {hoveredAsset.id === currentAssetId ? 'Keep Current' : 'Select Asset'}
                    </Button>
                    <p className="text-[9px] text-zinc-500 text-center mt-2">
                      Click tile or button to assign to layer
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                  <MousePointer2 className="w-5 h-5 text-zinc-600" />
                </div>
                <h3 className="text-xs font-medium text-zinc-400 mb-1">Preview Asset</h3>
                <p className="text-[10px] text-zinc-500">Hover over an asset in the grid to see details and a larger preview</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
