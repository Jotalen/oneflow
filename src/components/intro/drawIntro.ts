import {
  MERGE_SHARE,
  ballPositions,
  pointAtS,
  type IntroScene,
  type Pt,
  type SampledPath,
} from "@/lib/intro/geometry";

/** Canvas drawing for the intro overlay. The grey dot grid is CSS (see globals.css .intro-cover). */
export const NEON = "#39FF88";
export const DOT_SPACING = 32;
const GREY_LINE = "rgba(255,255,255,0.32)";
const LIT_RADIUS = DOT_SPACING * 1.7;
const LINE_FADE_U = 0.06;
const DOT_FADE_U = 0.1;
const BALL_R = 8;
const GLOW_R = 26;

/** A grid dot near a path, lit once the ball passes travel progress `u`. */
export interface LitDot { x: number; y: number; u: number; strength: number }

/** Travel progress at which each path's sample is reached (inflows first, then the outflow). */
const pathU = (pathIndex: number, s: number) => (pathIndex < 3 ? s * MERGE_SHARE : MERGE_SHARE + s * (1 - MERGE_SHARE));

const allPaths = (scene: IntroScene): SampledPath[] => [...scene.branchPaths, scene.outPath];

function nearest(paths: SampledPath[], x: number, y: number): { d: number; u: number } {
  return paths.reduce(
    (best, p, pi) => p.pts.reduce((b, q, i) => {
      const d = Math.hypot(q.x - x, q.y - y);
      return d < b.d ? { d, u: pathU(pi, p.s[i]) } : b;
    }, best),
    { d: Infinity, u: 0 },
  );
}

/** Grid dots (same lattice as the CSS grid: centred in 32px cells) that glow as the ball passes. */
export function litDots(scene: IntroScene, w: number, h: number): LitDot[] {
  const paths = allPaths(scene);
  const half = DOT_SPACING / 2;
  const cols = Math.ceil(w / DOT_SPACING);
  const rows = Math.ceil(h / DOT_SPACING);
  const cells = Array.from({ length: cols * rows }, (_, k) => ({ x: (k % cols) * DOT_SPACING + half, y: Math.floor(k / cols) * DOT_SPACING + half }));
  return cells
    .map((c) => ({ ...c, ...nearest(paths, c.x, c.y) }))
    .filter((c) => c.d < LIT_RADIUS)
    .map((c) => ({ x: c.x, y: c.y, u: c.u, strength: 1 - c.d / LIT_RADIUS }));
}

function strokeRange(ctx: CanvasRenderingContext2D, p: SampledPath, from: number, to: number): void {
  if (to <= from) return;
  // Exact interpolated ends, so short stretches still join up without gaps.
  const pts = [pointAtS(p, from), ...p.pts.filter((_, i) => p.s[i] > from && p.s[i] < to), pointAtS(p, to)];
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach((q) => ctx.lineTo(q.x, q.y));
  ctx.stroke();
}

const GLOW_LAYERS: ReadonlyArray<readonly [number, number]> = [[12, 0.07], [6, 0.16], [2, 1]];
const FADE_STEPS = 5;

function drawLit(ctx: CanvasRenderingContext2D, p: SampledPath, litTo: number, fadeS: number): void {
  const solidTo = Math.max(0, litTo - fadeS);
  GLOW_LAYERS.forEach(([width, alpha]) => {
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    strokeRange(ctx, p, 0, solidTo);
  });
  // The last stretch behind the ball brightens gradually, so the line lights up after it passes.
  Array.from({ length: FADE_STEPS }, (_, i) => i).forEach((i) => {
    const a = solidTo + (fadeS * i) / FADE_STEPS;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1 - (i + 1) / (FADE_STEPS + 1);
    strokeRange(ctx, p, a, a + fadeS / FADE_STEPS);
  });
  ctx.globalAlpha = 1;
}

export function drawBall(ctx: CanvasRenderingContext2D, at: Pt, r = BALL_R): void {
  const glow = GLOW_R * (r / BALL_R);
  const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, glow);
  g.addColorStop(0, "rgba(57,255,136,0.45)");
  g.addColorStop(1, "rgba(57,255,136,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(at.x, at.y, glow, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = NEON;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawDots(ctx: CanvasRenderingContext2D, dots: LitDot[], u: number): void {
  ctx.fillStyle = NEON;
  dots.forEach((d) => {
    const a = Math.min(1, Math.max(0, (u - d.u) / DOT_FADE_U)) * (0.25 + 0.6 * d.strength);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/** What one frame shows: how far the grey lines have drawn on (0 → 1) and travel progress u (0 → 1). */
export interface IntroFrame { drawn: number; u: number; balls: boolean }

/** One frame. Balls are drawn here only before the jump; the jump ball is a DOM node. */
export function drawIntroFrame(ctx: CanvasRenderingContext2D, scene: IntroScene, dots: LitDot[], f: IntroFrame, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  const paths = allPaths(scene);
  ctx.lineCap = "round";
  ctx.strokeStyle = GREY_LINE;
  ctx.lineWidth = 1.25;
  paths.forEach((p) => strokeRange(ctx, p, 0, f.drawn));
  drawDots(ctx, dots, f.u);
  ctx.strokeStyle = NEON;
  paths.forEach((p, i) => {
    const share = i < 3 ? MERGE_SHARE : 1 - MERGE_SHARE;
    const local = i < 3 ? Math.min(1, f.u / MERGE_SHARE) : Math.max(0, (f.u - MERGE_SHARE) / share);
    if (local > 0) drawLit(ctx, p, local, LINE_FADE_U / share);
  });
  if (f.balls) ballPositions(scene, f.u).forEach((b) => drawBall(ctx, b));
}
