# Memo builder

`frontend/src/memoBuilder.js` validates and builds Stellar SDK Memo objects for
text, ID, and hash memo types. All builders return a typed result instead of
throwing SDK validation errors.

## API

- `buildTextMemo(text)` returns a text Memo or `TEXT_TOO_LONG` when UTF-8 content
  exceeds 28 bytes. Empty text is accepted.
- `buildIdMemo(id)` accepts a safe integer number, decimal digit string, or
  bigint from zero through `2^64 - 1`.
- `buildHashMemo(hash)` accepts 32 bytes or a 64-character hex string.

Successful results have the shape `{ ok: true, value: Memo }`. Failures have the
shape `{ ok: false, error: { code, message } }`.