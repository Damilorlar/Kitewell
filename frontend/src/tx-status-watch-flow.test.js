import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two ways a watch starts: a hash the lab just submitted, and a hash
 * somebody pastes.
 *
 * The Horizon server is mocked the way `payment-stream-map.test.js` mocks it,
 * so the default read goes through the real call builder chain and stops at a
 * stubbed network. `transactions().transaction(hash)` only builds the request —
 * Horizon answers when `.call()` runs — so the stub keeps that shape. Envelopes
 * carry the absolute max time a 180 second timeout would put on them, so the
 * walk is repeatable.
 */

const { transactionReadMock } = vi.hoisted(() => ({ transactionReadMock: vi.fn() }));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return {
          transactions: () => ({
            transaction: (hash) => ({ call: () => transactionReadMock(hash) }),
          }),
        };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { TX_POLL_INTERVAL_MS, txStatusPresentation, watchTransactionStatus } = await import(
  "./txStatusWatch"
);

const PASSPHRASE = StellarSdk.Networks.TESTNET;
const CLIENT = StellarSdk.Keypair.random();
const DESTINATION = StellarSdk.Keypair.random();
const START_MS = 1000000;

function envelopeWithMaxSeconds(seconds) {
  const transaction = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(CLIENT.publicKey(), "7"),
    { fee: StellarSdk.BASE_FEE, networkPassphrase: PASSPHRASE }
  )
    .addOperation(
      StellarSdk.Operation.payment({
        destination: DESTINATION.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: "25.0000000",
      })
    )
    .setTimebounds(0, seconds)
    .build();
  transaction.sign(CLIENT);
  return transaction;
}

function notFound() {
  return new StellarSdk.NotFoundError("Request failed with status code 404", {
    data: { extras: {} },
    status: 404,
    statusText: "Not Found",
  });
}

function reads(values) {
  let index = 0;
  return async () => {
    const value = values[index];
    index += 1;
    if (value instanceof Error) throw value;
    return value;
  };
}

function clock() {
  let now = START_MS;
  const sleeps = [];
  return {
    nowMs: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    sleeps,
  };
}

describe("watching a transaction the lab submitted", () => {
  let hash;
  let time;

  beforeEach(() => {
    hash = "a".repeat(64);
    time = clock();
    transactionReadMock.mockReset();
  });

  it("reads Horizon through the transaction call builder", async () => {
    const target = "b".repeat(64);
    transactionReadMock.mockImplementation(reads([notFound(), { successful: true, result_codes: { transaction: "txSuccess" } }]));

    const result = await watchTransactionStatus({ hash: target, ...time });

    expect(StellarSdk.Horizon.Server).toHaveBeenCalledWith("https://horizon-testnet.stellar.org");
    expect(transactionReadMock).toHaveBeenCalledTimes(2);
    expect(transactionReadMock.mock.calls.map(([value]) => value)).toEqual([target, target]);
    expect(result.status).toBe("success");
    expect(result.explorerUrl).toBe(`https://stellar.expert/explorer/testnet/tx/${target}`);
  });

  it("walks a submitted payment from pending to on the ledger", async () => {
    const submitted = envelopeWithMaxSeconds(START_MS / 1000 + 180);
    hash = Buffer.from(submitted.hash()).toString("hex");
    transactionReadMock.mockImplementation(
      reads([
        notFound(),
        {
          hash,
          successful: true,
          result_codes: { transaction: "txSuccess" },
          created_at: "2026-11-21T12:00:00Z",
        },
      ])
    );

    const result = await watchTransactionStatus({
      hash,
      envelopeXdr: submitted.toXDR(),
      ...time,
    });
    const shown = txStatusPresentation(result);

    expect(result.status).toBe("success");
    expect(result.attempts).toBe(2);
    expect(time.sleeps).toEqual([TX_POLL_INTERVAL_MS]);
    expect(shown).toEqual({
      status: "success",
      text: "The transaction is on the ledger.",
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}`,
    });
  });

  it("shows the operation code when the lab payment fails on the ledger", async () => {
    transactionReadMock.mockImplementation(
      reads([
        {
          successful: false,
          result_codes: { transaction: "txFailed", operations: ["opInner", "opUnderfunded"] },
        },
      ])
    );

    const result = await watchTransactionStatus({ hash, ...time });

    expect(txStatusPresentation(result).text).toBe(
      "The transaction failed: txFailed / opInner."
    );
    expect(time.sleeps).toEqual([]);
  });

  it("follows a fee bump by the max time of the transaction inside it", async () => {
    const inner = envelopeWithMaxSeconds(START_MS / 1000 + 60);
    const bump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      CLIENT.publicKey(),
      "200",
      inner,
      PASSPHRASE
    );
    transactionReadMock.mockImplementation(reads(Array(6).fill(notFound())));

    const result = await watchTransactionStatus({
      hash: Buffer.from(bump.hash()).toString("hex"),
      envelopeXdr: bump.toXDR(),
      intervalMs: 20000,
      ...time,
    });

    expect(result.status).toBe("expired");
    expect(result.attempts).toBe(4);
    expect(txStatusPresentation(result).text).toBe(
      "Nothing reached the ledger before the transaction's max time, so it never landed."
    );
  });

  it("stops on the pasted hash's own window when nobody has heard of it", async () => {
    const pasted = "d".repeat(64);
    transactionReadMock.mockImplementation(async () => {
      throw notFound();
    });

    const result = await watchTransactionStatus({
      hash: pasted.toUpperCase(),
      windowMs: 6000,
      intervalMs: 2000,
      ...time,
    });
    const shown = txStatusPresentation(result);

    expect(transactionReadMock.mock.calls.map(([value]) => value)).toEqual([
      pasted,
      pasted,
      pasted,
      pasted,
    ]);
    expect(result.status).toBe("expired");
    expect(shown.status).toBe("expired");
    expect(shown.explorerUrl).toBe(`https://stellar.expert/explorer/testnet/tx/${pasted}`);
  });

  it("refuses a paste that is not a hash before touching Horizon", async () => {
    await expect(
      watchTransactionStatus({ hash: "https://stellar.expert/tx/abc", ...time })
    ).rejects.toThrow("Transaction hash must be 64 hexadecimal characters.");
    expect(transactionReadMock).not.toHaveBeenCalled();
  });
});
