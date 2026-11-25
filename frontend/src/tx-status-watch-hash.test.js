import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { normaliseTxHash } from "./txStatusWatch";

const PASSPHRASE = StellarSdk.Networks.TESTNET;
const HASH = "a".repeat(64);
const UPPERCASE = "DE5C26A09C2DA1449012BFE90D16F918A42FC4CE3E4749F7B0859E32EC6A3ABE";

function signedEnvelope(client, server) {
  const builder = new StellarSdk.TransactionBuilder(new StellarSdk.Account(client.publicKey(), "1"), {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  }).addOperation(
    StellarSdk.Operation.payment({
      destination: server.publicKey(),
      asset: StellarSdk.Asset.native(),
      amount: "1.0000000",
    })
  );
  builder.setTimeout(180);
  const transaction = builder.build();
  transaction.sign(client);
  return transaction.toXDR();
}

describe("normaliseTxHash", () => {
  it("keeps a lowercase hash as it is", () => {
    expect(normaliseTxHash(HASH)).toBe(HASH);
  });

  it("lowercases a hash pasted in caps", () => {
    expect(normaliseTxHash(UPPERCASE)).toBe(UPPERCASE.toLowerCase());
  });

  it("accepts the spaces a paste brings with it", () => {
    expect(normaliseTxHash(`  ${HASH}  `)).toBe(HASH);
  });

  it("reads the hash of a transaction the lab actually submitted", () => {
    const client = StellarSdk.Keypair.random();
    const server = StellarSdk.Keypair.random();
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedEnvelope(client, server),
      PASSPHRASE
    );
    const hash = transaction.hash().toString("hex");

    expect(hash).toHaveLength(64);
    expect(normaliseTxHash(hash)).toBe(hash);
  });

  it.each([
    "",
    "   ",
    "abc",
    HASH.slice(0, 63),
    `${HASH}0`,
    `${HASH.slice(0, 63)}z`,
    "g".repeat(64),
    `0x${HASH}`,
    `${"a".repeat(32)} ${"b".repeat(31)}`,
  ])("refuses %s", (value) => {
    expect(() => normaliseTxHash(value)).toThrow(
      "Transaction hash must be 64 hexadecimal characters."
    );
  });

  it("refuses anything that is not text at all", () => {
    for (const value of [null, undefined, 42, {}, [], Buffer.from(HASH, "hex")]) {
      expect(() => normaliseTxHash(value)).toThrow(
        "Transaction hash must be 64 hexadecimal characters."
      );
    }
  });
});
