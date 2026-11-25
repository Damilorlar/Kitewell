import { describe, expect, it } from "vitest";
import { buildIdMemo } from "./memoBuilder";

describe("memoBuilder numeric ID", () => {
  it("builds an ID memo from a safe integer", () => {
    const result = buildIdMemo(42);
    expect(result.ok).toBe(true);
    expect(result.value.type).toBe("id");
    expect(result.value.value).toBe("42");
  });
});