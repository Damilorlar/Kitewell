import * as StellarSdk from "@stellar/stellar-sdk";
import { getActiveNetworkId, getNetworkById } from "./network";
import { mapTransactionFee } from "./historyFee";
import { paymentMemoFields } from "./paymentMemo";

/**
 * Stream payments for the connected account while the history tab is open.
 *
 * Horizon serves `/accounts/<id>/payments` as a Server-Sent Events stream, which
 * needs a browser `EventSource`; the transport and the account loader are
 * therefore injected so the rules below are testable in the Node test
 * environment. Records use exactly the fields `getTransactions` in
 * `./stellar.js` already maps, so a streamed payment and a paged payment render
 * the same way.
 */

const PAYMENTS_PATH = "/payments";
const STREAM_LIMIT = 50;

/** Reasons the lab closes a stream, in the order the panel names them. */
export const PAYMENT_STREAM_REASONS = Object.freeze([
  "disconnect",
  "network-change",
  "tab-hidden",
]);

/**
 * Build the Horizon payments stream URL for an account.
 *
 * @param {string} horizonUrl Horizon root, e.g. `https://horizon-testnet.stellar.org`.
 * @param {string} publicKey Account to stream.
 * @param {object} [options]
 * @param {string} [options.cursor] Resume point; omit to start from now.
 * @param {number} [options.limit] Page size.
 * @returns {string} Stream URL.
 */
export function paymentsStreamUrl(horizonUrl, publicKey, { cursor, limit = STREAM_LIMIT } = {}) {
  if (typeof horizonUrl !== "string" || !horizonUrl.trim()) {
    throw new Error("There is no Horizon URL to stream payments from.");
  }
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error("Connect a valid Stellar account (G…) first.");
  }

  const url = new URL(
    `${horizonUrl.replace(/\/$/, "")}/accounts/${publicKey}${PAYMENTS_PATH}`
  );
  url.searchParams.set("limit", String(limit));
  // Embeds each payment's transaction record, the source of fee and operation count.
  url.searchParams.set("join", "transactions");
  if (cursor !== undefined && cursor !== null && String(cursor).trim()) {
    url.searchParams.set("cursor", String(cursor).trim());
  } else {
    // "now" starts the stream at the current ledger instead of replaying history.
    url.searchParams.set("cursor", "now");
  }
  return url.toString();
}

/**
 * Map a Horizon payment event to the fields the history list shows.
 *
 * @param {object} event One streamed record.
 * @returns {object|null} The list record, or null when the event is not a payment.
 */
export function mapStreamPayment(event) {
  if (!event || typeof event !== "object" || event.type !== "payment") return null;
  return {
    id: event.id,
    from: event.from,
    to: event.to,
    amount: event.amount,
    asset_type: event.asset_type,
    asset_code: event.asset_code || "XLM",
    transaction_hash: event.transaction_hash,
    created_at: event.created_at,
    ...mapTransactionFee(event.transaction),
    ...paymentMemoFields(event.transaction),
  };
}

/** The key that says two events are the same payment. */
function streamKey(event) {
  const token = event?.paging_token ?? event?.id;
  return token === undefined || token === null ? null : String(token);
}

function oneLine(value) {
  if (typeof value !== "string") return "";
  return value.split("\n").map((line) => line.trim()).filter(Boolean).join(" ");
}

/**
 * Open a payments stream over an injected EventSource factory.
 *
 * @param {object} options
 * @param {string} options.url Stream URL from {@link paymentsStreamUrl}.
 * @param {(url: string) => object} [options.createEventSource] EventSource factory.
 * @param {(event: object) => void} [options.onRecord] Called per payment event.
 * @param {(error: object) => void} [options.onError] Called on a stream failure.
 * @param {() => void} [options.onClose] Called when the stream ends.
 * @returns {{ close: () => void }} Handle for the open stream.
 */
export function openPaymentsStream({
  url,
  createEventSource,
  onRecord,
  onError,
  onClose,
} = {}) {
  if (typeof url !== "string" || !url) {
    throw new Error("There is no payments stream URL to open.");
  }
  const factory =
    createEventSource ??
    ((target) => {
      if (typeof globalThis.EventSource !== "function") {
        throw new Error("This session cannot open an event stream.");
      }
      return new globalThis.EventSource(target);
    });

  const source = factory(url);
  if (!source || typeof source.addEventListener !== "function") {
    throw new Error("The payments stream transport is not usable.");
  }

  let open = true;
  source.addEventListener("message", (event) => {
    let payload;
    try {
      payload = JSON.parse(event?.data);
    } catch {
      onError?.(new Error("The payments stream sent an unreadable record."));
      return;
    }
    onRecord?.(payload);
  });
  source.addEventListener("error", (event) => {
    onError?.(
      event?.error ?? new Error(oneLine(event?.message) || "The payments stream failed.")
    );
  });

  return {
    close() {
      if (!open) return false;
      open = false;
      if (typeof source.close === "function") source.close();
      onClose?.();
      return true;
    },
  };
}

function defaultHorizonUrlFor(networkId) {
  const network = getNetworkById(networkId);
  if (!network) throw new Error(`Unsupported network: ${networkId}`);
  return network.horizonUrl;
}

/**
 * Build the payments stream controller the history tab drives.
 *
 * @param {object} options
 * @param {(config: object) => object} [options.openStream] Transport opener.
 * @param {(networkId: string) => string} [options.horizonUrlFor] Network lookup.
 * @param {(records: object[], state: object) => void} [options.onChange] Render hook.
 * @returns {{ start: Function, stop: Function, ingest: Function, fail: Function,
 *   getRecords: Function, getState: Function, isOpen: Function }}
 */
export function createPaymentStreamController({
  openStream = openPaymentsStream,
  horizonUrlFor = defaultHorizonUrlFor,
  onChange,
} = {}) {
  const records = [];
  const seen = new Set();
  let handle = null;
  let session = null;
  let state = { status: "idle", failure: null, reason: null, networkId: null, account: null };

  function notify() {
    onChange?.([...records], { ...state });
  }

  function setState(patch) {
    state = { ...state, ...patch };
  }

  /** Add one streamed payment to the front, unless it is already shown. */
  function ingest(event) {
    const key = streamKey(event);
    if (key === null) {
      fail(new Error("The payments stream sent a record with no paging token."));
      return false;
    }
    if (seen.has(key)) return false;

    const record = mapStreamPayment(event);
    if (!record) return false;

    seen.add(key);
    records.unshift(record);
    setState({ failure: null });
    notify();
    return true;
  }

  /** Keep the payments already loaded and show a one-line failure. */
  function fail(error) {
    setState({
      status: "error",
      failure: `Payments stream failed: ${oneLine(error?.message ?? error) || "no reason given."}`,
    });
    notify();
  }

  function start({ publicKey, networkId = getActiveNetworkId(), cursor } = {}) {
    const sameSession = session && session.networkId === networkId && session.account === publicKey;
    if (sameSession && handle) {
      // The tab re-rendered while the same stream is already running.
      return { reused: true, ...session };
    }

    const url = paymentsStreamUrl(horizonUrlFor(networkId), publicKey, { cursor });

    if (handle) {
      // Testnet to Futurenet (or a new account) closes the old stream first.
      const previous = handle;
      handle = null;
      previous.close();
    }

    session = { networkId, account: publicKey, url };
    setState({ status: "open", failure: null, reason: null, networkId, account: publicKey });
    notify();

    handle = openStream({
      url,
      onRecord: ingest,
      onError: fail,
      onClose: () => {
        if (state.status === "open") setState({ status: "closed", reason: state.reason });
      },
    });
    return { reused: false, ...session };
  }

  /** Close the stream for one of {@link PAYMENT_STREAM_REASONS}. */
  function stop(reason = "disconnect") {
    if (!PAYMENT_STREAM_REASONS.includes(reason)) {
      throw new Error(`Unknown payments stream reason: ${reason}`);
    }
    const current = handle;
    handle = null;
    session = null;
    setState({ status: "closed", reason, networkId: null, account: null });
    const wasOpen = current ? current.close() : false;
    notify();
    return wasOpen;
  }

  return {
    start,
    stop,
    ingest,
    fail,
    getRecords: () => [...records],
    getState: () => ({ ...state }),
    isOpen: () => handle !== null,
  };
}
