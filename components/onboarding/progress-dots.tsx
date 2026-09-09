export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-8 flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-full transition-colors"
          style={{ background: i <= step ? "var(--accent)" : "var(--border)" }}
        />
      ))}
    </div>
  );
}
