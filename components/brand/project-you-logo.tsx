import { cn } from "@/lib/utils";

type LogoProps = { className?: string; markClassName?: string; compact?: boolean; showMark?: boolean };

export function ProjectYouLogo({ className, markClassName, compact = false, showMark = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="Project You+">
      {showMark && <ProjectYouMark className={markClassName} />}
      {!compact && (
        <div className="leading-none tracking-[-0.04em]">
          <span className="text-text-1">Project </span>
          <span className="text-accent">You+</span>
        </div>
      )}
    </div>
  );
}

export function ProjectYouMark({ className }: { className?: string }) {
  return (
    <img
      src="/project-you-plus-logo.svg"
      alt="Project You+"
      className={cn("h-8 w-8 shrink-0 object-contain", className)}
    />
  );
}
