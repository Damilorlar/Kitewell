# Stellar address format validator

`backend/src/addressValidate.js` exports `isValidStellarAddress(address)`.
It returns a boolean and never needs network access. The function accepts only
primitive strings with the 56-character, uppercase, unpadded base32 format of
a Stellar Ed25519 public key (`G...`). It checks the full `0x30` version byte,
which appears as `GA`, `GB`, `GC`, or `GD` at the start of the encoded string.
Invalid values, including non-strings, return `false` without coercion.

```js
import { isValidStellarAddress } from "../../backend/src/addressValidate.js";

isValidStellarAddress("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"); // true
isValidStellarAddress(null); // false
```

This is a **format check**. It does not verify the StrKey checksum, confirm the
public key is usable, or check whether an account exists. Use the Stellar SDK's
`StrKey.isValidEd25519PublicKey` when checksum validation is needed. The module
is standalone and is not wired into the backend routes.

Format reference: [SEP-23 Strkey](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md).
