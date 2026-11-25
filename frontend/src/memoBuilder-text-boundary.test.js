import { describe, expect, it } from "vitest";
import { buildTextMemo } from "./memoBuilder";

describe("memoBuilder 28-byte boundary", () => {
  it("accepts text at the 28-byte limit", () => {
    const result = buildTextMemo("a".repeat(28));
    expect(result.ok).toBe(true);
    expect(new TextEncoder().encode(result.value.value).length).toBe(28);
  });
});