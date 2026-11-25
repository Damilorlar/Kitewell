import test from "node:test";
import assert from "node:assert/strict";
import * as StellarSdk from "@stellar/stellar-sdk";

import { createApp } from "./app.js";

/**
 * Issue #492: account and payment reads follow the network selected in the
 * Lab header, not the backend process's single HORIZON_URL.
 *
 * Each network gets its own stubbed Horizon so a Testnet response can never
 * satisfy a Futurenet request.
 */

const VALID_ADDRESS = StellarSdk.Keypair.random().publicKey();

test.beforeEach((t) => {
  t.mock.method(console, "log", () => {});
});

function testEnv(overrides = {}) {
  return {
    NETWORK: "TESTNET",
    HORIZON_URL: "https://horizon.test.invalid",
    EXPLORER_BASE: "https://explorer.test.invalid",
    ...overrides,
  };
}

function stubHorizon({ id = "GTEST", fail } = {}) {
  const calls = { loadAccount: [] };

  return {
    calls,
    server: {
      async loadAccount(address) {
        calls.loadAccount.push(address);
        if (fail) throw fail;
        return {
          id,
          sequenceNumber: () => "1",
          subentry_count: 0,
          thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
          balances: [{ asset_type: "native", balance: "10.0000000" }],
        };
      },
      payments() {
        const builder = {
          _records: [],
          forAccount(address) {
            calls.paymentsFor = address;
            return builder;
          },
          limit() {
            return builder;
          },
          order() {
            return builder;
          },
          cursor() {
            return builder;
          },
          async call() {
            if (fail) throw fail;
            return {
              records: [
                {
                  id: "1",
                  type: "payment",
                  from: "GFROM",
                  to: "GTO",
                  amount: "1.0000000",
                  asset_type: "native",
                  transaction_hash: "abc",
                  created_at: "2026-01-01T00:00:00Z",
                },
              ],
            };
          },
        };
        return builder;
      },
    },
  };
}

async function startApp(app) {
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const { port } = server.address();

  return {
    async get(path, headers = {}) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
      return { status: res.status, body: await res.json() };
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function boot(t, { horizon, env = testEnv() } = {}) {
  const app = createApp({ horizon, env });
  const client = await startApp(app);
  t.after(client.close);
  return client;
}

test("GET /api/account defaults to Testnet when the client sends no network", async (t) => {
  const testnet = stubHorizon();
  const futurenet = stubHorizon();
  const { get } = await boot(t, {
    horizon: { TESTNET: testnet.server, FUTURENET: futurenet.server },
  });

  const { status } = await get(`/api/account/${VALID_ADDRESS}`);

  assert.equal(status, 200);
  assert.deepEqual(testnet.calls.loadAccount, [VALID_ADDRESS]);
  assert.deepEqual(futurenet.calls.loadAccount, []);
});

test("GET /api/account serves Futurenet from Futurenet Horizon", async (t) => {
  const testnet = stubHorizon();
  const futurenet = stubHorizon();
  const { get } = await boot(t, {
    horizon: { TESTNET: testnet.server, FUTURENET: futurenet.server },
  });

  const { status, body } = await get(
    `/api/account/${VALID_ADDRESS}?network=FUTURENET`,
  );

  assert.equal(status, 200);
  assert.deepEqual(futurenet.calls.loadAccount, [VALID_ADDRESS]);
  assert.deepEqual(testnet.calls.loadAccount, []);
  assert.equal(
    body.explorerUrl,
    `https://stellar.expert/explorer/futurenet/account/${VALID_ADDRESS}`,
  );
});

test("the x-kitewell-network header selects the network", async (t) => {
  const testnet = stubHorizon();
  const futurenet = stubHorizon();
  const { get } = await boot(t, {
    horizon: { TESTNET: testnet.server, FUTURENET: futurenet.server },
  });

  const { status } = await get(`/api/account/${VALID_ADDRESS}`, {
    "x-kitewell-network": "futurenet",
  });

  assert.equal(status, 200);
  assert.deepEqual(futurenet.calls.loadAccount, [VALID_ADDRESS]);
  assert.deepEqual(testnet.calls.loadAccount, []);
});

test("GET /api/payments follows the selected network", async (t) => {
  const testnet = stubHorizon();
  const futurenet = stubHorizon();
  const { get } = await boot(t, {
    horizon: { TESTNET: testnet.server, FUTURENET: futurenet.server },
  });

  const { status, body } = await get(
    `/api/payments/${VALID_ADDRESS}?network=FUTURENET`,
  );

  assert.equal(status, 200);
  assert.equal(futurenet.calls.paymentsFor, VALID_ADDRESS);
  assert.equal(body.records[0].explorerUrl, "https://stellar.expert/explorer/futurenet/tx/abc");
});

test("an unsupported network is a 400 and never reaches Horizon", async (t) => {
  const testnet = stubHorizon();
  const futurenet = stubHorizon();
  const { get } = await boot(t, {
    horizon: { TESTNET: testnet.server, FUTURENET: futurenet.server },
  });

  const account = await get(`/api/account/${VALID_ADDRESS}?network=MAINNET`);
  const payments = await get(`/api/payments/${VALID_ADDRESS}?network=`);

  assert.equal(account.status, 400);
  assert.match(account.body.error, /Unsupported network "MAINNET"/);
  assert.equal(payments.status, 200); // blank means Testnet, not an error
  assert.deepEqual(testnet.calls.loadAccount, []);
  assert.equal(testnet.calls.paymentsFor, VALID_ADDRESS);
  assert.deepEqual(futurenet.calls.loadAccount, []);
});

test("a Futurenet 404 keeps Horizon's not-found status", async (t) => {
  const error = Object.assign(new Error("Resource Missing"), {
    response: { status: 404 },
  });
  const testnet = stubHorizon();
  const futurenet = stubHorizon({ fail: error });
  const { get } = await boot(t, {
    horizon: { TESTNET: testnet.server, FUTURENET: futurenet.server },
  });

  const { status, body } = await get(
    `/api/account/${VALID_ADDRESS}?network=FUTURENET`,
  );

  assert.equal(status, 404);
  assert.equal(
    body.error,
    "Account not found on Futurenet. Fund with Friendbot first.",
  );
});
