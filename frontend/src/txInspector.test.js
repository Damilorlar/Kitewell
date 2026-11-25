import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { NETWORKS } from "./network";
import {
  PASSPHRASE_MISMATCH_ERROR,
  XDR_READ_ERROR,
  decodeTransactionEnvelope,
} from "./txInspector";

const TESTNET = NETWORKS.TESTNET.passphrase;
const FUTURENET = NETWORKS.FUTURENET.passphrase;

const sourceKeypair = StellarSdk.Keypair.random();
const destinationKeypair = StellarSdk.Keypair.random();
const feeSourceKeypair = StellarSdk.Keypair.random();
const issuer = StellarSdk.Keypair.random().publicKey();
const USDC = new StellarSdk.Asset("USDC", issuer);

function buildPaymentEnvelope({ passphrase = TESTNET, sign = true } = {}) {
  const account = new StellarSdk.Account(sourceKeypair.publicKey(), "123456789");
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: passphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationKeypair.publicKey(),
        asset: USDC,
        amount: "12.5",
      })
    )
    .addMemo(StellarSdk.Memo.text("invoice-42"))
    .setTimeout(30)
    .build();

  if (sign) transaction.sign(sourceKeypair);
  return transaction.toXDR();
}

describe("decodeTransactionEnvelope", () => {
  it("decodes a payment fixture on the selected network", () => {
    const decoded = decodeTransactionEnvelope(buildPaymentEnvelope(), TESTNET);

    expect(decoded.isFeeBump).toBe(false);
    expect(decoded.network.id).toBe("TESTNET");
    expect(decoded.source).toBe(sourceKeypair.publicKey());
    expect(decoded.fee).toBe("100");
    expect(decoded.sequence).toBe("123456790");
    expect(decoded.memo).toEqual({ type: "text", value: "invoice-42" });
    expect(decoded.timeBounds.maxTime).not.toBe("0");

    expect(decoded.operations).toHaveLength(1);
    expect(decoded.operations[0]).toMatchObject({
      index: 0,
      type: "payment",
      destination: destinationKeypair.publicKey(),
      asset: `USDC:${issuer}`,
      amount: "12.5000000",
    });
  });

  it("lists every operation with its fields", () => {
    const account = new StellarSdk.Account(sourceKeypair.publicKey(), "1");
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: "200",
      networkPassphrase: TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: destinationKeypair.publicKey(),
          startingBalance: "2",
        })
      )
      .addOperation(
        StellarSdk.Operation.changeTrust({ asset: USDC, limit: "1000" })
      )
      .setTimeout(30)
      .build();
    transaction.sign(sourceKeypair);

    const decoded = decodeTransactionEnvelope(transaction.toXDR(), TESTNET);
    expect(decoded.operations.map((op) => op.type)).toEqual([
      "createAccount",
      "changeTrust",
    ]);
    expect(decoded.operations[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Destination" }),
        expect.objectContaining({ label: "Starting balance", value: "2.0000000" }),
      ])
    );
    expect(decoded.operations[1].line).toBe(`USDC:${issuer}`);
  });

  it("rejects truncated XDR with a readable message", () => {
    const envelope = buildPaymentEnvelope().slice(0, 40);

    expect(() => decodeTransactionEnvelope(envelope, TESTNET)).toThrow(
      XDR_READ_ERROR
    );
  });

  it("rejects empty and non-string input with a readable message", () => {
    expect(() => decodeTransactionEnvelope("", TESTNET)).toThrow(XDR_READ_ERROR);
    expect(() => decodeTransactionEnvelope("   ", TESTNET)).toThrow(
      XDR_READ_ERROR
    );
    expect(() => decodeTransactionEnvelope(undefined, TESTNET)).toThrow(
      XDR_READ_ERROR
    );
    expect(() => decodeTransactionEnvelope("AAAA", TESTNET)).toThrow(
      XDR_READ_ERROR
    );
  });

  it("reports a passphrase mismatch for the other network", () => {
    const envelope = buildPaymentEnvelope({ passphrase: TESTNET });

    expect(() => decodeTransactionEnvelope(envelope, FUTURENET)).toThrow(
      PASSPHRASE_MISMATCH_ERROR
    );
    expect(() => decodeTransactionEnvelope(envelope, FUTURENET)).toThrow(
      /passphrase does not match/i
    );
  });

  it("decodes a fee-bump envelope and then its inner transaction", () => {
    const account = new StellarSdk.Account(sourceKeypair.publicKey(), "7");
    const inner = new StellarSdk.TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destinationKeypair.publicKey(),
          asset: StellarSdk.Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();
    inner.sign(sourceKeypair);

    const feeBump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      feeSourceKeypair,
      "200",
      inner,
      TESTNET
    );
    feeBump.sign(feeSourceKeypair);

    const decoded = decodeTransactionEnvelope(feeBump.toXDR(), TESTNET);
    expect(decoded.isFeeBump).toBe(true);
    expect(decoded.feeSource).toBe(feeSourceKeypair.publicKey());
    expect(decoded.fee).toBe("400");
    expect(decoded.inner.source).toBe(sourceKeypair.publicKey());
    expect(decoded.inner.sequence).toBe("8");
    expect(decoded.inner.operations[0]).toMatchObject({
      type: "payment",
      asset: "XLM",
      amount: "1.0000000",
    });

    expect(() => decodeTransactionEnvelope(feeBump.toXDR(), FUTURENET)).toThrow(
      PASSPHRASE_MISMATCH_ERROR
    );
  });
});
