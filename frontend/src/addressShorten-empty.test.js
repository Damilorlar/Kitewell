import { describe, expect, it } from "vitest";
import { shortenAddress } from "./addressShorten";

describe("shortenAddress empty input", () => {
  it("rejects an empty or whitespace-only address", () => {
    expect(() => shortenAddress("")).toThrow("Address is required.");
    expect(() => shortenAddress("   ")).toThrow("Address is required.");
  });
});
