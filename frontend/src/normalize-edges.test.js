import { describe, expect, it, vi } from "vitest";

/**
 * Issue #136: lock the `normalizeAmount` edges that path-payment.test.js
 * leaves open — surrounding whitespace, a leading `+`, and the
 * caller-supplied `label` in both error messages.
 *
 * This is a pure-validator suite: no Horizon, no Soroban RPC, no wallet.
 * `@stellar/freighter-api` is mocked so importing ./freighter stays inert,
 * and the 7-decimal rule is asserted alongside the trim case to prove that
 * trimming never loosens precision.
 */

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(async () => {
    const { getActiveNetwork } = await import("./network");
    const active = getActiveNetwork();
    return { network: active.id, networkPassphrase: active.passphrase };
  }),
  signTransaction: vi.fn(),
}));

const { normalizeAmount } = await import("./freighter");

describe("normalizeAmount edges", () => {
  it("trims surrounding whitespace", () => {
    const normalized = normalizeAmount(" 2.5 ");

    expect(normalized).toBe("2.5");
    expect(Number(normalized)).toBe(2.5);
  });

  it("rejects a leading plus sign as a positive number", () => {
    expect(() => normalizeAmount("+1")).toThrow(/positive number/);
  });

  it("uses the caller's label for the greater-than-zero error", () => {
    expect(() => normalizeAmount("0", "Fee")).toThrow(
      /^Fee must be greater than zero/
    );
  });

  it("uses the caller's label for the positive-number error", () => {
    expect(() => normalizeAmount("nope", "Fee")).toThrow(
      /Fee must be a positive number/
    );
  });

  it("keeps the 7-decimal cap for a trimmed value", () => {
    expect(() => normalizeAmount(" 1.12345678 ")).toThrow(/7 decimals/);
  });
});
