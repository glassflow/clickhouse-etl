'use client'

import { useState } from 'react'
import { AppTopbar } from '@/src/components/shared/AppTopbar'
import { CreatePipelineModal } from '@/src/components/common/CreatePipelineModal'

type ShellLayoutClientProps = {
  children: React.ReactNode
  aiEnabled?: boolean
}

export function ShellLayoutClient({ children, aiEnabled = false }: ShellLayoutClientProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen w-full">
      <AppTopbar onCreateClick={() => setIsCreateModalOpen(true)} />
      <main className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="px-4 sm:px-8 lg:px-10 py-6 min-h-full max-w-[var(--shell-max-width)] mx-auto w-full">
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
