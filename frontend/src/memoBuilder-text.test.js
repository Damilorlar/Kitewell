import { describe, expect, it } from "vitest";
import { buildTextMemo } from "./memoBuilder";

describe("memoBuilder text memo", () => {
  it("returns a typed successful text memo", () => {
    const result = buildTextMemo("invoice-42");
    expect(result.ok).toBe(true);
    expect(result.value.type).toBe("text");
    expect(result.value.value).toBe("invoice-42");
  });
});