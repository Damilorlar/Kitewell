import { describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  TX_POLL_INTERVAL_MS,
  TX_WATCH_WINDOW_MS,
  watchTransactionStatus,
} from "./txStatusWatch";

const PASSPHRASE = StellarSdk.Networks.TESTNET;
const CLIENT = StellarSdk.Keypair.random();
const SERVER = StellarSdk.Keypair.random();
const HASH = "e".repeat(64);
const START_MS = 1000000;

function notFound() {
  return new StellarSdk.NotFoundError("Request failed with status code 404", {
    data: { extras: {} },
    status: 404,
    statusText: "Not Found",
  });
}

function bareNotFound() {
  const error = new Error("Request failed with status code 404");
  error.response = { status: 404, data: {} };
  return error;
}

function record(successful, result_codes) {
  return {
    hash: HASH,
    successful,
    result_codes,
    created_at: "2026-11-21T12:00:00Z",
  };
}

const success = () => record(true, { transaction: "txSuccess" });

function envelope({ maxSeconds, timeout } = {}) {
  const builder = new StellarSdk.TransactionBuilder(new StellarSdk.Account(CLIENT.publicKey(), "1"), {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  }).addOperation(
    StellarSdk.Operation.payment({
      destination: SERVER.publicKey(),
      asset: StellarSdk.Asset.native(),
      amount: "1.0000000",
    })
  );
  if (timeout !== undefined) builder.setTimeout(timeout);
  if (maxSeconds !== undefined) builder.setTimebounds(0, maxSeconds);
  const transaction = builder.build();
  transaction.sign(CLIENT);
  return transaction.toXDR();
}

function harness(loadTransaction) {
  let now = START_MS;
  const sleeps = [];
  const updates = [];
  const spy = vi.fn(loadTransaction);
  const watch = (patch) =>
    watchTransactionStatus({
      hash: HASH,
      loadTransaction: spy,
      nowMs: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
      onUpdate: (snapshot) => updates.push(snapshot),
      ...patch,
    });
  return { watch, spy, sleeps, updates };
}

/** A loader that never hears of the transaction. */
function neverFound() {
  return async () => {
    throw notFound();
  };
}

/** A loader that throws or answers in the given order. */
function reads(values) {
  let index = 0;
  return async () => {
    const value = values[index];
    index += 1;
    if (value instanceof Error) throw value;
    return value;
  };
}

describe("watchTransactionStatus", () => {
  it("walks pending then success", async () => {
    const run = harness(reads([notFound(), notFound(), success()]));

    const result = await run.watch({});

    expect(result.status).toBe("success");
    expect(result.code).toBe("txSuccess");
    expect(result.attempts).toBe(3);
    expect(run.updates.map((snapshot) => snapshot.status)).toEqual([
      "pending",
      "pending",
      "success",
    ]);
    expect(run.sleeps).toEqual([TX_POLL_INTERVAL_MS, TX_POLL_INTERVAL_MS]);
  });

  it("walks pending then expiry once the max time has passed", async () => {
    const run = harness(neverFound());

    const result = await run.watch({
      envelopeXdr: envelope({ maxSeconds: START_MS / 1000 + 60 }),
      intervalMs: 20000,
    });

    expect(result.status).toBe("expired");
    expect(result.attempts).toBe(4);
    expect(run.updates.map((snapshot) => snapshot.status)).toEqual([
      "pending",
      "pending",
      "pending",
      "expired",
    ]);
    expect(run.spy).toHaveBeenCalledTimes(4);
  });

  it("stops on a failed result without waiting for another read", async () => {
    const run = harness(
      reads([record(false, { transaction: "txFailed", operations: ["opInner", "opPaymentSuccess"] })])
    );

    const result = await run.watch({});

    expect(result.status).toBe("failed");
    expect(result.code).toBe("txFailed");
    expect(result.operationCodes).toEqual(["opInner", "opPaymentSuccess"]);
    expect(result.attempts).toBe(1);
    expect(run.sleeps).toEqual([]);
  });

  it("keeps a 404 pending while the max time is in the future", async () => {
    const run = harness(reads([notFound(), success()]));

    const result = await run.watch({ deadlineMs: START_MS + 500000, intervalMs: 1000 });

    expect(run.updates[0]).toMatchObject({
      status: "pending",
      code: null,
      operationCodes: [],
      attempts: 1,
    });
    expect(result.status).toBe("success");
  });

  it("reports a transaction that lands exactly on its max time", async () => {
    const run = harness(reads([notFound(), success()]));

    const result = await run.watch({ deadlineMs: START_MS + 2000, intervalMs: 2000 });

    expect(result.status).toBe("success");
    expect(result.attempts).toBe(2);
  });

  it("expires on the first read when the max time is already behind us", async () => {
    const run = harness(neverFound());

    const result = await run.watch({ deadlineMs: START_MS });

    expect(result.status).toBe("expired");
    expect(result.attempts).toBe(1);
    expect(run.sleeps).toEqual([]);
  });

  it("prefers a caller's deadline over the envelope's max time", async () => {
    const run = harness(neverFound());

    const result = await run.watch({
      deadlineMs: START_MS,
      envelopeXdr: envelope({ maxSeconds: START_MS / 1000 + 600 }),
    });

    expect(result.status).toBe("expired");
    expect(result.attempts).toBe(1);
  });

  it("falls back to a window when the envelope says TimeoutInfinite", async () => {
    const run = harness(neverFound());

    const result = await run.watch({
      envelopeXdr: envelope({ timeout: StellarSdk.TimeoutInfinite }),
      windowMs: 4000,
      intervalMs: 2000,
    });

    expect(result.status).toBe("expired");
    expect(result.attempts).toBe(3);
  });

  it("bounds a pasted hash with the watch window", async () => {
    const run = harness(neverFound());

    const result = await run.watch({ windowMs: 6000, intervalMs: 2000 });

    expect(TX_WATCH_WINDOW_MS).toBe(180000);
    expect(result.status).toBe("expired");
    expect(result.attempts).toBe(4);
  });

  it("reads the normalised hash on every attempt", async () => {
    const run = harness(reads([notFound(), notFound(), success()]));

    await run.watch({ hash: HASH.toUpperCase(), intervalMs: 1000 });

    expect(run.spy.mock.calls.map(([value]) => value)).toEqual([HASH, HASH, HASH]);
  });

  it("treats a bare 404 response as a transaction nobody has heard of", async () => {
    const run = harness(reads([bareNotFound(), success()]));

    const result = await run.watch({ intervalMs: 1000 });

    expect(run.updates[0].status).toBe("pending");
    expect(result.status).toBe("success");
  });

  it("gives up when Horizon answers something other than a 404", async () => {
    const run = harness(reads([new Error("Horizon is unreachable")]));

    await expect(run.watch({})).rejects.toThrow(
      "The transaction watch could not read the transaction: Horizon is unreachable."
    );
    expect(run.spy).toHaveBeenCalledTimes(1);
    expect(run.sleeps).toEqual([]);
  });

  it.each([
    ["several lines", new Error("Socket hang up\nafter 3 retries"), "Socket hang up."],
    ["a trailing period", new Error("Horizon is unreachable."), "Horizon is unreachable."],
    ["no message at all", new Error(""), "Horizon did not answer."],
  ])("names a transport failure that came as %s", async (_label, error, clause) => {
    const run = harness(reads([error]));

    await expect(run.watch({})).rejects.toThrow(
      `The transaction watch could not read the transaction: ${clause}`
    );
  });

  it("refuses a hash that is not 64 hex characters before reading anything", async () => {
    const run = harness(reads([success()]));

    await expect(run.watch({ hash: "nope" })).rejects.toThrow(
      "Transaction hash must be 64 hexadecimal characters."
    );
    expect(run.spy).not.toHaveBeenCalled();
  });

  it.each([
    ["an endless window", { windowMs: Infinity }],
    ["a deadline of zero", { deadlineMs: 0 }],
    ["a deadline of text", { deadlineMs: "soon" }],
  ])("refuses %s", async (_label, patch) => {
    const run = harness(neverFound());

    await expect(run.watch(patch)).rejects.toThrow(
      "The transaction watch needs a deadline in milliseconds."
    );
    expect(run.spy).not.toHaveBeenCalled();
  });

  it("links the explorer once for the whole watch", async () => {
    const run = harness(reads([notFound(), success()]));
    const explorerUrlFor = vi.fn((value) => `https://example.test/tx/${value}`);

    const result = await run.watch({ explorerUrlFor, intervalMs: 1000 });

    expect(explorerUrlFor).toHaveBeenCalledTimes(1);
    expect(explorerUrlFor).toHaveBeenCalledWith(HASH);
    expect(result.explorerUrl).toBe(`https://example.test/tx/${HASH}`);
    expect(run.updates[0].explorerUrl).toBe(result.explorerUrl);
  });

  it("links the active network's explorer by default", async () => {
    const run = harness(reads([success(), success()]));

    const testnet = await run.watch({});
    const futurenet = await run.watch({ networkId: "FUTURENET" });

    expect(testnet.explorerUrl).toBe(`https://stellar.expert/explorer/testnet/tx/${HASH}`);
    expect(futurenet.explorerUrl).toBe(`https://stellar.expert/explorer/futurenet/tx/${HASH}`);
  });

  it("reports the snapshot it returns", async () => {
    const run = harness(reads([record(false, { transaction: "txInsufficientFee" })]));

    const result = await run.watch({});

    expect(run.updates).toEqual([result]);
    expect(Object.keys(result)).toEqual([
      "hash",
      "explorerUrl",
      "attempts",
      "status",
      "code",
      "operationCodes",
    ]);
  });
});
