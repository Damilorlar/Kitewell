import { describe, expect, it } from "vitest";
import { validateAssetCode } from "./validateAssetCode";

describe("validateAssetCode surrounding whitespace", () => {
  it("trims before validating and uppercases the code", () => {
    expect(validateAssetCode("  usdc  ")).toBe("USDC");
  });
});
