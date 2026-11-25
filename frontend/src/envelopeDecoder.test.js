import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  decodeEnvelope,
  formatArgumentValue,
  xdrTypeName,
} from "./envelopeDecoder";

const CONTRACT_ID =
  "CCWLNS5HECRJ2GM3Q6JZZDV334ZXYO6EKZLFPLQRXO6SUDAKMS4U3E3X";
const PASSPHRASE = StellarSdk.Networks.TESTNET;

function sourceAccount(sequence = "7") {
  return new StellarSdk.Account(StellarSdk.Keypair.random().publicKey(), sequence);
}

function buildInvokeEnvelope() {
  const contract = new StellarSdk.Contract(CONTRACT_ID);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount(), {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "hello",
        StellarSdk.nativeToScVal(42, { type: "i32" }),
        StellarSdk.nativeToScVal("world", { type: "string" })
      )
    )
    .setTimeout(60)
    .build();

  return { tx, xdr: tx.toXDR() };
}

function buildPaymentEnvelope() {
  const destination = StellarSdk.Keypair.random().publicKey();
  const tx = new StellarSdk.TransactionBuilder(sourceAccount("8"), {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination,
        asset: StellarSdk.Asset.native(),
        amount: "1.5000000",
      })
    )
    .setTimeout(60)
    .build();

  return { tx, xdr: tx.toXDR(), destination };
}

describe("decodeEnvelope", () => {
  it("names the contract, function, and XDR-typed arguments of an invoke", () => {
    const decoded = decodeEnvelope(buildInvokeEnvelope().xdr, PASSPHRASE);

    expect(decoded.kind).toBe("transaction");
    expect(decoded.operations).toHaveLength(1);

    const [operation] = decoded.operations;
    expect(operation.type).toBe("invokeHostFunction");
    expect(operation.contract).toMatchObject({
      address: CONTRACT_ID,
      function: "hello",
      hostFunctionType: "hostFunctionTypeInvokeContract",
    });
    expect(operation.contract.args.map((argument) => argument.type)).toEqual([
      "SCV_I32",
      "SCV_STRING",
    ]);
    expect(operation.contract.args.map(formatArgumentValue)).toEqual([
      "42",
      "world",
    ]);
  });

  it("keeps the classic envelope fields and signatures", () => {
    const { tx } = buildInvokeEnvelope();
    const signer = StellarSdk.Keypair.random();
    tx.sign(signer);

    const decoded = decodeEnvelope(tx.toXDR(), PASSPHRASE);

    expect(decoded.fee).toBe("100");
    expect(decoded.sequence).toBe(tx.sequence);
    expect(decoded.source).toBe(tx.source);
    expect(decoded.signatures).toHaveLength(1);
    // A signature hint is four bytes, rendered as eight hex characters.
    expect(decoded.signatures[0].hint).toHaveLength(8);
    expect(decoded.signatures[0].signature.length).toBeGreaterThan(0);
    // Re-signing the same bytes yields the same XDR, so this is stable.
    expect(decoded.operations[0].contract.function).toBe("hello");
  });

  it("unwraps a fee bump to the inner invoke", () => {
    const { tx } = buildInvokeEnvelope();
    const feeBump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      StellarSdk.Keypair.random(),
      "200",
      tx,
      PASSPHRASE
    );

    const decoded = decodeEnvelope(feeBump.toXDR(), PASSPHRASE);

    expect(decoded.kind).toBe("feeBump");
    // The fee bump's fee covers its own operation plus the inner transaction.
    expect(decoded.fee).toBe("400");
    expect(decoded.innerFee).toBe("100");
    expect(decoded.operations[0].contract.address).toBe(CONTRACT_ID);
    expect(decoded.operations[0].contract.function).toBe("hello");
  });

  it("says so when an invoke has no contract address", () => {
    const tx = new StellarSdk.TransactionBuilder(sourceAccount(), {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.invokeHostFunction({
          func: StellarSdk.xdr.HostFunction.hostFunctionTypeUploadContractWasm(
            Buffer.from("00", "hex")
          ),
          auth: [],
        })
      )
      .setTimeout(60)
      .build();

    const decoded = decodeEnvelope(tx.toXDR(), PASSPHRASE);
    expect(decoded.operations[0].contract).toMatchObject({
      address: null,
      function: null,
      args: [],
      hostFunctionType: "hostFunctionTypeUploadContractWasm",
    });
  });

  it("decodes a classic payment without a contract section", () => {
    const { xdr, destination } = buildPaymentEnvelope();

    const decoded = decodeEnvelope(xdr, PASSPHRASE);
    const [operation] = decoded.operations;

    expect(decoded.kind).toBe("transaction");
    expect(operation.type).toBe("payment");
    expect(operation.contract).toBeUndefined();
    expect(operation.destination).toBe(destination);
    expect(operation.amount).toBe("1.5000000");
    expect(operation.asset).toBe("XLM (native)");
  });

  it("rejects empty or malformed XDR with a readable error", () => {
    expect(() => decodeEnvelope("")).toThrow(/Paste a transaction envelope/);
    expect(() => decodeEnvelope("not-xdr")).toThrow(
      /Could not decode the envelope/
    );
  });
});

describe("xdrTypeName", () => {
  it("labels common ScVal types with their XDR names", () => {
    expect(xdrTypeName(StellarSdk.nativeToScVal(true))).toBe("SCV_BOOL");
    expect(xdrTypeName(StellarSdk.nativeToScVal(42, { type: "i32" }))).toBe(
      "SCV_I32"
    );
    expect(xdrTypeName(StellarSdk.nativeToScVal("hi"))).toBe("SCV_STRING");
  });
});
