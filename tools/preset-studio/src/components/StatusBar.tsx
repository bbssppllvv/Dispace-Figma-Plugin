import { useEffect, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { AlertCircle, WifiOff, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatusBar() {
  const { error, clearError, hasUnsavedChanges } = useStore()
  const [isOnline, setIsOnline] = useState(true)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  // Check API connectivity
  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch('/api/local-assets', { 
          method: 'HEAD',
          cache: 'no-store'
        })
        setApiStatus(response.ok ? 'online' : 'offline')
      } catch {
        setApiStatus('offline')
      }
    }

    checkApi()
    const interval = setInterval(checkApi, 30000) // Check every 30s
    
    return () => clearInterval(interval)
  }, [])

  // Browser online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const showConnectionWarning = !isOnline || apiStatus === 'offline'

  return (
    <>
      {/* Connection Warning Banner */}
      {showConnectionWarning && (
        <div className="bg-red-900/90 border-b border-red-700 px-3 py-2 flex items-center gap-2 text-red-100">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium">
            {!isOnline 
              ? '⚠️ No internet connection - changes will NOT be saved!'
              : '⚠️ API server not responding - saving disabled!'
            }
          </span>
          <span className="text-xs opacity-75 ml-auto">
            Check that dev-server is running on port 3001
          </span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/90 border-b border-red-700 px-3 py-2 flex items-center gap-2 text-red-100">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium flex-1">
            ❌ Error: {error}
          </span>
          <button
            onClick={clearError}
            className="p-1 rounded hover:bg-red-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connection Status Indicator (small) */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10px] text-zinc-500">
        <div className={cn(
          "w-2 h-2 rounded-full",
          apiStatus === 'online' && isOnline ? "bg-green-500" : 
          apiStatus === 'checking' ? "bg-amber-500 animate-pulse" : "bg-red-500"
        )} />
        <span>
          {apiStatus === 'online' && isOnline ? 'Connected' : 
           apiStatus === 'checking' ? 'Connecting...' : 'Disconnected'}
        </span>
      </div>
    </>
  )
}

