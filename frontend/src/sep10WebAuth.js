import * as StellarSdk from "@stellar/stellar-sdk";
import { getActiveNetwork } from "./network";

const HTTPS_PREFIX = "https://";
const MANAGE_DATA_TYPE = "manageData";
const WEB_AUTH_DOMAIN_OP = "web_auth_domain";

function decodeJsonSegment(segment, failureMessage) {
  const normalised = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  let text;
  try {
    text = atob(padded);
  } catch {
    throw new Error(failureMessage);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(failureMessage);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(failureMessage);
  }
  return value;
}

function timestampOrZero(value) {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null;
}

async function readJsonBody(response, failureMessage) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(failureMessage);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(failureMessage);
  }
  return payload;
}

function sameHash(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

// The SDK's xdr structs expose each field as an accessor function.
function xdrField(struct, name) {
  const value = struct[name];
  return typeof value === "function" ? value.call(struct) : value;
}

function bytesToText(value) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    return Array.from(value, (byte) => String.fromCharCode(byte)).join("");
  }
  return String(value ?? "");
}

function signatureMatches(envelope, hash, account) {
  let keypair;
  try {
    keypair = StellarSdk.Keypair.fromPublicKey(account);
  } catch {
    return false;
  }
  return envelope.signatures.some((signature) => {
    try {
      return keypair.verify(hash, xdrField(signature, "signature"));
    } catch {
      return false;
    }
  });
}

/**
 * Validate and normalise the anchor's SEP-10 web-auth endpoint.
 *
 * Only HTTPS is accepted: a challenge carries the account's signature, so it
 * must never travel over a plaintext connection. Query parameters are refused
 * because the lab appends the account itself.
 *
 * @param {string} endpoint User-entered endpoint URL.
 * @returns {string} The endpoint without a trailing slash.
 * @throws {Error} When the endpoint is missing, spaced, credentialed, not
 *   HTTPS, or carries a query string.
 */
export function normaliseAuthEndpoint(endpoint) {
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    throw new Error("Enter the anchor's web-auth endpoint.");
  }
  const trimmed = endpoint.trim();
  if (/\s/.test(trimmed)) {
    throw new Error("The web-auth endpoint cannot contain spaces.");
  }
  if (!trimmed.toLowerCase().startsWith(HTTPS_PREFIX)) {
    throw new Error("The web-auth endpoint must use https://.");
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("The web-auth endpoint is not a readable URL.");
  }
  if (url.username || url.password) {
    throw new Error("The web-auth endpoint cannot embed credentials.");
  }
  if (url.search) {
    throw new Error(
      "Enter the endpoint without query parameters; the account is appended for you."
    );
  }
  return url.toString().replace(/\/$/, "");
}

/**
 * Build the GET URL that asks the anchor for a challenge.
 *
 * @param {string} endpoint Web-auth endpoint, validated as in
 *   {@link normaliseAuthEndpoint}.
 * @param {object} [options]
 * @param {string} options.account Client account the challenge is addressed to.
 * @param {string[]} [options.homeDomains] Anchor home domains to request.
 * @returns {string} Absolute request URL.
 */
export function challengeRequestUrl(endpoint, { account, homeDomains } = {}) {
  const base = normaliseAuthEndpoint(endpoint);
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(account)) {
    throw new Error("Connect a valid Stellar account (G…) first.");
  }

  const url = new URL(base);
  url.searchParams.set("account", account);
  const domains = (Array.isArray(homeDomains) ? homeDomains : [])
    .map((domain) => String(domain ?? "").trim())
    .filter(Boolean);
  if (domains.length) {
    url.searchParams.set("home_domains", domains.join(","));
  }
  return url.toString();
}

/**
 * Request the unsigned challenge for an account.
 *
 * @param {object} options
 * @param {string} options.endpoint Web-auth endpoint.
 * @param {string} options.account Client account.
 * @param {string[]} [options.homeDomains] Home domains to request.
 * @param {typeof fetch} [options.fetchFn] Injectable fetch, for tests.
 * @returns {Promise<{ challengeXdr: string, requestUrl: string }>}
 */
export async function fetchUnsignedChallenge({
  endpoint,
  account,
  homeDomains,
  fetchFn = globalThis.fetch,
} = {}) {
  if (typeof fetchFn !== "function") {
    throw new Error("This session cannot make requests, so no challenge can be fetched.");
  }
  const requestUrl = challengeRequestUrl(endpoint, { account, homeDomains });
  const response = await fetchFn(requestUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `The web-auth endpoint replied ${response.status}; no challenge was returned.`
    );
  }

  const payload = await readJsonBody(
    response,
    "The web-auth endpoint did not return a JSON challenge."
  );
  if (typeof payload.challenge !== "string" || !payload.challenge) {
    throw new Error("The web-auth endpoint returned no challenge transaction.");
  }
  return { challengeXdr: payload.challenge, requestUrl };
}

/**
 * Read a challenge envelope and refuse it before anything is signed.
 *
 * The refusal order matters: every check here runs before Freighter is asked to
 * sign, so a challenge from the wrong server, already expired, not yet valid,
 * or not addressed to this account never reaches the wallet.
 *
 * @param {object} options
 * @param {string} options.challengeXdr Unsigned challenge, base64 XDR.
 * @param {string} options.clientAccount Connected Freighter account.
 * @param {string} options.expectedServerAccount Server account the endpoint claims.
 * @param {string} [options.networkPassphrase] Defaults to the active network.
 * @param {number} [options.nowMs] Clock, injectable for tests.
 * @returns {{ serverAccount: string, clientAccount: string, operationName: string,
 *   webAuthDomain: string|null, operationCount: number, expiresAtMs: number,
 *   validFromMs: number|null }}
 */
export function inspectChallenge({
  challengeXdr,
  clientAccount,
  expectedServerAccount,
  networkPassphrase = getActiveNetwork().passphrase,
  nowMs = Date.now(),
} = {}) {
  if (typeof challengeXdr !== "string" || !challengeXdr) {
    throw new Error("There is no challenge transaction to read.");
  }
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(clientAccount)) {
    throw new Error("The client account must be a valid Stellar public key (G…).");
  }
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(expectedServerAccount)) {
    throw new Error("The endpoint's server account must be a valid Stellar public key (G…).");
  }

  let transaction;
  try {
    transaction = StellarSdk.TransactionBuilder.fromXDR(challengeXdr, networkPassphrase);
  } catch {
    throw new Error("The challenge is not a transaction for this network.");
  }
  if (transaction instanceof StellarSdk.FeeBumpTransaction) {
    throw new Error("The challenge must be a base transaction, not a fee bump.");
  }

  if (transaction.source !== expectedServerAccount) {
    throw new Error(
      `Refused: the challenge's source account is ${transaction.source}, not the endpoint's server ${expectedServerAccount}.`
    );
  }

  const [firstOperation] = transaction.operations;
  if (!firstOperation) {
    throw new Error("Refused: the challenge holds no operations.");
  }
  if (firstOperation.type !== MANAGE_DATA_TYPE) {
    throw new Error(
      `Refused: the first challenge operation must be manageData, not ${firstOperation.type}.`
    );
  }
  if (firstOperation.source !== clientAccount) {
    throw new Error("Refused: the challenge's first operation is not addressed to this account.");
  }

  const { minTime, maxTime } = transaction.timeBounds || {};
  const expiresAt = timestampOrZero(maxTime);
  if (expiresAt === null) {
    throw new Error("Refused: the challenge sets no expiry.");
  }
  const expiresAtMs = expiresAt * 1000;
  const validFrom = timestampOrZero(minTime);
  if (expiresAtMs <= nowMs) {
    throw new Error(
      `Refused: the challenge expired at ${new Date(expiresAtMs).toISOString()}.`
    );
  }
  if (validFrom !== null && validFrom * 1000 > nowMs) {
    throw new Error(
      `Refused: the challenge is not valid until ${new Date(validFrom * 1000).toISOString()}.`
    );
  }

  const webAuthDomainOp = transaction.operations.find(
    (operation) => operation.type === MANAGE_DATA_TYPE && operation.name === WEB_AUTH_DOMAIN_OP
  );

  return {
    serverAccount: transaction.source,
    clientAccount,
    operationName: firstOperation.name,
    webAuthDomain: webAuthDomainOp
      ? bytesToText(xdrField(webAuthDomainOp, "value"))
      : null,
    operationCount: transaction.operations.length,
    expiresAtMs,
    validFromMs: validFrom === null ? null : validFrom * 1000,
  };
}

/**
 * Ask the wallet to sign the challenge without touching secret keys here.
 *
 * @param {object} options
 * @param {string} options.challengeXdr Unsigned challenge.
 * @param {(unsignedXdr: string) => Promise<string>} options.sign Freighter
 *   signer, injected so this module never imports the wallet itself.
 * @returns {Promise<string>} The signed envelope, base64 XDR.
 */
export async function signChallengeEnvelope({ challengeXdr, sign } = {}) {
  if (typeof sign !== "function") {
    throw new Error("Freighter is not available to sign the challenge.");
  }
  const signedXdr = await sign(challengeXdr);
  if (typeof signedXdr !== "string" || !signedXdr) {
    throw new Error("Freighter returned no signed challenge.");
  }
  return signedXdr;
}

/**
 * Report which accounts actually signed an envelope.
 *
 * @param {object} options
 * @param {string} options.envelopeXdr Signed challenge.
 * @param {string} options.serverAccount Expected server signer.
 * @param {string} options.clientAccount Expected client signer.
 * @param {string} [options.networkPassphrase] Defaults to the active network.
 * @returns {{ serverSigned: boolean, clientSigned: boolean, signatureCount: number }}
 */
export function verifyChallengeSignatures({
  envelopeXdr,
  serverAccount,
  clientAccount,
  networkPassphrase = getActiveNetwork().passphrase,
} = {}) {
  let envelope;
  try {
    envelope = StellarSdk.TransactionBuilder.fromXDR(envelopeXdr, networkPassphrase);
  } catch {
    throw new Error("The signed challenge is not a transaction for this network.");
  }
  if (envelope instanceof StellarSdk.FeeBumpTransaction) {
    throw new Error("The signed challenge must be a base transaction.");
  }

  const hash = envelope.hash();
  return {
    serverSigned: signatureMatches(envelope, hash, serverAccount),
    clientSigned: signatureMatches(envelope, hash, clientAccount),
    signatureCount: envelope.signatures.length,
  };
}

/**
 * Assert that signing only added a signature.
 *
 * Signing must not change what the client agreed to, so the signed envelope has
 * to hash to the same bytes as the one that was inspected.
 *
 * @param {object} options
 * @param {string} options.unsignedXdr Challenge as returned by the endpoint.
 * @param {string} options.signedXdr Envelope that came back from Freighter.
 * @param {string} [options.networkPassphrase] Defaults to the active network.
 * @throws {Error} When either envelope cannot be read or the hashes differ.
 */
export function assertEnvelopeUnchanged({
  unsignedXdr,
  signedXdr,
  networkPassphrase = getActiveNetwork().passphrase,
} = {}) {
  let unsigned;
  let signed;
  try {
    unsigned = new StellarSdk.Transaction(unsignedXdr, networkPassphrase);
    signed = new StellarSdk.Transaction(signedXdr, networkPassphrase);
  } catch {
    throw new Error("The signed challenge does not match the challenge that was shown.");
  }
  if (
    unsigned.signatures.length >= signed.signatures.length ||
    !sameHash(unsigned.hash(), signed.hash())
  ) {
    throw new Error("Refused: signing altered the challenge envelope.");
  }
}

/**
 * Post the signed challenge back and return the token.
 *
 * The token is returned only so {@link completeWebAuthChallenge} can read its
 * claims; nothing above this function keeps it.
 *
 * @param {object} options
 * @param {string} options.endpoint Web-auth endpoint.
 * @param {string} options.signedXdr Signed envelope.
 * @param {typeof fetch} [options.fetchFn] Injectable fetch, for tests.
 * @returns {Promise<string>} The access token.
 */
export async function postSignedChallenge({
  endpoint,
  signedXdr,
  fetchFn = globalThis.fetch,
} = {}) {
  const base = normaliseAuthEndpoint(endpoint);
  if (typeof signedXdr !== "string" || !signedXdr) {
    throw new Error("There is no signed challenge to post.");
  }
  if (typeof fetchFn !== "function") {
    throw new Error("This session cannot make requests, so the challenge cannot be posted.");
  }

  const response = await fetchFn(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signedXdr }),
  });
  if (!response.ok) {
    throw new Error(
      `The web-auth endpoint rejected the signed challenge (${response.status}).`
    );
  }

  const payload = await readJsonBody(
    response,
    "The web-auth endpoint did not return an access token."
  );
  if (typeof payload.token !== "string" || !payload.token) {
    throw new Error("The web-auth endpoint returned no access token.");
  }
  return payload.token;
}

/**
 * Read the subject and expiry out of a SEP-10 access token.
 *
 * Only claims are returned — never the token itself — so nothing upstream can
 * log or persist it.
 *
 * @param {string} token Compact JWS from the endpoint.
 * @param {object} [options]
 * @param {string} [options.expectedSubject] Refuse a token minted for someone else.
 * @param {number} [options.nowMs] Clock, injectable for tests.
 * @returns {{ subject: string, expiresAtMs: number, issuedAtMs: number|null, expired: boolean }}
 */
export function readJwtClaims(token, { expectedSubject, nowMs = Date.now() } = {}) {
  if (typeof token !== "string" || !token) {
    throw new Error("There is no access token to read.");
  }
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("The access token is not a JSON web token.");
  }

  const payload = decodeJsonSegment(
    segments[1],
    "The access token's payload could not be read."
  );
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("The access token names no subject.");
  }
  if (expectedSubject && payload.sub !== expectedSubject) {
    throw new Error("The access token was issued for a different account.");
  }

  const expiresAt = timestampOrZero(payload.exp);
  if (expiresAt === null) {
    throw new Error("The access token carries no expiry.");
  }
  const issuedAt = timestampOrZero(payload.iat);
  const expiresAtMs = expiresAt * 1000;

  return {
    subject: payload.sub,
    expiresAtMs,
    issuedAtMs: issuedAt === null ? null : issuedAt * 1000,
    expired: expiresAtMs <= nowMs,
  };
}

/**
 * Display lines for a finished web-auth session.
 *
 * @param {object} challenge Summary from {@link inspectChallenge}.
 * @param {object} session Claims from {@link readJwtClaims}.
 * @returns {string[]} Lines safe to render or log.
 */
export function webAuthPresentation(challenge, session) {
  return [
    `Challenge from ${challenge.serverAccount}, operation ${challenge.operationName}.`,
    `Valid until ${new Date(challenge.expiresAtMs).toISOString()}.`,
    `Session subject ${session.subject}, expires ${new Date(session.expiresAtMs).toISOString()}.`,
    session.expired ? "The session token has already expired." : "The session token is current.",
  ];
}

/**
 * Run the whole SEP-10 dance for the connected account.
 *
 * @param {object} options
 * @param {string} options.endpoint Web-auth endpoint entered by the user.
 * @param {string} options.account Connected client account.
 * @param {string} options.serverAccount The endpoint's signing account.
 * @param {string[]} [options.homeDomains] Home domains to request.
 * @param {(unsignedXdr: string) => Promise<string>} options.sign Freighter signer.
 * @param {typeof fetch} [options.fetchFn] Injectable fetch, for tests.
 * @param {string} [options.networkPassphrase] Defaults to the active network.
 * @param {number} [options.nowMs] Clock, injectable for tests.
 * @returns {Promise<{ requestUrl: string, challenge: object, session: object,
 *   presentation: string[] }>} The result carries no token.
 */
export async function completeWebAuthChallenge({
  endpoint,
  account,
  serverAccount,
  homeDomains,
  sign,
  fetchFn = globalThis.fetch,
  networkPassphrase = getActiveNetwork().passphrase,
  nowMs = Date.now(),
} = {}) {
  const { challengeXdr, requestUrl } = await fetchUnsignedChallenge({
    endpoint,
    account,
    homeDomains,
    fetchFn,
  });
  const challenge = inspectChallenge({
    challengeXdr,
    clientAccount: account,
    expectedServerAccount: serverAccount,
    networkPassphrase,
    nowMs,
  });

  const signedXdr = await signChallengeEnvelope({ challengeXdr, sign });
  assertEnvelopeUnchanged({ unsignedXdr: challengeXdr, signedXdr, networkPassphrase });
  const signatures = verifyChallengeSignatures({
    envelopeXdr: signedXdr,
    serverAccount,
    clientAccount: account,
    networkPassphrase,
  });
  if (!signatures.serverSigned || !signatures.clientSigned) {
    throw new Error(
      "Refused: the signed challenge is not backed by both the server's and this account's signature."
    );
  }

  const token = await postSignedChallenge({ endpoint, signedXdr, fetchFn });
  const session = readJwtClaims(token, { expectedSubject: account, nowMs });

  return {
    requestUrl,
    challenge,
    session,
    presentation: webAuthPresentation(challenge, session),
  };
}
