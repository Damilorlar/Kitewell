import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for the Soroban helpers in ./freighter.
 *
 * Nothing here touches the network or a real wallet:
 * - `StellarSdk.rpc.Server` is mocked so simulate/prepare/send/poll are fake.
 * - `@stellar/freighter-api` `signTransaction` is mocked.
 * - The real SDK is used for tx building, XDR round-trips, and scVal decoding.
 */

const { sorobanServerMock, signTransactionMock, horizonLoadAccountMock, horizonSubmitMock } = vi.hoisted(() => ({
  sorobanServerMock: {
    simulateTransaction: vi.fn(),
    prepareTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
    getAccount: vi.fn(),
  },
  signTransactionMock: vi.fn(),
  horizonLoadAccountMock: vi.fn(),
  horizonSubmitMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetworkDetails: getNetworkDetailsMock,
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
          loadAccount: horizonLoadAccountMock,
          submitTransaction: horizonSubmitMock,
        };
      }),
    },
    rpc: {
      ...actual.rpc,
      Server: vi.fn(function () {
        return sorobanServerMock;
      }),
    },
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return horizonServerMock;
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const {
  SOROBAN_RPC_URL,
  readKitewellState,
  registerBuilderWithFreighter,
  manageDataWithFreighter,
  mergeAccountWithFreighter,
} = await import("./freighter");

const CONTRACT_ID =
  "CCWLNS5HECRJ2GM3Q6JZZDV334ZXYO6EKZLFPLQRXO6SUDAKMS4U3E3X";
const USER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const DEST = StellarSdk.Keypair.random().publicKey();
const AMOUNT = "10.0000000";

// Build a valid signed transaction XDR for mocking
let signedTxXdr;
beforeAll(() => {
  const account = new StellarSdk.Account(USER, "123456");
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: DEST,
        asset: StellarSdk.Asset.native(),
        amount: AMOUNT,
      })
    )
    .setTimeout(180)
    .build();
  // Sign with a dummy keypair to get valid XDR
  const keypair = StellarSdk.Keypair.fromSecret(
    "SBP4BHQPSIWSFMYZUE5RZ7AXZBKTUY76HNISQ7GZYD7U7JKGJBMRQR52"
  );
  tx.sign(keypair);
  signedTxXdr = tx.toXDR();
});

/** Build the same tx shape the helpers build, for XDR round-trip asserts. */
function buildRegisterTx(caller, name, sequence = "7") {
  const contract = new StellarSdk.Contract(CONTRACT_ID);
  return new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(caller, sequence),
    {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    }
  )
    .addOperation(
      contract.call(
        "register",
        StellarSdk.nativeToScVal(caller, { type: "address" }),
        StellarSdk.nativeToScVal(name, { type: "string" })
      )
    )
    .setTimeout(60)
    .build();
}

/** Soroban RPC getAccount payload the tx builder can consume. */
function rpcAccountFixture(address) {
  return new StellarSdk.Account(address, "7");
}

/** Minimal successful sim response for a read (lab_name / builder_count / get_builder). */
function simOk(retval) {
  return { error: null, result: { retval } };
}

/** prepareTransaction's assemble step, with a fixed resource fee. */
function assemblePrepared(tx) {
  return StellarSdk.rpc
    .assembleTransaction(tx, {
      _parsed: true,
      transactionData: new StellarSdk.SorobanDataBuilder().setResourceFee("4321"),
      minResourceFee: "123",
      result: {
        auth: [],
        retval: StellarSdk.nativeToScVal(undefined, { type: "void" }),
      },
    })
    .build();
}

/** Successful create-contract result: the new contract hash in the first op. */
function installResultXdr(contractHash = CONTRACT_HASH) {
  const ok = StellarSdk.xdr.OperationResult.opInner(
    StellarSdk.xdr.OperationResultTr.invokeHostFunction(
      StellarSdk.xdr.InvokeHostFunctionResult.invokeHostFunctionSuccess(contractHash)
    )
  );
  return new StellarSdk.xdr.TransactionResult({
    feeCharged: StellarSdk.xdr.Int64.fromString("100"),
    result: StellarSdk.xdr.TransactionResultResult.txSuccess([ok]),
    ext: new StellarSdk.xdr.TransactionResultExt(0),
  });
}

/** Stub the common prepare → sign → submit → poll pipeline for one invoke. */
function stubSorobanSubmit(sendResult, successStatus = { status: "SUCCESS" }) {
  sorobanServerMock.prepareTransaction.mockImplementation(async (tx) =>
    assemblePrepared(tx)
  );
  signTransactionMock.mockImplementation(async (xdr) => ({
    error: null,
    signedTxXdr: xdr,
  }));
  sorobanServerMock.sendTransaction.mockResolvedValue(sendResult);
  sorobanServerMock.getTransaction.mockResolvedValue(successStatus);
}

beforeEach(() => {
  vi.clearAllMocks();
  getNetworkDetailsMock.mockResolvedValue({
    network: "TESTNET",
    networkPassphrase: StellarSdk.Networks.TESTNET,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("soroban rpc url", () => {
  it("points at the public testnet Soroban RPC", () => {
    expect(SOROBAN_RPC_URL).toBe("https://soroban-testnet.stellar.org");
  });
});

describe("readKitewellState", () => {
  it("decodes lab_name, builder_count, and get_builder(Some)", async () => {
    sorobanServerMock.simulateTransaction.mockImplementation(async (tx) => {
      const method = tx.operations[0].func.value().functionName();
      if (method === "lab_name") return simOk(StellarSdk.nativeToScVal("Kitewell", { type: "string" }));
      if (method === "builder_count") return simOk(StellarSdk.nativeToScVal(2, { type: "u32" }));      if (method === "get_builder")
        return simOk(
          StellarSdk.xdr.ScVal.scvVec([
            StellarSdk.nativeToScVal("alice", { type: "string" }),
          ])
        );
      if (method === "paused")
        return simOk(StellarSdk.nativeToScVal(false, { type: "bool" }));
      if (method === "get_admin")
        return simOk(
          StellarSdk.xdr.ScVal.scvVec([
            StellarSdk.nativeToScVal(USER, { type: "address" }),
          ])
        );
      throw new Error(`unexpected method ${method}`);
    });

    const state = await readKitewellState(CONTRACT_ID, USER);

    expect(state).toEqual({
      labName: "Kitewell",
      builderCount: 2,
      builder: "alice",
      archived: false,
    });

    // Five parallel reads, each a single invokeHostFunction op.
    expect(sorobanServerMock.simulateTransaction).toHaveBeenCalledTimes(5);
    const ops = sorobanServerMock.simulateTransaction.mock.calls.map(
      ([tx]) => tx.operations[0]
    );
    expect(ops.map((op) => op.func.value().functionName())).toEqual([
      "lab_name",
      "builder_count",
      "get_builder",
      "paused",
      "get_admin",
    ]);
  });

  it("returns null for get_builder(None) and 0 count on a fresh registry", async () => {
    sorobanServerMock.simulateTransaction.mockImplementation(async (tx) => {
      const method = tx.operations[0].func.value().functionName();
      if (method === "lab_name") return simOk(StellarSdk.nativeToScVal("Kitewell", { type: "string" }));
      if (method === "builder_count") return simOk(StellarSdk.nativeToScVal(0, { type: "u32" }));
      if (method === "paused") return simOk(StellarSdk.nativeToScVal(false, { type: "bool" }));
      return simOk(StellarSdk.xdr.ScVal.scvVec([]));
    });

    const state = await readKitewellState(CONTRACT_ID, null);

    expect(state).toEqual({ labName: "Kitewell", builderCount: 0, builder: null, archived: false });
  });

  it("falls back to the zero address when no viewer is passed", async () => {
    sorobanServerMock.simulateTransaction.mockImplementation(async (tx) => {
      const method = tx.operations[0].func.value().functionName();
      if (method === "get_builder") {
        const caller = tx.operations[0].func.value().args()[0];
        return simOk(caller);
      }
      if (method === "paused") return simOk(StellarSdk.nativeToScVal(false, { type: "bool" }));
      if (method === "get_admin") return simOk(StellarSdk.xdr.ScVal.scvVec([]));
      return simOk(StellarSdk.nativeToScVal("Kitewell", { type: "string" }));
    });

    const state = await readKitewellState(CONTRACT_ID, null);

    expect(state.builder).toBe(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
    );
  });

  it("throws a method-tagged error when a simulation fails", async () => {
    sorobanServerMock.simulateTransaction.mockResolvedValue({
      error: "Storage access exceeded",
    });

    await expect(readKitewellState(CONTRACT_ID, USER)).rejects.toThrow(
      "lab_name() simulation failed: Storage access exceeded"
    );
  });

  it("rejects non-contract ids before any RPC call", async () => {
    await expect(readKitewellState("GAAAAWTF", USER)).rejects.toThrow(
      "valid Soroban contract"
    );
    expect(sorobanServerMock.simulateTransaction).not.toHaveBeenCalled();
  });
});

describe("mergeAccountWithFreighter", () => {
  it("does not call Freighter for a mismatched retype", async () => {
    const destination = StellarSdk.Keypair.random().publicKey();

    await expect(
      mergeAccountWithFreighter(USER, destination, "GWRONG")
    ).rejects.toThrow("Retype the destination");
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("refuses merging an account into itself before loading or signing", async () => {
    await expect(
      mergeAccountWithFreighter(USER, USER, USER)
    ).rejects.toThrow("cannot be the connected account");
    expect(horizonLoadAccountMock).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("builds an account merge operation body", async () => {
    const destination = StellarSdk.Keypair.random().publicKey();
    horizonLoadAccountMock.mockResolvedValue(new StellarSdk.Account(USER, "7"));
    signTransactionMock.mockResolvedValue({
      signedTxXdr: null,
      error: { message: "stop after building" },
    });

    await expect(
      mergeAccountWithFreighter(USER, destination, destination)
    ).rejects.toThrow("stop after building");

    const unsignedXdr = signTransactionMock.mock.calls[0][0];
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      unsignedXdr,
      StellarSdk.Networks.TESTNET
    );
    expect(transaction.operations[0].type).toBe("accountMerge");
    expect(transaction.operations[0].destination).toBe(destination);
  });
});

describe("manageDataWithFreighter", () => {
  it("refuses names and values longer than 64 UTF-8 bytes before signing", async () => {
    await expect(
      manageDataWithFreighter(USER, "é".repeat(33), "value")
    ).rejects.toThrow("64 UTF-8 bytes");
    await expect(
      manageDataWithFreighter(USER, "name", "é".repeat(33))
    ).rejects.toThrow("64 UTF-8 bytes");
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("builds set and clear manageData operations", async () => {
    horizonLoadAccountMock.mockResolvedValue(new StellarSdk.Account(USER, "7"));
    signTransactionMock.mockResolvedValue({
      signedTxXdr: null,
      error: { message: "stop after building" },
    });

    await expect(
      manageDataWithFreighter(USER, "profile", "hello")
    ).rejects.toThrow("stop after building");

    const setXdr = signTransactionMock.mock.calls[0][0];
    const setTx = StellarSdk.TransactionBuilder.fromXDR(
      setXdr,
      StellarSdk.Networks.TESTNET
    );
    expect(setTx.operations[0].type).toBe("manageData");
    expect(setTx.operations[0].name).toBe("profile");
    expect(setTx.operations[0].value.toString("utf8")).toBe("hello");

    await expect(manageDataWithFreighter(USER, "profile", null)).rejects.toThrow(
      "stop after building"
    );
    const clearXdr = signTransactionMock.mock.calls[1][0];
    const clearTx = StellarSdk.TransactionBuilder.fromXDR(
      clearXdr,
      StellarSdk.Networks.TESTNET
    );
    expect(clearTx.operations[0].value ?? null).toBeNull();
  });
});

describe("registerBuilderWithFreighter", () => {
  it("signs via Freighter, submits, polls, and returns hash + returnValue", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    const unsigned = buildRegisterTx(USER, "  stellar-alice  ");
    sorobanServerMock.prepareTransaction.mockImplementation(async (tx) => {
      // Mirror prepareTransaction: simulate then assemble.
      const sim = {
        _parsed: true,
        transactionData: new StellarSdk.SorobanDataBuilder().setResourceFee(
          "4321"
        ),
        minResourceFee: "123",
        result: { auth: [], retval: StellarSdk.nativeToScVal(undefined, { type: "void" }) },
      };
      return StellarSdk.rpc.assembleTransaction(tx, sim).build();
    });
    signTransactionMock.mockResolvedValue({
      error: null,
      signedTxXdr: unsigned.toXDR(), // reuse the same tx as "signed"
    });
    sorobanServerMock.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "abc123def456",
    });
    sorobanServerMock.getTransaction.mockResolvedValue({
      status: "SUCCESS",
      returnValue: StellarSdk.nativeToScVal(undefined, { type: "void" }),
    });

    const result = await registerBuilderWithFreighter(USER, CONTRACT_ID, "  stellar-alice  ");

    expect(result).toEqual({
      hash: "abc123def456",
      returnValue: null, // void() decodes to null
      confirmed: true,
    });

    // Freighter was asked to sign the prepared tx XDR.
    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    const [xdr, opts] = signTransactionMock.mock.calls[0];
    expect(opts).toEqual({
      networkPassphrase: StellarSdk.Networks.TESTNET,
      address: USER,
    });
    const signedForFreighter = StellarSdk.TransactionBuilder.fromXDR(
      xdr,
      StellarSdk.Networks.TESTNET
    );
    expect(signedForFreighter.fee).toBe("4421"); // assembled: 4321 resource + 100 inclusion

    // The invoke carries caller + trimmed name.
    const invoke = signedForFreighter.operations[0].func.value();
    // After an XDR round-trip the name comes back as an ScBytes Buffer.
    expect(invoke.functionName().toString()).toBe("register");
    expect(StellarSdk.scValToNative(invoke.args()[0])).toBe(USER);
    expect(StellarSdk.scValToNative(invoke.args()[1])).toBe("stellar-alice");

    // Submitted via Soroban RPC and polled to SUCCESS.
    expect(sorobanServerMock.sendTransaction).toHaveBeenCalledTimes(1);
    expect(sorobanServerMock.getTransaction).toHaveBeenCalledWith("abc123def456");
  });

  it("throws a hash-tagged error when submission is rejected (ERROR)", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    const unsigned = buildRegisterTx(USER, "alice");
    sorobanServerMock.prepareTransaction.mockImplementation(async (tx) =>
      StellarSdk.rpc
        .assembleTransaction(tx, {
          _parsed: true,
          transactionData: new StellarSdk.SorobanDataBuilder(),
          minResourceFee: "0",
          result: { auth: [], retval: StellarSdk.nativeToScVal(undefined, { type: "void" }) },
        })
        .build()
    );
    signTransactionMock.mockResolvedValue({ error: null, signedTxXdr: unsigned.toXDR() });
    sorobanServerMock.sendTransaction.mockResolvedValue({
      status: "ERROR",
      hash: "deadbeef",
    });

    await expect(registerBuilderWithFreighter(USER, CONTRACT_ID, "alice")).rejects.toThrow(
      "Contract invoke rejected by the network. Tx hash: deadbeef"
    );
    expect(sorobanServerMock.getTransaction).not.toHaveBeenCalled();
  });

  it("throws a hash-tagged error when the tx fails on-chain (FAILED)", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    const unsigned = buildRegisterTx(USER, "alice");
    sorobanServerMock.prepareTransaction.mockImplementation(async (tx) =>
      StellarSdk.rpc
        .assembleTransaction(tx, {
          _parsed: true,
          transactionData: new StellarSdk.SorobanDataBuilder(),
          minResourceFee: "0",
          result: { auth: [], retval: StellarSdk.nativeToScVal(undefined, { type: "void" }) },
        })
        .build()
    );
    signTransactionMock.mockResolvedValue({ error: null, signedTxXdr: unsigned.toXDR() });
    sorobanServerMock.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "feedface",
    });
    sorobanServerMock.getTransaction.mockResolvedValue({ status: "FAILED" });

    await expect(registerBuilderWithFreighter(USER, CONTRACT_ID, "alice")).rejects.toThrow(
      "Contract invoke failed on-chain. Tx hash: feedface"
    );
  });

  it("returns confirmed:false when polling times out", async () => {
    vi.useFakeTimers();
    try {
      sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
      const unsigned = buildRegisterTx(USER, "alice");
      sorobanServerMock.prepareTransaction.mockImplementation(async (tx) =>
        StellarSdk.rpc
          .assembleTransaction(tx, {
            _parsed: true,
            transactionData: new StellarSdk.SorobanDataBuilder(),
            minResourceFee: "0",
            result: { auth: [], retval: StellarSdk.nativeToScVal(undefined, { type: "void" }) },
          })
          .build()
      );
      signTransactionMock.mockResolvedValue({ error: null, signedTxXdr: unsigned.toXDR() });
      sorobanServerMock.sendTransaction.mockResolvedValue({
        status: "PENDING",
        hash: "pending123",
      });
      sorobanServerMock.getTransaction.mockResolvedValue({ status: "NOT_FOUND" });

      const promise = registerBuilderWithFreighter(USER, CONTRACT_ID, "alice");
      // 15 polls x 2s — flush the polling loop.
      await vi.advanceTimersByTimeAsync(31_000);
      await expect(promise).resolves.toEqual({
        hash: "pending123",
        returnValue: null,
        confirmed: false,
      });
      expect(sorobanServerMock.getTransaction).toHaveBeenCalledTimes(15);
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces Freighter signing rejections", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    sorobanServerMock.prepareTransaction.mockImplementation(async (tx) =>
      StellarSdk.rpc
        .assembleTransaction(tx, {
          _parsed: true,
          transactionData: new StellarSdk.SorobanDataBuilder(),
          minResourceFee: "0",
          result: { auth: [], retval: StellarSdk.nativeToScVal(undefined, { type: "void" }) },
        })
        .build()
    );
    signTransactionMock.mockResolvedValue({
      error: { message: "user declined" },
      signedTxXdr: null,
    });

    await expect(registerBuilderWithFreighter(USER, CONTRACT_ID, "alice")).rejects.toThrow(
      "user declined"
    );
    expect(sorobanServerMock.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects empty names without touching Freighter", async () => {
    await expect(registerBuilderWithFreighter(USER, CONTRACT_ID, "   ")).rejects.toThrow(
      "Enter a builder name to register."
    );
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(sorobanServerMock.getAccount).not.toHaveBeenCalled();
  });

  it("rejects names longer than 64 characters", async () => {
    await expect(
      registerBuilderWithFreighter(USER, CONTRACT_ID, "a".repeat(65))
    ).rejects.toThrow("64 characters or fewer");
    expect(sorobanServerMock.getAccount).not.toHaveBeenCalled();
  });

  it("allows a 64-character (multibyte-safe) name", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    const unsigned = buildRegisterTx(USER, "é".repeat(64));
    sorobanServerMock.prepareTransaction.mockImplementation(async (tx) =>
      StellarSdk.rpc
        .assembleTransaction(tx, {
          _parsed: true,
          transactionData: new StellarSdk.SorobanDataBuilder(),
          minResourceFee: "0",
          result: { auth: [], retval: StellarSdk.nativeToScVal(undefined, { type: "void" }) },
        })
        .build()
    );
    signTransactionMock.mockResolvedValue({ error: null, signedTxXdr: unsigned.toXDR() });
    sorobanServerMock.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "h",
    });
    sorobanServerMock.getTransaction.mockResolvedValue({ status: "SUCCESS" });

    const result = await registerBuilderWithFreighter(USER, CONTRACT_ID, "é".repeat(64));
    expect(result.confirmed).toBe(true);
  });

  it("rejects invalid public keys", async () => {
    await expect(
      registerBuilderWithFreighter("NOT_A_KEY", CONTRACT_ID, "alice")
    ).rejects.toThrow("Connect a valid Freighter address first.");
  });

  it("rejects invalid contract ids", async () => {
    await expect(
      registerBuilderWithFreighter(USER, "GAAAAWTF", "alice")
    ).rejects.toThrow("valid Soroban contract");
  });
});

describe("pause and unregister through the generated client", () => {
  /** Assemble without changing the call, so sendTransaction receives it. */
  function prepareAsIs() {
    sorobanServerMock.prepareTransaction.mockImplementation(async (tx) =>
      StellarSdk.rpc
        .assembleTransaction(tx, {
          _parsed: true,
          transactionData: new StellarSdk.SorobanDataBuilder(),
          minResourceFee: "0",
          result: { auth: [], retval: StellarSdk.nativeToScVal(undefined, { type: "void" }) },
        })
        .build()
    );
  }

  function signAsIs() {
    signTransactionMock.mockImplementation(async (xdr) => ({
      error: null,
      signedTxXdr: xdr,
    }));
  }

  it("signs set_paused as the admin and reports the confirmation", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    prepareAsIs();
    signAsIs();
    sorobanServerMock.sendTransaction.mockResolvedValue({ status: "PENDING", hash: "pause123" });
    sorobanServerMock.getTransaction.mockResolvedValue({ status: "SUCCESS" });

    const result = await setPausedWithFreighter(USER, CONTRACT_ID, true);

    expect(result).toEqual({ hash: "pause123", returnValue: null, confirmed: true });

    const [xdr, opts] = signTransactionMock.mock.calls[0];
    expect(opts).toEqual({ networkPassphrase: StellarSdk.Networks.TESTNET, address: USER });
    const signed = StellarSdk.TransactionBuilder.fromXDR(xdr, StellarSdk.Networks.TESTNET);
    const invoke = signed.operations[0].func.value();
    expect(invoke.functionName().toString()).toBe("set_paused");
    expect(StellarSdk.scValToNative(invoke.args()[0])).toBe(USER);
    expect(StellarSdk.scValToNative(invoke.args()[1])).toBe(true);
  });

  it("signs unregister for the connected builder", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    prepareAsIs();
    signAsIs();
    sorobanServerMock.sendTransaction.mockResolvedValue({ status: "PENDING", hash: "unreg123" });
    sorobanServerMock.getTransaction.mockResolvedValue({ status: "SUCCESS" });

    const result = await unregisterBuilderWithFreighter(USER, CONTRACT_ID);

    expect(result.confirmed).toBe(true);

    const [xdr] = signTransactionMock.mock.calls[0];
    const signed = StellarSdk.TransactionBuilder.fromXDR(xdr, StellarSdk.Networks.TESTNET);
    const invoke = signed.operations[0].func.value();
    expect(invoke.functionName().toString()).toBe("unregister");
    expect(StellarSdk.scValToNative(invoke.args()[0])).toBe(USER);
  });

  it("turns a NotAdmin contract error into plain language without submitting", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    sorobanServerMock.prepareTransaction.mockRejectedValue(
      new Error("HostError: Error(Contract, #3)")
    );

    await expect(setPausedWithFreighter(USER, CONTRACT_ID, true)).rejects.toThrow(
      "Only the lab admin can do that. The transaction was not submitted."
    );
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(sorobanServerMock.sendTransaction).not.toHaveBeenCalled();
  });

  it("turns a Paused contract error into plain language while registering", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    sorobanServerMock.prepareTransaction.mockRejectedValue(
      new Error("HostError: Error(Contract, #4)")
    );

    await expect(
      registerBuilderWithFreighter(USER, CONTRACT_ID, "alice")
    ).rejects.toThrow("Registration is paused by the lab admin. Unpause it to register.");
    expect(sorobanServerMock.sendTransaction).not.toHaveBeenCalled();
  });

  it("turns a NotRegistered contract error into plain language", async () => {
    sorobanServerMock.getAccount.mockResolvedValue(rpcAccountFixture(USER));
    sorobanServerMock.prepareTransaction.mockRejectedValue(
      new Error("HostError: Error(Contract, #6)")
    );

    await expect(unregisterBuilderWithFreighter(USER, CONTRACT_ID)).rejects.toThrow(
      "This builder is not registered, so there is nothing to remove."
    );
    expect(sorobanServerMock.sendTransaction).not.toHaveBeenCalled();
  });

  it("refuses to submit when Freighter is on a different network than the contract", async () => {
    getNetworkDetailsMock.mockResolvedValue({
      network: "FUTURENET",
      networkPassphrase: StellarSdk.Networks.FUTURENET,
    });

    await expect(setPausedWithFreighter(USER, CONTRACT_ID, true)).rejects.toThrow(
      "Freighter is on FUTURENET, but this contract is on a different network."
    );
    expect(sorobanServerMock.getAccount).not.toHaveBeenCalled();
    expect(signTransactionMock).not.toHaveBeenCalled();
  });
});
