# Error response shape

`backend/src/errorResponseShape.js` exports `formatErrorResponse(code, message)`.
It creates a plain JSON-ready body with a consistent error shape:

```js
formatErrorResponse("INVALID_ADDRESS", "Invalid Stellar public key");
// { error: { code: "INVALID_ADDRESS", message: "Invalid Stellar public key" } }
```

Both arguments are strings and are trimmed. An omitted or whitespace-only
`code` becomes `"UNKNOWN_ERROR"`; an omitted or whitespace-only `message`
becomes `"An unexpected error occurred."`. Supplying any other type, including
`null` or an `Error` object, throws a `TypeError`. Pass a deliberate public
message rather than an internal error object.

The formatter only builds a response body. It does not choose an HTTP status or
send a response, and no route uses it yet.
