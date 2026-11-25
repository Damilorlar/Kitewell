# Signer weight validation

`backend/src/signerWeightValidate.js` validates a Stellar signer weight value.
It does not import `@stellar/stellar-sdk` and does not call Horizon. The HTTP
app does not use it; `app.js` is unchanged.

## Rules

A signer weight is valid only when every rule below holds (checked in order):

| Rule | Valid | Invalid |
| --- | --- | --- |
| Type | `number` | strings, `null`, `undefined`, booleans, BigInt, objects, arrays |
| Integer | finite integer (`Number.isInteger`) | `NaN`, `Infinity`, `-Infinity`, fractions |
| Range | `0`–`255` inclusive | `-1`, `256`, any value outside `[0, 255]` |

Boundary values:

- `0` is valid (a weight of 0 effectively removes the signer)
- `255` is valid (the 8-bit maximum)
- `-1` is invalid (one below the minimum)
- `256` is invalid (one above the maximum)

The helper does not coerce input. `"10"` is rejected with a type error; it is
not turned into the number `10`. `true` is not treated as `1`.

## API

```js
import {
  isValidSignerWeight,
  validateSignerWeight,
} from "./signerWeightValidate.js";

validateSignerWeight(10);
// { ok: true, weight: 10 }

validateSignerWeight(1.5);
// { ok: false, error: "Signer weight must be an integer" }

validateSignerWeight("10");
// { ok: false, error: "Signer weight must be a number" }

validateSignerWeight(256);
// { ok: false, error: "Signer weight must be between 0 and 255" }

isValidSignerWeight(1);    // true
isValidSignerWeight(null); // false
```

`validateSignerWeight(weight)` returns `{ ok: true, weight }` or
`{ ok: false, error }`. It never throws on invalid input.
`isValidSignerWeight(weight)` is the boolean form — `true` only when
validation succeeds.

Constants (`SIGNER_WEIGHT_MIN`, `SIGNER_WEIGHT_MAX`, `SIGNER_WEIGHT_ERROR`)
live in `backend/src/signerWeightValidateConstants.js`.

## Tests

`npm test` from `backend/` runs the `node:test` files:

- `signerWeightValidate-happy.test.js`
- `signerWeightValidate-type.test.js`
- `signerWeightValidate-integer.test.js`
- `signerWeightValidate-range.test.js`
- `signerWeightValidate-boundary.test.js`
- `signerWeightValidate-predicate.test.js`
- `signerWeightValidate-no-coerce.test.js`
- `signerWeightValidate-error-shape.test.js`
