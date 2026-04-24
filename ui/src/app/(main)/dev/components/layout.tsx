import { GalleryNav } from './GalleryNav'

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-8 min-h-[calc(100vh-6rem)]">
      <aside className="w-52 shrink-0">
        <GalleryNav />
      </aside>
      <main className="flex-1 min-w-0 pb-16">{children}</main>
    </div>
  )
}
