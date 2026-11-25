import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { deadlineFromEnvelope } from "./txStatusWatch";

const TESTNET = StellarSdk.Networks.TESTNET;
const FEE_SOURCE = StellarSdk.Keypair.random();
const CLIENT = StellarSdk.Keypair.random();
const SERVER = StellarSdk.Keypair.random();

function payment({ timeout, minSeconds, maxSeconds } = {}) {
  const builder = new StellarSdk.TransactionBuilder(new StellarSdk.Account(CLIENT.publicKey(), "1"), {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: TESTNET,
  }).addOperation(
    StellarSdk.Operation.payment({
      destination: SERVER.publicKey(),
      asset: StellarSdk.Asset.native(),
      amount: "1.0000000",
    })
  );
  if (timeout !== undefined) builder.setTimeout(timeout);
  if (maxSeconds !== undefined) builder.setTimebounds(minSeconds, maxSeconds);
  const transaction = builder.build();
  transaction.sign(CLIENT);
  return transaction;
}

describe("deadlineFromEnvelope", () => {
  it("turns a 180 second timeout into a deadline 180 seconds away", () => {
    const deadline = deadlineFromEnvelope(payment({ timeout: 180 }).toXDR(), {
      networkPassphrase: TESTNET,
    });

    expect(deadline).toBeGreaterThan(Date.now());
    expect(deadline - Date.now()).toBeLessThanOrEqual(180000);
    expect(deadline - Date.now()).toBeGreaterThan(178000);
  });

  it("uses the envelope's own max time, not a relative window", () => {
    expect(deadlineFromEnvelope(payment({ minSeconds: 0, maxSeconds: 2000 }).toXDR())).toBe(
      2000000
    );
  });

  it("treats a max time of zero as no expiry, even beside a min time", () => {
    const xdr = payment({ minSeconds: 500, maxSeconds: 0 }).toXDR();

    expect(StellarSdk.TransactionBuilder.fromXDR(xdr, TESTNET).timeBounds).toEqual({
      minTime: "500",
      maxTime: "0",
    });
    expect(deadlineFromEnvelope(xdr)).toBeNull();
  });

  it("reports no deadline for TimeoutInfinite", () => {
    const xdr = payment({ timeout: StellarSdk.TimeoutInfinite }).toXDR();

    expect(StellarSdk.TransactionBuilder.fromXDR(xdr, TESTNET).timeBounds).toEqual({
      minTime: "0",
      maxTime: "0",
    });
    expect(deadlineFromEnvelope(xdr)).toBeNull();
  });

  it("finds the max time a fee bump carries on its inner transaction", () => {
    const inner = payment({ minSeconds: 0, maxSeconds: 2500 });
    const bump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      FEE_SOURCE.publicKey(),
      "200",
      inner,
      TESTNET
    );

    expect(bump).toBeInstanceOf(StellarSdk.FeeBumpTransaction);
    expect(deadlineFromEnvelope(bump.toXDR())).toBe(2500000);
  });

  it("refuses XDR it cannot read", () => {
    for (const value of ["", "   ", "not-xdr", "AAAA", null, undefined, 42, {}, []]) {
      expect(() => deadlineFromEnvelope(value)).toThrow(
        "The transaction envelope could not be read."
      );
    }
  });

  it("takes the passphrase the envelope was built on", () => {
    const futurenet = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(CLIENT.publicKey(), "1"),
      { fee: StellarSdk.BASE_FEE, networkPassphrase: StellarSdk.Networks.FUTURENET }
    )
      .addOperation(
        StellarSdk.Operation.payment({
          destination: SERVER.publicKey(),
          asset: StellarSdk.Asset.native(),
          amount: "1.0000000",
        })
      )
      .setTimebounds(0, 3100)
      .build();
    futurenet.sign(CLIENT);

    expect(
      deadlineFromEnvelope(futurenet.toXDR(), {
        networkPassphrase: StellarSdk.Networks.FUTURENET,
      })
    ).toBe(3100000);
  });
});
