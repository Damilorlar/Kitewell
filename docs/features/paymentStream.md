# Live payment stream

`frontend/src/paymentStream.js` streams payments for the connected account
(Horizon's `/accounts/<id>/payments` Server-Sent Events stream) for issue #512.

The **History** tab of `App.jsx` drives this module: it opens the stream while
an account is connected and the tab is showing, names the reason when it
closes, and merges streamed payments into the paged list. An SSE stream needs a
browser `EventSource`, so the transport (`createEventSource` / `openStream`),
the Horizon URL lookup and the render hook are injected and the rules below are
tested in the Node test environment. Streamed records map to exactly the fields
`getTransactions` in `./stellar.js` already returns, so a streamed payment and
a paged payment render the same way.

## Public API

### `PAYMENT_STREAM_REASONS`

Frozen list of the reasons the panel closes a stream: `disconnect`,
`network-change`, `tab-hidden`.

### `paymentsStreamUrl(horizonUrl, publicKey, { cursor, limit })`

`<horizonUrl>/accounts/<G…>/payments?limit=50&cursor=now`. `limit` defaults to
50; a blank or missing `cursor` becomes `now`, which starts at the current
ledger instead of replaying history. A trailing slash on the Horizon URL is
removed. Throws `There is no Horizon URL to stream payments from.` and
`Connect a valid Stellar account (G…) first.`

### `mapStreamPayment(event)`

`{ id, from, to, amount, asset_type, asset_code, transaction_hash, created_at }`
for a `type: "payment"` event, `null` for anything else. `asset_code` falls back
to `XLM` for native payments; no other field is invented.

### `openPaymentsStream({ url, createEventSource, onRecord, onError, onClose })`

Opens one event source and returns `{ close() }`. `close()` closes the source,
calls `onClose` and returns `true`; a second call returns `false` and does not
close or report again. Each `message` event is JSON-parsed and handed to
`onRecord`; unreadable JSON becomes `onError(new Error("The payments stream sent
an unreadable record."))` rather than an exception in the caller's listener. A
transport error is forwarded as the event's own `error`, or as a one-line
`Error` from the event's `message`, or `The payments stream failed.`

With no injected factory it uses `globalThis.EventSource`, and refuses to
invent one when the session has none: `This session cannot open an event
stream.` Other refusals: `There is no payments stream URL to open.`,
`The payments stream transport is not usable.`

### `createPaymentStreamController({ openStream, horizonUrlFor, onChange })`

The object the history tab drives. `horizonUrlFor` defaults to the active
network's Horizon URL from `./network.js`.

| Method | Behaviour |
| --- | --- |
| `start({ publicKey, networkId, cursor })` | Opens the stream; returns `{ reused, networkId, account, url }`. The same account and network reuse the open stream and report `reused: true`; a network switch or a new account closes the previous stream first, after the new URL is validated. |
| `stop(reason)` | Closes the stream, names the reason, returns whether a stream was open. An unknown reason throws `Unknown payments stream reason: <reason>`. |
| `ingest(event)` | Adds a payment to the front of the list. Duplicate paging tokens are refused, non-payment events are ignored, and a record with neither `id` nor `paging_token` fails the stream. Returns whether the list changed. |
| `fail(error)` | Keeps every payment already streamed and shows one failure line. |
| `getRecords()` | A copy of the list, newest first. |
| `getState()` | `{ status, failure, reason, networkId, account }`, where `status` is `idle`, `open`, `closed` or `error`. |
| `isOpen()` | Whether a stream is live. |

The failure line is `Payments stream failed: <the error on one line>`, or
`Payments stream failed: no reason given.` when the error carries nothing to
show. A multi-line error is joined onto a single line so the panel never
reflows, and the failure clears as soon as a payment arrives again.

## Tests

`frontend/src/payment-stream-*.test.js` (URL, mapping against a real paged
record, list rules, transport, lifecycle, errors). Run with
`npm test -w frontend`.
