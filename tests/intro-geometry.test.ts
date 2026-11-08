import { describe, expect, it } from "vitest";
import {
  MERGE_SHARE,
  TIMELINE,
  ballPositions,
  buildScene,
  easeInOut,
  jumpPoint,
  pointAtS,
  samplePath,
  travelProgress,
} from "@/lib/intro/geometry";

const W = 1600;
const H = 900;

describe("intro scene", () => {
  const scene = buildScene(W, H);

  it("merges all three inflows at ~58% width", () => {
    // Arrange / Act
    const ends = scene.branches.map((b) => b.p3);
    // Assert
    ends.forEach((p) => expect(p).toEqual(scene.merge));
    expect(scene.merge.x / W).toBeCloseTo(0.585, 2);
  });

  it("starts every inflow at the left edge, top to bottom", () => {
    const starts = scene.branches.map((b) => b.p0);
    starts.forEach((p) => expect(p.x).toBe(0));
    expect(starts[0].y).toBeLessThan(starts[1].y);
    expect(starts[1].y).toBeLessThan(starts[2].y);
  });

  it("curves the outflow up toward the right edge", () => {
    expect(scene.out.p0).toEqual(scene.merge);
    expect(scene.end.x / W).toBeGreaterThan(0.9);
    expect(scene.end.y).toBeLessThan(scene.merge.y);
  });
});

describe("samplePath", () => {
  it("normalises cumulative length from 0 to 1, increasing", () => {
    const p = samplePath(buildScene(W, H).branches[0], 64);
    expect(p.s[0]).toBe(0);
    expect(p.s[p.s.length - 1]).toBeCloseTo(1, 10);
    p.s.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(p.s[i]));
  });

  it("returns the endpoints at s = 0 and s = 1", () => {
    const c = buildScene(W, H).out;
    const p = samplePath(c, 64);
    expect(pointAtS(p, 0)).toEqual(c.p0);
    expect(pointAtS(p, 1).x).toBeCloseTo(c.p3.x, 6);
  });
});

describe("ballPositions", () => {
  const scene = buildScene(W, H);

  it("has three balls at the left edge at the start", () => {
    const balls = ballPositions(scene, 0);
    expect(balls).toHaveLength(3);
    balls.forEach((b) => expect(b.x).toBe(0));
  });

  it("collapses to one ball after the merge and ends at the right end", () => {
    expect(ballPositions(scene, MERGE_SHARE + 0.01)).toHaveLength(1);
    const [last] = ballPositions(scene, 1);
    expect(last.x).toBeCloseTo(scene.end.x, 4);
    expect(last.y).toBeCloseTo(scene.end.y, 4);
  });

  it("puts all three balls on the merge point at the hand-over", () => {
    ballPositions(scene, MERGE_SHARE).forEach((b) => {
      expect(b.x).toBeCloseTo(scene.merge.x, 4);
      expect(b.y).toBeCloseTo(scene.merge.y, 4);
    });
  });
});

describe("timing", () => {
  it("eases symmetrically", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
  });

  it("travels for ~1.8s", () => {
    const [start, end] = TIMELINE.travel;
    expect(end - start).toBeCloseTo(1.8, 5);
    expect(travelProgress(start - 0.1)).toBe(0);
    expect(travelProgress(end + 0.1)).toBe(1);
    expect(travelProgress((start + end) / 2)).toBeCloseTo(0.5, 10);
  });

  it("jumps in an arc above both ends", () => {
    const from = { x: 1500, y: 340 };
    const to = { x: 30, y: 30 };
    expect(jumpPoint(from, to, 0.2 * H, 0)).toEqual(from);
    expect(jumpPoint(from, to, 0.2 * H, 1)).toEqual(to);
    expect(jumpPoint(from, to, 0.2 * H, 0.5).y).toBeLessThan(Math.min(from.y, to.y));
  });
});
