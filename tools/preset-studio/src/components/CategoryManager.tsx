import { useState } from 'react'
import { useStore, useSortedCategories } from '@/hooks/useStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'

export function CategoryManager() {
  const { categoryModalOpen, closeCategoryModal, addCategory, updateCategory, deleteCategory, reorderCategory } = useStore()
  const categories = useSortedCategories()
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    if (newName.trim()) {
      addCategory(newName.trim())
      setNewName('')
    }
  }

  const handleMoveUp = (id: string) => {
    const idx = categories.findIndex(c => c.id === id)
    if (idx > 0) {
      const prevOrder = categories[idx - 1].order
      reorderCategory(id, prevOrder - 1)
    }
  }

  const handleMoveDown = (id: string) => {
    const idx = categories.findIndex(c => c.id === id)
    if (idx < categories.length - 1) {
      const nextOrder = categories[idx + 1].order
      reorderCategory(id, nextOrder + 1)
    }
  }

  return (
    <Dialog open={categoryModalOpen} onOpenChange={closeCategoryModal}>
      <DialogContent className="max-w-md bg-zinc-900 border-zinc-700 p-0">
        <DialogHeader className="p-3 border-b border-zinc-800">
          <DialogTitle className="text-sm">Manage Categories</DialogTitle>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Categories determine how presets are grouped. Order affects display in plugin.
          </p>
        </DialogHeader>

        <div className="p-3 space-y-3">
          {/* Add new category */}
          <div className="flex gap-2">
            <Input
              placeholder="New category name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="h-7 text-xs bg-zinc-800 border-zinc-700 flex-1"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()} className="h-7 text-xs px-3">
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>

          {/* Category list */}
          <div className="space-y-1 max-h-64 overflow-auto">
            {/* Popular info */}
            <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400">
              <span className="font-medium">⭐ Popular</span>
              <span className="text-zinc-400">— virtual category, set via preset "Popular" checkbox</span>
            </div>

            {categories.length === 0 ? (
              <div className="text-center text-zinc-500 py-4 text-xs">
                No categories. Add one above.
              </div>
            ) : (
              categories.map((cat, idx) => (
                <div 
                  key={cat.id}
                  className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800/50 border border-zinc-700 rounded group"
                >
                  <GripVertical className="w-3 h-3 text-zinc-600" />
                  
                  <span className="text-[10px] text-zinc-500 w-5">{idx + 1}.</span>
                  
                  <Input
                    value={cat.name}
                    onChange={e => updateCategory(cat.id, { name: e.target.value })}
                    className="h-6 text-[11px] bg-transparent border-transparent hover:border-zinc-600 focus:border-zinc-500 px-1 flex-1"
                  />

                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleMoveUp(cat.id)}
                      disabled={idx === 0}
                      className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(cat.id)}
                      disabled={idx === categories.length - 1}
                      className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="text-[10px] text-zinc-500 border-t border-zinc-800 pt-2">
            Tip: Category order here = order in plugin's preset gallery
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

