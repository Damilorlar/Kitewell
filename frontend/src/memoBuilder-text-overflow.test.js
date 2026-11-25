import { describe, expect, it } from "vitest";
import { buildTextMemo } from "./memoBuilder";

describe("memoBuilder text overflow", () => {
  it("returns a typed error for text longer than 28 bytes", () => {
    expect(buildTextMemo("a".repeat(29))).toEqual({
      ok: false,
      error: {
        code: "TEXT_TOO_LONG",
        message: "Text memo cannot exceed 28 UTF-8 bytes.",
      },
    });
  });
});