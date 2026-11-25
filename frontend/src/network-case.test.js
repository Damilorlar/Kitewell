import { describe, expect, it } from "vitest";
import { isSupportedNetwork } from "./network";

/**
 * Network ids are the exact keys of `NETWORKS`, so the lookup is a plain
 * property read. Ids that differ only in case are not keys and must not be
 * accepted — a silently accepted `testnet` would resolve `NETWORKS[id]` to
 * `undefined` downstream and break Horizon and passphrase use.
 */

describe("isSupportedNetwork case sensitivity", () => {
  it("accepts the exact network ids", () => {
    expect(isSupportedNetwork("TESTNET")).toBe(true);
    expect(isSupportedNetwork("FUTURENET")).toBe(true);
  });

  it("rejects ids that differ only in case", () => {
    expect(isSupportedNetwork("testnet")).toBe(false);
    expect(isSupportedNetwork("Futurenet")).toBe(false);
  });

  it("rejects other case variants of the exact ids", () => {
    expect(isSupportedNetwork("Testnet")).toBe(false);
    expect(isSupportedNetwork("futurenet")).toBe(false);
    expect(isSupportedNetwork("FUTURENET ")).toBe(false);
  });
});
