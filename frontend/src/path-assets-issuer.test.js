import { describe, expect, it } from "vitest";
import { parsePathAssets } from "./stellar";

describe("path asset issuer validation", () => {
  it("rejects a malformed issuer in a credit hop", () => {
    expect(() => parsePathAssets("USDC:not-a-key")).toThrow(
      /valid Stellar public key/
    );
  });
});
