import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadAccountMock, submitTransactionMock, signTransactionMock, getNetworkMock } =
  vi.hoisted(() => ({
    loadAccountMock: vi.fn(),
    submitTransactionMock: vi.fn(),
    signTransactionMock: vi.fn(),
    getNetworkMock: vi.fn(),
  }));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: getNetworkMock,
  signTransaction: signTransactionMock,
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: vi.fn(function () {
        return { loadAccount: loadAccountMock, submitTransaction: submitTransactionMock };
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { getActiveNetwork } = await import("./network");
const {
  addSignatureToEnvelopeWithFreighter,
  inspectMultisigEnvelope,
  submitMultisigEnvelope,
} = await import("./multisigEnvelope");

const source = StellarSdk.Keypair.random();
const cosigner = StellarSdk.Keypair.random();
const outsider = StellarSdk.Keypair.random();

function account() {
  return {
    signers: [
      { key: source.publicKey(), weight: 1, type: "ed25519_public_key" },
      { key: cosigner.publicKey(), weight: 1, type: "ed25519_public_key" },
    ],
    thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 2 },
  };
}

function fixture(passphrase = getActiveNetwork().passphrase) {
  const tx = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(source.publicKey(), "1"),
    { fee: "100", networkPassphrase: passphrase }
  )
    .addOperation(
      StellarSdk.Operation.payment({
        destination: outsider.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: "1",
      })
    )
    .setTimeout(0)
    .build();
  tx.sign(source);
  return tx;
}

function sigKeys(tx) {
  return tx.signatures.map((s) => s.signature().toString("hex"));
}

beforeEach(() => {
  vi.clearAllMocks();
  const active = getActiveNetwork();
  getNetworkMock.mockResolvedValue({ network: active.id, networkPassphrase: active.passphrase });
  loadAccountMock.mockImplementation(async () => account());
  signTransactionMock.mockImplementation(async (xdr, { networkPassphrase }) => {
    // Freighter returns the tx with only its own signature appended.
    const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
    tx.signatures.length = 0;
    tx.sign(cosigner);
    return { signedTxXdr: tx.toXDR() };
  });
  submitTransactionMock.mockResolvedValue({ hash: "ok" });
});

describe("multi-sig envelope co-signing", () => {
  it("adds one signature and keeps the original signature", async () => {
    const tx = fixture();
    const originalSig = sigKeys(tx)[0];

    const before = await inspectMultisigEnvelope(tx.toXDR());
    expect(before.totalWeight).toBe(1);
    expect(before.meets).toEqual({ low: true, medium: false, high: false });

    const result = await addSignatureToEnvelopeWithFreighter(tx.toXDR(), cosigner.publicKey());
    const merged = StellarSdk.TransactionBuilder.fromXDR(result.xdr, getActiveNetwork().passphrase);

    expect(merged.signatures).toHaveLength(2);
    expect(sigKeys(merged)[0]).toBe(originalSig);
    expect(result.signers.every((s) => s.signed)).toBe(true);
    expect(result.meets.medium).toBe(true);
  });

  it("refuses an account that is not a signer", async () => {
    await expect(
      addSignatureToEnvelopeWithFreighter(fixture().toXDR(), outsider.publicKey())
    ).rejects.toThrow(/not a signer/);
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("refuses an account that already signed", async () => {
    await expect(
      addSignatureToEnvelopeWithFreighter(fixture().toXDR(), source.publicKey())
    ).rejects.toThrow(/already signed/);
  });

  it("refuses an envelope signed on another network", async () => {
    const other = fixture("Some Other Network ; 2026");
    await expect(inspectMultisigEnvelope(other.toXDR())).rejects.toThrow(/different network/);
  });

  it("refuses when Freighter is on another network", async () => {
    getNetworkMock.mockResolvedValue({ network: "X", networkPassphrase: "Some Other Network ; 2026" });
    await expect(
      addSignatureToEnvelopeWithFreighter(fixture().toXDR(), cosigner.publicKey())
    ).rejects.toThrow(/Switch either side/);
  });

  it("refuses to submit below the medium threshold", async () => {
    await expect(submitMultisigEnvelope(fixture().toXDR())).rejects.toThrow(/below the medium/);
    expect(submitTransactionMock).not.toHaveBeenCalled();
  });
});
