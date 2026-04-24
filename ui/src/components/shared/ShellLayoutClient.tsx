'use client'

import { useState } from 'react'
import { AppSidebar } from '@/src/components/shared/AppSidebar'
import { CreatePipelineModal } from '@/src/components/common/CreatePipelineModal'

type ShellLayoutClientProps = {
  children: React.ReactNode
  aiEnabled?: boolean
}

export function ShellLayoutClient({ children, aiEnabled = false }: ShellLayoutClientProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar onCreateClick={() => setIsCreateModalOpen(true)} aiEnabled={aiEnabled} />
      <main className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="px-4 sm:px-8 lg:px-10 py-6 min-h-full">
          {children}
        </div>
      </main>
      <CreatePipelineModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        aiEnabled={aiEnabled}
      />
    </div>
  )
}
