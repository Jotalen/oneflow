"use client";
import { animate, useInView } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactElement, type ReactNode, type RefObject } from "react";
import { formatCountUpToken, parseCountUp, type CountUpParts } from "@/lib/countup";
import { useIntroPhase } from "@/lib/motion";

const COUNT_DURATION_S = 0.8;
const COUNT_EASE = [0.2, 0.9, 0.3, 1] as const;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Strings already counted this session: navigating back shows them settled. Client-only (written in effects). */
const counted = new Set<string>();

type Stage = "idle" | "armed" | "running" | "done";

const prefersReducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION).matches;

/** Writes the number through React's own text node, so React's later updates still land. */
function setToken(el: HTMLElement, text: string): void {
  const node = el.firstChild;
  if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = text;
}

/** Shows 0 and pins the number's final width, so nothing around it moves while it counts. */
function hold(el: HTMLElement, parts: CountUpParts): void {
  el.style.removeProperty("min-width");
  setToken(el, parts.token);
  el.style.display = "inline-block";
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  setToken(el, formatCountUpToken(parts, 0));
}

function release(el: HTMLElement, token: string): void {
  el.style.removeProperty("display");
  el.style.removeProperty("min-width");
  setToken(el, token);
}

function useCountUp(ref: RefObject<HTMLSpanElement | null>, value: string, parts: CountUpParts): void {
  const stage = useRef<Stage>("idle");
  const latestToken = useRef(parts.token);
  const phase = useIntroPhase();
  const inView = useInView(ref, { once: true });
  const ready = inView && phase !== "playing";

  // Before paint on mount: zero the number so the first visible frame is not the final value.
  useLayoutEffect(() => {
    latestToken.current = parts.token;
    const el = ref.current;
    const canHold = stage.current === "idle" || stage.current === "armed";
    if (!el || !canHold || counted.has(value) || prefersReducedMotion()) return;
    hold(el, parts);
    stage.current = "armed";
  }, [ref, value, parts]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready || stage.current !== "armed") return;
    stage.current = "running";
    counted.add(value);
    const controls = animate(0, parts.value, {
      duration: COUNT_DURATION_S,
      ease: COUNT_EASE,
      onUpdate: (n) => setToken(el, formatCountUpToken(parts, n)),
      onComplete: () => {
        stage.current = "done";
        release(el, latestToken.current);
      },
    });
    return () => {
      controls.stop();
      if (stage.current === "running") stage.current = "armed";
    };
  }, [ref, ready, value, parts]);
}

function CountUpNumber({ value, parts }: { value: string; parts: CountUpParts }): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  useCountUp(ref, value, parts);
  return <>{parts.prefix}<span ref={ref}>{parts.token}</span>{parts.suffix}</>;
}

/**
 * Counts the first number in `value` up from 0 the first time it scrolls into view,
 * keeping its prefix, suffix, separators and decimals. Server render, reduced motion and
 * every later view show `value` exactly; the text always ends as `value`.
 */
export function CountUp({ value }: { value: string }): ReactElement {
  const parts = useMemo(() => parseCountUp(value), [value]);
  if (!parts) return <>{value}</>;
  return <CountUpNumber value={value} parts={parts} />;
}

/** Plain text of a node made only of strings and numbers (e.g. `{score} · {label}`), else null. */
export function countableText(node: ReactNode): string | null {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!Array.isArray(node)) return null;
  const items: readonly unknown[] = node;
  return items.every((x) => typeof x === "string" || typeof x === "number") ? items.join("") : null;
}

/** CountUp for text children; any other children render untouched. */
export function CountUpText({ children }: { children: ReactNode }): ReactNode {
  const text = countableText(children);
  return text === null ? children : <CountUp value={text} />;
}
