"use client";
import { useEffect, useRef } from "react";
import { buildScene, easeInOut, jumpPoint, type Pt } from "@/lib/intro/geometry";
import { INTRO_KEY } from "@/lib/intro/init";
import { setIntroPhase, useIntroPhase } from "@/lib/motion";
import { LAND_SCALE, LAND_SECONDS, LOGO, logoPointFraction } from "@/components/brand/LogoMark";
import { MERGED_BALL_R, drawIntroFrame, litDots } from "./drawIntro";

const FALLBACK_TARGET: Pt = { x: 24, y: 24 };
const JUMP_LIFT = 0.22;
/** The arc's highest point stays at least this far below the top of the screen, so the ball never leaves view. */
const PEAK_MIN_PX = 56;
/** Extra size the ball gains at the top of its arc. */
const JUMP_SWELL_PX = 9;
/** Scroll distance, in screen heights: the flow left → right, then the slower jump up to the logo. */
const TRAVEL_SCREENS = 1.6;
const JUMP_SCREENS = 1.3;
const TOTAL_SCREENS = TRAVEL_SCREENS + JUMP_SCREENS;
/** Per-frame smoothing toward the scrolled position, so wheel steps glide instead of jump. */
const SMOOTH = 0.14;
const KEY_STEP_SCREENS = 0.25;
const LINE_HEIGHT_PX = 16;
const DRAW_S = 0.45;
const LANDED_K = 0.995;
const HINT_FADE_U = 0.06;
const FORWARD_KEYS = new Set(["ArrowDown", "PageDown", " "]);
const BACK_KEYS = new Set(["ArrowUp", "PageUp"]);

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

interface LandingSpot { at: Pt; r: number }

/**
 * Where the ball lands: the hub of the sidebar logo mark as it will be drawn at LAND_SCALE
 * (scaled from its left edge), or the top-left corner on phones where the sidebar is hidden.
 */
function landingSpot(): LandingSpot {
  const el = document.querySelector("[data-logo-mark]");
  const rect = el?.getBoundingClientRect();
  if (!rect || rect.width === 0) return { at: FALLBACK_TARGET, r: 0 };
  const { fx, fy } = logoPointFraction(LOGO.hub.x, LOGO.hub.y);
  const size = Number(LOGO.viewBox.split(" ")[2]);
  const cy = rect.top + rect.height / 2;
  const at = { x: rect.left + fx * rect.width * LAND_SCALE, y: cy + (rect.top + fy * rect.height - cy) * LAND_SCALE };
  return { at, r: (LOGO.dot.r / size) * rect.width * LAND_SCALE };
}

function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Wheel, touch and arrow/page keys report a downward scroll delta in px; page scrolling is blocked meanwhile. */
function listenScroll(onDelta: (dy: number) => void, screen: number): () => void {
  let touchY = 0;
  const wheel = (e: WheelEvent) => { e.preventDefault(); onDelta(e.deltaMode === 1 ? e.deltaY * LINE_HEIGHT_PX : e.deltaY); };
  const touchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? 0; };
  const touchMove = (e: TouchEvent) => {
    e.preventDefault();
    const y = e.touches[0]?.clientY ?? touchY;
    onDelta(touchY - y);
    touchY = y;
  };
  const key = (e: KeyboardEvent) => {
    const dir = FORWARD_KEYS.has(e.key) ? 1 : BACK_KEYS.has(e.key) ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    onDelta(dir * KEY_STEP_SCREENS * screen);
  };
  window.addEventListener("wheel", wheel, { passive: false });
  window.addEventListener("touchstart", touchStart, { passive: true });
  window.addEventListener("touchmove", touchMove, { passive: false });
  window.addEventListener("keydown", key);
  return () => {
    window.removeEventListener("wheel", wheel);
    window.removeEventListener("touchstart", touchStart);
    window.removeEventListener("touchmove", touchMove);
    window.removeEventListener("keydown", key);
  };
}

interface Refs { cover: HTMLDivElement; canvas: HTMLCanvasElement; ball: HTMLDivElement; hint: HTMLDivElement }

/** Lift for the jump arc, capped so its peak (at k = 0.5) stays PEAK_MIN_PX inside the screen. */
function arcLift(from: Pt, to: Pt, h: number): number {
  const minY = Math.min(from.y, to.y);
  const controlY = Math.max(minY - JUMP_LIFT * h, 2 * PEAK_MIN_PX - (from.y + to.y) / 2);
  return minY - controlY;
}

/** Moves the DOM ball along the jump arc (k: 0 → 1) and fades the cover. */
function stepJump({ cover, ball }: Refs, from: Pt, k: number, h: number): void {
  cover.style.opacity = String(1 - easeInOutSine(k));
  const spot = landingSpot();
  const p = jumpPoint(from, spot.at, arcLift(from, spot.at, h), easeInOutSine(k));
  const end = spot.r || MERGED_BALL_R / 2;
  const r = MERGED_BALL_R + (end - MERGED_BALL_R) * k + JUMP_SWELL_PX * Math.sin(Math.PI * k);
  ball.style.opacity = spot.r ? "1" : String(1 - k);
  ball.style.transform = `translate(${p.x - r}px, ${p.y - r}px)`;
  ball.style.width = ball.style.height = `${2 * r}px`;
}

/**
 * Scroll scrubs the whole intro (scrolling up rewinds it): the flow, then the slower jump up to the
 * logo. Once the ball touches down, the logo assembles on its own. Returns a stop function.
 */
function runIntro(refs: Refs, onDone: () => void): () => void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ctx = setupCanvas(refs.canvas, w, h);
  const scene = buildScene(w, h);
  const dots = litDots(scene, w, h);
  const start = performance.now();
  let target = 0;
  let shown = 0;
  let landedAt: number | null = null;
  let raf = 0;
  const detach = listenScroll((dy) => { if (landedAt === null) target = clamp01(target + dy / (TOTAL_SCREENS * h)); }, h);
  const frame = (now: number) => {
    const drawn = easeInOut(clamp01((now - start) / 1000 / DRAW_S));
    shown = Math.abs(target - shown) < 1e-4 ? target : shown + (target - shown) * SMOOTH;
    const u = clamp01((shown * TOTAL_SCREENS) / TRAVEL_SCREENS);
    const k = clamp01((shown * TOTAL_SCREENS - TRAVEL_SCREENS) / JUMP_SCREENS);
    refs.hint.style.opacity = String(drawn * (1 - clamp01(shown / HINT_FADE_U)));
    if (ctx) drawIntroFrame(ctx, scene, dots, { drawn, u, balls: k === 0 && drawn >= 1 }, w, h);
    if (landedAt === null) {
      if (k > 0) {
        stepJump(refs, scene.end, k, h);
        setIntroPhase("reveal");
      }
      else refs.ball.style.opacity = "0";
      if (k >= LANDED_K) {
        landedAt = now;
        refs.ball.style.opacity = "0";
        refs.cover.style.opacity = "0";
        setIntroPhase("landing");
      }
    }
    if (landedAt !== null && (now - landedAt) / 1000 >= LAND_SECONDS) return onDone();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    detach();
  };
}

/**
 * First-load intro, driven by scroll: three flows merge into one as you scroll, then the ball jumps
 * up to become the sidebar logo. The cover is server-rendered but only visible under
 * html[data-intro="play"] (set before paint). Click, Esc or Enter skips it.
 */
export function IntroOverlay() {
  const active = useIntroPhase() !== "off";
  const cover = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ball = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.intro !== "play") return;
    try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* private mode: the intro may replay, harmless */ }
    setIntroPhase("playing");
  }, []);

  useEffect(() => {
    if (!active || !cover.current || !canvas.current || !ball.current || !hint.current) return;
    const finish = () => {
      stop();
      delete document.documentElement.dataset.intro;
      setIntroPhase("off");
    };
    const skipKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter") finish(); };
    // Scripts are running, so the CSS no-JS failsafe must not hide the cover while someone scrolls.
    cover.current.style.animation = "none";
    const stop = runIntro({ cover: cover.current, canvas: canvas.current, ball: ball.current, hint: hint.current }, finish);
    window.addEventListener("click", finish);
    window.addEventListener("keydown", skipKey);
    return () => {
      stop();
      window.removeEventListener("click", finish);
      window.removeEventListener("keydown", skipKey);
    };
  }, [active]);

  return (
    <>
      <div ref={cover} className="intro-cover" aria-hidden>
        {active && <canvas ref={canvas} className="absolute inset-0 h-full w-full" />}
        <div ref={hint} className="intro-hint">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </div>
      </div>
      {active && <div ref={ball} className="intro-ball" aria-hidden />}
    </>
  );
}
