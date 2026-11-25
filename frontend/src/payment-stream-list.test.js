import { beforeEach, describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { createPaymentStreamController } from "./paymentStream";

const ACCOUNT = StellarSdk.Keypair.random().publicKey();
const COUNTERPARTY = StellarSdk.Keypair.random().publicKey();
const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";
const FUTURENET_HORIZON = "https://horizon-futurenet.stellar.org";

const HORIZON_BY_NETWORK = {
  TESTNET: TESTNET_HORIZON,
  FUTURENET: FUTURENET_HORIZON,
};

function event(token, amount = "1.0000000") {
  return {
    id: token,
    paging_token: token,
    type: "payment",
    from: ACCOUNT,
    to: COUNTERPARTY,
    amount,
    asset_type: "credit_alphanum4",
    asset_code: "USD",
    asset_issuer: StellarSdk.Keypair.random().publicKey(),
    transaction_hash: "b".repeat(64),
    created_at: `2026-11-20T12:00:0${token.slice(-1)}Z`,
  };
}

function harness() {
  const streams = [];
  const changes = [];
  const openStream = vi.fn((config) => {
    const handle = { close: vi.fn(() => true) };
    streams.push({ config, handle });
    return handle;
  });

  return {
    streams,
    changes,
    openStream,
    controller: createPaymentStreamController({
      openStream,
      horizonUrlFor: (networkId) => {
        if (!HORIZON_BY_NETWORK[networkId]) throw new Error(`Unsupported network: ${networkId}`);
        return HORIZON_BY_NETWORK[networkId];
      },
      onChange: (records, state) => changes.push({ records, state }),
    }),
  };
}

describe("the payments list a stream builds", () => {
  let run;

  beforeEach(() => {
    run = harness();
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
  });

  it("adds two events and refuses the duplicate of the first", () => {
    const { config } = run.streams[0];
    config.onRecord(event("100-1", "3.0000000"));
    config.onRecord(event("200-2", "4.0000000"));
    config.onRecord(event("100-1", "3.0000000"));

    const records = run.controller.getRecords();
    expect(records).toHaveLength(2);
    // Newest first: the second payment prepended over the first.
    expect(records.map((record) => record.id)).toEqual(["200-2", "100-1"]);
    expect(records[0].amount).toBe("4.0000000");
  });

  it("prepends so the newest payment is the first row", () => {
    const { config } = run.streams[0];
    config.onRecord(event("1-0"));
    config.onRecord(event("2-0"));
    config.onRecord(event("3-0"));
    expect(run.controller.getRecords().map((record) => record.id)).toEqual(["3-0", "2-0", "1-0"]);
  });

  it("shows the fields history shows, not the raw event", () => {
    const { config } = run.streams[0];
    config.onRecord(event("1-0"));
    expect(Object.keys(run.controller.getRecords()[0]).sort()).toEqual(
      [
        "amount", "asset_code", "asset_type", "created_at", "fee_bumped", "fee_charged",
        "from", "id", "operation_count", "to", "transaction_hash",
      ].sort()
    );
  });

  it("ignores a repeated id even when the amount differs", () => {
    const { config } = run.streams[0];
    config.onRecord(event("1-0", "1.0000000"));
    config.onRecord(event("1-0", "99.0000000"));
    expect(run.controller.getRecords()).toHaveLength(1);
    expect(run.controller.getRecords()[0].amount).toBe("1.0000000");
  });

  it("ignores non-payment events without failing the stream", () => {
    const { config } = run.streams[0];
    config.onRecord({ ...event("1-0"), type: "claim_claimable_balance" });
    config.onRecord(event("2-0"));
    expect(run.controller.getRecords().map((record) => record.id)).toEqual(["2-0"]);
    expect(run.controller.getState().status).toBe("open");
    expect(run.controller.getState().failure).toBeNull();
  });

  it("deduplicates on paging_token when the id is missing", () => {
    const { config } = run.streams[0];
    const first = { ...event("7-0") };
    delete first.id;
    config.onRecord(first);
    config.onRecord(first);
    expect(run.controller.getRecords()).toHaveLength(1);
  });

  it("fails a record that carries neither an id nor a paging token", () => {
    const { config } = run.streams[0];
    config.onRecord(event("1-0"));
    const anonymous = { ...event("2-0") };
    delete anonymous.id;
    delete anonymous.paging_token;
    config.onRecord(anonymous);

    expect(run.controller.getRecords()).toHaveLength(1);
    expect(run.controller.getState().status).toBe("error");
  });

  it("reports every change to the list through onChange", () => {
    const { config } = run.streams[0];
    config.onRecord(event("1-0"));
    config.onRecord(event("1-0"));
    const statuses = run.changes.map((change) => change.state.status);
    expect(statuses).toEqual(["open", "open"]);
    expect(run.changes.at(-1).records).toHaveLength(1);
  });
});
