import { cn } from "@/lib/utils";

type LogoProps = { className?: string; markClassName?: string; compact?: boolean };

export function ProjectYouLogo({ className, markClassName, compact = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="Project You+">
      <ProjectYouMark className={markClassName} />
      {!compact && <div className="leading-none tracking-[-0.04em]"><span className="text-text-1">Project </span><span className="text-accent">You+</span></div>}
    </div>
  );
}

export function ProjectYouMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" role="img" aria-label="Project You+ mark" className={cn("h-7 w-7 shrink-0", className)} fill="none">
      <defs><linearGradient id="py-official-mark" x1="80" y1="94" x2="365" y2="370" gradientUnits="userSpaceOnUse"><stop stopColor="#A78BFA"/><stop offset="0.52" stopColor="#8B5CF6"/><stop offset="1" stopColor="#7C3AED"/></linearGradient></defs>
      <path d="M80 112L216 257L381 84L305 181L305 329L232 425L232 376L80 220V112Z" fill="url(#py-official-mark)"/>
      <path d="M232 257L305 181V329L232 425V257Z" fill="#7C3AED"/>
      <rect x="364" y="306" width="97" height="32" rx="16" fill="#A78BFA"/>
      <rect x="396.5" y="273.5" width="32" height="97" rx="16" fill="#A78BFA"/>
    </svg>
  );
}
