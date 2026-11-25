# Request id middleware

`backend/src/requestIdMiddleware.js` is an Express-compatible middleware that
assigns a correlation id to every incoming request. It is standalone: it is not
wired into `app.js`, `index.js`, or any route yet, and it imports no Express
code, so it can be unit-tested with plain request/response objects.

## What it does

1. Reads the inbound `X-Request-Id` header (configurable).
2. Reuses it when it is a safe id (`[A-Za-z0-9._-]{1,128}`); otherwise
   generates a new UUID with `crypto.randomUUID`.
3. Exposes the id as `req.id`, `req.requestId`, and `res.locals.requestId`.
4. Sets the id on the response header so clients can quote it in bug reports.
5. On the response `finish` event, writes one JSON log line:

```json
{
  "ts": "2026-10-21T10:00:00.000Z",
  "level": "info",
  "requestId": "6f1a1b2c-3d4e-5f60-7a8b-9c0d1e2f3a4b",
  "method": "GET",
  "path": "/health",
  "status": 200,
  "ms": 3
}
```

## Public API

### `createRequestIdMiddleware(options)`

Returns the middleware `(req, res, next)`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `headerName` | `string` | `"X-Request-Id"` | Header read and written |
| `generate` | `() => string` | `crypto.randomUUID` | Id generator |
| `logger` | `object \| Function` | `console` | `console`-like object (`info`/`log`) or a function receiving the JSON line |
| `now` | `() => number` | `Date.now` | Clock used for the `ms` field |

```js
import express from "express";
import { createRequestIdMiddleware } from "./requestIdMiddleware.js";

const app = express();
app.use(createRequestIdMiddleware());
```

Throws at construction time when `headerName` is blank, `generate` is not a
function, or `now` is not a function.

### `requestIdMiddleware`

A ready-to-use instance created with the default options.

### `isValidRequestId(value)`

Returns `true` for a string of 1–128 characters from `[A-Za-z0-9._-]`.
Whitespace, header-injection attempts, arrays, and non-strings return `false`.

### Constants

- `REQUEST_ID_HEADER` — `"X-Request-Id"`.
- `MAX_REQUEST_ID_LENGTH` — `128`.

## Behaviour notes

- Invalid inbound ids are replaced, never echoed back.
- A throwing logger is swallowed so logging can never break a response.
- A throwing `generate` propagates to the caller (and would be handled by
  Express's error middleware once the module is wired in).
- Tests live in `backend/src/requestIdMiddleware-*.test.js` and run with
  `npm test` from `backend/`.
