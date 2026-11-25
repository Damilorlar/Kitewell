# Request timeout middleware

`requestTimeout` is a standalone Express middleware factory. It limits how long a single request may run. If the handler has not started sending a response when the limit is reached, the middleware answers with HTTP 408 and a JSON body instead of leaving the client hanging.

The module is not mounted by `app.js`, `index.js`, or any route. Callers attach the returned handler themselves.

## Public API

### `requestTimeout(timeoutMs, options)`

Defined in `backend/src/requestTimeout.js`.

| Argument | Required | Description |
| --- | --- | --- |
| `timeoutMs` | yes | Positive integer duration in milliseconds. |
| `options` | no | Timer overrides. Omitted, `undefined`, and `null` all use the global timers. |

`options` fields:

| Field | Default | Description |
| --- | --- | --- |
| `setTimer` | global `setTimeout` | Schedules the timeout callback. Signature `(fn, ms) => handle`. |
| `clearTimer` | global `clearTimeout` | Cancels a handle returned by `setTimer`. |

Returns `(req, res, next) => void`.

Behavior of the returned handler:

1. Arm one timer for this request only.
2. Listen for `res` `finish` and `close`. Either event clears the timer.
3. Call `next()` so the rest of the route still runs.
4. If the timer fires and `res.headersSent` is false, respond with `res.status(408).json({ error: "request_timeout", timeoutMs })`.
5. If `res.headersSent` is already true, leave the response untouched.

Invalid `timeoutMs` throws `RequestTimeoutError` from the factory. The factory does not return middleware and does not start a timer.

Rejected values:

| Input | `reason` |
| --- | --- |
| Not a number (`undefined`, `null`, strings, objects, booleans) | `invalid-type` |
| `NaN`, `Infinity`, `-Infinity` | `non-finite` |
| Fractional numbers such as `1.5` | `non-integer` |
| `0`, `-0`, and negative integers | `non-positive` |

`1` is the smallest accepted timeout. `Number.MAX_SAFE_INTEGER` is accepted.

### `RequestTimeoutError`

Defined in `backend/src/requestTimeoutErrors.js` and re-exported from `requestTimeout.js`.

Subclass of `Error`. Instances set `name` to `"RequestTimeoutError"` and include:

| Property | Meaning |
| --- | --- |
| `message` | Why the timeout was rejected. |
| `timeoutMs` | The value that failed validation. |
| `reason` | `invalid-type`, `non-finite`, `non-integer`, or `non-positive`. |

## Example

```js
import { requestTimeout } from "./requestTimeout.js";

const limit = requestTimeout(5_000);

app.get("/reports/:id", limit, async (req, res) => {
  const report = await loadReport(req.params.id);
  res.json(report);
});
```

A request that is still silent after 5000ms receives:

```json
{ "error": "request_timeout", "timeoutMs": 5000 }
```

A handler that calls `res.json` (or otherwise ends the response) before the deadline never receives that body. The `finish` or `close` event cancels the timer.
