import { beforeEach, describe, expect, it, vi } from "vitest";

const { isConnectedMock, setAllowedMock, getAddressMock } = vi.hoisted(() => ({
  isConnectedMock: vi.fn(),
  setAllowedMock: vi.fn(),
  getAddressMock: vi.fn(),
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
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn(function () {
        return {};
      }),
    },
  };
});

const { connectFreighterWallet } = await import("./freighter");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("connectFreighterWallet", () => {
  it("returns the address when Freighter is installed and permission is allowed", async () => {
    isConnectedMock.mockResolvedValue({ isConnected: true });
    setAllowedMock.mockResolvedValue({ isAllowed: true });
    getAddressMock.mockResolvedValue({ address: "GTEST" });

    await expect(connectFreighterWallet()).resolves.toBe("GTEST");
  });
});
