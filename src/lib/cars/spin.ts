/**
 * Drag-to-rotate frame math for the car card.
 * Yaw convention (degrees): 0 = left side, nose pointing left; 90 = nose toward viewer;
 * 180 = right side; 270 = tail toward viewer. Toyota's configurator publishes 4 left-side
 * angles per model; mirroring them gives the right side, so a spin set has 8 views.
 */
export interface SpinFrame { src: string; yaw: number; mirror: boolean }
export interface SpinSet { slug: string; frames: SpinFrame[]; full360: boolean }

/** Models with a 4-angle set in public/cars/spin/<slug>/{1..4}.png. */
export const SPIN_MODELS = new Set(["rav4", "rav4-hybrid", "corolla-cross", "tacoma", "highlander", "grand-highlander"]);
/** Models with a single render in public/cars/<slug>.png. */
export const SINGLE_MODELS = new Set(["camry", "camry-hybrid", "corolla", "tundra", "sequoia", "prius", "bz4x", "avalon"]);

/** Toyota frame number → yaw on the left side of the car. */
const LEFT_SIDE: { n: number; yaw: number }[] = [
  { n: 4, yaw: 0 },   // side profile
  { n: 1, yaw: 30 },  // shallow front three-quarter
  { n: 2, yaw: 55 },  // steep front three-quarter
  { n: 3, yaw: 305 }, // rear three-quarter
];
const SINGLE_FRONT_YAW = 40;
const SINGLE_MIRROR_YAW = 140;

export const carSlug = (model: string): string => model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const normalizeYaw = (y: number): number => ((y % 360) + 360) % 360;

export function framesFor(slug: string): SpinSet {
  if (SPIN_MODELS.has(slug)) {
    const left = LEFT_SIDE.map(({ n, yaw }) => ({ src: `/cars/spin/${slug}/${n}.png`, yaw, mirror: false }));
    // Mirror across the nose-tail axis: yaw → 180 − yaw.
    const right = LEFT_SIDE.map(({ n, yaw }) => ({ src: `/cars/spin/${slug}/${n}.png`, yaw: normalizeYaw(180 - yaw), mirror: true }));
    return { slug, frames: [...left, ...right].sort((a, b) => a.yaw - b.yaw), full360: true };
  }
  const src = SINGLE_MODELS.has(slug) ? `/cars/${slug}.png` : "/cars/placeholder.svg";
  return { slug, frames: [{ src, yaw: SINGLE_FRONT_YAW, mirror: false }, { src, yaw: SINGLE_MIRROR_YAW, mirror: true }], full360: false };
}

/** Keep single-image models inside their swing; 360 models wrap freely. */
export function clampYaw(yaw: number, set: SpinSet): number {
  if (set.full360) return normalizeYaw(yaw);
  const lo = set.frames[0].yaw;
  const hi = set.frames[set.frames.length - 1].yaw;
  return Math.min(hi, Math.max(lo, yaw));
}

/** The two frames bracketing `yaw` and how far (0..1) we are from a toward b. */
export function blend(yaw: number, set: SpinSet): { a: SpinFrame; b: SpinFrame; t: number } {
  const f = set.frames;
  const y = set.full360 ? normalizeYaw(yaw) : clampYaw(yaw, set);
  for (let i = 0; i < f.length; i++) {
    const a = f[i];
    const next = f[i + 1];
    if (next && y >= a.yaw && (y < next.yaw || (!set.full360 && i + 2 === f.length))) {
      return { a, b: next, t: next.yaw === a.yaw ? 0 : (y - a.yaw) / (next.yaw - a.yaw) };
    }
  }
  // Wrap segment: last → first across 360 (only reachable for full360).
  const a = f[f.length - 1];
  const b = f[0];
  const span = b.yaw + 360 - a.yaw;
  const d = y >= a.yaw ? y - a.yaw : y + 360 - a.yaw;
  return { a, b, t: span === 0 ? 0 : d / span };
}

/** Signed shortest angular distance from `from` to `to`, in (-180, 180]. */
const angleDelta = (from: number, to: number): number => {
  const d = normalizeYaw(to - from);
  return d > 180 ? d - 360 : d;
};

/**
 * The one frame to show at `yaw` (never two at once — crossfading two photos ghosts the car)
 * and how far `yaw` sits from it, for a small continuous 3D tilt.
 */
export function nearestFrame(yaw: number, set: SpinSet): { frame: SpinFrame; offsetDeg: number } {
  const y = clampYaw(yaw, set);
  let best = set.frames[0];
  let bestOffset = set.full360 ? angleDelta(best.yaw, y) : y - best.yaw;
  for (const f of set.frames.slice(1)) {
    const off = set.full360 ? angleDelta(f.yaw, y) : y - f.yaw;
    if (Math.abs(off) < Math.abs(bestOffset)) { best = f; bestOffset = off; }
  }
  return { frame: best, offsetDeg: bestOffset };
}
