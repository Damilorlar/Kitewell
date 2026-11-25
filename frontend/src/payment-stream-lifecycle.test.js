import { beforeEach, describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  createPaymentStreamController,
  PAYMENT_STREAM_REASONS,
} from "./paymentStream";

const ACCOUNT = StellarSdk.Keypair.random().publicKey();
const OTHER_ACCOUNT = StellarSdk.Keypair.random().publicKey();

function harness() {
  const streams = [];
  const openStream = vi.fn((config) => {
    const handle = { close: vi.fn(() => true) };
    streams.push({ config, handle });
    return handle;
  });
  const controller = createPaymentStreamController({
    openStream,
    horizonUrlFor: (networkId) => `https://horizon-${networkId.toLowerCase()}.stellar.org`,
  });
  return { streams, openStream, controller };
}

describe("PAYMENT_STREAM_REASONS", () => {
  it("names the three ways the lab closes a stream", () => {
    expect(PAYMENT_STREAM_REASONS).toEqual(["disconnect", "network-change", "tab-hidden"]);
  });

  it("cannot be mutated by the caller", () => {
    expect(Object.isFrozen(PAYMENT_STREAM_REASONS)).toBe(true);
  });
});

describe("the payments stream lifecycle", () => {
  let run;

  beforeEach(() => {
    run = harness();
  });

  it("opens a stream for the connected account on the active network", () => {
    const started = run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });

    expect(run.openStream).toHaveBeenCalledTimes(1);
    expect(started.reused).toBe(false);
    expect(started.url).toBe(`https://horizon-testnet.stellar.org/accounts/${ACCOUNT}/payments?limit=50&join=transactions&cursor=now`);
    expect(run.controller.isOpen()).toBe(true);
    expect(run.controller.getState()).toEqual({
      status: "open",
      failure: null,
      reason: null,
      networkId: "TESTNET",
      account: ACCOUNT,
    });
  });

  it("does nothing new when the same account and network start again", () => {
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    const second = run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });

    expect(second.reused).toBe(true);
    expect(run.openStream).toHaveBeenCalledTimes(1);
    expect(run.streams[0].handle.close).not.toHaveBeenCalled();
  });

  it("closes the Testnet stream before opening Futurenet", () => {
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    run.controller.start({ publicKey: ACCOUNT, networkId: "FUTURENET" });

    expect(run.streams).toHaveLength(2);
    expect(run.streams[0].handle.close).toHaveBeenCalledTimes(1);
    expect(run.openStream.mock.calls.map(([config]) => config.url)).toEqual([
      `https://horizon-testnet.stellar.org/accounts/${ACCOUNT}/payments?limit=50&join=transactions&cursor=now`,
      `https://horizon-futurenet.stellar.org/accounts/${ACCOUNT}/payments?limit=50&join=transactions&cursor=now`,
    ]);
    expect(run.controller.getState().networkId).toBe("FUTURENET");
  });

  it("closes the old stream when a different account connects", () => {
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    run.controller.start({ publicKey: OTHER_ACCOUNT, networkId: "TESTNET" });

    expect(run.streams[0].handle.close).toHaveBeenCalledTimes(1);
    expect(run.openStream).toHaveBeenCalledTimes(2);
    expect(run.controller.getState().account).toBe(OTHER_ACCOUNT);
  });

  it.each(PAYMENT_STREAM_REASONS)("closes for %s and reports the reason", (reason) => {
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    const wasOpen = run.controller.stop(reason);

    expect(wasOpen).toBe(true);
    expect(run.streams[0].handle.close).toHaveBeenCalledTimes(1);
    expect(run.controller.isOpen()).toBe(false);
    expect(run.controller.getState()).toMatchObject({ status: "closed", reason });
  });

  it("keeps payments already streamed after a close", () => {
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    run.streams[0].config.onRecord({
      id: "1-0",
      paging_token: "1-0",
      type: "payment",
      from: ACCOUNT,
      to: OTHER_ACCOUNT,
      amount: "5.0000000",
      asset_type: "native",
      transaction_hash: "c".repeat(64),
      created_at: "2026-11-20T12:00:00Z",
    });
    run.controller.stop("tab-hidden");

    expect(run.controller.getRecords()).toHaveLength(1);
  });

  it("is safe to stop when nothing was streaming", () => {
    expect(run.controller.stop("disconnect")).toBe(false);
    expect(run.controller.isOpen()).toBe(false);
    expect(run.controller.getState().status).toBe("closed");
    expect(run.openStream).not.toHaveBeenCalled();
  });

  it("refuses a reason the panel cannot display", () => {
    expect(() => run.controller.stop("went-away")).toThrow(
      "Unknown payments stream reason: went-away"
    );
    expect(() => run.controller.stop()).not.toThrow();
  });

  it("reopens after a stop and starts from now again", () => {
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    run.controller.stop("disconnect");
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET" });

    expect(run.openStream).toHaveBeenCalledTimes(2);
    expect(run.controller.getState().status).toBe("open");
  });

  it("passes a cursor through when resuming after a reload", () => {
    run.controller.start({ publicKey: ACCOUNT, networkId: "TESTNET", cursor: "500-3" });
    expect(run.streams[0].config.url).toContain("cursor=500-3");
  });

  it("refuses an account that is not connected", () => {
    expect(() => run.controller.start({ publicKey: "GST7", networkId: "TESTNET" })).toThrow(
      "Connect a valid Stellar account (G…) first."
    );
    expect(run.openStream).not.toHaveBeenCalled();
  });

  it("uses the active network's own Horizon host by default", () => {
    const plain = createPaymentStreamController({ openStream: run.openStream });
    const started = plain.start({ publicKey: ACCOUNT, networkId: "TESTNET" });
    expect(started.url).toBe(
      `https://horizon-testnet.stellar.org/accounts/${ACCOUNT}/payments?limit=50&join=transactions&cursor=now`
    );

    expect(() => plain.start({ publicKey: ACCOUNT, networkId: "PUBLIC" })).toThrow(
      "Unsupported network: PUBLIC"
    );
  });
});
