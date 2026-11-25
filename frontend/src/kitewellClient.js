import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Generated client for `contracts/kitewell`.
 *
 * `KITEWELL_CONTRACT_SPEC` mirrors the contract's public interface — method
 * names, argument types, and result types — as produced by the Stellar CLI's
 * bindings generator for the contract spec. It is the single place the Lab
 * learns how to call the contract, so the hand-written invoke in the UI cannot
 * drift from the deployed contract unnoticed.
 *
 * The Rust contract remains the source of truth: `kitewellClient.test.js`
 * parses `contracts/kitewell/src/lib.rs` and fails when a contract method that
 * this client declares (or the Lab needs) has moved, changed arity, or gone.
 */

/** Public Stellar RPC endpoint for Soroban reads + invokes. */
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";

/** Read-only invokes need a funded-looking source; the zero address works. */
export const ZERO_ADDRESS =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

const POLL_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

/**
 * Contract spec subset used by the frontend.
 *
 * `args` are Soroban types from the contract's `#[contractimpl]` signatures and
 * `result` is the declared return type. `read: true` methods are simulated
 * only; the rest are signed invokes.
 */
export const KITEWELL_CONTRACT_SPEC = Object.freeze({
  contract: "kitewell",
  methods: Object.freeze({
    lab_name: { args: [], result: "string", read: true },
    builder_count: { args: [], result: "u32", read: true },
    get_builder: { args: ["address"], result: "Option<string>", read: true },
    paused: { args: [], result: "bool", read: true },
    get_admin: { args: [], result: "Option<address>", read: true },
    register: { args: ["address", "string"], result: "Result<(), Error>", read: false },
    unregister: { args: ["address"], result: "Result<(), Error>", read: false },
    set_paused: { args: ["address", "bool"], result: "Result<(), Error>", read: false },
  }),
});

/**
 * Plain-language versions of the contract's `Error` enum
 * (`contracts/kitewell/src/lib.rs`).
 */
export const CONTRACT_ERROR_MESSAGES = Object.freeze({
  1: "Enter a builder name to register.",
  2: "This contract has already been initialised.",
  3: "Only the lab admin can do that. The transaction was not submitted.",
  4: "Registration is paused by the lab admin. Unpause it to register.",
  5: "There is no pending admin to accept.",
  6: "This builder is not registered, so there is nothing to remove.",
});

/**
 * Turn a Soroban host error into a user-facing sentence.
 *
 * Simulation and submission both report contract errors as
 * `Error(Contract, #N)`; unknown errors keep their original message so a real
 * failure is never hidden.
 */
export function describeContractError(error) {
  const message = error?.message || String(error ?? "");
  const match = message.match(/Error\(Contract,\s*#(\d+)\)/i);
  if (match) {
    const mapped = CONTRACT_ERROR_MESSAGES[Number(match[1])];
    if (mapped) return mapped;
  }
  return message || "Contract invoke failed.";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Encode a native JS value as the ScVal the contract signature expects. */
function toScVal(type, value) {
  if (type === "address") {
    return StellarSdk.nativeToScVal(value, { type: "address" });
  }
  if (type === "bool") {
    return StellarSdk.nativeToScVal(Boolean(value), { type: "bool" });
  }
  if (type === "string") {
    return StellarSdk.nativeToScVal(value, { type: "string" });
  }
  return StellarSdk.nativeToScVal(value);
}

/** Decode a contract return value, unwrapping Soroban `Option<T>`. */
function fromScVal(result, scVal) {
  if (!scVal) {
    if (result === "u32") return 0;
    if (result === "bool") return false;
    return null;
  }

  const native = StellarSdk.scValToNative(scVal);
  if (result.startsWith("Option<")) {
    // Option<T> arrives as an empty vec (None) or a one-element vec (Some).
    return Array.isArray(native) ? (native.length > 0 ? native[0] : null) : native;
  }
  if (result === "u32") return Number(native);
  if (result === "bool") return Boolean(native);
  return native;
}

function assertContractId(contractId) {
  if (!StellarSdk.StrKey.isValidContract(contractId)) {
    throw new Error("Contract ID must be a valid Soroban contract strkey (C…).");
  }
}

/**
 * Create a spec-driven client for one deployed Kitewell contract.
 *
 * @param {object} options
 * @param {string} options.contractId Deployed contract id (C…).
 * @param {string} [options.networkPassphrase] Passphrase used to build and
 *   submit invokes; defaults to Testnet.
 * @param {string} [options.rpcUrl] Soroban RPC URL.
 * @param {object} [options.server] Injected Soroban RPC server (tests).
 */
export function createKitewellClient({
  contractId,
  networkPassphrase = StellarSdk.Networks.TESTNET,
  rpcUrl = SOROBAN_RPC_URL,
  server,
} = {}) {
  assertContractId(contractId);

  const contract = new StellarSdk.Contract(contractId);
  const rpc = server || new StellarSdk.rpc.Server(rpcUrl);

  function buildTransaction(method, args, sourceAccount, timeout = 60) {
    const spec = KITEWELL_CONTRACT_SPEC.methods[method];
    if (!spec) throw new Error(`Unknown Kitewell contract method: ${method}`);

    const scArgs = args.map((value, index) => toScVal(spec.args[index], value));

    return new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(contract.call(method, ...scArgs))
      .setTimeout(timeout)
      .build();
  }

  async function read(method, values = []) {
    const spec = KITEWELL_CONTRACT_SPEC.methods[method];
    if (!spec || !spec.read) {
      throw new Error(`Unknown Kitewell read method: ${method}`);
    }

    const source = new StellarSdk.Account(ZERO_ADDRESS, "0");
    const transaction = buildTransaction(method, values, source, 30);
    const simulation = await rpc.simulateTransaction(transaction);

    if (simulation.error) {
      throw new Error(`${method}() simulation failed: ${simulation.error}`);
    }

    return fromScVal(spec.result, simulation.result?.retval ?? null);
  }

  /**
   * Sign and submit a state-changing invoke.
   *
   * @param {string} publicKey Source account that signs.
   * @param {string} method Contract method.
   * @param {unknown[]} args Arguments matching `KITEWELL_CONTRACT_SPEC`.
   * @param {(xdr: string) => Promise<object>} signer Returns a signed
   *   `StellarSdk.Transaction` for the prepared XDR.
   * @returns {Promise<{ hash: string, returnValue: unknown, confirmed: boolean }>}
   */
  async function invoke(publicKey, method, args, signer) {
    const spec = KITEWELL_CONTRACT_SPEC.methods[method];
    if (!spec || spec.read) {
      throw new Error(`Unknown Kitewell invoke method: ${method}`);
    }
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
      throw new Error("Connect a valid Freighter address first.");
    }

    const sourceAccount = await rpc.getAccount(publicKey);
    const transaction = buildTransaction(method, args, sourceAccount);

    // Simulation fills in auth entries + resource fees for the invoke, and
    // surfaces contract errors (paused, NotAdmin, …) before a signature.
    let prepared;
    try {
      prepared = await rpc.prepareTransaction(transaction);
    } catch (err) {
      throw new Error(describeContractError(err), { cause: err });
    }

    const signed = await signer(prepared.toXDR());
    const sendResult = await rpc.sendTransaction(signed);

    if (sendResult.status === "ERROR") {
      throw new Error(
        `Contract invoke rejected by the network. Tx hash: ${sendResult.hash}`
      );
    }

    // RPC submission is asynchronous: poll getTransaction until applied.
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      const status = await rpc.getTransaction(sendResult.hash);
      if (status.status === "SUCCESS") {
        return {
          hash: sendResult.hash,
          returnValue: status.returnValue
            ? StellarSdk.scValToNative(status.returnValue)
            : null,
          confirmed: true,
        };
      }
      if (status.status === "FAILED") {
        throw new Error(
          `Contract invoke failed on-chain. Tx hash: ${sendResult.hash}`
        );
      }
      await sleep(POLL_INTERVAL_MS);
    }

    // Still pending after the polling window; the tx may land shortly.
    return { hash: sendResult.hash, returnValue: null, confirmed: false };
  }

  return {
    contractId,
    spec: KITEWELL_CONTRACT_SPEC,

    labName: () => read("lab_name"),
    builderCount: () => read("builder_count"),
    getBuilder: (address) => read("get_builder", [address]),
    paused: () => read("paused"),
    getAdmin: () => read("get_admin"),

    /**
     * Read every value the Lab tab renders in one parallel round.
     *
     * @param {string|null} viewerAddress Address whose registration to show.
     */
    async readState(viewerAddress) {
      const viewer = viewerAddress || ZERO_ADDRESS;
      const [labName, builderCount, builder, paused, admin] = await Promise.all([
        read("lab_name"),
        read("builder_count"),
        read("get_builder", [viewer]),
        read("paused"),
        read("get_admin"),
      ]);

      return { labName, builderCount, builder, paused, admin };
    },

    register: (publicKey, name, signer) =>
      invoke(publicKey, "register", [publicKey, name], signer),
    unregister: (publicKey, signer) =>
      invoke(publicKey, "unregister", [publicKey], signer),
    setPaused: (admin, paused, signer) =>
      invoke(admin, "set_paused", [admin, paused], signer),
  };
}
