/**
 * Validation error for an unsupported network name.
 *
 * `code` is always `unsupported_network`. `input` is the value the caller
 * passed, unchanged, so it can be logged or mapped. The message names that
 * input and does not include secrets.
 */
export class NetworkConfigError extends Error {
  /**
   * @param {unknown} input Value that failed network-name validation.
   */
  constructor(input) {
    super(`Unsupported network: ${describeNetworkInput(input)}.`);
    this.name = "NetworkConfigError";
    /** @type {"unsupported_network"} */
    this.code = "unsupported_network";
    /** @type {unknown} */
    this.input = input;
  }
}

/**
 * Render a rejected input for an error message.
 *
 * Strings are quoted. Objects and arrays are described by type only, so a
 * payload that happens to carry a secret is not copied into the message.
 *
 * @param {unknown} input
 * @returns {string}
 */
function describeNetworkInput(input) {
  if (typeof input === "string") return JSON.stringify(input);
  if (input === null) return "null";
  if (input === undefined) return "undefined";
  if (
    typeof input === "number" ||
    typeof input === "boolean" ||
    typeof input === "bigint"
  ) {
    return String(input);
  }
  if (typeof input === "symbol") return input.toString();
  return Object.prototype.toString.call(input);
}
