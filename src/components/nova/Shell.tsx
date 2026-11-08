"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MOBILE_TABS, NAV } from "@/lib/nav";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" || path.startsWith("/dashboard") : path.startsWith(href));

function NavLink({ href, label, path }: { href: string; label: string; path: string }) {
  const on = isActive(path, href);
  return (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${on ? "bg-line/70 font-semibold" : "text-fg/85 hover:bg-line/40"}`}>
      <span className={`h-3.5 w-3.5 rounded-[4px] border ${on ? "bg-ink border-ink" : "border-fg/40"}`} aria-hidden />
      {label}
    </Link>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2.5 py-1 font-semibold text-lg tracking-tight">
      <span className="h-7 w-7 rounded-lg bg-ink grid place-items-center text-ink-fg text-sm" aria-hidden>N</span>NovaBank
    </Link>
  );
}

/** Desktop sidebar + mobile bottom tabs around every page. */
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden md:flex flex-col gap-4 border-r border-line bg-surface px-3 py-5 sticky top-0 h-dvh overflow-y-auto">
        <Logo />
        <nav className="flex flex-col gap-4" aria-label="Main">
          {NAV.map((g, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {g.label && <div className="px-2.5 pb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-muted">{g.label}</div>}
              {g.items.map((it) => <NavLink key={it.href} {...it} path={path} />)}
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-3 flex flex-col gap-0.5">
          <NavLink href="/settings" label="Settings" path={path} />
        </div>
      </aside>
      <div className="min-w-0 flex flex-col">
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-28 md:pb-10"><div>{children}</div></main>
        <footer className="hidden md:block max-w-6xl mx-auto w-full px-6 pb-6 text-xs text-muted">
          Synthetic data. Not financial advice. Bank data: Capital One Nessie v2 · Vehicle data: Toyota Financial Services pack · HackUTD 2026.
        </footer>
      </div>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/95 backdrop-blur grid grid-cols-5 pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        {MOBILE_TABS.map((t) => {
          const on = t.href === "/more" ? path === "/more" : isActive(path, t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className="flex flex-col items-center gap-1 py-2 text-[0.68rem]">
              <span className={`h-5 w-5 rounded-md border ${on ? "bg-ink border-ink" : "border-fg/40"}`} aria-hidden />
              <span className={on ? "font-semibold" : "text-muted"}>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
