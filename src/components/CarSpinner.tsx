"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { carSlug, clampYaw, framesFor, nearestFrame } from "@/lib/cars/spin";

const DEG_PER_PX = 0.45;
const FRICTION = 0.92;
const MIN_VELOCITY = 0.05;
const IDLE_DEG_PER_FRAME = 0.18;
const KEY_STEP = 15;
const MAX_TILT_DEG = 14;
const TILT_GAIN = 0.6;

/** Drag-to-rotate car. Shows exactly one real Toyota angle frame at a time (no crossfade ghosting) with a small 3D tilt between angles. */
export function CarSpinner({ model, year }: { model: string; year: number }) {
  const set = useMemo(() => framesFor(carSlug(model)), [model]);
  const [yaw, setYaw] = useState(set.frames[set.full360 ? 1 : 0].yaw);
  const [touched, setTouched] = useState(false);
  const drag = useRef<{ x: number; last: number; v: number } | null>(null);
  const raf = useRef<number | null>(null);
  const idleDir = useRef(1);

  // New car model: restart at its first angle (state adjusted during render, per React docs).
  const [shownSet, setShownSet] = useState(set);
  if (shownSet !== set) {
    setShownSet(set);
    setYaw(set.frames[set.full360 ? 1 : 0].yaw);
    setTouched(false);
  }
  useEffect(() => {
    for (const f of set.frames) { const img = new Image(); img.src = f.src; }
  }, [set]);

  // Idle spin until first interaction (skipped for reduced motion).
  useEffect(() => {
    if (touched || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tick = () => {
      setYaw((y) => {
        let next = y + IDLE_DEG_PER_FRAME * idleDir.current;
        if (!set.full360) {
          const lo = set.frames[0].yaw, hi = set.frames[set.frames.length - 1].yaw;
          if (next >= hi || next <= lo) { idleDir.current *= -1; next = Math.min(hi, Math.max(lo, next)); }
        }
        return clampYaw(next, set);
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [touched, set]);

  const stopAnim = () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    stopAnim();
    setTouched(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, last: e.clientX, v: 0 };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.last;
    drag.current.last = e.clientX;
    drag.current.v = dx * DEG_PER_PX;
    setYaw((y) => clampYaw(y - dx * DEG_PER_PX, set));
  };
  const onUp = () => {
    if (!drag.current) return;
    let v = drag.current.v;
    drag.current = null;
    const coast = () => {
      v *= FRICTION;
      if (Math.abs(v) < MIN_VELOCITY) { raf.current = null; return; }
      setYaw((y) => clampYaw(y - v, set));
      raf.current = requestAnimationFrame(coast);
    };
    raf.current = requestAnimationFrame(coast);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    stopAnim();
    setTouched(true);
    setYaw((y) => clampYaw(y + (e.key === "ArrowRight" ? -KEY_STEP : KEY_STEP), set));
  };

  const { frame: active, offsetDeg } = nearestFrame(yaw, set);
  const tilt = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, offsetDeg * TILT_GAIN));

  return (
    <div className="relative">
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${year} ${model}. Drag or use arrow keys to rotate.`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(yaw)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        className="relative w-full aspect-[2/1] cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
        style={{ perspective: "1200px", touchAction: "pan-y" }}
      >
        <div className="absolute inset-x-[12%] bottom-[8%] h-[10%] rounded-[50%] bg-fg/20 blur-xl" aria-hidden />
        {set.frames.map((f, i) => {
          const on = f === active;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${set.slug}-${i}`}
              src={f.src}
              alt=""
              draggable={false}
              aria-hidden
              className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
              style={{
                opacity: on ? 1 : 0,
                visibility: on ? "visible" : "hidden",
                transform: `${f.mirror ? "scaleX(-1) " : ""}rotateY(${f.mirror ? -tilt : tilt}deg)`,
              }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/cars/placeholder.svg"; }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-center gap-2 text-[0.7rem] text-muted select-none">
        <span aria-hidden>⟲</span>
        <span>{set.full360 ? "Drag to rotate 360°" : "Drag to swing"}</span>
        <span aria-hidden>⟳</span>
      </div>
    </div>
  );
}
