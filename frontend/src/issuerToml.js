import * as StellarSdk from "@stellar/stellar-sdk";
import { getActiveNetwork } from "./network";

/**
 * Read an issuer's published stellar.toml (SEP-0001) for the lab panel.
 *
 * The toml is parsed with a small subset reader rather than a dependency: the
 * panel only needs the DOCUMENTATION table and the [[CURRENCIES]] rows, and the
 * lab must never display a row it invented itself. A file the reader cannot
 * parse therefore yields a failure and no rows at all.
 */

const STELLAR_TOML_PATH = "/.well-known/stellar.toml";
const DOCUMENTATION_TABLE = "DOCUMENTATION";
const CURRENCIES_ARRAY = "CURRENCIES";
const TABLE_NAME = /^[A-Za-z0-9_-]+$/;

function readServer() {
  return new StellarSdk.Horizon.Server(getActiveNetwork().horizonUrl);
}

function failure(lineNumber, reason) {
  return new Error(`stellar.toml line ${lineNumber}: ${reason}`);
}

/** Drop an end-of-line comment without touching anything inside a string. */
function withoutComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === "\\" && quote === '"') index += 1;
      else if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "#") {
      return line.slice(0, index);
    }
  }
  return line;
}

/**
 * How many arrays a fragment opens without closing, counting brackets outside
 * strings. A published stellar.toml spreads `ACCOUNTS = [ … ]` over several
 * lines, so the reader keeps taking lines while this is greater than zero.
 */
function openArrayDepth(text) {
  let depth = 0;
  let quote = null;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === "\\" && quote === '"') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[") depth += 1;
    else if (character === "]") depth -= 1;
  }
  return depth;
}

function readBasicString(text, start, lineNumber) {
  let value = "";
  let index = start + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === '"') return { value, index: index + 1 };
    if (character !== "\\") {
      value += character;
      index += 1;
      continue;
    }
    const escaped = text[index + 1];
    if (escaped === undefined) break;
    const simple = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };
    if (escaped === "u" || escaped === "U") {
      const width = escaped === "u" ? 4 : 8;
      const hex = text.slice(index + 2, index + 2 + width);
      if (hex.length !== width || /[^0-9a-fA-F]/.test(hex)) {
        throw failure(lineNumber, "a string escape is not a code point");
      }
      value += String.fromCodePoint(Number.parseInt(hex, 16));
      index += 2 + width;
      continue;
    }
    if (!(escaped in simple)) {
      throw failure(lineNumber, `unknown string escape \\${escaped}`);
    }
    value += simple[escaped];
    index += 2;
  }
  throw failure(lineNumber, "a string is not closed on its line");
}

function readLiteralString(text, start, lineNumber) {
  const end = text.indexOf("'", start + 1);
  if (end === -1) throw failure(lineNumber, "a string is not closed on its line");
  return { value: text.slice(start + 1, end), index: end + 1 };
}

function readNumber(text, start) {
  const matched = /^[+-]?(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*)?(?:[eE][+-]?[0-9](?:_?[0-9])*)?/.exec(
    text.slice(start)
  );
  if (!matched) return null;
  const digits = matched[0].replace(/_/g, "");
  return { value: Number(digits), index: start + matched[0].length };
}

function readArray(text, start, lineNumber) {
  const values = [];
  let index = start + 1;
  for (;;) {
    index = skipSpace(text, index);
    if (index >= text.length) throw failure(lineNumber, "an array is not closed");
    if (text[index] === "]") return { value: values, index: index + 1 };
    const item = readValue(text, index, lineNumber);
    values.push(item.value);
    index = skipSpace(text, item.index);
    if (text[index] === ",") {
      index += 1;
      continue;
    }
    if (text[index] === "]") return { value: values, index: index + 1 };
    throw failure(lineNumber, "an array item is not followed by , or ]");
  }
}

function skipSpace(text, index) {
  let cursor = index;
  while (cursor < text.length && /[ \t]/.test(text[cursor])) cursor += 1;
  return cursor;
}

function readValue(text, start, lineNumber) {
  const character = text[start];
  if (character === undefined) throw failure(lineNumber, "a key has no value");
  if (character === '"') return readBasicString(text, start, lineNumber);
  if (character === "'") return readLiteralString(text, start, lineNumber);
  if (character === "[") return readArray(text, start, lineNumber);
  if (text.startsWith("true", start)) return { value: true, index: start + 4 };
  if (text.startsWith("false", start)) return { value: false, index: start + 5 };
  const number = readNumber(text, start);
  if (number) return number;
  throw failure(lineNumber, `${text.slice(start, start + 12)} is not a toml value`);
}

function readKey(text, start, lineNumber) {
  const character = text[start];
  if (character === '"' || character === "'") {
    const read = character === '"'
      ? readBasicString(text, start, lineNumber)
      : readLiteralString(text, start, lineNumber);
    return { key: read.value, index: read.index };
  }
  const matched = /^[A-Za-z0-9_-]+/.exec(text.slice(start));
  if (!matched) throw failure(lineNumber, "a line is neither a table header nor a key");
  return { key: matched[0], index: start + matched[0].length };
}

/**
 * Parse the stellar.toml subset the panel shows.
 *
 * @param {string} text Raw stellar.toml body.
 * @returns {{ values: object, tables: object, arrays: object }} Parsed
 *   key/value sections. A file that cannot be parsed throws instead of
 *   returning whatever was read before the failure.
 * @throws {Error} With the line number of the first unparseable line.
 */
export function parseStellarToml(text) {
  if (typeof text !== "string") {
    throw new Error("There is no stellar.toml body to read.");
  }

  const parsed = { values: {}, tables: {}, arrays: {} };
  let current = { kind: "top", target: parsed.values };
  const lines = text.split(/\r?\n/);

  for (let offset = 0; offset < lines.length; offset += 1) {
    const lineNumber = offset + 1;
    let statement = withoutComment(lines[offset]).trim();
    if (!statement) continue;

    // A value that carries an open array runs on until the array closes. The
    // line number reported stays the one the statement started on.
    while (openArrayDepth(statement) > 0 && offset + 1 < lines.length) {
      offset += 1;
      statement = `${statement} ${withoutComment(lines[offset]).trim()}`;
    }

    const arrayHeader = /^\[\[([^\]]+)\]\]$/.exec(statement);
    if (arrayHeader) {
      const name = arrayHeader[1].trim();
      if (!TABLE_NAME.test(name)) throw failure(lineNumber, `${name} is not a table name`);
      parsed.arrays[name] ??= [];
      const row = {};
      parsed.arrays[name].push(row);
      current = { kind: "array", target: row };
      continue;
    }

    const tableHeader = /^\[([^\]]+)\]$/.exec(statement);
    if (tableHeader) {
      const name = tableHeader[1].trim();
      if (!TABLE_NAME.test(name)) throw failure(lineNumber, `${name} is not a table name`);
      parsed.tables[name] ??= {};
      current = { kind: "table", target: parsed.tables[name] };
      continue;
    }

    let index = 0;
    const key = readKey(statement, index, lineNumber);
    index = skipSpace(statement, key.index);
    if (statement[index] !== "=") throw failure(lineNumber, "a key is not followed by =");
    index = skipSpace(statement, index + 1);
    const value = readValue(statement, index, lineNumber);
    const trailing = skipSpace(statement, value.index);
    if (trailing !== statement.length) {
      throw failure(lineNumber, "extra text follows the value");
    }
    if (Object.hasOwn(current.target, key.key)) {
      throw failure(lineNumber, `${key.key} is set twice`);
    }
    current.target[key.key] = value.value;
  }

  return parsed;
}

function documentationValue(parsed, name) {
  const table = parsed?.tables?.[DOCUMENTATION_TABLE];
  if (!table) return null;
  const wanted = name.toLowerCase().replace(/[^a-z]/g, "");
  const key = Object.keys(table).find(
    (candidate) => candidate.toLowerCase().replace(/[^a-z]/g, "") === wanted
  );
  return key === undefined ? null : table[key];
}

/**
 * The organisation name the issuer published, or null.
 *
 * @param {object} parsed Output of {@link parseStellarToml}.
 * @returns {string|null}
 */
export function getOrgName(parsed) {
  const value = documentationValue(parsed, "orgname");
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Map every published [[CURRENCIES]] row to what the panel shows.
 *
 * A field the issuer did not publish stays null; nothing is filled in here.
 *
 * @param {object} parsed Output of {@link parseStellarToml}.
 * @returns {Array<{ code: string|null, issuer: string|null, displayDecimals: number|null }>}
 */
export function currencyRows(parsed) {
  const rows = parsed?.arrays?.[CURRENCIES_ARRAY];
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const source = row && typeof row === "object" ? row : {};
    const decimals = source.display_decimals;
    return {
      code: typeof source.code === "string" && source.code ? source.code : null,
      issuer: typeof source.issuer === "string" && source.issuer ? source.issuer : null,
      displayDecimals: typeof decimals === "number" && Number.isFinite(decimals) ? decimals : null,
    };
  });
}

/**
 * Validate the domain the user typed.
 *
 * A home domain is a bare host: a scheme, path, query, fragment, port or
 * credentials would all point the fetch somewhere the issuer did not publish.
 *
 * @param {string} domain Home domain, as entered or read from an account.
 * @returns {string} The domain, trimmed.
 * @throws {Error} When the value is not a bare hostname.
 */
export function normaliseIssuerDomain(domain) {
  if (typeof domain !== "string" || !domain.trim()) {
    throw new Error("Enter the issuer's home domain.");
  }
  const trimmed = domain.trim();
  if (/\s/.test(trimmed)) {
    throw new Error("A home domain cannot contain spaces.");
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    throw new Error("A home domain is a hostname, not a URL with a scheme.");
  }
  if (/[/?#]/.test(trimmed)) {
    throw new Error("A home domain cannot carry a path, query or fragment.");
  }
  if (trimmed.includes("@")) {
    throw new Error("A home domain cannot embed credentials.");
  }
  if (trimmed.includes(":")) {
    throw new Error("A home domain cannot name a port.");
  }
  if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(trimmed)) {
    throw new Error("A home domain must be a hostname with at least one dot.");
  }
  return trimmed;
}

/**
 * Build the HTTPS URL for a domain's stellar.toml.
 *
 * @param {string} domain Home domain, validated by {@link normaliseIssuerDomain}.
 * @returns {string} `https://<domain>/.well-known/stellar.toml`.
 */
export function stellarTomlUrl(domain) {
  return `https://${normaliseIssuerDomain(domain)}${STELLAR_TOML_PATH}`;
}

/**
 * Read the home_domain an issuer account published on the ledger.
 *
 * @param {object} options
 * @param {string} options.issuerAccount Issuer account id.
 * @param {(accountId: string) => Promise<object>} [options.loadAccount]
 *   Horizon account loader, for tests.
 * @returns {Promise<string|null>} The home domain, or null when unpublished.
 */
export async function resolveIssuerHomeDomain({
  issuerAccount,
  loadAccount = (accountId) => readServer().loadAccount(accountId),
} = {}) {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(issuerAccount)) {
    throw new Error("Enter a valid issuer account (G…).");
  }
  const account = await loadAccount(issuerAccount);
  const homeDomain = account?.home_domain;
  if (typeof homeDomain !== "string" || !homeDomain.trim()) {
    return { homeDomain: null, issuerAccount };
  }
  return { homeDomain: normaliseIssuerDomain(homeDomain), issuerAccount };
}

/**
 * Fetch a domain's stellar.toml over HTTPS only.
 *
 * @param {object} options
 * @param {string} options.domain Home domain.
 * @param {typeof fetch} [options.fetchFn] Injectable fetch, for tests.
 * @returns {Promise<{ url: string, text: string }>}
 */
export async function fetchIssuerToml({ domain, fetchFn = globalThis.fetch } = {}) {
  const url = stellarTomlUrl(domain);
  if (typeof fetchFn !== "function") {
    throw new Error("This session cannot make requests, so no stellar.toml can be read.");
  }

  const response = await fetchFn(url, { method: "GET", headers: { Accept: "text/plain" } });
  if (!response.ok) {
    throw new Error(`No stellar.toml was published for this domain (${response.status}).`);
  }
  if (typeof response.url === "string" && !response.url.toLowerCase().startsWith("https://")) {
    throw new Error("The stellar.toml redirect left HTTPS, so it was not read.");
  }
  return { url, text: await response.text() };
}

/**
 * Say which host a user-entered issuer refers to.
 *
 * @param {string} accountOrDomain An issuer account (G…) or a home domain.
 * @returns {"account"|"domain"}
 */
export function issuerInputKind(accountOrDomain) {
  if (typeof accountOrDomain === "string" && StellarSdk.StrKey.isValidEd25519PublicKey(accountOrDomain.trim())) {
    return "account";
  }
  return "domain";
}

/**
 * Resolve an issuer account or domain to its published currency list.
 *
 * @param {object} options
 * @param {string} options.accountOrDomain Issuer account (G…) or home domain.
 * @param {(accountId: string) => Promise<object>} [options.loadAccount]
 *   Horizon account loader, for tests.
 * @param {typeof fetch} [options.fetchFn] Injectable fetch, for tests.
 * @returns {Promise<{ kind: string, account: string|null, homeDomain: string,
 *   url: string, documentation: object, orgName: string|null, currencies: object[],
 *   rows: object[], presentation: string[] }>}
 */
export async function loadIssuerCurrencyList({
  accountOrDomain,
  loadAccount,
  fetchFn = globalThis.fetch,
} = {}) {
  const entered = typeof accountOrDomain === "string" ? accountOrDomain.trim() : "";
  if (!entered) {
    throw new Error("Enter an issuer account or a home domain.");
  }

  let kind = "domain";
  let account = null;
  let homeDomain;
  if (issuerInputKind(entered) === "account") {
    kind = "account";
    account = entered;
    const resolved = await resolveIssuerHomeDomain({ issuerAccount: entered, loadAccount });
    if (!resolved.homeDomain) {
      throw new Error(`The issuer account ${entered} publishes no home_domain, so it has no stellar.toml.`);
    }
    homeDomain = resolved.homeDomain;
  } else {
    homeDomain = normaliseIssuerDomain(entered);
  }

  const { url, text } = await fetchIssuerToml({ domain: homeDomain, fetchFn });
  const parsed = parseStellarToml(text);
  const result = {
    kind,
    account,
    homeDomain,
    url,
    documentation: parsed.tables[DOCUMENTATION_TABLE] ?? {},
    orgName: getOrgName(parsed),
    currencies: parsed.arrays[CURRENCIES_ARRAY] ?? [],
    rows: currencyRows(parsed),
  };
  return { ...result, presentation: issuerTomlPresentation(result) };
}

/**
 * Display lines for a parsed stellar.toml.
 *
 * @param {object} result Without `presentation`, from {@link loadIssuerCurrencyList}.
 * @returns {string[]} Lines safe to render; unpublished fields say so.
 */
export function issuerTomlPresentation(result) {
  const lines = [
    `stellar.toml from ${result.homeDomain}.`,
    `Organisation: ${result.orgName ?? "not published"}.`,
  ];

  const keys = Object.keys(result.documentation ?? {});
  if (keys.length) {
    lines.push(`DOCUMENTATION (${keys.length} field${keys.length === 1 ? "" : "s"}):`);
    for (const key of keys) lines.push(`  ${key} = ${result.documentation[key]}`);
  } else {
    lines.push("DOCUMENTATION is not published.");
  }

  if (!result.rows.length) {
    lines.push("No CURRENCIES rows are published.");
    return lines;
  }

  lines.push(`${result.rows.length} published currency${result.rows.length === 1 ? "" : "ies"}:`);
  for (const row of result.rows) {
    lines.push(
      `  ${row.code ?? "code not published"} · issuer ${row.issuer ?? "not published"} · ` +
        `display_decimals ${row.displayDecimals ?? "not published"}`
    );
  }
  return lines;
}
