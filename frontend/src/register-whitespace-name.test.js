import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signTransactionMock } = vi.hoisted(() => ({
  signTransactionMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(async () => {
    const { getActiveNetwork } = await import("./network");
    const active = getActiveNetwork();
    return { network: active.id, networkPassphrase: active.passphrase };
  }),
  signTransaction: signTransactionMock,
}));

const { registerBuilderWithFreighter } = await import("./freighter");

const USER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CONTRACT_ID =
  "CCWLNS5HECRJ2GM3Q6JZZDV334ZXYO6EKZLFPLQRXO6SUDAKMS4U3E3X";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerBuilderWithFreighter whitespace name", () => {
  it("rejects a single-space name without signing", async () => {
    await expect(
      registerBuilderWithFreighter(USER, CONTRACT_ID, " ")
    ).rejects.toThrow("Enter a builder name to register.");

    expect(signTransactionMock).not.toHaveBeenCalled();
  });
});