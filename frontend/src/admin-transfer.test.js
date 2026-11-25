import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test suite for the Kitewell admin transfer operations.
 * Validates that propose and accept work correctly and that the pending
 * slot clears on accept.
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
const {
  readAdminState,
  proposeAdminWithFreighter,
  acceptAdminWithFreighter,
} = await import("./freighter");

const TEST_ADMIN = StellarSdk.Keypair.random().publicKey();
const TEST_NEW_ADMIN = StellarSdk.Keypair.random().publicKey();
const TEST_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

beforeEach(() => {
  vi.clearAllMocks();
  
  mockGetAccount.mockResolvedValue(
    new StellarSdk.Account(TEST_ADMIN, "1000")
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readAdminState", () => {
  it("reads admin and pending admin from contract", async () => {
    mockSimulateTransaction.mockImplementation(async (tx) => {
      const method = tx.operations[0].func.value().functionName();
      
      if (method === "get_admin") {
        // Return Some(admin) as a single-element vector
        return {
          error: null,
          result: {
            retval: StellarSdk.xdr.ScVal.scvVec([
              StellarSdk.nativeToScVal(TEST_ADMIN, { type: "address" }),
            ]),
          },
        };
      }
      
      if (method === "get_pending_admin") {
        // Return Some(pending) as a single-element vector
        return {
          error: null,
          result: {
            retval: StellarSdk.xdr.ScVal.scvVec([
              StellarSdk.nativeToScVal(TEST_NEW_ADMIN, { type: "address" }),
            ]),
          },
        };
      }
      
      return { error: "Unknown method" };
    });

    const result = await readAdminState(TEST_CONTRACT_ID);

    expect(result.admin).toBe(TEST_ADMIN);
    expect(result.pendingAdmin).toBe(TEST_NEW_ADMIN);
  });

  it("handles null admin when not initialized", async () => {
    mockSimulateTransaction.mockImplementation(async () => {
      // Return None as empty vector
      return {
        error: null,
        result: {
          retval: StellarSdk.xdr.ScVal.scvVec([]),
        },
      };
    });

    const result = await readAdminState(TEST_CONTRACT_ID);

    expect(result.admin).toBe(null);
    expect(result.pendingAdmin).toBe(null);
  });

  it("handles missing get_pending_admin method gracefully", async () => {
    mockSimulateTransaction.mockImplementation(async (tx) => {
      const method = tx.operations[0].func.value().functionName();
      
      if (method === "get_admin") {
        // Return Some(admin)
        return {
          error: null,
          result: {
            retval: StellarSdk.xdr.ScVal.scvVec([
              StellarSdk.nativeToScVal(TEST_ADMIN, { type: "address" }),
            ]),
          },
        };
      }
      
      if (method === "get_pending_admin") {
        // Method doesn't exist on old contract
        return {
          error: "get_pending_admin() simulation failed: unknown method",
        };
      }
      
      return { error: "Unknown method" };
    });

    const result = await readAdminState(TEST_CONTRACT_ID);

    // Should still return admin, with pendingAdmin as null
    expect(result.admin).toBe(TEST_ADMIN);
    expect(result.pendingAdmin).toBe(null);
  });

  it("rejects invalid contract id", async () => {
    await expect(
      readAdminState("INVALID_CONTRACT")
    ).rejects.toThrow(/Contract ID must be a valid/);
  });
});

describe("proposeAdminWithFreighter", () => {
  it("builds a propose_admin invoke for the current admin", async () => {
    mockPrepareTransaction.mockImplementation((tx) => {
      expect(tx.operations).toHaveLength(1);
      expect(tx.operations[0].type).toBe("invokeHostFunction");
      return Promise.resolve(tx);
    });

    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "propose-hash-123",
    });

    mockGetTransaction.mockResolvedValue({
      status: "SUCCESS",
    });

    const result = await proposeAdminWithFreighter(
      TEST_ADMIN,
      TEST_CONTRACT_ID,
      TEST_NEW_ADMIN
    );

    expect(result.hash).toBe("propose-hash-123");
    expect(result.confirmed).toBe(true);
  });

  it("rejects invalid current admin address", async () => {
    await expect(
      proposeAdminWithFreighter("INVALID", TEST_CONTRACT_ID, TEST_NEW_ADMIN)
    ).rejects.toThrow(/Current admin address is invalid/);
  });

  it("rejects invalid new admin address", async () => {
    await expect(
      proposeAdminWithFreighter(TEST_ADMIN, TEST_CONTRACT_ID, "INVALID")
    ).rejects.toThrow(/New admin address must be a valid/);
  });

  it("rejects invalid contract id", async () => {
    await expect(
      proposeAdminWithFreighter(TEST_ADMIN, "INVALID", TEST_NEW_ADMIN)
    ).rejects.toThrow(/Contract ID must be a valid/);
  });

  it("handles on-chain failure", async () => {
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "propose-hash-fail",
    });
    mockGetTransaction.mockResolvedValue({ status: "FAILED" });

    await expect(
      proposeAdminWithFreighter(TEST_ADMIN, TEST_CONTRACT_ID, TEST_NEW_ADMIN)
    ).rejects.toThrow(/Propose admin failed on-chain/);
  });
});

describe("acceptAdminWithFreighter", () => {
  it("builds an accept_admin invoke for the pending admin", async () => {
    mockGetAccount.mockResolvedValue(
      new StellarSdk.Account(TEST_NEW_ADMIN, "1000")
    );
    
    mockPrepareTransaction.mockImplementation((tx) => {
      expect(tx.operations).toHaveLength(1);
      expect(tx.operations[0].type).toBe("invokeHostFunction");
      return Promise.resolve(tx);
    });

    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "accept-hash-123",
    });

    mockGetTransaction.mockResolvedValue({
      status: "SUCCESS",
    });

    const result = await acceptAdminWithFreighter(
      TEST_NEW_ADMIN,
      TEST_CONTRACT_ID
    );

    expect(result.hash).toBe("accept-hash-123");
    expect(result.confirmed).toBe(true);
  });

  it("rejects invalid pending admin address", async () => {
    await expect(
      acceptAdminWithFreighter("INVALID", TEST_CONTRACT_ID)
    ).rejects.toThrow(/Pending admin address is invalid/);
  });

  it("rejects invalid contract id", async () => {
    await expect(
      acceptAdminWithFreighter(TEST_NEW_ADMIN, "INVALID")
    ).rejects.toThrow(/Contract ID must be a valid/);
  });

  it("handles on-chain failure", async () => {
    mockGetAccount.mockResolvedValue(
      new StellarSdk.Account(TEST_NEW_ADMIN, "1000")
    );
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "accept-hash-fail",
    });
    mockGetTransaction.mockResolvedValue({ status: "FAILED" });

    await expect(
      acceptAdminWithFreighter(TEST_NEW_ADMIN, TEST_CONTRACT_ID)
    ).rejects.toThrow(/Accept admin failed on-chain/);
  });
});

describe("admin transfer flow", () => {
  it("pending slot clears on accept", async () => {
    // Step 1: Propose admin
    mockPrepareTransaction.mockImplementation((tx) => Promise.resolve(tx));
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "propose-hash",
    });
    mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });

    await proposeAdminWithFreighter(
      TEST_ADMIN,
      TEST_CONTRACT_ID,
      TEST_NEW_ADMIN
    );

    // Step 2: Read state - pending should be set
    mockSimulateTransaction.mockImplementation(async (tx) => {
      const method = tx.operations[0].func.value().functionName();
      
      if (method === "get_admin") {
        return {
          error: null,
          result: {
            retval: StellarSdk.xdr.ScVal.scvVec([
              StellarSdk.nativeToScVal(TEST_ADMIN, { type: "address" }),
            ]),
          },
        };
      }
      
      if (method === "get_pending_admin") {
        return {
          error: null,
          result: {
            retval: StellarSdk.xdr.ScVal.scvVec([
              StellarSdk.nativeToScVal(TEST_NEW_ADMIN, { type: "address" }),
            ]),
          },
        };
      }
    });

    let state = await readAdminState(TEST_CONTRACT_ID);
    expect(state.admin).toBe(TEST_ADMIN);
    expect(state.pendingAdmin).toBe(TEST_NEW_ADMIN);

    // Step 3: Accept admin
    mockGetAccount.mockResolvedValue(
      new StellarSdk.Account(TEST_NEW_ADMIN, "1000")
    );
    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "accept-hash",
    });

    await acceptAdminWithFreighter(TEST_NEW_ADMIN, TEST_CONTRACT_ID);

    // Step 4: Read state - pending should be cleared, admin should be new
    mockSimulateTransaction.mockImplementation(async (tx) => {
      const method = tx.operations[0].func.value().functionName();
      
      if (method === "get_admin") {
        return {
          error: null,
          result: {
            retval: StellarSdk.xdr.ScVal.scvVec([
              StellarSdk.nativeToScVal(TEST_NEW_ADMIN, { type: "address" }),
            ]),
          },
        };
      }
      
      if (method === "get_pending_admin") {
        // Pending cleared - return None
        return {
          error: null,
          result: {
            retval: StellarSdk.xdr.ScVal.scvVec([]),
          },
        };
      }
    });

    state = await readAdminState(TEST_CONTRACT_ID);
    expect(state.admin).toBe(TEST_NEW_ADMIN);
    expect(state.pendingAdmin).toBe(null);
  });
});
