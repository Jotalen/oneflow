"use client";
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

/** Where an artboard point sits inside the rendered mark, as fractions of its box (for the intro hand-off). */
export function logoPointFraction(x: number, y: number): { fx: number; fy: number } {
  const [minX, minY, size] = LOGO.viewBox.split(" ").map(Number);
  return { fx: (x - minX) / size, fy: (y - minY) / size };
}

interface LogoMarkProps {
  className?: string;
  /** Play the landing sequence: ring springs in, inflows draw on, the ball slides out to become the dot. */
  assemble?: boolean;
  /** Hide the mark while the intro ball is still in the air (keeps its box, so no layout shift). */
  hidden?: boolean;
}

const DRAW: Transition = { duration: 0.32, ease: [0.4, 0, 0.2, 1] };
const BAR_DELAY_S = 0.22;

/** OneFlow mark as an inline SVG. Ring and inflows use currentColor; the outflow is brand green. */
export function LogoMark({ className = "", assemble = false, hidden = false }: LogoMarkProps) {
  const { ring, hub, dot, inflows } = LOGO;
  return (
    <svg viewBox={LOGO.viewBox} className={className} aria-hidden fill="none" style={{ opacity: hidden ? 0 : 1, overflow: "visible" }}>
      <motion.circle cx={ring.cx} cy={ring.cy} r={ring.r} stroke="currentColor" strokeWidth={ring.width}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={assemble ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={SPRING} />
      {inflows.map((d, i) => (
        <motion.path key={d} d={d} stroke="currentColor" strokeWidth={LOGO.lineWidth} strokeLinecap="round"
          initial={assemble ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ ...DRAW, delay: 0.08 + i * 0.04 }} />
      ))}
      <motion.line x1={LOGO.barStart} y1={hub.y} x2={dot.x} y2={dot.y} stroke={LOGO_GREEN} strokeWidth={LOGO.barWidth} strokeLinecap="round"
        initial={assemble ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ ...SPRING, delay: BAR_DELAY_S }} />
      <motion.circle cx={dot.x} cy={dot.y} r={dot.r} fill={LOGO_GREEN}
        initial={assemble ? { x: hub.x - dot.x } : false} animate={{ x: 0 }} transition={{ ...SPRING, delay: BAR_DELAY_S }} />
    </svg>
  );
}
