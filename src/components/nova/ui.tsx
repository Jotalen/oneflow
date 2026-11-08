"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { fmtUSD, type Cents } from "@/lib/money";
import { TopActions } from "./TopActions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-07" → "Nov 7" (or "Nov 7, 2026" with year). */
export function fmtDate(iso: string, withYear = false): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ""}`;
}
/** "2026-11-07" → "Nov 2026". */
export const fmtMonth = (iso: string) => { const [y, m] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
/** Whole dollars: $13,124. */
export const fmtWhole = (c: Cents) => fmtUSD(Math.round(c / 100) * 100).replace(/\.00$/, "");
/** Signed money: +$12.00 / −$12.00. */
export const fmtSigned = (c: Cents) => `${c > 0 ? "+" : c < 0 ? "−" : ""}${fmtUSD(Math.abs(c))}`;

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {actions}
        <TopActions />
      </div>
    </header>
  );
}

export function Panel({ title, subtitle, right, children, className = "", href, dark }: { title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; href?: string; dark?: boolean }) {
  const body = (
    <section className={`${dark ? "bg-ink text-ink-fg rounded-2xl" : "panel"} p-4 sm:p-5 h-full ${href ? "hover:border-fg/40 transition-colors" : ""} ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            {title && <h2 className="font-semibold leading-tight">{title}</h2>}
            {subtitle && <p className={`text-xs mt-0.5 ${dark ? "opacity-70" : "text-muted"}`}>{subtitle}</p>}
          </div>
          {right && <div className="shrink-0 flex items-center gap-2 text-sm">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

/** Small grey tile used inside panels (wireframe "Left to spend" boxes). */
export function Tile({ label, value, note, dark }: { label: ReactNode; value: ReactNode; note?: ReactNode; dark?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${dark ? "bg-ink text-ink-fg" : "bg-surface-2"}`}>
      <div className={`text-xs ${dark ? "opacity-70" : "text-muted"}`}>{label}</div>
      <div className="text-lg font-semibold money leading-tight mt-0.5">{value}</div>
      {note && <div className={`text-[0.7rem] mt-0.5 ${dark ? "opacity-70" : "text-muted"}`}>{note}</div>}
    </div>
  );
}

export function Bar({ pct, tone = "ink", marker }: { pct: number; tone?: "ink" | "bad" | "muted"; marker?: number }) {
  const w = Math.max(0, Math.min(100, pct));
  const color = tone === "bad" ? "bg-bad" : tone === "muted" ? "bg-muted" : "bg-ink";
  return (
    <div className="relative h-2 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      {marker !== undefined && <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-fg" style={{ left: `${Math.max(0, Math.min(100, marker))}%` }} />}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "md" }: { value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-full bg-surface-2 p-1 gap-1" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}
          className={`rounded-full font-semibold ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${o.value === value ? "bg-ink text-ink-fg" : "text-fg/80 hover:text-fg"} disabled:opacity-40 disabled:cursor-not-allowed`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Row in a list: icon square, title/sub on the left, value on the right. */
export function Row({ title, sub, value, onClick, active, icon }: { title: ReactNode; sub?: ReactNode; value?: ReactNode; onClick?: () => void; active?: boolean; icon?: ReactNode }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`w-full text-left flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg ${onClick ? "hover:bg-surface-2" : ""} ${active ? "bg-surface-2" : ""}`}>
      <div className="h-9 w-9 shrink-0 rounded-lg bg-surface-2 border border-line grid place-items-center text-xs font-semibold text-muted">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{title}</div>
        {sub && <div className="text-xs text-muted truncate">{sub}</div>}
      </div>
      {value !== undefined && <div className="text-sm font-semibold money shrink-0">{value}</div>}
    </Tag>
  );
}

export function Money({ cents, className = "", signed }: { cents: Cents; className?: string; signed?: boolean }) {
  return <span className={`money ${className}`}>{signed ? fmtSigned(cents) : fmtUSD(cents)}</span>;
}

export function Delta({ text, down }: { text: string; down?: boolean }) {
  return <span className="text-xs text-muted">{down ? "↓" : "↑"} {text}</span>;
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="panel p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-surface-2 border border-line mb-3" />
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted mt-1 max-w-md mx-auto">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** First letters of a merchant/account, for the icon square. */
export const initials = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
