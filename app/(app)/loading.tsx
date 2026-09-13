export default function AppLoading() {
  return <main className="py-mobile-shell space-y-5 md:py-shell-narrow" role="status" aria-label="Loading screen">
    <span className="sr-only">Loading your screen…</span>
    <div className="h-7 w-32 rounded-lg bg-white/10" />
    {[180, 240, 120].map((height, index) => <div key={index} aria-hidden="true" className="rounded-[28px] border border-white/5 bg-white/[.035]" style={{ height }} />)}
  </main>;
}
