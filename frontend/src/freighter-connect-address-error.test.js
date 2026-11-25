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

const { connectFreighterWallet } = await import("./freighter");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("connectFreighterWallet address errors", () => {
  it("preserves the error message returned by Freighter", async () => {
    isConnectedMock.mockResolvedValue({ isConnected: true });
    setAllowedMock.mockResolvedValue({ isAllowed: true });
    getAddressMock.mockResolvedValue({ error: { message: "locked" } });

    await expect(connectFreighterWallet()).rejects.toThrow("locked");

    expect(getAddressMock).toHaveBeenCalledOnce();
  });
});
