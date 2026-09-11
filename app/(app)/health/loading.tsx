export default function HealthLoading() {
  return (
    <main
      className="py-mobile-shell space-y-5 md:py-shell-narrow"
      aria-label="Loading Health"
    >
      {[160, 240, 180, 140, 120].map((height, i) => (
        <div
          key={i}
          className="py-glass-soft animate-pulse"
          style={{ height }}
        />
      ))}
    </main>
  );
}
