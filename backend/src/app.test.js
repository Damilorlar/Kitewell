import test from "node:test";
import assert from "node:assert/strict";
import * as StellarSdk from "@stellar/stellar-sdk";

import { createApp } from "./app.js";

const VALID_ADDRESS = StellarSdk.Keypair.random().publicKey();
const INVALID_ADDRESS = "not-a-valid-stellar-key";

/** Silence the per-request JSON logger while keeping the middleware in place. */
test.beforeEach((t) => {
  t.mock.method(console, "log", () => {});
});

/** Env fixture with every optional setting pinned to a test-only value. */
function testEnv(overrides = {}) {
  return {
    NETWORK: "TESTNET",
    HORIZON_URL: "https://horizon.test.invalid",
    FRIENDBOT_URL: "https://friendbot.test.invalid",
    EXPLORER_BASE: "https://explorer.test.invalid",
    SOROBAN_RPC_URL: "https://soroban.test.invalid",
    ...overrides,
  };
}

/** Stubbed Horizon server that records how it was called. */
function stubHorizon({ account, accountError, payments, paymentsError } = {}) {
  const calls = {
    loadAccount: [],
    payments: { forAccount: null, limit: null, order: null, cursor: null, join: null },
  };

  return {
    calls,
    server: {
      async loadAccount(address) {
        calls.loadAccount.push(address);
        if (accountError) throw accountError;
        return account;
      },
      payments() {
        const builder = {
          forAccount(address) {
            calls.payments.forAccount = address;
            return builder;
          },
          limit(value) {
            calls.payments.limit = value;
            return builder;
          },
          order(value) {
            calls.payments.order = value;
            return builder;
          },
          cursor(value) {
            calls.payments.cursor = value;
            return builder;
          },
          join(value) {
            calls.payments.join = value;
            return builder;
          },
          async call() {
            if (paymentsError) throw paymentsError;

            const all = payments ?? [];
            let start = 0;
            if (calls.payments.cursor) {
              const index = all.findIndex(
                (p) => p.paging_token === calls.payments.cursor,
              );
              // Horizon rejects a cursor it cannot resolve with a 400.
              if (index === -1) throw horizonError(400, "Bad cursor");
              start = index + 1;
            }

            const size = calls.payments.limit ?? 15;
            return { records: all.slice(start, start + size) };
          },
        };
        return builder;
      },
    },
  };
}

/** Build a Horizon-shaped error (what `axios` errors look like in practice). */
function horizonError(status, message = `Horizon responded with ${status}`) {
  return Object.assign(new Error(message), { response: { status } });
}

/** Boot the app on an ephemeral loopback port (no outbound network). */
async function startApp(app) {
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const { port } = server.address();

  return {
    async get(path) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      return { status: res.status, body: await res.json() };
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Convenience: create an app whose Horizon is stubbed, and boot it. */
async function boot(t, { horizon = stubHorizon(), env = testEnv() } = {}) {
  const app = createApp({ horizon: horizon.server, env });
  const client = await startApp(app);
  t.after(client.close);
  return { ...client, stub: horizon };
}

function accountFixture(overrides = {}) {
  return {
    id: VALID_ADDRESS,
    sequenceNumber: () => "123456789012345678",
    subentry_count: 1,
    last_modified_ledger: 987654,
    thresholds: {
      low_threshold: 1,
      med_threshold: 2,
      high_threshold: 3,
    },
    balances: [{ asset_type: "native", balance: "100.0000000" }],
    ...overrides,
  };
}

test("GET /health returns the service metadata body", async (t) => {
  const { get } = await boot(t);

  const { status, body } = await get("/health");

  assert.equal(status, 200);
  assert.deepEqual(body, {
    ok: true,
    service: "kitewell-backend",
    network: "TESTNET",
    horizon: "https://horizon.test.invalid",
  });
});

test("GET /api/network reports not_deployed when KITEWELL_CONTRACT_ID is unset", async (t) => {
  const { get } = await boot(t);

  const { status, body } = await get("/api/network");

  assert.equal(status, 200);
  assert.equal(body.network, "TESTNET");
  assert.equal(body.horizonUrl, "https://horizon.test.invalid");
  assert.equal(body.friendbotUrl, "https://friendbot.test.invalid");
  assert.equal(body.explorerBase, "https://explorer.test.invalid");
  assert.equal(body.sorobanRpcUrl, "https://soroban.test.invalid");
  assert.equal(body.passphrase, StellarSdk.Networks.TESTNET);
  assert.deepEqual(body.contract, { kitewell: null, status: "not_deployed" });
});

test("GET /api/network reports configured when KITEWELL_CONTRACT_ID is set", async (t) => {
  const contractId = "CDTESTCONTRACT7XQ4W7ZP4Z2YQ4ZP4Z2YQ4ZP4Z2YQ4ZP4Z2YQ4ZP4Z2";
  const { get } = await boot(t, {
    env: testEnv({ KITEWELL_CONTRACT_ID: contractId }),
  });

  const { status, body } = await get("/api/network");

  assert.equal(status, 200);
  assert.deepEqual(body.contract, {
    kitewell: contractId,
    status: "configured",
  });
});

test("GET /api/account/:address rejects an invalid public key without calling Horizon", async (t) => {
  const { get, stub } = await boot(t);

  const { status, body } = await get(`/api/account/${INVALID_ADDRESS}`);

  assert.equal(status, 400);
  assert.equal(body.error, "Invalid Stellar public key");
  assert.deepEqual(stub.calls.loadAccount, []);
});

test("GET /api/account/:address maps a Horizon account into the API body", async (t) => {
  const account = accountFixture({
    balances: [
      { asset_type: "native", balance: "100.0000000" },
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "GISSUER",
        balance: "5.0000000",
        limit: "1000.0000000",
      },
    ],
    data_attr: { z: "eg==", a: "aGVsbG8=" },
  });
  const { get, stub } = await boot(t, {
    horizon: stubHorizon({ account }),
  });

  const { status, body } = await get(`/api/account/${VALID_ADDRESS}`);

  assert.equal(status, 200);
  assert.deepEqual(stub.calls.loadAccount, [VALID_ADDRESS]);
  assert.deepEqual(body, {
    id: VALID_ADDRESS,
    sequence: "123456789012345678",
    subentryCount: 1,
    lastModifiedLedger: 987654,
    thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
    signers: [],
    balances: [
      {
        key: "native",
        code: "XLM",
        issuer: null,
        balance: "100.0000000",
        limit: null,
        isNative: true,
      },
      {
        key: "USDC:GISSUER",
        code: "USDC",
        issuer: "GISSUER",
        balance: "5.0000000",
        limit: "1000.0000000",
        isNative: false,
        isAuthorized: null,
        isAuthorizedToMaintainLiabilities: null,
        clawbackEnabled: null,
      },
    ],
    dataEntries: [
      { name: "a", value: "aGVsbG8=" },
      { name: "z", value: "eg==" },
    ],
    explorerUrl: `https://explorer.test.invalid/account/${VALID_ADDRESS}`,
  });
});

test("GET /api/account/:address returns 404 when Horizon reports the account missing", async (t) => {
  const error = horizonError(404, "Resource Missing");
  const { get } = await boot(t, { horizon: stubHorizon({ accountError: error }) });

  const { status, body } = await get(`/api/account/${VALID_ADDRESS}`);

  assert.equal(status, 404);
  assert.equal(
    body.error,
    "Account not found on Testnet. Fund with Friendbot first.",
  );
  assert.equal(body.detail, "Resource Missing");
});

test("GET /api/account/:address returns 502 when Horizon fails for another reason", async (t) => {
  const error = horizonError(503, "Horizon is temporarily unavailable");
  const { get } = await boot(t, { horizon: stubHorizon({ accountError: error }) });

  const { status, body } = await get(`/api/account/${VALID_ADDRESS}`);

  assert.equal(status, 502);
  assert.equal(body.error, "Horizon request failed");
  assert.equal(body.detail, "Horizon is temporarily unavailable");
});

test("GET /api/payments/:address rejects an invalid public key", async (t) => {
  const { get, stub } = await boot(t);

  const { status, body } = await get(`/api/payments/${INVALID_ADDRESS}`);

  assert.equal(status, 400);
  assert.equal(body.error, "Invalid Stellar public key");
  assert.equal(stub.calls.payments.forAccount, null);
});

test("GET /api/payments/:address filters out non-payment records", async (t) => {
  const { get, stub } = await boot(t, {
    horizon: stubHorizon({
      payments: [
        {
          id: "1",
          type: "create_account",
          from: "GFROM",
          to: "GTO",
          amount: "10.0000000",
          transaction_hash: "hash-create",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "2",
          type: "payment",
          from: "GFROM",
          to: "GTO",
          amount: "7.5000000",
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          transaction_hash: "hash-payment",
          created_at: "2026-01-02T00:00:00Z",
          transaction: {
            fee_charged: "100",
            operation_count: 1,
            memo_type: "text",
            memo: "invoice-42",
            memo_bytes: "aW52b2ljZS00Mg==",
          },
        },
        {
          id: "3",
          type: "path_payment_strict_send",
          from: "GFROM",
          to: "GTO",
          amount: "1.0000000",
          transaction_hash: "hash-path",
          created_at: "2026-01-03T00:00:00Z",
        },
        {
          id: "4",
          type: "payment",
          from: "GOTHER",
          to: "GTO",
          amount: "2.0000000",
          asset_type: "native",
          transaction_hash: "hash-native",
          created_at: "2026-01-04T00:00:00Z",
        },
      ],
    }),
  });

  const { status, body } = await get(`/api/payments/${VALID_ADDRESS}`);

  assert.equal(status, 200);
  assert.deepEqual(stub.calls.payments.forAccount, VALID_ADDRESS);
  assert.equal(stub.calls.payments.order, "desc");
  assert.equal(stub.calls.payments.join, "transactions");
  assert.equal(body.records.length, 2);
  assert.equal(body.nextCursor, null, "a short page is the last page");
  assert.deepEqual(body.records, [
    {
      id: "2",
      from: "GFROM",
      to: "GTO",
      amount: "7.5000000",
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      transaction_hash: "hash-payment",
      created_at: "2026-01-02T00:00:00Z",
      fee_charged: "100",
      operation_count: 1,
      fee_bumped: false,
      memo_type: "text",
      memo: "invoice-42",
      memo_bytes: "aW52b2ljZS00Mg==",
      explorerUrl: "https://explorer.test.invalid/tx/hash-payment",
    },
    {
      id: "4",
      from: "GOTHER",
      to: "GTO",
      amount: "2.0000000",
      asset_type: "native",
      asset_code: "XLM",
      transaction_hash: "hash-native",
      created_at: "2026-01-04T00:00:00Z",
      fee_charged: null,
      operation_count: null,
      fee_bumped: false,
      explorerUrl: "https://explorer.test.invalid/tx/hash-native",
    },
  ]);
});

test("GET /api/payments/:address forwards a limit and caps it at 50", async (t) => {
  const withLimit = await boot(t, { horizon: stubHorizon() });
  await withLimit.get(`/api/payments/${VALID_ADDRESS}?limit=5`);
  assert.equal(withLimit.stub.calls.payments.limit, 5);

  const withoutLimit = await boot(t, { horizon: stubHorizon() });
  await withoutLimit.get(`/api/payments/${VALID_ADDRESS}`);
  assert.equal(withoutLimit.stub.calls.payments.limit, 15);

  const capped = await boot(t, { horizon: stubHorizon() });
  await capped.get(`/api/payments/${VALID_ADDRESS}?limit=999`);
  assert.equal(capped.stub.calls.payments.limit, 50);
});

test("GET /api/payments/:address returns 502 when Horizon fails", async (t) => {
  const error = new Error("Horizon payments request failed");
  const { get } = await boot(t, {
    horizon: stubHorizon({ paymentsError: error }),
  });

  const { status, body } = await get(`/api/payments/${VALID_ADDRESS}`);

  assert.equal(status, 502);
  assert.equal(body.error, "Could not load payments");
  assert.equal(body.detail, "Horizon payments request failed");
});

/** Newest-first raw Horizon payment record, used by the pagination tests. */
function paymentFixture(id, type = "payment") {
  return {
    id,
    type,
    paging_token: `token-${id}`,
    from: "GFROM",
    to: "GTO",
    amount: "1.0000000",
    asset_type: "native",
    transaction_hash: `hash-${id}`,
    created_at: `2026-01-0${id}T00:00:00Z`,
  };
}

const PAGED_PAYMENTS = [
  paymentFixture("5"),
  paymentFixture("4"),
  paymentFixture("3"),
  paymentFixture("2"),
  paymentFixture("1"),
];

test("GET /api/payments/:address returns a first page with a nextCursor", async (t) => {
  const { get, stub } = await boot(t, {
    horizon: stubHorizon({ payments: PAGED_PAYMENTS }),
  });

  const { status, body } = await get(`/api/payments/${VALID_ADDRESS}?limit=2`);

  assert.equal(status, 200);
  assert.equal(stub.calls.payments.cursor, null, "no cursor on the first page");
  assert.deepEqual(
    body.records.map((r) => r.id),
    ["5", "4"],
  );
  assert.equal(
    body.nextCursor,
    "token-4",
    "cursor is the paging_token of the last raw record",
  );
});

test("GET /api/payments/:address forwards the cursor and returns the next page", async (t) => {
  const { get, stub } = await boot(t, {
    horizon: stubHorizon({ payments: PAGED_PAYMENTS }),
  });

  const { status, body } = await get(
    `/api/payments/${VALID_ADDRESS}?limit=2&cursor=token-4`,
  );

  assert.equal(status, 200);
  assert.equal(stub.calls.payments.cursor, "token-4");
  assert.deepEqual(
    body.records.map((r) => r.id),
    ["3", "2"],
  );
  assert.equal(body.nextCursor, "token-2");
});

test("GET /api/payments/:address returns nextCursor null on the last page", async (t) => {
  const { get, stub } = await boot(t, {
    horizon: stubHorizon({ payments: PAGED_PAYMENTS }),
  });

  const { status, body } = await get(
    `/api/payments/${VALID_ADDRESS}?limit=2&cursor=token-2`,
  );

  assert.equal(status, 200);
  assert.equal(stub.calls.payments.cursor, "token-2");
  assert.deepEqual(
    body.records.map((r) => r.id),
    ["1"],
  );
  assert.equal(body.nextCursor, null, "a short page ends paging");
});

test("GET /api/payments/:address pages from the last raw record, not the last payment", async (t) => {
  // The last raw record of this page is not a payment, so it still has to
  // drive the cursor — skipping it would drop every record after it.
  const { get } = await boot(t, {
    horizon: stubHorizon({
      payments: [paymentFixture("9"), paymentFixture("8", "create_account")],
    }),
  });

  const { status, body } = await get(`/api/payments/${VALID_ADDRESS}?limit=2`);

  assert.equal(status, 200);
  assert.deepEqual(
    body.records.map((r) => r.id),
    ["9"],
  );
  assert.equal(body.nextCursor, "token-8");
});

test("GET /api/payments/:address returns 400 Invalid cursor when Horizon rejects it", async (t) => {
  const { get } = await boot(t, {
    horizon: stubHorizon({ payments: PAGED_PAYMENTS }),
  });

  const { status, body } = await get(
    `/api/payments/${VALID_ADDRESS}?cursor=not-a-cursor`,
  );

  assert.equal(status, 400);
  assert.deepEqual(body, { error: "Invalid cursor" });
});
