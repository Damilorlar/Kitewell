import { describe, expect, it } from "vitest";
import { buildTextMemo } from "./memoBuilder";

describe("memoBuilder multibyte text", () => {
  it("counts UTF-8 bytes rather than JavaScript characters", () => {
    expect(buildTextMemo("é".repeat(14)).ok).toBe(true);
    expect(buildTextMemo("é".repeat(15)).error.code).toBe("TEXT_TOO_LONG");
  });
});