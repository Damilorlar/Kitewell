import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test suite for the Kitewell contract restore operation.
 * Validates that RestoreFootprint is built correctly for archived contracts
 * and skipped when the contract is live.
 */

const mockSendTransaction = vi.fn();
const mockGetTransaction = vi.fn();
const mockGetAccount = vi.fn();
const mockPrepareTransaction = vi.fn();
const mockSimulateTransaction = vi.fn();

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
          simulateTransaction: mockSimulateTransaction,
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { restoreContractWithFreighter, readKitewellState } = await import("./freighter");

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

describe("restoreContractWithFreighter", () => {
  it("builds RestoreFootprint for the configured contract instance", async () => {
    mockPrepareTransaction.mockImplementation((tx) => {
      // Verify the transaction has RestoreFootprint operation
      expect(tx.operations).toHaveLength(1);
      expect(tx.operations[0].type).toBe("restoreFootprint");
      
      // Return a prepared transaction
      return Promise.resolve(tx);
    });

    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "restore-hash-123",
    });

    mockGetTransaction.mockResolvedValue({
      status: "SUCCESS",
    });

    const result = await restoreContractWithFreighter(
      TEST_PUBLIC_KEY,
      TEST_CONTRACT_ID
    );

    expect(result.hash).toBe("restore-hash-123");
    expect(result.confirmed).toBe(true);
    expect(mockPrepareTransaction).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalled();
  });

  it("rejects when contract id is missing", async () => {
    await expect(
      restoreContractWithFreighter(TEST_PUBLIC_KEY, "")
    ).rejects.toThrow(/Contract ID must be a valid/);

    await expect(
      restoreContractWithFreighter(TEST_PUBLIC_KEY, null)
    ).rejects.toThrow(/Contract ID must be a valid/);
  });

  it("rejects when contract id is invalid", async () => {
    await expect(
      restoreContractWithFreighter(TEST_PUBLIC_KEY, "INVALID_CONTRACT_ID")
    ).rejects.toThrow(/Contract ID must be a valid/);

    await expect(
      restoreContractWithFreighter(TEST_PUBLIC_KEY, "GTEST")
    ).rejects.toThrow(/Contract ID must be a valid/);
  });

  it("rejects when public key is invalid", async () => {
    await expect(
      restoreContractWithFreighter("INVALID_KEY", TEST_CONTRACT_ID)
    ).rejects.toThrow(/Connect a valid Freighter address/);
  });

  it("polls for transaction confirmation", async () => {
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "restore-hash-456",
    });

    // First two polls return NOT_FOUND, third returns SUCCESS
    mockGetTransaction
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "SUCCESS" });

    const result = await restoreContractWithFreighter(
      TEST_PUBLIC_KEY,
      TEST_CONTRACT_ID
    );

    expect(result.confirmed).toBe(true);
    expect(mockGetTransaction).toHaveBeenCalledTimes(3);
  });

  it("throws when restore operation fails on-chain", async () => {
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "restore-hash-789",
    });

    mockGetTransaction.mockResolvedValue({
      status: "FAILED",
    });

    await expect(
      restoreContractWithFreighter(TEST_PUBLIC_KEY, TEST_CONTRACT_ID)
    ).rejects.toThrow(/Restore operation failed on-chain/);
  });

  it("returns unconfirmed when polling times out", async () => {
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "restore-hash-pending",
    });

    // Always return NOT_FOUND to simulate timeout
    mockGetTransaction.mockResolvedValue({ status: "NOT_FOUND" });

    const result = await restoreContractWithFreighter(
      TEST_PUBLIC_KEY,
      TEST_CONTRACT_ID
    );

    expect(result.hash).toBe("restore-hash-pending");
    expect(result.confirmed).toBe(false);
  }, 35000); // 35 second timeout (15 attempts x 2s interval)
});

describe("readKitewellState with archived contract", () => {
  it("detects when contract is archived", async () => {
    mockSimulateTransaction.mockResolvedValue({
      error: "Contract instance entry is archived and needs to be restored",
    });

    const result = await readKitewellState(TEST_CONTRACT_ID, TEST_PUBLIC_KEY);

    expect(result.archived).toBe(true);
    expect(result.labName).toBe(null);
    expect(result.builderCount).toBe(0);
    expect(result.builder).toBe(null);
  });

  it("returns live state when contract is not archived", async () => {
    mockSimulateTransaction.mockResolvedValue({
      error: null,
      result: {
        retval: StellarSdk.nativeToScVal("Kitewell Lab", { type: "string" }),
      },
    });

    const result = await readKitewellState(TEST_CONTRACT_ID, TEST_PUBLIC_KEY);

    expect(result.archived).toBe(false);
    expect(result.labName).toBe("Kitewell Lab");
  });

  it("detects archived state with case-insensitive match", async () => {
    mockSimulateTransaction.mockResolvedValue({
      error: "Entry Archived - restore required",
    });

    const result = await readKitewellState(TEST_CONTRACT_ID, TEST_PUBLIC_KEY);

    expect(result.archived).toBe(true);
  });

  it("throws for non-archived errors", async () => {
    mockSimulateTransaction.mockResolvedValue({
      error: "Network connection failed",
    });

    await expect(
      readKitewellState(TEST_CONTRACT_ID, TEST_PUBLIC_KEY)
    ).rejects.toThrow(/simulation failed/);
  });
});
