"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type SyntheticEvent } from "react";
import { canRotate, carSlug, clampYaw, framesFor, nearestFrame, restFrame, startsRotateDrag, type SpinSet } from "@/lib/cars/spin";

const DEG_PER_PX = 0.45;
const KEY_STEP = 15;
const MAX_TILT_DEG = 14;
const TILT_GAIN = 0.6;
const PLACEHOLDER = "/cars/placeholder.svg";

const onImgError = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.src = PLACEHOLDER; };
const STAGE = "relative w-full aspect-[2/1] rounded-xl";
const IMG = "absolute inset-0 w-full h-full object-contain select-none pointer-events-none";
const Shadow = () => <div className="absolute inset-x-[12%] bottom-[8%] h-[10%] rounded-[50%] bg-fg/20 blur-xl" aria-hidden />;

/**
 * The car: one static front three-quarter render. Models with a real multi-angle set can also be
 * turned with a left-button drag, a touch drag or the arrow keys. It never moves on its own.
 */
export function CarSpinner({ model, year }: { model: string; year: number }) {
  const set = useMemo(() => framesFor(carSlug(model)), [model]);
  if (!canRotate(set)) {
    const f = restFrame(set);
    return (
      <div className={STAGE}>
        <Shadow />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.src} alt={`${year} ${model}`} draggable={false} className={IMG} onError={onImgError} />
      </div>
    );
  }
  return <RotatableCar key={set.slug} set={set} model={model} year={year} />;
}

/** Keyed by model, so a new car starts again at its front three-quarter view. */
function RotatableCar({ set, model, year }: { set: SpinSet; model: string; year: number }) {
  const { frames } = set;
  const [yaw, setYaw] = useState(() => restFrame(set).yaw);
  const drag = useRef<{ pointerId: number; last: number } | null>(null);

  // Warm the other angles so the first drag doesn't flash blank frames.
  useEffect(() => {
    for (const f of frames) { const img = new Image(); img.src = f.src; }
  }, [frames]);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || !startsRotateDrag(e)) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone: drag still tracks moves over the car */ }
    drag.current = { pointerId: e.pointerId, last: e.clientX };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.current.last;
    drag.current = { ...drag.current, last: e.clientX };
    setYaw((y) => clampYaw(y - dx * DEG_PER_PX, set));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
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
        className={`${STAGE} cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-accent`}
        style={{ perspective: "1200px", touchAction: "pan-y" }}
      >
        <Shadow />
        {frames.map((f, i) => {
          const on = f === active;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${model}-${i}`}
              src={f.src}
              alt=""
              draggable={false}
              aria-hidden
              className={IMG}
              style={{
                opacity: on ? 1 : 0,
                visibility: on ? "visible" : "hidden",
                transform: `${f.mirror ? "scaleX(-1) " : ""}rotateY(${f.mirror ? -tilt : tilt}deg)`,
              }}
              onError={onImgError}
            />
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-center gap-2 text-[0.7rem] text-muted select-none">
        <span aria-hidden>⟲</span>
        <span>Drag to rotate</span>
        <span aria-hidden>⟳</span>
      </div>
    </div>
  );
}
