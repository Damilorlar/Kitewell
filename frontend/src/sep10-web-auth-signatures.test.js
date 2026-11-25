import { describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  assertEnvelopeUnchanged,
  signChallengeEnvelope,
  verifyChallengeSignatures,
} from "./sep10WebAuth";

const PASSPHRASE = StellarSdk.Networks.TESTNET;
const SERVER = StellarSdk.Keypair.random();
const CLIENT = StellarSdk.Keypair.random();
const STRANGER = StellarSdk.Keypair.random();
const FUTURE_SECONDS = 4_000_000_000;

function challenge({ server = SERVER, client = CLIENT, maxTime = FUTURE_SECONDS, sign = true } = {}) {
  const transaction = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(server.publicKey(), "1"),
    { fee: StellarSdk.BASE_FEE, networkPassphrase: PASSPHRASE }
  )
    .addOperation(
      StellarSdk.Operation.manageData({
        name: "auth",
        value: "kitewell-login",
        source: client.publicKey(),
      })
    )
    .setTimebounds(0, maxTime)
    .build();
  if (sign) transaction.sign(server);
  return transaction.toXDR();
}

function addClientSignature(xdr, keypair = CLIENT) {
  const transaction = new StellarSdk.Transaction(xdr, PASSPHRASE);
  transaction.sign(keypair);
  return transaction.toXDR();
}

describe("signChallengeEnvelope", () => {
  it("returns the envelope the wallet signs", async () => {
    const signed = challenge();
    await expect(
      signChallengeEnvelope({ challengeXdr: challenge(), sign: async () => signed })
    ).resolves.toBe(signed);
  });

  it("hands the wallet the unsigned challenge it was given", async () => {
    const unsigned = challenge();
    const sign = vi.fn(async (xdr) => addClientSignature(xdr));
    await signChallengeEnvelope({ challengeXdr: unsigned, sign });
    expect(sign).toHaveBeenCalledWith(unsigned);
  });

  it("refuses to run without a signer", async () => {
    await expect(signChallengeEnvelope({ challengeXdr: challenge() })).rejects.toThrow(
      "Freighter is not available to sign the challenge."
    );
    await expect(
      signChallengeEnvelope({ challengeXdr: challenge(), sign: "nope" })
    ).rejects.toThrow("Freighter is not available to sign the challenge.");
  });

  it("refuses a wallet that returns nothing usable", async () => {
    for (const returned of [undefined, null, "", 42, {}]) {
      await expect(
        signChallengeEnvelope({ challengeXdr: challenge(), sign: async () => returned })
      ).rejects.toThrow("Freighter returned no signed challenge.");
    }
  });
});

describe("verifyChallengeSignatures", () => {
  it("sees only the server signature on an unsigned challenge", () => {
    const result = verifyChallengeSignatures({
      envelopeXdr: challenge(),
      serverAccount: SERVER.publicKey(),
      clientAccount: CLIENT.publicKey(),
      networkPassphrase: PASSPHRASE,
    });
    expect(result).toEqual({ serverSigned: true, clientSigned: false, signatureCount: 1 });
  });

  it("sees both signatures once the wallet has signed", () => {
    const result = verifyChallengeSignatures({
      envelopeXdr: addClientSignature(challenge()),
      serverAccount: SERVER.publicKey(),
      clientAccount: CLIENT.publicKey(),
      networkPassphrase: PASSPHRASE,
    });
    expect(result).toEqual({ serverSigned: true, clientSigned: true, signatureCount: 2 });
  });

  it("does not credit a signature from an unrelated account", () => {
    const result = verifyChallengeSignatures({
      envelopeXdr: addClientSignature(challenge({ client: STRANGER }), STRANGER),
      serverAccount: SERVER.publicKey(),
      clientAccount: CLIENT.publicKey(),
      networkPassphrase: PASSPHRASE,
    });
    expect(result).toEqual({ serverSigned: true, clientSigned: false, signatureCount: 2 });
  });

  it("does not credit signatures made on another network", () => {
    const futurenet = challenge({ server: STRANGER });
    const result = verifyChallengeSignatures({
      envelopeXdr: futurenet,
      serverAccount: STRANGER.publicKey(),
      clientAccount: CLIENT.publicKey(),
      networkPassphrase: StellarSdk.Networks.FUTURENET,
    });
    expect(result.serverSigned).toBe(false);
  });

  it("reports an envelope with no signatures at all", () => {
    const result = verifyChallengeSignatures({
      envelopeXdr: challenge({ sign: false }),
      serverAccount: SERVER.publicKey(),
      clientAccount: CLIENT.publicKey(),
      networkPassphrase: PASSPHRASE,
    });
    expect(result).toEqual({ serverSigned: false, clientSigned: false, signatureCount: 0 });
  });

  it("refuses a fee bump envelope", () => {
    const inner = new StellarSdk.Transaction(addClientSignature(challenge()), PASSPHRASE);
    const feeBump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      STRANGER.publicKey(),
      10_000,
      inner,
      PASSPHRASE
    );
    expect(() =>
      verifyChallengeSignatures({
        envelopeXdr: feeBump.toXDR(),
        serverAccount: SERVER.publicKey(),
        clientAccount: CLIENT.publicKey(),
        networkPassphrase: PASSPHRASE,
      })
    ).toThrow("The signed challenge must be a base transaction.");
  });

  it("refuses an envelope it cannot read", () => {
    expect(() =>
      verifyChallengeSignatures({
        envelopeXdr: "not-base64-at-all!!",
        serverAccount: SERVER.publicKey(),
        clientAccount: CLIENT.publicKey(),
        networkPassphrase: PASSPHRASE,
      })
    ).toThrow("The signed challenge is not a transaction for this network.");
  });
});

describe("assertEnvelopeUnchanged", () => {
  it("accepts an envelope that only gained a signature", () => {
    const unsigned = challenge();
    expect(() =>
      assertEnvelopeUnchanged({
        unsignedXdr: unsigned,
        signedXdr: addClientSignature(unsigned),
        networkPassphrase: PASSPHRASE,
      })
    ).not.toThrow();
  });

  it("refuses a wallet that returned the challenge back unsigned", () => {
    const unsigned = challenge();
    expect(() =>
      assertEnvelopeUnchanged({
        unsignedXdr: unsigned,
        signedXdr: unsigned,
        networkPassphrase: PASSPHRASE,
      })
    ).toThrow("Refused: signing altered the challenge envelope.");
  });

  it("refuses a signed envelope over different bytes", () => {
    const unsigned = challenge();
    const tampered = addClientSignature(challenge({ maxTime: FUTURE_SECONDS - 600 }));
    expect(() =>
      assertEnvelopeUnchanged({
        unsignedXdr: unsigned,
        signedXdr: tampered,
        networkPassphrase: PASSPHRASE,
      })
    ).toThrow("Refused: signing altered the challenge envelope.");
  });

  it("refuses an envelope that cannot be parsed", () => {
    expect(() =>
      assertEnvelopeUnchanged({
        unsignedXdr: challenge(),
        signedXdr: "not-base64-at-all!!",
        networkPassphrase: PASSPHRASE,
      })
    ).toThrow("The signed challenge does not match the challenge that was shown.");
  });
});
