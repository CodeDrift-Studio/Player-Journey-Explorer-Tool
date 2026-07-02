/**
 * Temporary placeholder screen.
 *
 * Its only job right now is to VERIFY the toolchain: if this renders with a
 * gradient title, rounded card, and colored badge, then React + TypeScript +
 * Vite + Tailwind are all wired correctly. We replace this in Phase 2 with the
 * real map viewport.
 */
function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="bg-gradient-to-r from-indigo-400 to-fuchsia-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
        LILA BLACK
      </h1>
      <p className="text-lg text-slate-400">Player Journey Explorer</p>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Toolchain verified: React + TypeScript + Vite + Tailwind
        </span>
      </div>
    </div>
  )
}

export default App
