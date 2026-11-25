import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for contract instance TTL reads and extension. Soroban RPC
 * and Freighter are mocked; the real SDK builds and round-trips the transaction.
 */

const {
  sorobanServerMock,
  signTransactionMock,
} = vi.hoisted(() => ({
  sorobanServerMock: {
    getLedgerEntries: vi.fn(),
    getAccount: vi.fn(),
    prepareTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
  },
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
    rpc: {
      ...actual.rpc,
      Server: vi.fn(function () {
        return sorobanServerMock;
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const {
  readContractInstanceTtl,
  extendContractTtlWithFreighter,
} = await import("./freighter");

const CONTRACT_ID =
  "CCWLNS5HECRJ2GM3Q6JZZDV334ZXYO6EKZLFPLQRXO6SUDAKMS4U3E3X";
const USER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readContractInstanceTtl", () => {
  it("reports the instance deadline and ledgers remaining", async () => {
    sorobanServerMock.getLedgerEntries.mockResolvedValue({
      latestLedger: 1000,
      entries: [{ liveUntilLedgerSeq: 6000 }],
    });

    await expect(readContractInstanceTtl(CONTRACT_ID)).resolves.toEqual({
      latestLedger: 1000,
      liveUntilLedgerSeq: 6000,
      ledgersRemaining: 5000,
    });
    expect(sorobanServerMock.getLedgerEntries).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing or malformed contract id before any RPC call", async () => {
    await expect(readContractInstanceTtl("")).rejects.toThrow(
      /valid Soroban contract/
    );
    expect(sorobanServerMock.getLedgerEntries).not.toHaveBeenCalled();
  });
});

describe("extendContractTtlWithFreighter", () => {
  it("builds an extendFootprintTtl op for the configured contract id", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(
      new StellarSdk.Account(USER, "7")
    );
    // Returning the raw tx keeps the footprint we set; this test is about the
    // operation shape, not RPC assembly.
    sorobanServerMock.prepareTransaction.mockImplementation(async (tx) => tx);
    signTransactionMock.mockImplementation(async (xdr) => ({
      error: null,
      signedTxXdr: xdr,
    }));
    sorobanServerMock.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "extendhash",
    });
    sorobanServerMock.getTransaction.mockResolvedValue({ status: "SUCCESS" });

    const result = await extendContractTtlWithFreighter(
      USER,
      CONTRACT_ID,
      9000,
      { currentDeadline: 6000, latestLedger: 4000 }
    );

    expect(result).toEqual({
      hash: "extendhash",
      liveUntilLedgerSeq: 9000,
      confirmed: true,
    });

    const [xdr, options] = signTransactionMock.mock.calls[0];
    expect(options).toEqual({
      networkPassphrase: StellarSdk.Networks.TESTNET,
      address: USER,
    });
    const tx = StellarSdk.TransactionBuilder.fromXDR(
      xdr,
      StellarSdk.Networks.TESTNET
    );
    // Exactly one op: extend TTL. Never register / pause / unregister.
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0].type).toBe("extendFootprintTtl");
    // extendTo is a ledger count from the latest ledger, not the absolute
    // deadline: 9000 - 4000 = 5000 ledgers remaining.
    expect(tx.operations[0].extendTo).toBe(5000);

    // The footprint targets the configured contract instance.
    const footprint = tx
      .toEnvelope()
      .v1()
      .tx()
      .ext()
      .value()
      .resources()
      .footprint();
    const expectedKey = new StellarSdk.Contract(CONTRACT_ID).getFootprint();
    expect(
      StellarSdk.xdr.LedgerKey.toXDR(footprint.readOnly()[0])
    ).toEqual(StellarSdk.xdr.LedgerKey.toXDR(expectedKey));
  });

  it("refuses a deadline that is not past the current one, locally", async () => {
    await expect(
      extendContractTtlWithFreighter(USER, CONTRACT_ID, 6000, {
        currentDeadline: 6000,
      })
    ).rejects.toThrow(/later than the current one/);
    expect(sorobanServerMock.getAccount).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("reads the current deadline itself when none is supplied", async () => {
    sorobanServerMock.getLedgerEntries.mockResolvedValue({
      latestLedger: 1000,
      entries: [{ liveUntilLedgerSeq: 6000 }],
    });

    await expect(
      extendContractTtlWithFreighter(USER, CONTRACT_ID, 6000)
    ).rejects.toThrow(/later than the current one/);
    expect(sorobanServerMock.getLedgerEntries).toHaveBeenCalledTimes(1);
  });
});
