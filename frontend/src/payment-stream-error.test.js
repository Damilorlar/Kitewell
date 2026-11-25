import { beforeEach, describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { createPaymentStreamController } from "./paymentStream";

const ACCOUNT = StellarSdk.Keypair.random().publicKey();
const COUNTERPARTY = StellarSdk.Keypair.random().publicKey();

function event(token) {
  return {
    id: token,
    paging_token: token,
    type: "payment",
    from: ACCOUNT,
    to: COUNTERPARTY,
    amount: "2.0000000",
    asset_type: "native",
    transaction_hash: "d".repeat(64),
    created_at: "2026-11-20T12:00:00Z",
  };
}

function harness() {
  const streams = [];
  const openStream = vi.fn((config) => {
    const handle = { close: vi.fn(() => true) };
    streams.push({ config, handle });
    return handle;
  });
  return {
    streams,
    controller: createPaymentStreamController({
      openStream,
      horizonUrlFor: () => "https://horizon-testnet.stellar.org",
    }),
  };
}

describe("a payments stream that fails", () => {
  let run;

  beforeEach(() => {
    run = harness();
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    run.streams[0].config.onRecord(event("1-0"));
    run.streams[0].config.onRecord(event("2-0"));
  });

  it("keeps the payments already loaded", () => {
    run.streams[0].config.onError(new Error("Horizon closed the stream"));
    expect(run.controller.getRecords().map((record) => record.id)).toEqual(["2-0", "1-0"]);
  });

  it("shows the failure on one line", () => {
    run.streams[0].config.onError(
      new Error("EventSource reached readyState CLOSED\nafter 30 seconds\nof silence")
    );
    const failure = run.controller.getState().failure;
    expect(failure).toBe(
      "Payments stream failed: EventSource reached readyState CLOSED after 30 seconds of silence"
    );
    expect(failure.split("\n")).toHaveLength(1);
    expect(run.controller.getState().status).toBe("error");
  });

  it("still says something when the error carries no message", () => {
    for (const blank of [new Error(""), {}, " ", null, undefined]) {
      run.streams[0].config.onError(blank);
      expect(run.controller.getState().failure).toBe(
        "Payments stream failed: no reason given."
      );
    }
  });

  it("clears the failure once a payment arrives again", () => {
    run.streams[0].config.onError(new Error("connection reset"));
    expect(run.controller.getState().failure).not.toBeNull();

    run.streams[0].config.onRecord(event("3-0"));
    expect(run.controller.getState().failure).toBeNull();
    expect(run.controller.getRecords()[0].id).toBe("3-0");
  });

  it("can be reopened after a failure", () => {
    run.streams[0].config.onError(new Error("connection reset"));
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    expect(run.streams).toHaveLength(1);
    run.controller.stop("disconnect");
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    expect(run.streams).toHaveLength(2);
    expect(run.controller.getState().status).toBe("open");
  });

  it("exposes fail for a transport that reports its own error", () => {
    run.controller.fail(new Error("the tab was backgrounded"));
    expect(run.controller.getState().failure).toBe(
      "Payments stream failed: the tab was backgrounded"
    );
    expect(run.controller.getRecords()).toHaveLength(2);
  });
});
