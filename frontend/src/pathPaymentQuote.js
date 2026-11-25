/**
 * Path payment payload shape picker.
 *
 * A pure helper that transforms a path-payment form state object into the
 * exact payload shape required by the SDK's `Operation.pathPaymentStrictSend`
 * or `Operation.pathPaymentStrictReceive`, without touching the network.
 *
 * The form state contains a `mode` field ("strictSend" | "strictReceive") and
 * the relevant bound fields (`destMin` for strict send, `sendMax` for strict
 * receive). This module picks the correct shape and normalizes amounts to the
 * 7-decimal string format Stellar expects.
 *
 * @module pathPaymentQuote
 */

import { buildAsset, parsePathAssets } from "./stellar";

/**
 * Normalize an amount string to the 7-decimal fixed-point format
 * used by Stellar (stroop precision).
 *
 * @param {string} value - Amount string (e.g., "10" or "9.5")
 * @returns {string} Normalized amount with exactly 7 decimal places
 *
 * @example
 * normalizeStellarAmount("10")    // => "10.0000000"
 * normalizeStellarAmount("9.5")   // => "9.5000000"
 * normalizeStellarAmount("0.0000001") // => "0.0000001"
 */
function normalizeStellarAmount(value) {
  const text = String(value ?? "").trim();
  if (!text) return "0.0000000";

  const [whole = "0", fraction = ""] = text.split(".");
  const normalizedFraction = (fraction + "0000000").slice(0, 7);
  return `${whole}.${normalizedFraction}`;
}

/**
 * Validate that a field is present and non-empty.
 *
 * @param {unknown} value - The value to check
 * @param {string} fieldName - Name for error messages
 * @throws {Error} If value is missing or empty
 */
function requireField(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`${fieldName} is required.`);
  }
}

/**
 * The form state object for a path payment.
 * @typedef {Object} PathPaymentFormState
 * @property {"strictSend" | "strictReceive"} mode - Payment mode
 * @property {Object} sendAsset - Source asset descriptor { isNative?: boolean, code?: string, issuer?: string }
 * @property {Object} destAsset - Destination asset descriptor { isNative?: boolean, code?: string, issuer?: string }
 * @property {string} amount - Amount to send (strictSend) or receive (strictReceive)
 * @property {string} [destMin] - Minimum amount to receive (strictSend only)
 * @property {string} [sendMax] - Maximum amount to send (strictReceive only)
 * @property {string} [path] - Optional comma-separated intermediate hops (e.g., "USDC:G..., XLM")
 */

/**
 * The payload shape for a strict send path payment.
 * @typedef {Object} StrictSendPayload
 * @property {"pathPaymentStrictSend"} type
 * @property {Object} sendAsset - SDK Asset
 * @property {string} sendAmount - Amount to send (7 decimals)
 * @property {string} destination - Destination public key
 * @property {Object} destAsset - SDK Asset
 * @property {string} destMin - Minimum to receive (7 decimals)
 * @property {Object[]} path - Array of SDK Assets for intermediate hops
 */

/**
 * The payload shape for a strict receive path payment.
 * @typedef {Object} StrictReceivePayload
 * @property {"pathPaymentStrictReceive"} type
 * @property {Object} sendAsset - SDK Asset
 * @property {string} sendMax - Maximum to send (7 decimals)
 * @property {string} destination - Destination public key
 * @property {Object} destAsset - SDK Asset
 * @property {string} destAmount - Amount to receive (7 decimals)
 * @property {Object[]} path - Array of SDK Assets for intermediate hops
 */

/**
 * Union of both payload types.
 * @typedef {StrictSendPayload | StrictReceivePayload} PathPaymentPayload
 */

/**
 * Build the path payment payload from a form state object.
 *
 * Picks the correct payload shape based on `mode`, validates required
 * fields, converts asset descriptors to SDK Assets, normalizes amounts
 * to 7-decimal strings, and parses the intermediate path.
 *
 * @param {PathPaymentFormState} formState - Form state from the Path tab UI
 * @param {string} destination - Destination account public key (G...)
 * @returns {PathPaymentPayload} SDK-ready operation parameters
 *
 * @throws {Error} If mode is invalid, required fields are missing,
 *   asset descriptors are invalid, or path parsing fails.
 *
 * @example
 * // Strict send: fix send amount, set minimum received
 * buildPathPaymentPayload({
 *   mode: "strictSend",
 *   sendAsset: { isNative: true },
 *   destAsset: { isNative: false, code: "USDC", issuer: "G..." },
 *   amount: "10",
 *   destMin: "9.5",
 *   path: ""
 * }, "GDEST...");
 * // => { type: "pathPaymentStrictSend", sendAsset: ..., sendAmount: "10.0000000", ... }
 *
 * @example
 * // Strict receive: fix receive amount, set maximum sent
 * buildPathPaymentPayload({
 *   mode: "strictReceive",
 *   sendAsset: { isNative: true },
 *   destAsset: { isNative: false, code: "USDC", issuer: "G..." },
 *   amount: "25",
 *   sendMax: "26",
 *   path: "FOO:G..."
 * }, "GDEST...");
 * // => { type: "pathPaymentStrictReceive", sendAsset: ..., sendMax: "26.0000000", ... }
 */
export function buildPathPaymentPayload(formState, destination) {
  if (!formState || typeof formState !== "object") {
    throw new Error("Form state is required and must be an object.");
  }

  const { mode, sendAsset, destAsset, amount, destMin, sendMax, path = "" } = formState;

  if (mode !== "strictSend" && mode !== "strictReceive") {
    throw new Error(`Unsupported path payment mode: ${mode}`);
  }

  requireField(sendAsset, "Send asset");
  requireField(destAsset, "Destination asset");
  requireField(amount, "Amount");
  requireField(destination, "Destination");

  const isStrictReceive = mode === "strictReceive";

  if (isStrictReceive) {
    requireField(sendMax, "Maximum to send (sendMax)");
  } else {
    requireField(destMin, "Minimum received (destMin)");
  }

  const sourceAsset = buildAsset(sendAsset);
  const destinationAsset = buildAsset(destAsset);
  const intermediatePath = parsePathAssets(path);

  const amountValue = normalizeStellarAmount(amount);
  const boundValue = normalizeStellarAmount(isStrictReceive ? sendMax : destMin);

  if (isStrictReceive) {
    return {
      type: "pathPaymentStrictReceive",
      sendAsset: sourceAsset,
      sendMax: boundValue,
      destination,
      destAsset: destinationAsset,
      destAmount: amountValue,
      path: intermediatePath,
    };
  }

  return {
    type: "pathPaymentStrictSend",
    sendAsset: sourceAsset,
    sendAmount: amountValue,
    destination,
    destAsset: destinationAsset,
    destMin: boundValue,
    path: intermediatePath,
  };
}

/**
 * Validate a form state object without building the payload.
 * Useful for early validation in the UI before submission.
 *
 * @param {PathPaymentFormState} formState - Form state from the Path tab UI
 * @param {string} destination - Destination account public key (G...)
 * @returns {Object} Validation result
 * @returns {boolean} returns.valid - True if valid
 * @returns {string[]} returns.errors - Array of error messages (empty if valid)
 *
 * @example
 * validatePathPaymentForm({
 *   mode: "strictSend",
 *   sendAsset: { isNative: true },
 *   destAsset: { isNative: false, code: "USDC", issuer: "G..." },
 *   amount: "10",
 *   destMin: "9.5"
 * }, "GDEST...");
 * // => { valid: true, errors: [] }
 */
export function validatePathPaymentForm(formState, destination) {
  const errors = [];

  if (!formState || typeof formState !== "object") {
    errors.push("Form state is required.");
    return { valid: false, errors };
  }

  const { mode, sendAsset, destAsset, amount, destMin, sendMax } = formState;

  if (mode !== "strictSend" && mode !== "strictReceive") {
    errors.push(`Unsupported mode: ${mode}. Use "strictSend" or "strictReceive".`);
  }

  if (!sendAsset) errors.push("Send asset is required.");
  if (!destAsset) errors.push("Destination asset is required.");
  if (!amount || String(amount).trim() === "") errors.push("Amount is required.");
  if (!destination || String(destination).trim() === "") errors.push("Destination is required.");

  const isStrictReceive = mode === "strictReceive";
  if (isStrictReceive) {
    if (!sendMax || String(sendMax).trim() === "") errors.push("Maximum to send (sendMax) is required for strict receive.");
  } else {
    if (!destMin || String(destMin).trim() === "") errors.push("Minimum received (destMin) is required for strict send.");
  }

  if (sendAsset) {
    try { buildAsset(sendAsset); } catch (e) { errors.push(`Send asset: ${e.message}`); }
  }
  if (destAsset) {
    try { buildAsset(destAsset); } catch (e) { errors.push(`Destination asset: ${e.message}`); }
  }

  return { valid: errors.length === 0, errors };
}