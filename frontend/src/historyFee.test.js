import { describe, expect, it } from "vitest";
import { formatHistoryFee, mapTransactionFee } from "./historyFee";

/** Horizon transaction record for a plain one-operation payment. */
const PAYMENT_TX = {
  hash: "a".repeat(64),
  fee_charged: "100",
  max_fee: "1000",
  operation_count: 1,
};

/** Horizon transaction record for a fee-bump: outer fee at the top, inner nested. */
const FEE_BUMP_TX = {
  hash: "b".repeat(64),
  fee_account: "GFEEACCOUNT",
  fee_charged: "400",
  max_fee: "2000",
  operation_count: 1,
  fee_bump_transaction: { hash: "b".repeat(64), signatures: [] },
  inner_transaction: { hash: "c".repeat(64), max_fee: "100", signatures: [] },
};

describe("mapTransactionFee", () => {
  it("reads the fee and operation count of a one-operation payment", () => {
    expect(mapTransactionFee(PAYMENT_TX)).toEqual({
      fee_charged: "100",
      operation_count: 1,
      fee_bumped: false,
    });
  });

  it("takes the outer fee of a fee-bumped transaction without adding the inner one", () => {
    expect(mapTransactionFee(FEE_BUMP_TX)).toEqual({
      fee_charged: "400",
      operation_count: 1,
      fee_bumped: true,
    });
  });

  it("keeps a missing fee null instead of zero", () => {
    for (const tx of [undefined, null, {}, "tx", { fee_charged: "" }, { fee_charged: "abc" }]) {
      expect(mapTransactionFee(tx)).toEqual({
        fee_charged: null,
        operation_count: null,
        fee_bumped: false,
      });
    }
  });

  it("does not fall back to max_fee, which is a bid and not a charge", () => {
    expect(mapTransactionFee({ max_fee: "1000", operation_count: 2 }).fee_charged).toBeNull();
  });

  it("keeps a real zero fee as zero", () => {
    expect(mapTransactionFee({ fee_charged: "0" }).fee_charged).toBe("0");
  });
});

describe("formatHistoryFee", () => {
  it("formats a one-operation payment", () => {
    expect(formatHistoryFee(mapTransactionFee(PAYMENT_TX))).toBe("Fee 0.00001 XLM · 1 operation");
  });

  it("formats a fee-bumped transaction with its outer fee and a fee-bumped label", () => {
    expect(formatHistoryFee(mapTransactionFee(FEE_BUMP_TX))).toBe(
      "Fee 0.00004 XLM · fee-bumped · 1 operation"
    );
  });

  it("pluralises the operation count", () => {
    expect(formatHistoryFee({ fee_charged: "300", operation_count: 3 })).toBe(
      "Fee 0.00003 XLM · 3 operations"
    );
  });

  it("shows a missing fee as unknown, not zero", () => {
    expect(formatHistoryFee({ fee_charged: null, operation_count: 1 })).toBe(
      "Fee unknown · 1 operation"
    );
    expect(formatHistoryFee({})).toBe("Fee unknown · operations unknown");
    expect(formatHistoryFee(undefined)).toBe("Fee unknown · operations unknown");
  });

  it("shows a real zero fee as zero", () => {
    expect(formatHistoryFee({ fee_charged: "0", operation_count: 1 })).toBe(
      "Fee 0 XLM · 1 operation"
    );
  });

  it("formats whole-XLM and large fees without float rounding", () => {
    expect(formatHistoryFee({ fee_charged: "10000000", operation_count: 1 })).toContain("Fee 1 XLM");
    expect(formatHistoryFee({ fee_charged: "123456789", operation_count: 1 })).toContain(
      "Fee 12.3456789 XLM"
    );
  });
});
