import { describe, expect, it } from "vitest";
import {
  liquidityPoolDeposit,
  liquidityPoolWithdraw,
} from "./stellar";

const POOL_ID = "ab".repeat(32);

describe("liquidity pool operations", () => {
  it("builds a deposit operation with both reserves and price bounds", () => {
    const operation = liquidityPoolDeposit(
      POOL_ID.toUpperCase(),
      "12.5",
      "34",
      "0.5",
      "2"
    );
    const payload = operation.body().liquidityPoolDepositOp();

    expect(operation.body().switch().name).toBe("liquidityPoolDeposit");
    expect(payload.liquidityPoolId().toString("hex")).toBe(POOL_ID);
    expect(payload.maxAmountA().toString()).toBe("125000000");
    expect(payload.maxAmountB().toString()).toBe("340000000");
    expect(payload.minPrice().n()).toBe(1);
    expect(payload.minPrice().d()).toBe(2);
    expect(payload.maxPrice().n()).toBe(2);
    expect(payload.maxPrice().d()).toBe(1);
  });

  it("builds a withdrawal operation with share amount and both minimum reserves", () => {
    const operation = liquidityPoolWithdraw(POOL_ID, "9", "1", "2");
    const payload = operation.body().liquidityPoolWithdrawOp();

    expect(operation.body().switch().name).toBe("liquidityPoolWithdraw");
    expect(payload.liquidityPoolId().toString("hex")).toBe(POOL_ID);
    expect(payload.amount().toString()).toBe("90000000");
    expect(payload.minAmountA().toString()).toBe("10000000");
    expect(payload.minAmountB().toString()).toBe("20000000");
  });

  it("rejects malformed pool IDs before constructing an SDK operation", () => {
    expect(() =>
      liquidityPoolDeposit("not-hex", "1", "1", "0.5", "2")
    ).toThrow("Pool ID must be 64 hexadecimal characters.");

    expect(() =>
      liquidityPoolWithdraw(POOL_ID.slice(2), "1", "1", "1")
    ).toThrow("Pool ID must be 64 hexadecimal characters.");
  });
});
