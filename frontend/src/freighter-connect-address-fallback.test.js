import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAddressMock, isConnectedMock, setAllowedMock } = vi.hoisted(() => ({
  getAddressMock: vi.fn(),
  isConnectedMock: vi.fn(),
  setAllowedMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  getAddress: getAddressMock,
  isConnected: isConnectedMock,
  setAllowed: setAllowedMock,
  getNetwork: vi.fn(async () => {
    const { getActiveNetwork } = await import("./network");
    const active = getActiveNetwork();
    return { network: active.id, networkPassphrase: active.passphrase };
  }),
  signTransaction: vi.fn(),
}));

const { connectFreighterWallet } = await import("./freighter");

beforeEach(() => {
  vi.clearAllMocks();
  isConnectedMock.mockResolvedValue({ isConnected: true });
  setAllowedMock.mockResolvedValue({ isAllowed: true });
});

describe("connectFreighterWallet address fallback", () => {
  it.each([{ error: {} }, {}])(
    "rejects when getAddress resolves %o without an address",
    async (addressResult) => {
      getAddressMock.mockResolvedValue(addressResult);

      await expect(connectFreighterWallet()).rejects.toThrow(
        "Could not read the address from Freighter."
      );
    }
  );
});