import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import { buildBankView } from "@/lib/bank/view";
import { SYSTEM_PROMPT, contextFor } from "@/lib/llm/prompt";

const snap = (id: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8")) as Analysis;

describe("coach prompt", () => {
  test("tells the model to lead with the engine's top move and to quote the Safety net runway", () => {
    expect(SYSTEM_PROMPT).toContain("Lead with topMoves[0]");
    expect(SYSTEM_PROMPT).toContain("safetyNetMonths");
  });
  test.each(["C003", "C018"])("%s context carries the Safety net months shown on the Safety net page", (id) => {
    const a = snap(id);
    const ctx = contextFor(a);
    expect(ctx.safetyNetMonths).toBe(buildBankView(a).safetyNet.months);
    expect(ctx.topMoves[0]?.id).toBe(a.ranked[0]?.id);
  });
});
