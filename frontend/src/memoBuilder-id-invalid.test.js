import { describe, expect, it } from "vitest";
import { buildIdMemo } from "./memoBuilder";

describe("memoBuilder invalid ID", () => {
  it("returns typed errors for invalid and out-of-range IDs", () => {
    expect(buildIdMemo(-1).error.code).toBe("ID_OUT_OF_RANGE");
    expect(buildIdMemo("18446744073709551616").error.code).toBe("ID_OUT_OF_RANGE");
    expect(buildIdMemo(1.5).error.code).toBe("INVALID_ID");
    expect(buildIdMemo("1.0").error.code).toBe("INVALID_ID");
  });
});