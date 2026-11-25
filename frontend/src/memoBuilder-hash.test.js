import { describe, expect, it } from "vitest";
import { buildHashMemo } from "./memoBuilder";

describe("memoBuilder hash memo", () => {
  it("normalizes valid hexadecimal hashes to a 32-byte SDK memo", () => {
    const result = buildHashMemo("AB".repeat(32));
    expect(result.ok).toBe(true);
    expect(result.value.type).toBe("hash");
    expect(result.value.value).toHaveLength(32);
    expect(result.value.value[0]).toBe(0xab);
  });
});