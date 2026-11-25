# Stable asset keys

`frontend/src/assetKey.js` builds deterministic map keys for Stellar assets.
Native XLM uses `native`; issued assets use `CODE:ISSUER`, matching the
application's existing balance key shape.

## API

- `buildAssetKey(asset)` accepts a Horizon asset record, a UI descriptor
  (`{ isNative, code, issuer }`), or an SDK `Asset`. It returns the canonical
  key or `null` for malformed/unsupported input.
- `isNativeAssetKey(key)` returns `true` only for the exact `native` key.
- `splitAssetKey(key)` parses a canonical key into a native or issued-asset UI
  descriptor, or returns `null` when invalid.

Issued asset code casing is preserved. Asset codes must be 1-12 ASCII
alphanumeric characters, and issuers must match the 56-character Stellar
account StrKey shape. This module does not change existing balance handling.