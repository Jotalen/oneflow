import { describe, expect, test } from "vitest";
import { parseBlocks, parseInline } from "@/lib/text/markdown";

describe("parseInline", () => {
  test("bold, italic and code become spans; plain text stays plain", () => {
    expect(parseInline("Pay **$300** now, *then* save `2x`.")).toEqual([
      { kind: "text", text: "Pay " }, { kind: "bold", text: "$300" }, { kind: "text", text: " now, " },
      { kind: "italic", text: "then" }, { kind: "text", text: " save " }, { kind: "code", text: "2x" }, { kind: "text", text: "." },
    ]);
  });
  test("underscore italics and unmatched markers are handled without eating text", () => {
    expect(parseInline("_soon_ and 5 * 3")).toEqual([{ kind: "italic", text: "soon" }, { kind: "text", text: " and 5 * 3" }]);
  });
  test("never produces HTML: angle brackets stay literal text", () => {
    expect(parseInline("<script>x</script>")).toEqual([{ kind: "text", text: "<script>x</script>" }]);
  });
});

describe("parseBlocks", () => {
  test("groups bullet and numbered lines into lists, headings become bold paragraphs", () => {
    const blocks = parseBlocks("## Plan\nFirst line.\n- one\n* two\n1. alpha\n2) beta\n\nLast.");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "para", "ul", "ol", "para"]);
    expect(blocks[2]).toMatchObject({ kind: "ul", items: ["one", "two"] });
    expect(blocks[3]).toMatchObject({ kind: "ol", items: ["alpha", "beta"] });
  });
});
