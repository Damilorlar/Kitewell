# Asset issuer display formatter

`frontend/src/assetIssuerDomainFormat.js` renders an asset as one compact
display string for asset lists, for example `USDC (centre.io)` when the
issuer's home domain is known, or `USDC (GBEY3S…Y7EYFU)` — a shortened issuer —
when no domain is known.

The module is standalone; wiring it into `App.jsx`, `freighter.js`, or
`stellar.js` is a separate, later issue. It has no SDK dependency, so it stays
a pure string helper that can be unit tested in isolation.

## What it does

- Trims and uppercases the asset code, and rejects anything that is not 1–12
  alphanumeric characters.
- Validates the issuer as a canonical Stellar `G...` public key (the StrKey
  checksum is not verified — that is left to the SDK).
- Uses the issuer's home domain when one is known, and shortens the issuer
  address as the fallback when the domain is missing, empty, or whitespace-only.
- Normalizes the home domain to lowercase and rejects malformed domains.
- Renders native assets (no issuer) as the code alone, `XLM`.
- Throws an `Error` with a user-facing message for missing, malformed, or
  mistyped input, and for invalid shortening lengths.

## Public API

### `formatAssetIssuerDomain(asset, options)`

Formats a whole asset descriptor.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `asset` | `object` | — | Asset descriptor (see below) |
| `asset.code` | `string` | `XLM` for native assets | Asset code, 1–12 alphanumeric characters |
| `asset.issuer` | `string` | — | Issuer `G...` public key (required for credit assets) |
| `asset.domain` | `string` | — | Issuer home domain, e.g. `centre.io` |
| `asset.homeDomain` | `string` | — | Alias for `domain`, used when `domain` is missing; `domain` wins when both carry a value |
| `asset.isNative` | `boolean` | `false` | `true` for native XLM |
| `options.prefixLength` | `number` | `6` | Characters kept from the start of the issuer |
| `options.suffixLength` | `number` | `6` | Characters kept from the end of the issuer |

```js
import { formatAssetIssuerDomain } from "./assetIssuerDomainFormat";

formatAssetIssuerDomain({ code: "USDC", issuer: "G...", domain: "centre.io" });
// => "USDC (centre.io)"

formatAssetIssuerDomain({ code: "USDC", issuer: "G..." });
// => "USDC (GBEY3S…Y7EYFU)"

formatAssetIssuerDomain({ isNative: true });
// => "XLM"
```

### `formatIssuerWithDomain(issuer, domain, options)`

Formats the parenthesized issuer part on its own. The issuer is always
validated, even when a domain is known.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `issuer` | `string` | — | Issuer `G...` public key |
| `domain` | `string` | — | Issuer home domain; `undefined` or `null` means "unknown" |
| `options.prefixLength` | `number` | `6` | Characters kept from the start of the issuer |
| `options.suffixLength` | `number` | `6` | Characters kept from the end of the issuer |

```js
formatIssuerWithDomain("G...", "centre.io"); // => "(centre.io)"
formatIssuerWithDomain("G...");               // => "(GBEY3S…Y7EYFU)"
```

### `shortenIssuer(issuer, options)`

Shortens an issuer address to `GAAAAA…AAAWHF`. The address is returned
unchanged when it already fits within `prefixLength + suffixLength`, and a
zero-length side is omitted.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `issuer` | `string` | — | Issuer `G...` public key |
| `options.prefixLength` | `number` | `6` | Characters kept from the start |
| `options.suffixLength` | `number` | `6` | Characters kept from the end |

```js
shortenIssuer("G...");                                  // => "GBEY3S…Y7EYFU"
shortenIssuer("G...", { prefixLength: 4, suffixLength: 4 }); // => "GBEY…EYFU"
```

### Constants

- `ISSUER_ELLIPSIS` — the `…` character inserted between the kept parts.
- `DEFAULT_ISSUER_PREFIX_LENGTH` — `6`.
- `DEFAULT_ISSUER_SUFFIX_LENGTH` — `6`.
- `MAX_ASSET_CODE_LENGTH` — `12`.
- `MAX_DOMAIN_LENGTH` — `253`.

## Errors

| Condition | Error | Message |
| --- | --- | --- |
| `asset` is not a plain object | `TypeError` | `Asset must be an object.` |
| `asset.code` is not a string | `TypeError` | `Asset code must be a string.` |
| `asset.issuer` is not a string | `TypeError` | `Asset issuer must be a string.` |
| `asset.domain` is not a string | `TypeError` | `Asset home domain must be a string.` |
| `asset.code` is missing or empty | `Error` | `Asset code is required.` |
| `asset.code` is not 1–12 alphanumeric characters | `Error` | `Asset code must be 1–12 alphanumeric characters (A–Z, 0–9).` |
| `asset.issuer` is missing or empty | `Error` | `Asset issuer is required.` |
| `asset.issuer` is not a `G...` public key | `Error` | `Asset issuer must be a valid Stellar public key (G…).` |
| The home domain has no top-level domain | `Error` | `Asset home domain must include a top-level domain.` |
| The home domain has an empty or malformed label | `Error` | `Asset home domain contains an invalid label.` |
| The home domain's top-level domain has no letter | `Error` | `Asset home domain must end with a valid top-level domain.` |
| The home domain is longer than 253 characters | `Error` | `Asset home domain cannot exceed 253 characters.` |
| A shortening length is negative, fractional, or not a number | `Error` | `<option> must be a non-negative integer.` |
| Both shortening lengths are `0` | `Error` | `prefixLength and suffixLength cannot both be 0.` |

## Notes

- An empty or whitespace-only home domain is treated as "no domain is known",
  so the shortened issuer is used instead of raising an error.
- `frontend/src/addressShorten.js` is the general-purpose Stellar address
  helper; this module is the asset-list specific variant that also understands
  home domains.
- Tests live next to the module in
  `frontend/src/asset-issuer-domain-format-*.test.js` and run with `npm test`
  from `frontend/`.
