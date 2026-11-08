import type { ReactNode } from "react";

/**
 * Hand-drawn 20x20 line icons for navigation, keyed by route. 1.5px stroke, rounded caps,
 * currentColor, so they follow whatever text colour the link has.
 */
const NAV_ICONS: Record<string, ReactNode> = {
  // Overview: dashboard tiles
  "/": <>
    <rect x="3" y="3" width="5.5" height="5.5" rx="1.5" />
    <rect x="11.5" y="3" width="5.5" height="5.5" rx="1.5" />
    <rect x="3" y="11.5" width="5.5" height="5.5" rx="1.5" />
    <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.5" />
  </>,
  // Day-to-day: a calendar day
  "/day-to-day": <>
    <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
    <path d="M3 8.5h14M7 3v3M13 3v3" />
    <path d="M9 12.75h2" />
  </>,
  // Accounts: bank building
  "/accounts": <path d="M3 7.5 10 3.5l7 4M3.5 7.5h13M5.5 10v4.5M10 10v4.5M14.5 10v4.5M3 16.5h14" />,
  // Solana: the three slanted bars
  "/solana": <path d="M6.5 4.5H17l-2.5 2.5H4zM4 8.75h10.5l2.5 2.5H6.5zM6.5 13H17l-2.5 2.5H4z" />,
  // Transactions: money in, money out
  "/transactions": <path d="M4 7h11.5M12.5 4l3 3-3 3M16 13H4.5M7.5 10l-3 3 3 3" />,
  // Budget: a pie split
  "/budget": <>
    <circle cx="10" cy="10" r="6.75" />
    <path d="M10 3.25V10h6.75" />
  </>,
  // Net worth: trending up
  "/net-worth": <path d="M3 14.5 7.5 10l3 3L17 6.5M12.5 6.5H17V11" />,
  // Savings goals: target
  "/goals": <>
    <circle cx="10" cy="10" r="6.75" />
    <circle cx="10" cy="10" r="3.5" />
    <circle cx="10" cy="10" r="0.5" />
  </>,
  // Safety net: shield
  "/safety-net": <path d="M10 3 4.5 5v4.5c0 3.5 2.4 6 5.5 7.5 3.1-1.5 5.5-4 5.5-7.5V5z" />,
  // What if: a path that forks into two outcomes
  "/what-if": <path d="M3.5 10h4c2.5 0 3.5-4.5 7.5-4.5M7.5 10c2.5 0 3.5 4.5 7.5 4.5M13 3.5l2 2-2 2M13 12.5l2 2-2 2" />,
  // Debt & liquidity: a drop
  "/debt": <path d="M10 3.25s-5 5.25-5 8.75a5 5 0 0 0 10 0c0-3.5-5-8.75-5-8.75z" />,
  // Credit score: gauge with needle
  "/credit": <path d="M3.5 14.5a6.5 6.5 0 1 1 13 0M10 14.5l3-4" />,
  // Car financing: car from the side
  "/car": <>
    <path d="M4.25 13.75H3v-3.25l1.8-3.6A1.5 1.5 0 0 1 6.14 6h7.72a1.5 1.5 0 0 1 1.34.83L17 10.5v3.25h-1.25M8.25 13.75h3.5M3 10.5h14" />
    <circle cx="6.25" cy="13.75" r="1.75" />
    <circle cx="13.75" cy="13.75" r="1.75" />
  </>,
  // House financing: house with a door
  "/house": <path d="M3 9.25 10 3.5l7 5.75M5 8v8.5h10V8M8.5 16.5v-4h3v4" />,
  // Settings: gear
  "/settings": <>
    <path d="M15.43 8.65L17.53 8.94L17.53 11.06L15.43 11.35L14.8 12.88L16.07 14.57L14.57 16.07L12.88 14.8L11.35 15.43L11.06 17.53L8.94 17.53L8.65 15.43L7.12 14.8L5.43 16.07L3.93 14.57L5.2 12.88L4.57 11.35L2.47 11.06L2.47 8.94L4.57 8.65L5.2 7.12L3.93 5.43L5.43 3.93L7.12 5.2L8.65 4.57L8.94 2.47L11.06 2.47L11.35 4.57L12.88 5.2L14.57 3.93L16.07 5.43L14.8 7.12Z" />
    <circle cx="10" cy="10" r="2.25" />
  </>,
  // More: three dots
  "/more": <>
    <circle cx="4.5" cy="10" r="0.75" />
    <circle cx="10" cy="10" r="0.75" />
    <circle cx="15.5" cy="10" r="0.75" />
  </>,
};

export function hasNavIcon(href: string): boolean {
  return Object.hasOwn(NAV_ICONS, href);
}

interface IconProps { className?: string; children: ReactNode }

/** Shared 20x20 line-icon frame. Decorative: the link or button carries the name. */
function Icon({ className = "h-5 w-5 shrink-0", children }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden focusable="false">
      {children}
    </svg>
  );
}

/** The icon for a nav route; renders nothing for an unknown route. */
export function NavIcon({ href, className }: { href: string; className?: string }) {
  const paths = NAV_ICONS[href];
  return paths ? <Icon className={className}>{paths}</Icon> : null;
}

/** Sidebar collapse toggle: panel with a chevron pointing the way it will move. */
export function SidebarToggleIcon({ collapsed, className }: { collapsed: boolean; className?: string }) {
  return (
    <Icon className={className}>
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d="M7.5 3.5v13" />
      <path d={collapsed ? "M11 8l2 2-2 2" : "M13 8l-2 2 2 2"} />
    </Icon>
  );
}
