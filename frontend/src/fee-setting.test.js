import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for the persisted per-operation fee and its use in the
 * payment, trustline, and path-payment builders. Horizon and Freighter are
 * mocked; the real SDK builds the transaction.
 */

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
  FEE_STORAGE_KEY,
  getFeePerOperation,
  loadFeeSetting,
  parseFeeStroops,
  saveFeeSetting,
} = await import("./feeSetting");
const {
  changeTrustWithFreighter,
  pathPaymentWithFreighter,
  sendPaymentWithFreighter,
} = await import("./freighter");
const { setActiveNetwork } = await import("./network");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const DESTINATION = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

beforeEach(() => {
  setActiveNetwork("TESTNET");
  vi.stubGlobal("localStorage", memoryStorage());
  vi.clearAllMocks();
  loadAccountMock.mockResolvedValue(new StellarSdk.Account(SOURCE, "1"));
  submitTransactionMock.mockResolvedValue({ hash: "feehash", ledger: 2 });
  signTransactionMock.mockImplementation(async (xdr) => ({ signedTxXdr: xdr }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  setActiveNetwork("TESTNET");
});

describe("parseFeeStroops", () => {
  it("accepts positive whole stroops", () => {
    expect(parseFeeStroops("500")).toBe("500");
    expect(parseFeeStroops(700)).toBe("700");
    expect(parseFeeStroops(" 100 ")).toBe("100");
  });

  it("refuses zero", () => {
    expect(() => parseFeeStroops("0")).toThrow(/greater than zero/);
    expect(() => parseFeeStroops(0)).toThrow(/greater than zero/);
  });

  it("refuses negative, fractional, and non-numeric fees", () => {
    expect(() => parseFeeStroops("-1")).toThrow(/whole number/);
    expect(() => parseFeeStroops("1.5")).toThrow(/whole number/);
    expect(() => parseFeeStroops("abc")).toThrow(/whole number/);
    expect(() => parseFeeStroops("")).toThrow(/whole number/);
  });
});

describe("fee persistence", () => {
  it("round-trips the selection through localStorage", () => {
    const saved = saveFeeSetting({ source: "p99", stroops: "900" });

    expect(saved).toEqual({ source: "p99", stroops: "900" });
    expect(loadFeeSetting()).toEqual({ source: "p99", stroops: "900" });
    expect(getFeePerOperation()).toBe("900");
    expect(localStorage.getItem(FEE_STORAGE_KEY)).toContain('"900"');
  });

  it("returns null when nothing is stored", () => {
    expect(loadFeeSetting()).toBeNull();
    expect(getFeePerOperation()).toBeNull();
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem(FEE_STORAGE_KEY, "{not-json");
    expect(loadFeeSetting()).toBeNull();

    localStorage.setItem(
      FEE_STORAGE_KEY,
      JSON.stringify({ source: "p10", stroops: "0" })
    );
    expect(loadFeeSetting()).toBeNull();
  });

  it("keeps the previous choice when a zero fee is refused", () => {
    saveFeeSetting({ source: "custom", stroops: "500" });

    expect(() =>
      saveFeeSetting({ source: "custom", stroops: "0" })
    ).toThrow(/greater than zero/);

    expect(loadFeeSetting()).toEqual({ source: "custom", stroops: "500" });
  });
});

describe("transactions use the selected fee per operation", () => {
  it("applies a typed fee to a built payment", async () => {
    saveFeeSetting({ source: "custom", stroops: "750" });

    await sendPaymentWithFreighter(SOURCE, DESTINATION, "1");

    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
    expect(submitTransactionMock.mock.calls[0][0].fee).toBe("750");
  });

  it("applies the fee to a trustline", async () => {
    saveFeeSetting({ source: "p10", stroops: "550" });

    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER, "100");

    expect(submitTransactionMock.mock.calls[0][0].fee).toBe("550");
  });

  it("applies the fee to a path payment", async () => {
    saveFeeSetting({ source: "mode", stroops: "600" });

    await pathPaymentWithFreighter({
      publicKey: SOURCE,
      destination: DESTINATION,
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: true },
      amount: "1",
      destMin: "0.5",
    });

    expect(submitTransactionMock.mock.calls[0][0].fee).toBe("600");
  });

  it("falls back to the SDK fee when no choice is saved", async () => {
    await sendPaymentWithFreighter(SOURCE, DESTINATION, "1");

    expect(submitTransactionMock.mock.calls[0][0].fee).toBe(
      StellarSdk.BASE_FEE
    );
  });
});
