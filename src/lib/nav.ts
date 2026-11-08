/** Sidebar / mobile navigation, in wireframe order. */
export interface NavItem { href: string; label: string }
export interface NavGroup { label?: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { items: [{ href: "/", label: "Overview" }] },
  { label: "Everyday", items: [
    { href: "/day-to-day", label: "Day-to-day" },
    { href: "/accounts", label: "Accounts" },
    { href: "/solana", label: "Solana" },
    { href: "/transactions", label: "Transactions" },
    { href: "/budget", label: "Budget" },
  ] },
  { label: "Wealth", items: [
    { href: "/net-worth", label: "Net worth" },
    { href: "/goals", label: "Savings goals" },
    { href: "/safety-net", label: "Safety net" },
    { href: "/what-if", label: "What if" },
  ] },
  { label: "Borrowing", items: [
    { href: "/debt", label: "Debt & liquidity" },
    { href: "/credit", label: "Credit score" },
    { href: "/car", label: "Car financing" },
    { href: "/house", label: "House financing" },
  ] },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings" };
export const MORE_ITEM: NavItem = { href: "/more", label: "More" };

/** Mobile bottom bar: four destinations plus More. */
export const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/day-to-day", label: "Day-to-day" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budget", label: "Budget" },
  MORE_ITEM,
];

/** Whether `href` is the current section. Overview also owns the dashboard editor. */
export function isNavActive(path: string, href: string): boolean {
  if (href === "/") return path === "/" || path === "/dashboard" || path.startsWith("/dashboard/");
  return path === href || path.startsWith(`${href}/`);
}

/** Desktop sidebar collapse choice, saved on this device. */
export const SIDEBAR_KEY = "nova:sidebar-collapsed";
export const SIDEBAR_EVENT = "nova:sidebar";

export function parseCollapsed(raw: string | null): boolean {
  return raw === "true";
}

/**
 * Runs in <head> before first paint so a collapsed rail renders collapsed from the start
 * (CSS keys the rail width off html[data-sidebar="collapsed"]).
 */
export const SIDEBAR_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_KEY)})==="true")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;
