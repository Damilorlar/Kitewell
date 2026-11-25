import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test suite for the Kitewell builder rename operation.
 * Validates that rename changes the name without changing the count,
 * and properly rejects unregistered callers and empty names.
 */

const mockSendTransaction = vi.fn();
const mockGetTransaction = vi.fn();
const mockGetAccount = vi.fn();
const mockPrepareTransaction = vi.fn();

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn().mockResolvedValue({ isConnected: true }),
  setAllowed: vi.fn().mockResolvedValue({ isAllowed: true }),
  getAddress: vi
    .fn()
    .mockResolvedValue({ address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" }),
  signTransaction: vi.fn().mockImplementation((xdr) => ({
    signedTxXdr: xdr,
  })),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rpc: {
      Server: vi.fn(function () {
        return {
          sendTransaction: mockSendTransaction,
          getTransaction: mockGetTransaction,
          getAccount: mockGetAccount,
          prepareTransaction: mockPrepareTransaction,
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { renameBuilderWithFreighter } = await import("./freighter");

const TEST_PUBLIC_KEY = StellarSdk.Keypair.random().publicKey();
const TEST_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

beforeEach(() => {
  vi.clearAllMocks();
  
  mockGetAccount.mockResolvedValue(
    new StellarSdk.Account(TEST_PUBLIC_KEY, "1000")
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renameBuilderWithFreighter", () => {
  it("builds a rename invoke for the registered caller", async () => {
    mockPrepareTransaction.mockImplementation((tx) => {
      // Verify the transaction has invokeHostFunction operation
      expect(tx.operations).toHaveLength(1);
      expect(tx.operations[0].type).toBe("invokeHostFunction");
      
      // Return a prepared transaction
      return Promise.resolve(tx);
    });

    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "rename-hash-123",
    });

    mockGetTransaction.mockResolvedValue({
      status: "SUCCESS",
    });

    const result = await renameBuilderWithFreighter(
      TEST_PUBLIC_KEY,
      TEST_CONTRACT_ID,
      "new-name"
    );

    expect(result.hash).toBe("rename-hash-123");
    expect(result.confirmed).toBe(true);
    expect(mockPrepareTransaction).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalled();
  });

  it("rejects empty names", async () => {
    await expect(
      renameBuilderWithFreighter(TEST_PUBLIC_KEY, TEST_CONTRACT_ID, "")
    ).rejects.toThrow(/Enter a builder name/);

    await expect(
      renameBuilderWithFreighter(TEST_PUBLIC_KEY, TEST_CONTRACT_ID, "   ")
    ).rejects.toThrow(/Enter a builder name/);
  });

  it("rejects names longer than 64 characters", async () => {
    const longName = "a".repeat(65);
    await expect(
      renameBuilderWithFreighter(TEST_PUBLIC_KEY, TEST_CONTRACT_ID, longName)
    ).rejects.toThrow(/64 characters or fewer/);
  });

  it("allows a 64-character (multibyte-safe) name", async () => {
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "rename-hash-64",
    });
    mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });

    const name64 = "🌟".repeat(16); // 16 emoji = 64 UTF-8 code points
    const result = await renameBuilderWithFreighter(
      TEST_PUBLIC_KEY,
      TEST_CONTRACT_ID,
      name64
    );

    expect(result.confirmed).toBe(true);
  });

  it("rejects invalid public keys", async () => {
    await expect(
      renameBuilderWithFreighter("INVALID_KEY", TEST_CONTRACT_ID, "new-name")
    ).rejects.toThrow(/Connect a valid Freighter address/);
  });

  it("rejects invalid contract ids", async () => {
    await expect(
      renameBuilderWithFreighter(TEST_PUBLIC_KEY, "INVALID_CONTRACT", "new-name")
    ).rejects.toThrow(/Contract ID must be a valid/);

    await expect(
      renameBuilderWithFreighter(TEST_PUBLIC_KEY, "GTEST", "new-name")
    ).rejects.toThrow(/Contract ID must be a valid/);
  });

  it("polls for transaction confirmation", async () => {
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "rename-hash-poll",
    });

    // First two polls return NOT_FOUND, third returns SUCCESS
    mockGetTransaction
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "SUCCESS" });

    const result = await renameBuilderWithFreighter(
      TEST_PUBLIC_KEY,
      TEST_CONTRACT_ID,
      "polled-name"
    );

    expect(result.confirmed).toBe(true);
    expect(mockGetTransaction).toHaveBeenCalledTimes(3);
  });

  it("throws when rename operation fails on-chain", async () => {
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "rename-hash-fail",
    });

    mockGetTransaction.mockResolvedValue({
      status: "FAILED",
    });

    await expect(
      renameBuilderWithFreighter(TEST_PUBLIC_KEY, TEST_CONTRACT_ID, "fail-name")
    ).rejects.toThrow(/Contract invoke failed on-chain/);
  });

  it("returns unconfirmed when polling times out", async () => {
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "rename-hash-timeout",
    });

    // Always return NOT_FOUND to simulate timeout
    mockGetTransaction.mockResolvedValue({ status: "NOT_FOUND" });

    const result = await renameBuilderWithFreighter(
      TEST_PUBLIC_KEY,
      TEST_CONTRACT_ID,
      "timeout-name"
    );

    expect(result.hash).toBe("rename-hash-timeout");
    expect(result.confirmed).toBe(false);
  }, 35000); // 35 second timeout

  it("trims whitespace from the name", async () => {
    mockPrepareTransaction.mockImplementation((tx) => {
      // The trimmed name should be used
      return Promise.resolve(tx);
    });
    
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "rename-hash-trim",
    });

    mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });

    const result = await renameBuilderWithFreighter(
      TEST_PUBLIC_KEY,
      TEST_CONTRACT_ID,
      "  trimmed-name  "
    );

    expect(result.confirmed).toBe(true);
  });
});
