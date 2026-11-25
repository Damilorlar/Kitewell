import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #131: lock the passphrase passed to Freighter when signing a trustline.
 *
 * `trustline.test.js` asserts the operation shape but never looks at the
 * signing options, and every other suite leaves the network on Testnet. Nothing
 * therefore stops `changeTrustWithFreighter` (via `signWithFreighter`) from
 * hard-coding `Networks.TESTNET`, or from reading the passphrase once at module
 * load, without a test failing — on Futurenet that would make Freighter refuse
 * the signature even though the Horizon submit used the right URL.
 *
 * Freighter and Horizon are mocked; the real SDK builds the operation, so the
 * passphrase asserted below is the one a real wallet would be handed.
 */

const {
  loadAccountMock,
  submitTransactionMock,
  signTransactionMock,
  ledgerCallMock,
  builderPassphrases,
} = vi.hoisted(() => ({
  loadAccountMock: vi.fn(),
  submitTransactionMock: vi.fn(),
  signTransactionMock: vi.fn(),
  ledgerCallMock: vi.fn(),
  builderPassphrases: [],
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
  // Records the passphrase each transaction is *built* with, then delegates to
  // the real builder so the operation and its XDR stay genuine. The XDR carries
  // no passphrase, so this is the only way to tell a correctly built
  // transaction from one left on the wrong network.
  const TransactionBuilder = vi.fn(function (sourceAccount, options) {
    builderPassphrases.push(options?.networkPassphrase);
    return new actual.TransactionBuilder(sourceAccount, options);
  });
  for (const [name, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(actual.TransactionBuilder)
  )) {
    if (["length", "name", "prototype"].includes(name)) continue;
    Object.defineProperty(TransactionBuilder, name, {
      ...descriptor,
      configurable: true,
    });
  }

  return {
    ...actual,
    TransactionBuilder,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return {
          loadAccount: loadAccountMock,
          submitTransaction: submitTransactionMock,
          ledgers: () => ({
            order: () => ({ limit: () => ({ call: ledgerCallMock }) }),
          }),
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { changeTrustWithFreighter } = await import("./freighter");
const { DEFAULT_NETWORK_ID, getActiveNetworkId, setActiveNetwork } =
  await import("./network");

const SOURCE = StellarSdk.Keypair.random().publicKey();
const ISSUER = StellarSdk.Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  builderPassphrases.length = 0;
  loadAccountMock.mockResolvedValue(
    Object.assign(new StellarSdk.Account(SOURCE, "1"), {
      subentry_count: 0,
      balances: [{ asset_type: "native", balance: "100.0000000" }],
    })
  );
  ledgerCallMock.mockResolvedValue({
    records: [{ base_reserve_in_stroops: "5000000" }],
  });
  submitTransactionMock.mockResolvedValue({ hash: "trusthash", ledger: 9 });
  signTransactionMock.mockImplementation(async (xdr) => ({
    signedTxXdr: xdr,
  }));
});

// The network is module-level shared state, so a leaked FUTURENET would make
// the Testnet assertions below depend on test order.
afterEach(() => {
  setActiveNetwork("TESTNET");
});

/** The options object handed to the mocked Freighter `signTransaction`. */
function signOptions(callIndex = 0) {
  expect(signTransactionMock.mock.calls.length).toBeGreaterThan(callIndex);
  return signTransactionMock.mock.calls[callIndex][1];
}

/** The unsigned XDR handed to Freighter for the current call. */
function signedXdr(callIndex = 0) {
  return signTransactionMock.mock.calls[callIndex][0];
}

/** Re-parse a signed XDR through the real SDK. */
function parsedTransaction(callIndex = 0) {
  return StellarSdk.TransactionBuilder.fromXDR(
    signedXdr(callIndex),
    StellarSdk.Networks.TESTNET
  );
}

describe("changeTrustWithFreighter sign options", () => {
  it("signs with the Testnet passphrase and the source address", async () => {
    expect(getActiveNetworkId()).toBe("TESTNET");

    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);

    expect(signOptions()).toEqual({
      networkPassphrase: StellarSdk.Networks.TESTNET,
      address: SOURCE,
    });
  });

  it("signs with the Futurenet passphrase after switching networks", async () => {
    setActiveNetwork("FUTURENET");

    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);

    expect(getActiveNetworkId()).toBe("FUTURENET");
    expect(signOptions().networkPassphrase).toBe(
      StellarSdk.Networks.FUTURENET
    );
    expect(signOptions().networkPassphrase).not.toBe(
      StellarSdk.Networks.TESTNET
    );
    expect(signOptions().address).toBe(SOURCE);
  });

  it("reads the passphrase at sign time, not once at module load", async () => {
    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);
    setActiveNetwork("FUTURENET");
    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);
    setActiveNetwork("TESTNET");
    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);

    expect(signTransactionMock).toHaveBeenCalledTimes(3);
    expect(signOptions(0).networkPassphrase).toBe(
      StellarSdk.Networks.TESTNET
    );
    expect(signOptions(1).networkPassphrase).toBe(
      StellarSdk.Networks.FUTURENET
    );
    expect(signOptions(2).networkPassphrase).toBe(
      StellarSdk.Networks.TESTNET
    );
  });

  it("builds the transaction on the same network it signs for", async () => {
    setActiveNetwork("FUTURENET");

    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);

    // A builder left on a hard-coded passphrase would hand Freighter a
    // Futurenet signature request for a transaction built elsewhere.
    expect(builderPassphrases).toEqual([StellarSdk.Networks.FUTURENET]);
    expect(builderPassphrases[0]).toBe(signOptions().networkPassphrase);

    const tx = parsedTransaction();
    expect(tx.operations[0].type).toBe("changeTrust");
    expect(tx.operations[0].limit).toBe("1000000.0000000");
  });

  it("keeps the changeTrust op intact for the limit-0 removal path", async () => {
    setActiveNetwork("FUTURENET");

    await changeTrustWithFreighter(SOURCE, "usdc", ISSUER, "0");

    const tx = parsedTransaction();
    expect(tx.operations[0].type).toBe("changeTrust");
    expect(tx.operations[0].limit).toBe("0.0000000");
    expect(tx.operations[0].line.getCode()).toBe("USDC");
    expect(tx.operations[0].line.getIssuer()).toBe(ISSUER);
  });

  it("sends the signature to the Horizon host of the active network", async () => {
    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);
    expect(StellarSdk.Horizon.Server.mock.calls[0][0]).toBe(
      "https://horizon-testnet.stellar.org"
    );
    expect(builderPassphrases).toEqual([StellarSdk.Networks.TESTNET]);

    submitTransactionMock.mockClear();
    StellarSdk.Horizon.Server.mockClear();
    builderPassphrases.length = 0;
    setActiveNetwork("FUTURENET");
    await changeTrustWithFreighter(SOURCE, "USDC", ISSUER);

    expect(StellarSdk.Horizon.Server.mock.calls[0][0]).toBe(
      "https://horizon-futurenet.stellar.org"
    );
    expect(builderPassphrases).toEqual([StellarSdk.Networks.FUTURENET]);
    const tx = submitTransactionMock.mock.calls[0][0];
    expect(tx.source).toBe(SOURCE);
    expect(tx.operations[0].type).toBe("changeTrust");
  });

  it("uses a passphrase that differs per network so the checks are real", () => {
    expect(StellarSdk.Networks.TESTNET).not.toBe(
      StellarSdk.Networks.FUTURENET
    );
    expect(DEFAULT_NETWORK_ID).toBe("TESTNET");
  });
});
