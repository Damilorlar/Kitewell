import { describe, expect, it } from "vitest";
import { buildTextMemo } from "./memoBuilder";

describe("memoBuilder empty text", () => {
  it("allows an empty text memo", () => {
    const result = buildTextMemo("");
    expect(result.ok).toBe(true);
    expect(result.value.value).toBe("");
  });
});