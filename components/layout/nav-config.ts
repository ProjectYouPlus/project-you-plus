export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const ROOT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/health", label: "Health", icon: "health" },
  { href: "/money", label: "Finance", icon: "finance" },
  { href: "/coach", label: "Coach", icon: "coach" },
  { href: "/you", label: "You", icon: "you" },
];

export const ORGANIZE_NAV: NavItem[] = [
  { href: "/goals", label: "Goals", icon: "goals" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/habits", label: "Habits", icon: "habits" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
];

export const HEALTH_NAV: NavItem[] = [
  { href: "/fitness", label: "Fitness", icon: "fitness" },
  { href: "/supplements", label: "Supplements", icon: "supplements" },
];

export const SYSTEM_NAV: NavItem[] = [
  { href: "/accountability", label: "Accountability", icon: "progress" },
  { href: "/reminders", label: "Alerts", icon: "calendar" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/review", label: "Weekly Review", icon: "review" },
  { href: "/integrations", label: "Integrations", icon: "integrations" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export const PLAN_NAV = ORGANIZE_NAV;
export const YOU_NAV = [...HEALTH_NAV, ...SYSTEM_NAV];
export const PRIMARY_NAV = ROOT_NAV;
export const SECONDARY_NAV = [...ORGANIZE_NAV, ...HEALTH_NAV];
export const UTILITY_NAV = SYSTEM_NAV;
export const MOBILE_PRIMARY_NAV = ROOT_NAV;

export type RootSection = "/dashboard" | "/health" | "/money" | "/coach" | "/you";

export function rootSectionForPath(pathname: string): RootSection {
  if (pathname.startsWith("/coach")) return "/coach";
  if (["/health", "/fitness", "/supplements"].some((path) => pathname.startsWith(path))) return "/health";
  if (["/money", "/finance"].some((path) => pathname.startsWith(path))) return "/money";
  if (["/goals", "/tasks", "/habits", "/calendar", "/plan", "/profile", "/settings", "/integrations", "/accountability", "/reminders", "/you"].some((path) => pathname.startsWith(path))) return "/you";
  return "/dashboard";
}
