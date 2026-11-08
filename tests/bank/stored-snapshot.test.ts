import { describe, expect, it } from "vitest";
import { createSnapshotReader } from "@/lib/bank/storedValue";

function memoryStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

const parseList = (raw: string | null): number[] => (raw ? (JSON.parse(raw) as number[]) : []);

describe("createSnapshotReader", () => {
  it("returns the same object while the stored string is unchanged (required by useSyncExternalStore)", () => {
    const read = createSnapshotReader(memoryStorage({ k: "[1,2]" }));
    expect(read("k", parseList)).toBe(read("k", parseList));
  });

  it("returns a new parsed value after the stored string changes", () => {
    const s = memoryStorage({ k: "[1]" });
    const read = createSnapshotReader(s);
    const first = read("k", parseList);
    s.setItem("k", "[1,2]");
    expect(read("k", parseList)).toEqual([1, 2]);
    expect(read("k", parseList)).not.toBe(first);
  });

  it("treats a missing key, corrupt JSON, or blocked storage as empty", () => {
    expect(createSnapshotReader(memoryStorage())("k", parseList)).toEqual([]);
    expect(createSnapshotReader(memoryStorage({ k: "{bad" }))("k", parseList)).toEqual([]);
    const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => {} };
    expect(createSnapshotReader(blocked)("k", parseList)).toEqual([]);
  });
});
