import { describe, expect, it } from "vitest";
import { computeBackoffDelay } from "./retryWithBackoff";

describe("computeBackoffDelay", () => {
  it("grows exponentially with the default base and factor", () => {
    expect(computeBackoffDelay(1)).toBe(200);
    expect(computeBackoffDelay(2)).toBe(400);
    expect(computeBackoffDelay(3)).toBe(800);
  });

  it("respects a custom base delay and factor", () => {
    expect(computeBackoffDelay(1, 100, 3)).toBe(100);
    expect(computeBackoffDelay(2, 100, 3)).toBe(300);
    expect(computeBackoffDelay(3, 100, 3)).toBe(900);
  });

  it("caps the delay at maxDelayMs", () => {
    expect(computeBackoffDelay(5, 200, 2, 1000)).toBe(1000);
  });
});
