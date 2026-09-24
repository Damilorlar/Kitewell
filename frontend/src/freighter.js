import {
  isConnected,
  setAllowed,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";
import { HORIZON_URL } from "./stellar";

const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const MAX_MEMO_TEXT_BYTES = 28;
const MAX_U64 = 18446744073709551615n;

function createMemo(memoType, value) {
  if (!value) return null;

  if (memoType === "text") {
    if (new TextEncoder().encode(value).length > MAX_MEMO_TEXT_BYTES) {
      throw new Error("Text memos must be 28 UTF-8 bytes or fewer.");
    }
    return StellarSdk.Memo.text(value);
  }

  if (memoType === "id") {
    if (!/^\d{1,20}$/.test(value) || BigInt(value) > MAX_U64) {
      throw new Error("ID memos must be unsigned 64-bit integers.");
    }
    return StellarSdk.Memo.id(value);
  }

  if (memoType === "hash") {
    if (!/^[0-9a-fA-F]{64}$/.test(value)) {
      throw new Error("Hash memos must be exactly 64 hexadecimal characters.");
    }
    return StellarSdk.Memo.hash(value);
  }

  throw new Error(`Unsupported memo type: ${memoType}`);
}

export async function checkFreighterInstalled() {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectFreighterWallet() {
  const installed = await isConnected();
  if (!installed.isConnected) {
    throw new Error(
      "Freighter is not installed. Get it from freighter.app, set Testnet, then refresh."
    );
  }

  const permission = await setAllowed();
  if (!permission.isAllowed) {
    throw new Error("Connection denied. Allow Kitewell in Freighter to continue.");
  }

  const addressResult = await getAddress();
  if (addressResult.error || !addressResult.address) {
    throw new Error(
      addressResult.error?.message || "Could not read the address from Freighter."
    );
  }

  return addressResult.address;
}

async function signAndSubmit(transaction, publicKey) {
  const unsignedXdr = transaction.toXDR();
  const signResult = await signTransaction(unsignedXdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: publicKey,
  });

  if (signResult.error || !signResult.signedTxXdr) {
    throw new Error(
      signResult.error?.message || "Transaction signing was rejected in Freighter."
    );
  }

  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signResult.signedTxXdr,
    NETWORK_PASSPHRASE
  );

  return server.submitTransaction(signedTx);
}

export async function sendPaymentWithFreighter(
  publicKey,
  destination,
  amount,
  memoType = "text",
  memo = ""
) {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(destination)) {
    throw new Error("Destination must be a valid Stellar public key (G…).");
  }

  const transactionMemo = createMemo(memoType, memo);
  const sourceAccount = await server.loadAccount(publicKey);
  const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    StellarSdk.Operation.payment({
      destination,
      asset: StellarSdk.Asset.native(),
      amount: amount.toString(),
    })
  );

  if (transactionMemo) {
    txBuilder.addMemo(transactionMemo);
  }

  const transaction = txBuilder.setTimeout(180).build();
  return signAndSubmit(transaction, publicKey);
}

/**
 * Establish or raise a trustline for a credit asset on Testnet.
 * limit "0" removes the trustline (when balance is zero).
 */
export async function changeTrustWithFreighter(
  publicKey,
  assetCode,
  assetIssuer,
  limit = "1000000"
) {
  if (!assetCode || assetCode.length > 12) {
    throw new Error("Asset code must be 1–12 characters.");
  }
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(assetIssuer)) {
    throw new Error("Issuer must be a valid Stellar public key (G…).");
  }

  const asset = new StellarSdk.Asset(assetCode.toUpperCase(), assetIssuer);
  const sourceAccount = await server.loadAccount(publicKey);
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset,
        limit: limit.toString(),
      })
    )
    .setTimeout(180)
    .build();

  return signAndSubmit(transaction, publicKey);
}
