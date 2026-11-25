import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for issuer auth flag handling: the pure setOptions body
 * builder (including the immutable confirmation gate) and the Freighter
 * wrapper that actually signs a setOptions op. Nothing touches the network.
 */

vi.mock("./api", () => ({
  fetchAccountViaApi: vi.fn(),
  fetchPaymentsViaApi: vi.fn(),
}));

const { loadAccountMock, submitTransactionMock, signTransactionMock } =
  vi.hoisted(() => ({
    loadAccountMock: vi.fn(),
    submitTransactionMock: vi.fn(),
    signTransactionMock: vi.fn(),
  }));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: signTransactionMock,
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return {
          loadAccount: loadAccountMock,
          submitTransaction: submitTransactionMock,
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const {
  ACCOUNT_FLAG_BITS,
  buildSetOptionsBody,
  getAccountAuthConfig,
} = await import("./stellar");
const { setAccountOptionsWithFreighter } = await import("./freighter");

const SOURCE = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildSetOptionsBody", () => {
  it("requires the literal IMMUTABLE confirmation before setting the flag", () => {
    expect(() => buildSetOptionsBody({ authImmutable: true })).toThrow(
      /Type IMMUTABLE/
    );
    expect(() =>
      buildSetOptionsBody({
        authImmutable: true,
        immutableConfirmation: "immutable",
      })
    ).toThrow(/Type IMMUTABLE/);

    expect(
      buildSetOptionsBody({
        authImmutable: true,
        immutableConfirmation: "IMMUTABLE",
      })
    ).toEqual({ setFlags: ACCOUNT_FLAG_BITS.authImmutable });
  });

  it("refuses to turn immutable off once it is reported as set", () => {
    expect(() =>
      buildSetOptionsBody({
        current: { authImmutable: true },
        authImmutable: false,
        immutableConfirmation: "IMMUTABLE",
      })
    ).toThrow(/cannot be turned off/);
  });

  it("maps required/revocable toggles to setFlags and clearFlags", () => {
    expect(
      buildSetOptionsBody({
        current: {
          authRequired: false,
          authRevocable: true,
          authImmutable: false,
        },
        authRequired: true,
        authRevocable: false,
        homeDomain: "example.com",
      })
    ).toEqual({
      homeDomain: "example.com",
      setFlags: ACCOUNT_FLAG_BITS.authRequired,
      clearFlags: ACCOUNT_FLAG_BITS.authRevocable,
    });
  });

  it("refuses a home domain longer than 32 bytes", () => {
    expect(() => buildSetOptionsBody({ homeDomain: "a".repeat(33) })).toThrow(
      /32 bytes or fewer/
    );
    // 17 two-byte characters = 34 bytes.
    expect(() => buildSetOptionsBody({ homeDomain: "é".repeat(17) })).toThrow(
      /32 bytes or fewer/
    );
    expect(buildSetOptionsBody({ homeDomain: "a".repeat(32) }).homeDomain).toBe(
      "a".repeat(32)
    );
  });
});

describe("getAccountAuthConfig", () => {
  it("reads flags and the home domain from Horizon", async () => {
    loadAccountMock.mockResolvedValue({
      home_domain: "kitewell.dev",
      flags: {
        auth_required: true,
        auth_revocable: false,
        auth_immutable: false,
      },
    });

    await expect(getAccountAuthConfig(SOURCE)).resolves.toEqual({
      homeDomain: "kitewell.dev",
      authRequired: true,
      authRevocable: false,
      authImmutable: false,
    });
  });
});

describe("setAccountOptionsWithFreighter", () => {
  beforeEach(() => {
    loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
    submitTransactionMock.mockResolvedValue({ hash: "optshash" });
    signTransactionMock.mockImplementation(async (xdr) => ({
      signedTxXdr: xdr,
    }));
  });

  it("builds a setOptions op carrying the confirmed immutable flag", async () => {
    await setAccountOptionsWithFreighter(SOURCE, {
      current: { authImmutable: false },
      authImmutable: true,
      immutableConfirmation: "IMMUTABLE",
      homeDomain: "kitewell.dev",
    });

    const op = submitTransactionMock.mock.calls[0][0].operations[0];
    expect(op.type).toBe("setOptions");
    expect(op.setFlags).toBe(ACCOUNT_FLAG_BITS.authImmutable);
    expect(op.homeDomain).toBe("kitewell.dev");
    expect(signTransactionMock).toHaveBeenCalledTimes(1);
  });

  it("never signs when the immutable confirmation is missing", async () => {
    await expect(
      setAccountOptionsWithFreighter(SOURCE, { authImmutable: true })
    ).rejects.toThrow(/Type IMMUTABLE/);
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
