import { describe, expect, it } from "vitest";
import { sortBalances } from "./balanceSort";

describe("sortBalances missing asset code", () => {
  it("sorts a missing code before named issued assets and after native", () => {
    const sorted = sortBalances([
      { asset_type: "credit_alphanum4", asset_code: "AAA" },
      { asset_type: "credit_alphanum4" },
      { asset_type: "native" },
    ]);

    expect(sorted[0].asset_type).toBe("native");
    expect(sorted[1].asset_code).toBeUndefined();
    expect(sorted[2].asset_code).toBe("AAA");
  });
});
