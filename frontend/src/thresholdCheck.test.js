import { describe, expect, it } from "vitest";
import { checkThresholds } from "./thresholdCheck";

describe("checkThresholds", () => {
  it("passes medium threshold only when the right pair is selected", () => {
    const signers = [
      { key: "GA", weight: 2, type: "ed25519_public_key" },
      { key: "GB", weight: 1, type: "ed25519_public_key" },
      { key: "GC", weight: 1, type: "ed25519_public_key" },
    ];
    const thresholds = { low: 1, medium: 3, high: 4 };

    // Just GA (weight 2) - doesn't meet medium
    let result = checkThresholds(signers, ["GA"], thresholds);
    expect(result.totalWeight).toBe(2);
    expect(result.low).toBe(true);
    expect(result.medium).toBe(false);
    expect(result.high).toBe(false);

    // GA + GB (weight 3) - meets medium
    result = checkThresholds(signers, ["GA", "GB"], thresholds);
    expect(result.totalWeight).toBe(3);
    expect(result.low).toBe(true);
    expect(result.medium).toBe(true);
    expect(result.high).toBe(false);

    // GA + GC (weight 3) - also meets medium
    result = checkThresholds(signers, ["GA", "GC"], thresholds);
    expect(result.totalWeight).toBe(3);
    expect(result.low).toBe(true);
    expect(result.medium).toBe(true);
    expect(result.high).toBe(false);

    // GB + GC (weight 2) - doesn't meet medium
    result = checkThresholds(signers, ["GB", "GC"], thresholds);
    expect(result.totalWeight).toBe(2);
    expect(result.low).toBe(true);
    expect(result.medium).toBe(false);
    expect(result.high).toBe(false);

    // All three (weight 4) - meets all thresholds
    result = checkThresholds(signers, ["GA", "GB", "GC"], thresholds);
    expect(result.totalWeight).toBe(4);
    expect(result.low).toBe(true);
    expect(result.medium).toBe(true);
    expect(result.high).toBe(true);
  });

  it("ignores signers with zero weight", () => {
    const signers = [
      { key: "GA", weight: 2, type: "ed25519_public_key" },
      { key: "GB", weight: 0, type: "ed25519_public_key" },
      { key: "GC", weight: 1, type: "ed25519_public_key" },
    ];
    const thresholds = { low: 1, medium: 2, high: 3 };

    // Selecting GB (zero weight) should not contribute
    const result = checkThresholds(signers, ["GB"], thresholds);
    expect(result.totalWeight).toBe(0);
    expect(result.low).toBe(false);
    expect(result.medium).toBe(false);
    expect(result.high).toBe(false);

    // GA + GB should only count GA's weight
    const result2 = checkThresholds(signers, ["GA", "GB"], thresholds);
    expect(result2.totalWeight).toBe(2);
    expect(result2.low).toBe(true);
    expect(result2.medium).toBe(true);
    expect(result2.high).toBe(false);
  });

  it("includes master key when weight is non-zero", () => {
    const signers = [
      { key: "GMASTER", weight: 3, type: "ed25519_public_key" },
      { key: "GA", weight: 1, type: "ed25519_public_key" },
    ];
    const thresholds = { low: 1, medium: 2, high: 3 };

    const result = checkThresholds(signers, ["GMASTER"], thresholds);
    expect(result.totalWeight).toBe(3);
    expect(result.low).toBe(true);
    expect(result.medium).toBe(true);
    expect(result.high).toBe(true);
  });

  it("detects when no subset can meet high threshold", () => {
    const signers = [
      { key: "GA", weight: 2, type: "ed25519_public_key" },
      { key: "GB", weight: 1, type: "ed25519_public_key" },
    ];
    const thresholds = { low: 1, medium: 2, high: 5 };

    const result = checkThresholds(signers, ["GA", "GB"], thresholds);
    expect(result.canMeetHigh).toBe(false);
    expect(result.high).toBe(false);
  });

  it("detects when high threshold can be met", () => {
    const signers = [
      { key: "GA", weight: 3, type: "ed25519_public_key" },
      { key: "GB", weight: 2, type: "ed25519_public_key" },
    ];
    const thresholds = { low: 1, medium: 2, high: 4 };

    const result = checkThresholds(signers, ["GA", "GB"], thresholds);
    expect(result.canMeetHigh).toBe(true);
    expect(result.high).toBe(true);
  });

  it("handles empty selection", () => {
    const signers = [
      { key: "GA", weight: 2, type: "ed25519_public_key" },
    ];
    const thresholds = { low: 1, medium: 2, high: 2 };

    const result = checkThresholds(signers, [], thresholds);
    expect(result.totalWeight).toBe(0);
    expect(result.low).toBe(false);
    expect(result.medium).toBe(false);
    expect(result.high).toBe(false);
    expect(result.canMeetHigh).toBe(true);
  });

  it("handles accounts with only zero-weight signers", () => {
    const signers = [
      { key: "GA", weight: 0, type: "ed25519_public_key" },
      { key: "GB", weight: 0, type: "ed25519_public_key" },
    ];
    const thresholds = { low: 0, medium: 0, high: 1 };

    const result = checkThresholds(signers, ["GA", "GB"], thresholds);
    expect(result.totalWeight).toBe(0);
    expect(result.canMeetHigh).toBe(false);
  });
});
