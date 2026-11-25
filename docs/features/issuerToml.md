# Issuer stellar.toml reader

`frontend/src/issuerToml.js` reads the currency list an issuer publishes in its
`stellar.toml` (SEP-0001), for issue #511: the organisation name, the
DOCUMENTATION table, and one row per `[[CURRENCIES]]` entry.

The **Issuer** tab of `App.jsx` drives this module. The toml is read by a small
subset parser rather than a new dependency, because the panel only needs
DOCUMENTATION and `[[CURRENCIES]]`, and because the lab must never display a
row it invented itself — a file the parser cannot read throws and yields no
rows at all. A statement may run over several lines only while an array is
still open, which is how published files write `ACCOUNTS = [ … ]`; an array
that never closes is reported on the line it opened. Multi-line strings and
inline tables are outside the subset and are reported as failures. Horizon
reads and `fetch` are injected, so the whole flow is tested in the Node test
environment.

## Public API

### `parseStellarToml(text)`

| Returns | Holds |
| --- | --- |
| `values` | top-level key/value pairs |
| `tables` | one object per `[TABLE]` header |
| `arrays` | one list per `[[ARRAY]]` header |

Accepted values: basic strings (`"…"`, with `\n \t \uXXXX` escapes), literal
strings (`'…'`), numbers (signed, `_` separators and exponents allowed),
`true` / `false`, and inline arrays of those. Whole-line and end-of-line
comments are ignored outside strings; `#` inside a string stays part of the
string. Any `[[ARRAY]]` or `[TABLE]` name must match `[A-Za-z0-9_-]+`.

Every failure names the line: `stellar.toml line <N>: <reason>`. A second set of
the same key in the same table (`… is set twice`), a line that is neither a
header nor a key, a missing `=`, `extra text follows the value`, an unclosed
string or array, and `… is not a toml value` all throw. Non-string input throws
`There is no stellar.toml body to read.`

### `getOrgName(parsed)`

The `ORG_NAME` value from DOCUMENTATION, found without regard to underscores or
case, trimmed, or `null`.

### `currencyRows(parsed)`

One row per `[[CURRENCIES]]` entry: `{ code, issuer, displayDecimals }`. A field
the issuer did not publish stays `null` — nothing is filled in. No rows at all
returns `[]`.

### `normaliseIssuerDomain(domain)`

Trims and validates a bare hostname. Rejects an empty value, spaces, a scheme,
a path/query/fragment, credentials, a port, and a name without a dot.

### `stellarTomlUrl(domain)`

`https://<domain>/.well-known/stellar.toml`, always HTTPS, with the domain
validated as above.

### `resolveIssuerHomeDomain({ issuerAccount, loadAccount })`

Reads `home_domain` off the issuer account on the ledger and returns
`{ homeDomain, issuerAccount }`; `homeDomain` is `null` when the account
publishes none. The published value is validated, never trusted: a
`home_domain` that is a URL rather than a hostname throws.

### `fetchIssuerToml({ domain, fetchFn })`

Returns `{ url, text }`. A non-2xx response throws `No stellar.toml was
published for this domain (<status>).`, and a response whose final URL is no
longer HTTPS throws `The stellar.toml redirect left HTTPS, so it was not read.`

### `issuerInputKind(accountOrDomain)`

`"account"` when the entered value is a valid `G…` key, `"domain"` otherwise.

### `loadIssuerCurrencyList({ accountOrDomain, loadAccount, fetchFn })`

The one entry point: it decides the kind, reads the home domain from the ledger
when an account was entered, fetches and parses the toml, and returns

```js
{ kind, account, homeDomain, url, documentation, orgName, currencies, rows, presentation }
```

`currencies` is the raw `[[CURRENCIES]]` list and `rows` the mapped one, so the
panel can show what was published next to what it read. An issuer account with
no `home_domain` throws `The issuer account <G…> publishes no home_domain, so
it has no stellar.toml.`

### `issuerTomlPresentation(result)`

Display lines: the domain the file came from, the organisation (or `not
published`), the DOCUMENTATION fields or `DOCUMENTATION is not published.`, and
one line per currency row, or `No CURRENCIES rows are published.`

## Tests

`frontend/src/issuer-toml-*.test.js` (parse edges, two currencies, domain,
home domain, currency rows, list flow, presentation). Run with
`npm test -w frontend`.
