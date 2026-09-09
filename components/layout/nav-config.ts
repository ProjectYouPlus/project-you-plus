export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const ROOT_NAV: NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/plan", label: "Plan", icon: "plan" },
  { href: "/coach", label: "Coach", icon: "coach" },
  { href: "/you", label: "You", icon: "you" },
];

export const PLAN_NAV: NavItem[] = [
  { href: "/goals", label: "Goals", icon: "goals" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
];

export const YOU_NAV: NavItem[] = [
  { href: "/health", label: "Health", icon: "health" },
  { href: "/fitness", label: "Fitness", icon: "fitness" },
  { href: "/money", label: "Money", icon: "money" },
  { href: "/habits", label: "Habits", icon: "habits" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/review", label: "Weekly Review", icon: "review" },
  { href: "/integrations", label: "Integrations", icon: "integrations" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export const PRIMARY_NAV = ROOT_NAV;
export const SECONDARY_NAV = [...PLAN_NAV, ...YOU_NAV.slice(0, 5)];
export const UTILITY_NAV = YOU_NAV.slice(5);
export const MOBILE_PRIMARY_NAV = ROOT_NAV;

export function rootSectionForPath(pathname: string): "/today" | "/plan" | "/coach" | "/you" {
  if (pathname.startsWith("/coach")) return "/coach";
  if (["/goals", "/tasks", "/calendar", "/plan"].some((path) => pathname.startsWith(path))) return "/plan";
  if (["/health", "/fitness", "/money", "/habits", "/progress", "/review", "/integrations", "/profile", "/settings", "/you"].some((path) => pathname.startsWith(path))) return "/you";
  return "/today";
}
