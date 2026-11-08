"use client";
import { useState, type ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  eyebrow?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  expandable?: boolean;
  defaultExpanded?: boolean;
  expanded?: ReactNode;
  className?: string;
}

/** Glass card. Click the header to expand when `expandable`. */
export function Card({ title, eyebrow, right, children, expandable, defaultExpanded = false, expanded, className = "" }: CardProps) {
  const [open, setOpen] = useState(defaultExpanded);
  return (
    <section className={`glass glass-hover p-4 sm:p-5 ${open ? "sm:col-span-2 lg:col-span-3" : ""} ${className}`}>
      {(title || eyebrow || right) && (
        <header
          className={`flex items-start justify-between gap-3 ${expandable ? "cursor-pointer select-none" : ""}`}
          onClick={expandable ? () => setOpen((v) => !v) : undefined}
          aria-expanded={expandable ? open : undefined}
        >
          <div>
            {eyebrow && <div className="text-[0.7rem] uppercase tracking-wider text-muted">{eyebrow}</div>}
            {title && <h3 className="font-semibold leading-tight">{title}</h3>}
          </div>
          <div className="flex items-center gap-2">
            {right}
            {expandable && <span className="text-muted text-xs">{open ? "▲" : "▼"}</span>}
          </div>
        </header>
      )}
      <div className="mt-3">{children}</div>
      {open && expanded && <div className="mt-4 border-t border-line pt-4">{expanded}</div>}
    </section>
  );
}
