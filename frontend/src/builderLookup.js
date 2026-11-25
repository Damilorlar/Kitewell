import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Normalize and validate a Stellar account address before it is used as a
 * `get_builder` argument, so an RPC round trip is never spent on an address
 * that cannot be registered.
 *
 * @param {string} address
 * @returns {string} the trimmed G… address
 */
export function normalizeBuilderAddress(address) {
  const text = String(address ?? "").trim();
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(text)) {
    throw new Error("Address must be a valid Stellar public key (G…).");
  }
  return text;
}

/**
 * Decode the `Option<String>` returned by `get_builder`. A Soroban Option
 * arrives as an empty vec (None) or a one-element vec (Some); an already
 * unwrapped string is accepted too.
 *
 * @param {unknown} option
 * @returns {string|null} the registered name, or null when unregistered
 */
export function decodeBuilderName(option) {
  if (option === null || option === undefined) return null;
  const native = StellarSdk.scValToNative(option);
  const name = Array.isArray(native) ? native[0] : native;
  return typeof name === "string" && name.trim() !== "" ? name : null;
}

/**
 * Shape the lookup result for the panel: a registered builder shows its stored
 * name, an unregistered address shows a clear message instead of a blank name.
 *
 * @param {string} address
 * @param {string|null} name
 * @returns {{ address: string, name: string|null, registered: boolean, label: string }}
 */
export function describeBuilderLookup(address, name) {
  const registered = typeof name === "string" && name.trim() !== "";
  return {
    address,
    name: registered ? name : null,
    registered,
    label: registered ? name : "Not registered",
  };
}

/**
 * Look up one builder through an injected `simulate` function, so the same
 * rules run against Soroban RPC in the app and against fixtures in tests.
 *
 * @param {(address: string) => Promise<unknown>} simulate runs get_builder
 * @param {string} address
 */
export async function lookupRegisteredBuilder(simulate, address) {
  const normalized = normalizeBuilderAddress(address);
  const option = await simulate(normalized);
  return describeBuilderLookup(normalized, decodeBuilderName(option));
}
