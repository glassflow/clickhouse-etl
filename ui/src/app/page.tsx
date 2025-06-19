export default function Home() {
  return (
    // <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] min-w-[1200px] max-w-[1200px] mx-auto">
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] min-w-[var(--main-container-width)] max-w-[var(--main-container-width)] mx-auto">
      <header className="row-start-1 w-full"></header>
      <main className="flex flex-col gap-[32px] row-start-2 items-center">{/* Your page content goes here */}</main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center w-full">
        <p>Glassflow Footer</p>
      </footer>
    </div>
  )
}
