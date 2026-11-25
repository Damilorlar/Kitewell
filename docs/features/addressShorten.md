# Address shortener

`frontend/src/addressShorten.js` shortens a Stellar `G...` public key for
compact display, for example `GABC...WXYZ`. Prefix and suffix lengths are
configurable and the input is validated. The module is standalone; wallet and
UI integration (`App.jsx`, `freighter.js`, `stellar.js`) is out of scope.

## What it does

- Trims surrounding whitespace from the address.
- Validates that the value is a `G`-prefixed, base32 (`A–Z`, `2–7`) Stellar
  public key. The StrKey checksum is not verified.
- Keeps `prefixLength` characters from the start and `suffixLength` characters
  from the end, joining them with a single `…` ellipsis.
- Returns the address unchanged when it already fits within
  `prefixLength + suffixLength`.
- Throws an `Error` with a user-facing message for missing, malformed, or
  non-string input and for invalid length options.

## Public API

### `shortenAddress(address, options)`

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `address` | `string` | — | Stellar `G...` public key (trimmed before validation) |
| `options.prefixLength` | `number` | `6` | Characters kept from the start |
| `options.suffixLength` | `number` | `6` | Characters kept from the end |

```js
import { shortenAddress } from "./addressShorten";

shortenAddress("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
// => "GAAAAA…AAAWHF"

shortenAddress("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", {
  prefixLength: 4,
  suffixLength: 4,
});
// => "GAAA…AWHF"

shortenAddress("GABCDEFGHIJKL", { prefixLength: 0, suffixLength: 4 });
// => "…IJKL"
```

Throws when:

| Condition | Message |
| --- | --- |
| `address` is not a string | `Address must be a string.` |
| `address` is empty or whitespace-only | `Address is required.` |
| `address` is not a canonical G... key | `Invalid Stellar address. Expected a G... public key.` |
| A length is negative, fractional, or not a number | `<option> must be a non-negative integer.` |
| Both lengths are `0` | `prefixLength and suffixLength cannot both be 0.` |

### Constants

- `ELLIPSIS` — the `…` character inserted between the kept parts.
- `DEFAULT_PREFIX_LENGTH` — `6`.
- `DEFAULT_SUFFIX_LENGTH` — `6`.

## Notes

- `frontend/src/addressFormat.js` remains the lenient helper for arbitrary
  identifiers; this module is the validated, Stellar-specific variant.
- Tests live next to the module in `frontend/src/addressShorten-*.test.js` and
  run with `npm test` from `frontend/`.
