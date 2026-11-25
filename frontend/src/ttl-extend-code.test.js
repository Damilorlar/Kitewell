import { describe, it, expect, vi, beforeEach } from "vitest";

const { sorobanServerMock, signTransactionMock } = vi.hoisted(() => ({
  sorobanServerMock: {
    getAccount: vi.fn(),
    prepareTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getLatestLedger: vi.fn(),
    getLedgerEntries: vi.fn(),
  },
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
    rpc: {
      ...actual.rpc,
      Server: vi.fn(function () {
        return sorobanServerMock;
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { extendCodeTTL } = await import("./freighter");

describe("extendCodeTTL", () => {
  const mockPublicKey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const mockWasmHash = "a".repeat(64);
  const mockCurrentLedger = 1000;
  const mockExtendTo = 101000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds code-extend operation for wasm hash", async () => {
    const mockAccount = new StellarSdk.Account(mockPublicKey, "100");

    // Build a real transaction to get valid XDR
    const codeKey = StellarSdk.xdr.LedgerKey.contractCode(
      new StellarSdk.xdr.LedgerKeyContractCode({
        hash: Buffer.from(mockWasmHash, "hex"),
      })
    );

    const sorobanData = new StellarSdk.SorobanDataBuilder().setReadOnly([codeKey]).build();
    const realTransaction = new StellarSdk.TransactionBuilder(mockAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .setSorobanData(sorobanData)
      .addOperation(
        StellarSdk.Operation.extendFootprintTtl({
          extendTo: mockExtendTo - mockCurrentLedger,
        })
      )
      .setTimeout(180)
      .build();

    const signedXdr = realTransaction.toXDR();

    sorobanServerMock.getAccount.mockResolvedValue(mockAccount);
    sorobanServerMock.prepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    sorobanServerMock.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "abc123def456",
    });

    signTransactionMock.mockResolvedValue({
      signedTxXdr: signedXdr,
    });

    const result = await extendCodeTTL(
      mockPublicKey,
      mockWasmHash,
      mockExtendTo,
      mockCurrentLedger
    );

    expect(result).toEqual({
      hash: "abc123def456",
      deadline: mockExtendTo,
    });

    expect(sorobanServerMock.getAccount).toHaveBeenCalledWith(mockPublicKey);
    expect(sorobanServerMock.prepareTransaction).toHaveBeenCalled();
    expect(sorobanServerMock.sendTransaction).toHaveBeenCalled();
    expect(signTransactionMock).toHaveBeenCalled();

    // Verify the signed transaction was called with correct passphrase
    const signCall = signTransactionMock.mock.calls[0];
    expect(signCall[1].networkPassphrase).toBe(StellarSdk.Networks.TESTNET);
  });

  it("refuses non-hex wasm hash", async () => {
    await expect(
      extendCodeTTL(mockPublicKey, "not-hex", mockExtendTo, mockCurrentLedger)
    ).rejects.toThrow("Wasm hash must be exactly 64 hexadecimal characters");
  });

  it("refuses wasm hash that is not 64 chars", async () => {
    await expect(
      extendCodeTTL(mockPublicKey, "abc123", mockExtendTo, mockCurrentLedger)
    ).rejects.toThrow("Wasm hash must be exactly 64 hexadecimal characters");
  });

  it("refuses deadline not in future", async () => {
    await expect(
      extendCodeTTL(mockPublicKey, mockWasmHash, 500, mockCurrentLedger)
    ).rejects.toThrow("TTL deadline must be in the future");
  });
});
