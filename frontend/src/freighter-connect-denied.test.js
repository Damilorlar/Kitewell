import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { isConnectedMock, setAllowedMock, getAddressMock, signTransactionMock } = vi.hoisted(() => ({
  isConnectedMock: vi.fn(),
  setAllowedMock: vi.fn(),
  getAddressMock: vi.fn(),
  signTransactionMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: isConnectedMock,
  setAllowed: setAllowedMock,
  getAddress: getAddressMock,
  getNetwork: vi.fn(async () => {
    const { getActiveNetwork } = await import("./network");
    const active = getActiveNetwork();
    return { network: active.id, networkPassphrase: active.passphrase };
  }),
  signTransaction: signTransactionMock,
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn(function () {
        return {
          simulateTransaction: vi.fn(),
          prepareTransaction: vi.fn(),
          sendTransaction: vi.fn(),
          getTransaction: vi.fn(),
          getAccount: vi.fn(),
        };
      }),
    },
  };
});

const { connectFreighterWallet } = await import("./freighter");

describe("connectFreighterWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects with Connection denied when setAllowed returns isAllowed false", async () => {
    // Mock isConnected to return connected
    isConnectedMock.mockResolvedValueOnce({ isConnected: true });
    // Mock setAllowed to return not allowed
    setAllowedMock.mockResolvedValueOnce({ isAllowed: false });
    // getAddress should not be called (no need to mock, just assert not called)

    await expect(connectFreighterWallet()).rejects.toThrow(
      "Connection denied. Allow Kitewell in Freighter to continue."
    );
    expect(isConnectedMock).toHaveBeenCalledTimes(1);
    expect(setAllowedMock).toHaveBeenCalledTimes(1);
    expect(getAddressMock).not.toHaveBeenCalled();
  });
});
