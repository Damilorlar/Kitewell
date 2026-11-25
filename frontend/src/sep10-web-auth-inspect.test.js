import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { inspectChallenge } from "./sep10WebAuth";

const PASSPHRASE = StellarSdk.Networks.TESTNET;
const SERVER = StellarSdk.Keypair.random();
const OTHER_SERVER = StellarSdk.Keypair.random();
const CLIENT = StellarSdk.Keypair.random();
const NOW_MS = 1_700_000_000_000;
const FUTURE_SECONDS = 4_000_000_000;
const PAST_SECONDS = 1_000_000_000;

function authOp({ name = "auth", value = "kitewell-login", source = CLIENT.publicKey() } = {}) {
  return StellarSdk.Operation.manageData({ name, value, source });
}

function webAuthDomainOp(domain = "anchor.example.com") {
  return StellarSdk.Operation.manageData({
    name: "web_auth_domain",
    value: domain,
    source: SERVER.publicKey(),
  });
}

function envelope(
  operations,
  { minTime = 0, maxTime = FUTURE_SECONDS, server = SERVER, noExpiry = false } = {}
) {
  const builder = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(server.publicKey(), "1"),
    { fee: StellarSdk.BASE_FEE, networkPassphrase: PASSPHRASE }
  );
  for (const operation of operations) builder.addOperation(operation);
  if (noExpiry) {
    builder.setTimeout(StellarSdk.TimeoutInfinite);
  } else {
    builder.setTimebounds(minTime, maxTime);
  }
  const transaction = builder.build();
  transaction.sign(server);
  return transaction.toXDR();
}

function inspect(challengeXdr, overrides = {}) {
  return inspectChallenge({
    challengeXdr,
    clientAccount: CLIENT.publicKey(),
    expectedServerAccount: SERVER.publicKey(),
    networkPassphrase: PASSPHRASE,
    nowMs: NOW_MS,
    ...overrides,
  });
}

describe("inspectChallenge", () => {
  it("reports the server, the operation and the expiry of a valid challenge", () => {
    const summary = inspect(envelope([authOp()]));

    expect(summary).toEqual({
      serverAccount: SERVER.publicKey(),
      clientAccount: CLIENT.publicKey(),
      operationName: "auth",
      webAuthDomain: null,
      operationCount: 1,
      expiresAtMs: FUTURE_SECONDS * 1000,
      validFromMs: null,
    });
  });

  it("reads the web_auth_domain operation without disturbing the first operation", () => {
    const summary = inspect(envelope([authOp(), webAuthDomainOp()]));

    expect(summary.operationName).toBe("auth");
    expect(summary.webAuthDomain).toBe("anchor.example.com");
    expect(summary.operationCount).toBe(2);
  });

  it("honours a not-before time", () => {
    const summary = inspect(envelope([authOp()], { minTime: 1_600_000_000 }));
    expect(summary.validFromMs).toBe(1_600_000_000_000);
  });

  it("defaults to the active network when no passphrase is given", () => {
    const summary = inspectChallenge({
      challengeXdr: envelope([authOp()]),
      clientAccount: CLIENT.publicKey(),
      expectedServerAccount: SERVER.publicKey(),
      nowMs: NOW_MS,
    });
    expect(summary.serverAccount).toBe(SERVER.publicKey());
  });

  it("refuses a challenge whose source is not the endpoint's server", () => {
    const xdr = envelope([authOp()], { server: OTHER_SERVER });
    expect(() => inspect(xdr)).toThrow(
      `Refused: the challenge's source account is ${OTHER_SERVER.publicKey()}, not the endpoint's server ${SERVER.publicKey()}.`
    );
  });

  it("refuses a challenge with no operations", () => {
    const transaction = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(SERVER.publicKey(), "1"),
      { fee: StellarSdk.BASE_FEE, networkPassphrase: PASSPHRASE }
    )
      .addOperation(authOp())
      .setTimebounds(0, FUTURE_SECONDS)
      .clearOperations()
      .build();
    transaction.sign(SERVER);

    expect(() => inspect(transaction.toXDR())).toThrow(
      "Refused: the challenge holds no operations."
    );
  });

  it("refuses a challenge whose first operation is not manageData", () => {
    const payment = StellarSdk.Operation.payment({
      destination: CLIENT.publicKey(),
      asset: StellarSdk.Asset.native(),
      amount: "10.00",
    });
    const xdr = envelope([payment, authOp()]);

    expect(() => inspect(xdr)).toThrow(
      "Refused: the first challenge operation must be manageData, not payment."
    );
  });

  it("refuses a challenge whose first operation is addressed to somebody else", () => {
    const stranger = StellarSdk.Keypair.random().publicKey();
    expect(() => inspect(envelope([authOp({ source: stranger })]))).toThrow(
      "Refused: the challenge's first operation is not addressed to this account."
    );
    // And a manageData with no operation source falls back to the server, not us.
    const builder = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(SERVER.publicKey(), "1"),
      { fee: StellarSdk.BASE_FEE, networkPassphrase: PASSPHRASE }
    )
      .addOperation(StellarSdk.Operation.manageData({ name: "auth", value: "kitewell-login" }))
      .setTimebounds(0, FUTURE_SECONDS);
    const transaction = builder.build();
    transaction.sign(SERVER);
    expect(() => inspect(transaction.toXDR())).toThrow(
      "Refused: the challenge's first operation is not addressed to this account."
    );
  });

  it("refuses an already expired challenge before anything is signed", () => {
    expect(() => inspect(envelope([authOp()], { maxTime: PAST_SECONDS }))).toThrow(
      `Refused: the challenge expired at ${new Date(PAST_SECONDS * 1000).toISOString()}.`
    );
  });

  it("refuses a challenge at the exact second it expires", () => {
    const maxTime = Math.floor(NOW_MS / 1000);
    expect(() => inspect(envelope([authOp()], { maxTime }))).toThrow(
      "Refused: the challenge expired at"
    );
  });

  it("refuses a challenge that is not valid yet", () => {
    const minTime = 3_000_000_000;
    expect(
      () => inspect(envelope([authOp()], { minTime, maxTime: FUTURE_SECONDS }))
    ).toThrow(
      `Refused: the challenge is not valid until ${new Date(minTime * 1000).toISOString()}.`
    );
  });

  it("refuses a challenge that sets no expiry", () => {
    expect(() => inspect(envelope([authOp()], { noExpiry: true }))).toThrow(
      "Refused: the challenge sets no expiry."
    );
  });

  it("refuses a fee bump envelope rather than reading its inner transaction", () => {
    const inner = new StellarSdk.Transaction(envelope([authOp()]), PASSPHRASE);
    const feeBump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      OTHER_SERVER.publicKey(),
      10_000,
      inner,
      PASSPHRASE
    );

    expect(() => inspect(feeBump.toXDR())).toThrow(
      "The challenge must be a base transaction, not a fee bump."
    );
  });

  it("refuses an envelope that is not readable", () => {
    for (const bad of ["   ", "not-base64-at-all!!", "AAAA", "bm90ZQ=="]) {
      expect(() => inspect(bad)).toThrow(
        "The challenge is not a transaction for this network."
      );
    }
  });

  it("refuses a challenge that is missing entirely", () => {
    for (const missing of ["", undefined, null, 42, {}]) {
      expect(() => inspect(missing)).toThrow("There is no challenge transaction to read.");
    }
  });

  it("refuses a challenge missing either account", () => {
    const xdr = envelope([authOp()]);
    expect(() => inspect(xdr, { clientAccount: "GST7" })).toThrow(
      "The client account must be a valid Stellar public key (G…)."
    );
    expect(() => inspect(xdr, { expectedServerAccount: "" })).toThrow(
      "The endpoint's server account must be a valid Stellar public key (G…)."
    );
  });
});
