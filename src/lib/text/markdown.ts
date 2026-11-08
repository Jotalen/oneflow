/**
 * Minimal, safe Markdown for model replies: **bold**, *italic* / _italic_, `code`, headings, and
 * bullet/numbered lists. Produces plain data that the UI turns into React elements, never HTML.
 */
export type Inline = { kind: "text" | "bold" | "italic" | "code"; text: string };
export type Block =
  | { kind: "para"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: s.slice(last, at) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "code", text: m[2] });
    else out.push({ kind: "italic", text: (m[3] ?? m[4])! });
    last = at + m[0].length;
  }
  if (last < s.length) out.push({ kind: "text", text: s.slice(last) });
  return out;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const b = line.match(BULLET), n = line.match(NUMBERED), h = line.match(HEADING);
    const prev = blocks[blocks.length - 1];
    if (b) {
      if (prev?.kind === "ul") prev.items.push(b[1]); else blocks.push({ kind: "ul", items: [b[1]] });
    } else if (n) {
      if (prev?.kind === "ol") prev.items.push(n[1]); else blocks.push({ kind: "ol", items: [n[1]] });
    } else if (h) {
      blocks.push({ kind: "heading", text: h[1] });
    } else {
      blocks.push({ kind: "para", text: line.trim() });
    }
  }
  return blocks;
}
