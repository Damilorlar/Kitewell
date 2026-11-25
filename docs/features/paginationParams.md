# Pagination query parameters

`backend/src/paginationParams.js` parses `limit` and `cursor` from a query object. It is a standalone helper: nothing in `app.js`, `index.js`, or the Express routes imports it yet.

## Public API

```js
import { parsePaginationParams } from "./paginationParams.js";

parsePaginationParams(query, options?)
// => { limit: number, cursor: string | null }
```

`query` is a plain object (the same shape as `req.query`). `null` and `undefined` count as an empty query. Any other non-object throws `PaginationError` with code `invalid_query`.

### Defaults

| Option | Default | Meaning |
| --- | --- | --- |
| `minLimit` | `1` | Inclusive lower bound for `limit` |
| `maxLimit` | `200` | Inclusive upper bound for `limit` |
| `defaultLimit` | `20` | Used when `limit` is missing |

Pass an options object to override any of the three. Every override must be a safe integer. `minLimit` cannot be greater than `maxLimit`, and `defaultLimit` must lie inside that inclusive range. A bad options object throws code `invalid_options`. `minLimit === maxLimit` is allowed when `defaultLimit` equals that value.

### `limit`

| Input | Result |
| --- | --- |
| Missing (`undefined` or `null`) | `defaultLimit` |
| Integer inside `[minLimit, maxLimit]` | That integer |
| Integer below `minLimit` or above `maxLimit` | Throws `limit_out_of_range` |
| Non-integer or non-numeric | Throws `invalid_limit` |

String values are trimmed. A leading `+` or `-` is allowed, and the text must be a base-10 integer (`"20"`, `"-1"`). Decimals (`"20.5"`), scientific notation (`"1e2"`), and blank strings are `invalid_limit`. A negative integer such as `"-1"` is numeric, so it fails the range check (`limit_out_of_range`) instead.

### `cursor`

| Input | Result |
| --- | --- |
| Missing (`undefined` or `null`) | `null` |
| Empty or whitespace-only | `null` |
| String whose trimmed length is 1..256 | Trimmed string |
| Trimmed length greater than 256 | Throws `invalid_cursor` |
| Present but not a string | Throws `invalid_cursor` |

The length check runs after trimming, so surrounding spaces do not count toward the 256 character cap.

## Errors

`backend/src/paginationParamsErrors.js` exports `PaginationError`. It is an `Error` with a stable `code` string:

- `invalid_query`
- `invalid_options`
- `invalid_limit`
- `limit_out_of_range`
- `invalid_cursor`

Branch on `code`. Message text is for logs and responses.
