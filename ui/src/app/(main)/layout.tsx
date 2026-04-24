import { Suspense } from 'react'
import { Header } from '@/src/components/shared/Header'
import { HeaderWrapper } from '@/src/components/shared/HeaderWrapper'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeaderWrapper>
        <Suspense fallback={<header className="w-full shrink-0 h-14 bg-[var(--elevated-background)]" aria-hidden />}>
          <Header />
        </Suspense>
      </HeaderWrapper>
      <main className="flex flex-col w-full px-4 sm:px-8 lg:px-20 py-4 sm:py-8 overflow-x-hidden overflow-y-auto">
        <div className="grow container mx-auto px-4 sm:px-0">{children}</div>
      </main>
      <footer className="w-full px-4 sm:px-8 lg:px-20 py-4 sm:py-6 shrink-0">
        <div className="grow container mx-auto px-4 sm:px-0 flex gap-6 flex-wrap items-center justify-center">
          {/* <GlobalFooter /> */}
        </div>
      </footer>
    </>
  )
}
