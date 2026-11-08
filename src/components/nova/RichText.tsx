import type { ReactNode } from "react";
import { parseBlocks, parseInline, type Inline } from "@/lib/text/markdown";

function inline(parts: Inline[]): ReactNode[] {
  return parts.map((p, i) =>
    p.kind === "bold" ? <strong key={i} className="font-semibold">{p.text}</strong>
    : p.kind === "italic" ? <em key={i}>{p.text}</em>
    : p.kind === "code" ? <code key={i} className="rounded bg-surface px-1 text-[0.85em]">{p.text}</code>
    : <span key={i}>{p.text}</span>);
}

/** Renders a model reply's light Markdown as real formatting (React elements only, never raw HTML). */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {parseBlocks(text).map((b, i) => {
        if (b.kind === "heading" || b.kind === "para") return <p key={i} className={b.kind === "heading" ? "font-semibold" : undefined}>{inline(parseInline(b.text))}</p>;
        const items = b.items.map((it, j) => <li key={j}>{inline(parseInline(it))}</li>);
        return b.kind === "ul"
          ? <ul key={i} className="list-disc pl-5 space-y-1">{items}</ul>
          : <ol key={i} className="list-decimal pl-5 space-y-1">{items}</ol>;
      })}
    </div>
  );
}
