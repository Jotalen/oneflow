"use client";
import { useId } from "react";
import { motion, type Transition } from "framer-motion";
import { SPRING } from "@/lib/motion";

/** Brand green of the logo's dot and bar. */
export const LOGO_GREEN = "#7CF2C0";

/**
 * Logo geometry, traced from brand/OneFlow_logo_1000.png (1000×1000 artboard).
 * Ring, three inflows merging at the hub, and the green outflow ending in a dot on the ring.
 */
export const LOGO = {
  viewBox: "90 90 820 820",
  ring: { cx: 480, cy: 500, r: 357, width: 50 },
  hub: { x: 470, y: 500 },
  dot: { x: 838, y: 500, r: 64 },
  barStart: 495,
  lineWidth: 34,
  barWidth: 50,
  inflows: [
    "M188 332 C290 332 330 470 470 500",
    "M148 500 H470",
    "M188 668 C290 668 330 530 470 500",
  ],
} as const;

/** The mark assembles at this size (scaled from its left edge) after the intro, then settles to its normal size. */
export const LAND_SCALE = 2.4;
/** Seconds the landing sequence takes, from touchdown to normal size. */
export const LAND_SECONDS = 1.7;

/** Where an artboard point sits inside the rendered mark, as fractions of its box (for the intro hand-off). */
export function logoPointFraction(x: number, y: number): { fx: number; fy: number } {
  const [minX, minY, size] = LOGO.viewBox.split(" ").map(Number);
  return { fx: (x - minX) / size, fy: (y - minY) / size };
}

interface LogoMarkProps {
  className?: string;
  /** Play the landing sequence: big ring springs in, inflows draw on, the ball slides out to become the dot, then it all shrinks to size. */
  assemble?: boolean;
  /** Hide the mark while the intro ball is still in the air (keeps its box, so no layout shift). */
  hidden?: boolean;
}

const EASE_OUT: Transition["ease"] = [0.22, 1, 0.36, 1];
const DRAW: Transition = { duration: 0.5, ease: EASE_OUT };
const SLIDE: Transition = { duration: 0.6, ease: EASE_OUT, delay: 0.45 };
const SETTLE: Transition = { duration: LAND_SECONDS - 0.05, times: [0, 0.58, 1], ease: "easeInOut" };
const GLOW_FADE: Transition = { duration: LAND_SECONDS - 0.1, times: [0, 0.6, 1], ease: "easeOut" };

/** OneFlow mark as an inline SVG. Ring and inflows use currentColor; the outflow is brand green. */
export function LogoMark({ className = "", assemble = false, hidden = false }: LogoMarkProps) {
  const { ring, hub, dot, inflows } = LOGO;
  const glowId = `logo-glow-${useId().replace(/:/g, "")}`;
  const slideFrom = hub.x - dot.x;
  return (
    <motion.svg viewBox={LOGO.viewBox} className={className} aria-hidden fill="none"
      style={{ opacity: hidden ? 0 : 1, overflow: "visible", transformOrigin: "left center" }}
      initial={assemble ? { scale: LAND_SCALE } : false} animate={{ scale: assemble ? [LAND_SCALE, LAND_SCALE, 1] : 1 }} transition={assemble ? SETTLE : SPRING}>
      <defs>
        <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="38" /></filter>
      </defs>
      <motion.circle cx={ring.cx} cy={ring.cy} r={ring.r} stroke="currentColor" strokeWidth={ring.width}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={assemble ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={SPRING} />
      {inflows.map((d, i) => (
        <motion.path key={d} d={d} stroke="currentColor" strokeWidth={LOGO.lineWidth} strokeLinecap="round"
          initial={assemble ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ ...DRAW, delay: 0.15 + i * 0.07 }} />
      ))}
      <motion.line x1={LOGO.barStart} y1={hub.y} x2={dot.x} y2={dot.y} stroke={LOGO_GREEN} strokeWidth={LOGO.barWidth} strokeLinecap="round"
        initial={assemble ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={SLIDE} />
      {assemble && (
        <motion.circle cx={dot.x} cy={dot.y} r={dot.r * 2.4} fill="#39FF88" filter={`url(#${glowId})`}
          initial={{ x: slideFrom, opacity: 0.95 }} animate={{ x: 0, opacity: [0.95, 0.95, 0] }} transition={{ x: SLIDE, opacity: GLOW_FADE }} />
      )}
      <motion.circle cx={dot.x} cy={dot.y} r={dot.r} fill={LOGO_GREEN}
        initial={assemble ? { x: slideFrom } : false} animate={{ x: 0 }} transition={SLIDE} />
    </motion.svg>
  );
}
