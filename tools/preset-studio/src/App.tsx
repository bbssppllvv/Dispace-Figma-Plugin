import { useEffect, useCallback, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { PresetList } from '@/components/PresetList'
import { PresetForm } from '@/components/PresetForm'
import { PreviewPanel } from '@/components/PreviewPanel'
import { AssetModal } from '@/components/AssetModal'
import { CategoryManager } from '@/components/CategoryManager'
import { SampleImagesManager } from '@/components/SampleImagesManager'
import { TooltipManager } from '@/components/TooltipManager'
import { StatusBar } from '@/components/StatusBar'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Save, Plus, RefreshCw, Layers, Image as ImageIcon, MessageSquare } from 'lucide-react'

function AppContent() {
  const [view, setView] = useState<'presets' | 'samples' | 'tooltips'>('presets')
  const { 
    loadPresets, 
    loadAssets, 
    savePresets,
    createPreset,
    isLoading, 
    isSaving,
    hasUnsavedChanges,
    presets,
    assets,
    assetModalOpen,
    categoryModalOpen,
    error,
    clearError,
  } = useStore()

  const { addToast } = useToast()

  // Load data on mount
  useEffect(() => {
    const init = async () => {
      try {
        await loadPresets()
        await loadAssets()
        // Get fresh counts from store after loading
        const state = useStore.getState()
        addToast({
          type: 'success',
          title: 'Data loaded',
          message: `${state.presets.length} presets, ${state.assets.length} assets`,
        })
      } catch (e) {
        addToast({
          type: 'error',
          title: 'Failed to load data',
          message: String(e),
        })
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show error toasts when error state changes
  useEffect(() => {
    if (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error,
        duration: 10000,
      })
    }
  }, [error, addToast])

  // Handle save with feedback
  const handleSave = useCallback(async () => {
    addToast({
      type: 'info',
      title: 'Saving...',
      message: `Saving ${presets.length} presets to server`,
      duration: 2000,
    })

    const success = await savePresets()
    
    if (success) {
      addToast({
        type: 'success',
        title: '✅ Saved successfully!',
        message: `${presets.length} presets deployed to GitHub/CDN`,
      })
    } else {
      addToast({
        type: 'error',
        title: '❌ Save failed!',
        message: 'Your changes were NOT saved. Check the connection and try again.',
        duration: 10000,
      })
    }
  }, [savePresets, presets.length, addToast])

  // Handle refresh with feedback
  const handleRefresh = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Refreshing will lose them. Continue?'
      )
      if (!confirmed) return
    }

    addToast({
      type: 'info',
      title: 'Refreshing...',
      duration: 1500,
    })

    await loadPresets()
    await loadAssets()

    // Get fresh counts from store after loading
    const state = useStore.getState()
    addToast({
      type: 'success',
      title: 'Data refreshed',
      message: `${state.presets.length} presets, ${state.assets.length} assets`,
    })
  }, [loadPresets, loadAssets, hasUnsavedChanges, addToast])

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 relative">
      {/* Status Bar - connection warnings and errors */}
      <StatusBar />

      {/* Header */}
      <header className="h-10 border-b border-zinc-800 flex items-center justify-between px-3 bg-zinc-900/50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">Preset Studio</span>
          
          <div className="flex bg-zinc-800/50 p-0.5 rounded-md">
            <button 
              onClick={() => setView('presets')}
              className={`flex items-center px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                view === 'presets' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3 h-3 mr-1.5" />
              Presets
            </button>
            <button 
              onClick={() => setView('samples')}
              className={`flex items-center px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                view === 'samples' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ImageIcon className="w-3 h-3 mr-1.5" />
              Samples
            </button>
            <button 
              onClick={() => setView('tooltips')}
              className={`flex items-center px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                view === 'tooltips' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="w-3 h-3 mr-1.5" />
              Tooltips
            </button>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800" />

          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={createPreset} className="h-6 px-2 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              New
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleRefresh} 
              disabled={isLoading} 
              className="h-6 px-2 text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          {hasUnsavedChanges && (
            <span className="text-amber-400 text-[10px] font-semibold animate-pulse">
              ● UNSAVED CHANGES
            </span>
          )}
          <span className="text-zinc-500">{assets.length} assets</span>
          <span className="text-zinc-500">{presets.length} presets</span>
          <Button 
            size="sm" 
            onClick={handleSave} 
            disabled={isSaving || !hasUnsavedChanges} 
            className={`h-6 px-2 text-xs ${hasUnsavedChanges ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
          >
            <Save className="w-3 h-3 mr-1" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {view === 'presets' ? (
          <>
            {/* Left: Preset List */}
            <aside className="w-56 border-r border-zinc-800 flex flex-col bg-zinc-900/30 flex-shrink-0">
              <PresetList />
            </aside>

            {/* Center: Preset Editor */}
            <main className="flex-1 overflow-auto p-4 bg-zinc-950 min-w-0 flex justify-center">
              <PresetForm />
            </main>

            {/* Right: Preview - responsive width */}
            <aside className="w-72 lg:w-80 xl:w-96 2xl:w-[420px] border-l border-zinc-800 flex flex-col bg-zinc-900/30 flex-shrink-0">
              <PreviewPanel />
            </aside>
          </>
        ) : view === 'samples' ? (
          <main className="flex-1 overflow-auto bg-zinc-950">
            <SampleImagesManager />
          </main>
        ) : (
          <main className="flex-1 overflow-auto bg-zinc-950">
            <TooltipManager />
          </main>
        )}
      </div>

      {/* Modals */}
      {assetModalOpen && <AssetModal />}
      {categoryModalOpen && <CategoryManager />}
    </div>
  )
}

export function App() {
  return (
    <TooltipProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </TooltipProvider>
  )
}
