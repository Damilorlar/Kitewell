import { describe, expect, it } from "vitest";
import { buildIdMemo } from "./memoBuilder";

describe("memoBuilder uint64 ID range", () => {
  it("accepts the maximum unsigned 64-bit ID exactly", () => {
    const result = buildIdMemo("18446744073709551615");
    expect(result.ok).toBe(true);
    expect(result.value.value).toBe("18446744073709551615");
  });
});