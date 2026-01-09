import { useState, useMemo } from 'react'
import { useStore, useSortedCategories } from '@/hooks/useStore'
import { Input } from '@/components/ui/input'
import { Search, Crown, Trash2, Copy, Star, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function PresetList() {
  const { presets, currentPreset, selectPreset, duplicatePreset, deletePreset, isResourceMissing } = useStore()
  const categories = useSortedCategories()
  const [search, setSearch] = useState('')

  // Filter presets
  const filtered = useMemo(() => {
    return presets.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase())
    )
  }, [presets, search])

  // Group presets: Popular first (virtual), then by category order
  // Note: Popular presets ALSO appear in their own category
  const grouped = useMemo(() => {
    const groups: { id: string; name: string; presets: typeof presets }[] = []
    
    // Popular group (virtual category - always first)
    const popularPresets = filtered.filter(p => p.popular)
    if (popularPresets.length > 0) {
      groups.push({ id: '__popular__', name: '⭐ Popular', presets: popularPresets })
    }
    
    // Category groups (in order) - includes ALL presets in their category
    for (const cat of categories) {
      const catPresets = filtered.filter(p => p.category === cat.id)
      if (catPresets.length > 0) {
        groups.push({ id: cat.id, name: cat.name, presets: catPresets })
      }
    }
    
    // Uncategorized (presets with category not in list)
    const knownCatIds = new Set(categories.map(c => c.id))
    const uncategorized = filtered.filter(p => !knownCatIds.has(p.category))
    if (uncategorized.length > 0) {
      groups.push({ id: '__other__', name: 'Other', presets: uncategorized })
    }
    
    return groups
  }, [filtered, categories])

  const totalVisible = filtered.length
  
  // Check if preset has any missing resources
  const hasInvalidResources = (preset: typeof presets[0]) => {
    if (!preset.layers || preset.layers.length === 0) return false
    return preset.layers.some(layer => isResourceMissing(layer.src))
  }

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Search */}
      <div className="p-2 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 h-7 text-xs bg-zinc-800/50 border-zinc-700"
          />
        </div>
        <div className="text-[10px] text-zinc-500 mt-1.5 text-center">
          {totalVisible} / {presets.length}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-1.5">
        {grouped.length === 0 ? (
          <div className="text-center text-zinc-500 py-6 text-[11px]">
            No presets found
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.id} className="mb-2">
              <div className={cn(
                "text-[10px] font-medium uppercase tracking-wider px-1.5 py-1 rounded",
                group.id === '__popular__' ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500'
              )}>
                {group.name} ({group.presets.length})
              </div>
              <div className="space-y-px mt-0.5">
                {group.presets.map(preset => {
                  const isInvalid = hasInvalidResources(preset)
                  return (
                  <div
                    key={preset.id}
                    onClick={() => selectPreset(preset.id)}
                    className={cn(
                      "group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer",
                      isInvalid && "border border-red-500/30 bg-red-950/10",
                      currentPreset?.id === preset.id
                        ? "bg-blue-600/20 text-blue-400"
                        : "hover:bg-zinc-800/60 text-zinc-300"
                    )}
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {preset.popular && group.id !== '__popular__' && (
                          <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                        )}
                        {isInvalid && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Missing resources! Cannot save.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <span className="font-medium truncate">{preset.name}</span>
                        {preset.premium && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {preset.layers?.length || 0}L • {preset.defaultScale}%
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); duplicatePreset(preset.id) }}
                        className="p-1 hover:bg-zinc-700 rounded"
                        title="Duplicate"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deletePreset(preset.id) }}
                        className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
