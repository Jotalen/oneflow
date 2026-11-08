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
    { href: "/rewards", label: "Rewards" },
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

/** Mobile bottom bar: four destinations plus More. */
export const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/day-to-day", label: "Day-to-day" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budget", label: "Budget" },
  { href: "/more", label: "More" },
];
