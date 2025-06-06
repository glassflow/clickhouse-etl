import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { Plus, Clock, Trash2 } from 'lucide-react'
import { getConfigurations, deleteConfiguration, restoreConfiguration } from '@/src/utils/storage'
import { SavedConfiguration } from '@/src/utils/storage'
import { useStore } from '@/src/store'
import { cn } from '@/src/utils'

export function SavedConfigurations() {
  const router = useRouter()
  const [configurations, setConfigurations] = useState<SavedConfiguration[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load configurations from local storage
    const loadConfigurations = () => {
      try {
        const savedConfigs = getConfigurations()
        setConfigurations(savedConfigs)
      } catch (error) {
        console.error('Error loading configurations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadConfigurations()
  }, [])

  const handleCreateNew = () => {
    router.push('/kafka')
  }

  const handleLoadConfiguration = (config: SavedConfiguration) => {
    try {
      // Restore the complete state
      restoreConfiguration(config.id)

      const restoredState = useStore.getState()

      // Ensure we have a valid operation before navigating
      const { operationsSelected } = useStore.getState()
      if (!operationsSelected?.operation) {
        console.error('No operation type found in restored configuration. Full state:', restoredState)
        return
      }

      // Navigate to the create page
      router.push('/pipelines/create')
    } catch (error) {
      console.error('Error loading configuration:', error)
      // TODO: Track error
    }
  }

  const handleDeleteConfiguration = (id: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent triggering the card click
    try {
      const configToDelete = configurations.find((config) => config.id === id)
      deleteConfiguration(id)
      setConfigurations(configurations.filter((config) => config.id !== id))

      // Track configuration deletion
      if (configToDelete) {
        // TODO: Track configuration deletion
      }
    } catch (error) {
      console.error('Error deleting configuration:', error)
      // TODO: Track error
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (configurations.length === 0) {
    return null
  }

  return (
    <div className="w-full max-w-[512px] mx-auto px-0">
      <div className="flex justify-center items-center mb-8">
        <h1 className="text-2xl font-normal text-muted-foreground">Load Saved Configurations</h1>
      </div>

      {configurations.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">No saved configurations</h2>
          <p className="text-muted-foreground mb-4">Create your first pipeline configuration to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 w-full max-w-[512px]">
          {configurations.map((config) => (
            <div
              key={config.id}
              className={cn('content-card', 'btn-home-lg', 'cursor-pointer', 'relative', 'group')}
              onClick={() => handleLoadConfiguration(config)}
            >
              <div className="flex items-center px-6 w-full h-full">
                <div className="flex flex-col text-muted-foreground">
                  <span className="text-lg font-medium">{config.name}</span>
                  <div className="flex items-center text-sm text-muted-foreground mt-1">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>Saved {formatDate(config.timestamp)}</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-muted-foreground hover:text-destructive"
                onClick={(e) => handleDeleteConfiguration(config.id, e)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
