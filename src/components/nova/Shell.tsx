"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition, type ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import { MOBILE_TABS, NAV, SETTINGS_ITEM, SIDEBAR_EVENT, SIDEBAR_KEY, isNavActive, parseCollapsed, type NavItem } from "@/lib/nav";
import { useStoredValue, writeStored } from "@/lib/bank/storedValue";
import { SPRING, morphNameForPath, useIntroPhase } from "@/lib/motion";
import { LogoMark } from "@/components/brand/LogoMark";
import { IntroOverlay } from "@/components/intro/IntroOverlay";
import { NavIcon, SidebarToggleIcon } from "./icons";
import { AskAiPanel } from "@/components/chat/AskAiPanel";
import { GeminiMark } from "@/components/chat/GeminiMark";
import { openAskAi, useAskAiMode } from "@/components/chat/askAiStore";

const SIDEBAR_ID = "sidebar";

/**
 * Desktop rail collapse, saved on this device. Layout keys off html[data-sidebar], which the
 * head script sets before paint, so a saved collapsed rail never jumps on load.
 */
function useSidebarCollapsed() {
  const collapsed = useStoredValue(SIDEBAR_KEY, SIDEBAR_EVENT, parseCollapsed, false);
  const toggle = () => {
    const next = !collapsed;
    if (next) document.documentElement.dataset.sidebar = "collapsed";
    else delete document.documentElement.dataset.sidebar;
    writeStored(SIDEBAR_KEY, SIDEBAR_EVENT, next);
  };
  return { collapsed, toggle };
}

interface NavLinkProps { item: NavItem; path: string; collapsed: boolean }

function NavLink({ item, path, collapsed }: NavLinkProps) {
  const on = isNavActive(path, item.href);
  return (
    <Link href={item.href} aria-current={on ? "page" : undefined} title={collapsed ? item.label : undefined}
      className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm rail-collapsed:justify-center rail-collapsed:px-0 rail-collapsed:py-2 ${on ? "font-semibold text-fg" : "text-fg/85 hover:bg-accent-soft/60"}`}>
      {/* One highlight pill that glides between items. */}
      {on && <motion.span layoutId="nav-pill" transition={SPRING} className="absolute inset-0 rounded-lg bg-accent-soft" aria-hidden />}
      <NavIcon href={item.href} className={`relative h-5 w-5 shrink-0 ${on ? "text-accent" : "text-muted"}`} />
      <span className="relative truncate rail-collapsed:sr-only">{item.label}</span>
    </Link>
  );
}

/** The intro ball lands on [data-logo-mark]; the mark stays hidden until then, then assembles. */
function Logo() {
  const phase = useIntroPhase();
  const inFlight = phase === "playing" || phase === "reveal";
  return (
    <Link href="/" className="flex items-center gap-2 px-2.5 py-1 font-semibold text-lg tracking-tight rail-collapsed:justify-center rail-collapsed:px-0">
      <span data-logo-mark className="h-7 w-7 shrink-0 grid place-items-center">
        <LogoMark key={inFlight ? "wait" : "show"} className="h-7 w-7" hidden={inFlight} assemble={phase === "landing"} />
      </span>
      {/* The wordmark waits until the big landing logo has settled, so the two never overlap. */}
      <span className={`rail-collapsed:sr-only transition-opacity duration-500 ${inFlight || phase === "landing" ? "opacity-0" : "opacity-100"}`}>OneFlow</span>
    </Link>
  );
}

/** Opens the Ask AI chat (over the sidebar, or full width when there is no room). */
function AskAiButton({ collapsed }: { collapsed: boolean }) {
  return (
    <button type="button" onClick={openAskAi} title={collapsed ? "Ask AI" : undefined}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-fg/85 hover:bg-accent-soft/60 rail-collapsed:justify-center rail-collapsed:px-0 rail-collapsed:py-2">
      <GeminiMark className="h-5 w-5 shrink-0" />
      <span className="truncate rail-collapsed:sr-only">Ask AI</span>
    </button>
  );
}

function CollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-controls={SIDEBAR_ID} aria-label={label} title={label}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-accent-soft/60 hover:text-fg rail-collapsed:justify-center rail-collapsed:px-0 rail-collapsed:py-2">
      <SidebarToggleIcon collapsed={collapsed} className="h-5 w-5 shrink-0" />
      <span className="rail-collapsed:sr-only" aria-hidden>Collapse</span>
    </button>
  );
}

function Sidebar({ path }: { path: string }) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const askAi = useAskAiMode();
  if (askAi === "docked") {
    return <aside id={SIDEBAR_ID} className="hidden md:flex flex-col border-r border-line bg-surface sticky top-0 h-dvh overflow-hidden"><AskAiPanel mode="docked" /></aside>;
  }
  return (
    <aside id={SIDEBAR_ID} className="hidden md:flex flex-col gap-4 border-r border-line bg-surface px-3 py-5 sticky top-0 h-dvh overflow-y-auto overflow-x-hidden rail-collapsed:px-2.5">
      <Logo />
      <nav className="flex flex-col gap-4 rail-collapsed:gap-2" aria-label="Main">
        {NAV.map((g, i) => (
          <div key={g.label ?? `group-${i}`} className="flex flex-col gap-0.5">
            {g.label && <div className="px-2.5 pb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-muted rail-collapsed:sr-only">{g.label}</div>}
            {g.label && <div className="hidden rail-collapsed:block mx-2 mb-1.5 border-t border-line" aria-hidden />}
            {g.items.map((it) => <NavLink key={it.href} item={it} path={path} collapsed={collapsed} />)}
            {i === 0 && <AskAiButton collapsed={collapsed} />}
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-line pt-3 flex flex-col gap-0.5">
        <CollapseButton collapsed={collapsed} onToggle={toggle} />
        <NavLink item={SETTINGS_ITEM} path={path} collapsed={collapsed} />
      </div>
    </aside>
  );
}

function MobileTabs({ path }: { path: string }) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/95 backdrop-blur grid grid-cols-5 pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      {MOBILE_TABS.map((t) => {
        const on = isNavActive(path, t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className="flex flex-col items-center gap-1 py-2 text-[0.68rem]">
            <NavIcon href={t.href} className={`h-5 w-5 ${on ? "text-accent" : "text-muted"}`} />
            <span className={on ? "font-semibold text-fg" : "text-muted"}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar (collapsible to an icon rail) + mobile bottom tabs around every page. */
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const askAi = useAskAiMode();
  return (
    <MotionConfig reducedMotion="user">
    <IntroOverlay />
    <div className={`min-h-dvh md:grid ${askAi === "docked" ? "md:grid-cols-[24rem_minmax(0,1fr)]" : "md:grid-cols-[15rem_minmax(0,1fr)] md:rail-collapsed:grid-cols-[4.25rem_minmax(0,1fr)]"}`}>
      <Sidebar path={path} />
      <div className="min-w-0 flex flex-col">
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-28 md:pb-10">
          {/* Route change: fade + 8px rise. If this page belongs to the card just opened, the card morphs into it. */}
          {/* Expanded Ask AI takes over this area; the page stays mounted underneath so nothing reloads. */}
          {askAi === "expanded" && <div className="panel h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3.75rem)] overflow-hidden p-0"><AskAiPanel mode="expanded" /></div>}
          <ViewTransition key={path} name={morphNameForPath(path)} share="card-morph" enter="page-in" exit="page-out" default="none">
            <div className={askAi === "expanded" ? "hidden" : undefined}>{children}</div>
          </ViewTransition>
        </main>
        <footer className="hidden md:block max-w-6xl mx-auto w-full px-6 pb-6 text-xs text-muted">
          Synthetic data. Not financial advice. Bank data: Capital One Nessie v2 · Vehicle data: Toyota Financial Services pack · HackUTD 2026.
        </footer>
      </div>
      <MobileTabs path={path} />
    </div>
    </MotionConfig>
  );
}
