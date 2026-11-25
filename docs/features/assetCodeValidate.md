# Classic asset code validation

`backend/src/assetCodeValidate.js` checks a Stellar classic asset code. It does not import `@stellar/stellar-sdk` and it does not call Horizon. The HTTP app does not use it; `app.js` is unchanged.

## Rules

A code is valid only when every rule below holds:

| Rule | Valid | Invalid |
| --- | --- | --- |
| Type | string | `null`, numbers, objects, arrays, missing |
| Length | 1 through 12 inclusive | empty string, 13 or more |
| Charset | `A-Z` and `0-9` | lowercase, hyphen, underscore, space, other symbols |

Length boundaries:

- `A` (length 1) is valid
- `ABCDEFGHIJKL` (length 12) is valid
- `""` (length 0) is invalid
- `ABCDEFGHIJKLM` (length 13) is invalid

The helper does not trim and does not rewrite case. `"usdc"` is invalid; it is not turned into `"USDC"`.

## API

```js
import { isValidAssetCode, validateAssetCode } from "./assetCodeValidate.js";

validateAssetCode("USDC");
// { ok: true, code: "USDC" }

validateAssetCode("usdc");
// { ok: false, error: "Asset code must contain only uppercase A-Z and digits 0-9" }

isValidAssetCode("USDC"); // true
isValidAssetCode(null);   // false
```

`validateAssetCode(code)` returns `{ ok: true, code }` or `{ ok: false, error }`. It does not throw on invalid input. `isValidAssetCode(code)` is the boolean form and is true only when validation succeeds.

Constants (`ASSET_CODE_MIN_LENGTH`, `ASSET_CODE_MAX_LENGTH`, `ASSET_CODE_CHARSET`, `ASSET_CODE_ERROR`) live in `backend/src/assetCodeValidateConstants.js`.

## Tests

`npm test` from `backend/` runs the node:test files:

- `assetCodeValidate-happy.test.js`
- `assetCodeValidate-charset.test.js`
- `assetCodeValidate-length.test.js`
- `assetCodeValidate-boundary.test.js`
- `assetCodeValidate-type.test.js`
- `assetCodeValidate-lowercase.test.js`
- `assetCodeValidate-predicate.test.js`
