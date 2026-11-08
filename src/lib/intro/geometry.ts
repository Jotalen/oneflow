/**
 * Intro animation geometry and timing (pure, no DOM). Traced from the reference frames in
 * brand/intro_frames (2560×1430, 24fps): three inflows merge at ~58.5% width, then one line
 * curves up toward the right edge.
 */
export interface Pt { x: number; y: number }
export interface Cubic { p0: Pt; p1: Pt; p2: Pt; p3: Pt }
/** Points along a curve with normalised cumulative arc length `s` (0 → 1). */
export interface SampledPath { pts: Pt[]; s: number[] }

export interface IntroScene {
  branches: Cubic[];
  out: Cubic;
  merge: Pt;
  end: Pt;
  branchPaths: SampledPath[];
  outPath: SampledPath;
}

/** Seconds. Lines draw on, balls travel (1.8s), the ball jumps to the logo, the logo assembles. */
export const TIMELINE = {
  draw: [0, 0.35],
  travel: [0.25, 2.05],
  jump: [2.05, 2.75],
  land: [2.75, 3.4],
} as const;
/** Share of the travel spent on the three inflows; the rest is the merged outflow. */
export const MERGE_SHARE = 0.55;
const SAMPLES = 160;

const MERGE_FX = 0.585;
const MID_FY = 0.516;
const TOP_FY = 0.336;
const BOTTOM_FY = 0.695;
const END_FX = 0.945;
const END_FY = 0.378;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function cubicAt(c: Cubic, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
  return { x: a * c.p0.x + b * c.p1.x + d * c.p2.x + e * c.p3.x, y: a * c.p0.y + b * c.p1.y + d * c.p2.y + e * c.p3.y };
}

export function samplePath(c: Cubic, n = SAMPLES): SampledPath {
  const pts = Array.from({ length: n + 1 }, (_, i) => cubicAt(c, i / n));
  const lens = pts.reduce<number[]>((acc, p, i) => {
    if (i === 0) return [0];
    const q = pts[i - 1];
    return [...acc, acc[i - 1] + Math.hypot(p.x - q.x, p.y - q.y)];
  }, []);
  const total = lens[lens.length - 1] || 1;
  return { pts, s: lens.map((l) => l / total) };
}

/** Point at normalised arc length s, interpolated between samples. */
export function pointAtS(p: SampledPath, s: number): Pt {
  const t = clamp01(s);
  const i = p.s.findIndex((v) => v >= t);
  if (i <= 0) return p.pts[0];
  const span = p.s[i] - p.s[i - 1] || 1;
  const k = (t - p.s[i - 1]) / span;
  return { x: lerp(p.pts[i - 1].x, p.pts[i].x, k), y: lerp(p.pts[i - 1].y, p.pts[i].y, k) };
}

function inflow(w: number, h: number, fy: number): Cubic {
  const merge = { x: MERGE_FX * w, y: MID_FY * h };
  return { p0: { x: 0, y: fy * h }, p1: { x: 0.3 * w, y: fy * h }, p2: { x: 0.38 * w, y: merge.y }, p3: merge };
}

export function buildScene(w: number, h: number): IntroScene {
  const merge = { x: MERGE_FX * w, y: MID_FY * h };
  const end = { x: END_FX * w, y: END_FY * h };
  const branches = [inflow(w, h, TOP_FY), inflow(w, h, MID_FY), inflow(w, h, BOTTOM_FY)];
  const out: Cubic = { p0: merge, p1: { x: 0.7 * w, y: merge.y }, p2: { x: 0.78 * w, y: end.y }, p3: end };
  return { branches, out, merge, end, branchPaths: branches.map((b) => samplePath(b)), outPath: samplePath(out) };
}

/** Travel progress u (0 → 1) mapped onto the paths: three balls before the merge, one after. */
export function ballPositions(scene: IntroScene, u: number): Pt[] {
  if (u <= MERGE_SHARE) return scene.branchPaths.map((p) => pointAtS(p, u / MERGE_SHARE));
  return [pointAtS(scene.outPath, (u - MERGE_SHARE) / (1 - MERGE_SHARE))];
}

export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Fraction (0 → 1) of a [start, end] window at time t. */
export const windowProgress = (t: number, [a, b]: readonly [number, number]): number => clamp01((t - a) / (b - a));

export const travelProgress = (t: number): number => easeInOut(windowProgress(t, TIMELINE.travel));

/** Quadratic arc from `from` to `to`, peaking `lift` px above the higher end. */
export function jumpPoint(from: Pt, to: Pt, lift: number, k: number): Pt {
  const c = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const u = 1 - k;
  return { x: u * u * from.x + 2 * u * k * c.x + k * k * to.x, y: u * u * from.y + 2 * u * k * c.y + k * k * to.y };
}
