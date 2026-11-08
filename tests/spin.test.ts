import { describe, expect, test } from "vitest";
import { blend, framesFor, normalizeYaw, SPIN_MODELS, clampYaw, nearestFrame, restFrame, canRotate, startsRotateDrag } from "@/lib/cars/spin";

describe("car spin frames", () => {
  test("spin models get 8 frames covering both sides, sorted by yaw", () => {
    const f = framesFor("corolla-cross");
    expect(SPIN_MODELS.has("corolla-cross")).toBe(true);
    expect(f.frames).toHaveLength(8);
    expect(f.full360).toBe(true);
    const yaws = f.frames.map((x) => x.yaw);
    expect([...yaws].sort((a, b) => a - b)).toEqual(yaws);
    expect(f.frames.filter((x) => x.mirror)).toHaveLength(4);
  });

  test("single-image models get 2 frames and a limited swing", () => {
    const f = framesFor("camry");
    expect(f.frames).toHaveLength(2);
    expect(f.full360).toBe(false);
    expect(f.frames[1].mirror).toBe(true);
  });

  test("normalizeYaw wraps into [0, 360)", () => {
    expect(normalizeYaw(-30)).toBe(330);
    expect(normalizeYaw(725)).toBe(5);
  });

  test("blend at an exact frame yaw returns that frame fully", () => {
    const f = framesFor("corolla-cross");
    const b = blend(f.frames[2].yaw, f);
    expect(b.a.src).toBe(f.frames[2].src);
    expect(b.t).toBeCloseTo(0, 5);
  });

  test("blend halfway between two frames returns t = 0.5", () => {
    const f = framesFor("corolla-cross");
    const mid = (f.frames[0].yaw + f.frames[1].yaw) / 2;
    const b = blend(mid, f);
    expect(b.a.yaw).toBe(f.frames[0].yaw);
    expect(b.b.yaw).toBe(f.frames[1].yaw);
    expect(b.t).toBeCloseTo(0.5, 5);
  });

  test("blend wraps from the last frame back to the first across 360", () => {
    const f = framesFor("corolla-cross");
    const last = f.frames[f.frames.length - 1].yaw;
    const yaw = (last + 360 + f.frames[0].yaw) / 2; // between last and first (wrapped)
    const b = blend(yaw, f);
    expect(b.a.yaw).toBe(last);
    expect(b.b.yaw).toBe(f.frames[0].yaw);
    expect(b.t).toBeGreaterThan(0);
    expect(b.t).toBeLessThan(1);
  });

  test("clampYaw limits single-image models to their swing and leaves 360 models free", () => {
    const single = framesFor("camry");
    expect(clampYaw(500, single)).toBe(single.frames[1].yaw);
    expect(clampYaw(-50, single)).toBe(single.frames[0].yaw);
    expect(clampYaw(500, framesFor("rav4"))).toBe(140);
  });

  test("unknown model falls back to the placeholder", () => {
    const f = framesFor("delorean");
    expect(f.frames[0].src).toContain("placeholder");
  });
});

describe("nearestFrame (single visible frame, no ghosting)", () => {
  const set = framesFor("rav4");
  test("returns the frame whose yaw is closest, with signed offset", () => {
    const r = nearestFrame(10, set); // frames at 0 and 30
    expect(r.frame.yaw).toBe(0);
    expect(r.offsetDeg).toBeCloseTo(10);
  });
  test("swaps to the next frame past the midpoint", () => {
    const r = nearestFrame(20, set);
    expect(r.frame.yaw).toBe(30);
    expect(r.offsetDeg).toBeCloseTo(-10);
  });
  test("wraps across 360", () => {
    const r = nearestFrame(358, set);
    expect(r.frame.yaw).toBe(0);
    expect(r.offsetDeg).toBeCloseTo(-2);
  });
  test("single-image models clamp to their swing", () => {
    const s = framesFor("camry");
    expect(nearestFrame(0, s).frame.yaw).toBe(40);
  });
});

describe("static car by default", () => {
  test("a spin model rests on its front three-quarter render (Toyota frame 1, unmirrored)", () => {
    const f = restFrame(framesFor("rav4"));
    expect(f.src).toBe("/cars/spin/rav4/1.png");
    expect(f.mirror).toBe(false);
  });
  test("a single-image model rests on its one render, unmirrored", () => {
    const f = restFrame(framesFor("camry"));
    expect(f.src).toBe("/cars/camry.png");
    expect(f.mirror).toBe(false);
  });
  test("only real multi-angle sets can be rotated; single images stay static", () => {
    expect(canRotate(framesFor("rav4"))).toBe(true);
    expect(canRotate(framesFor("camry"))).toBe(false);
    expect(canRotate(framesFor("delorean"))).toBe(false);
  });
});

describe("startsRotateDrag", () => {
  test("a plain left-button mouse drag rotates", () => {
    expect(startsRotateDrag({ pointerType: "mouse", button: 0 })).toBe(true);
  });
  test("middle and right mouse buttons never rotate", () => {
    expect(startsRotateDrag({ pointerType: "mouse", button: 1 })).toBe(false);
    expect(startsRotateDrag({ pointerType: "mouse", button: 2 })).toBe(false);
  });
  test("touch and pen contacts rotate", () => {
    expect(startsRotateDrag({ pointerType: "touch", button: 0 })).toBe(true);
    expect(startsRotateDrag({ pointerType: "pen", button: 0 })).toBe(true);
  });
  test("a pen barrel button does not rotate", () => {
    expect(startsRotateDrag({ pointerType: "pen", button: 2 })).toBe(false);
  });
});
