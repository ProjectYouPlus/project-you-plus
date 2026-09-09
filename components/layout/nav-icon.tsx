const PATHS: Record<string, string> = {
  dashboard: "M4 4h6v6H4zM14 4h6v10h-6zM4 14h6v6H4zM14 18h6v2h-6z",
  today: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 3",
  goals: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  tasks: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  habits: "M22 12h-4l-3 9L9 3l-3 9H2",
  progress: "M3 3v18h18M7 15l4-4 3 3 5-6",
  coach: "M12 2a7 7 0 0 1 6.6 4.7A5.5 5.5 0 0 1 18 17H8a5 5 0 0 1-1.4-9.8A7 7 0 0 1 12 2zM9 12h.01M15 12h.01M10 16h4",
  health: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z",
  fitness: "M6.5 6.5l11 11M21 21l-1-1M4 4l-1-1M3.5 9.5l3-3 8 8-3 3zM14.5 3.5l-3 3M17 6l3-3M6 17l-3 3",
  money: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  finance: "M3 6h18M5 6V4h14v2M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18",
  supplements: "M8 3h8M9 3v4l-3 5a6 6 0 1 0 12 0l-3-5V3M8 13h8",
  integrations: "M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4",
  profile: "M20 21v-1a8 8 0 0 0-16 0v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  plan: "M4 5h16M4 12h10M4 19h16M18 9v6M15 12h6",
  you: "M20 21v-1a8 8 0 0 0-16 0v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  review: "M4 4h16v16H4zM8 9h8M8 13h5M8 17h7",
  alerts: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  accountability: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  schedule: "M4 6h16M4 12h10M4 18h16M18 9v6",
  more: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const d = PATHS[name] ?? PATHS.dashboard;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
