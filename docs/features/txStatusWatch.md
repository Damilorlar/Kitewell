# Transaction status watch

`frontend/src/txStatusWatch.js` follows a transaction hash until the network
settles it, for issue #513: after a submit the lab has a hash, and a
transaction still in the queue must not look like one that failed a minute
later.

The **Transaction status** panel `App.jsx` shows under Assets, Send, Path,
History and Lab drives this module: every submit hands the returned hash to
`watchTransactionStatus`, and the same panel takes a pasted hash. The Horizon
read, the clock, the timer, the explorer link builder and the network
passphrase are injected, so the polling rules are tested in the Node test
environment without waiting on a real network.

## Public API

### `TX_STATUSES`

Frozen list, in the order a transaction moves through them: `pending`,
`success`, `failed`, `expired`.

### `TX_POLL_INTERVAL_MS` / `TX_WATCH_WINDOW_MS`

`2000` ms between reads, the interval `./freighter.js` already polls Soroban
with, and `180000` ms as the watch length when no max time is known — the same
horizon the lab's own `setTimeout(180)` puts on a transaction.

### `normaliseTxHash(hash)`

Trimmed, lowercase 64-hex hash. Anything else throws `Transaction hash must be
64 hexadecimal characters.` — the same rule `./explorerLink.js` applies.

### `deadlineFromEnvelope(envelopeXdr, { networkPassphrase })`

The absolute millisecond the envelope's `timeBounds.maxTime` falls on, or `null`
when it has none (`TimeoutInfinite`, or a max time of `0`). A fee bump carries
its timeout on the transaction inside it, so that is read too. Unreadable XDR
throws `The transaction envelope could not be read.`

### `txStatusFromRecord(record)`

`{ status, code, operationCodes }` from a Horizon transaction resource:
`success` when `successful === true`, `failed` otherwise, with
`result_codes.transaction` as the code and `result_codes.operations` kept in
order. Nothing is invented when Horizon sends no result codes: `code` is `null`
and `operationCodes` is `[]`.

### `watchTransactionStatus(options)`

Polls until the transaction settles.

| Option | Default | Meaning |
| --- | --- | --- |
| `hash` | — | Transaction to follow, validated first. |
| `loadTransaction` | `server.transactions().transaction(hash).call()` on the active network | One read. `.transaction(hash)` only builds the request; Horizon answers at `.call()`. |
| `deadlineMs` | — | Absolute stop time; wins over `envelopeXdr`. |
| `envelopeXdr` | — | Envelope to read the max time from. |
| `windowMs` | `TX_WATCH_WINDOW_MS` | Watch length when no max time is known. |
| `intervalMs` | `TX_POLL_INTERVAL_MS` | Delay between reads. |
| `nowMs`, `sleep` | `Date.now`, `setTimeout` | Clock and timer. |
| `networkPassphrase` | active network | For `envelopeXdr`. |
| `networkId` | active network | Network the explorer link points at. |
| `explorerUrlFor` | `buildTransactionExplorerUrl(networkId, hash)` | Explorer link. |
| `onUpdate` | — | Called with every snapshot, including the last. |

Each read produces `{ hash, explorerUrl, attempts, status, code,
operationCodes }`:

- a record answers with `success` or `failed`, and the watch stops;
- a transaction nobody has heard of keeps being `pending` **while its max time
  is still in the future**, and becomes `expired` on the first read at or after
  that max time;
- only `pending` waits `intervalMs` for another read, so the three stopping
  conditions are the only ways out.

A 404 is `StellarSdk.NotFoundError` or a response with `status: 404`. Any other
read failure stops the watch with `The transaction watch could not read the
transaction: <reason>.`, keeping the original error as `cause`. A deadline that
cannot be reached throws `The transaction watch needs a deadline in
milliseconds.` before the first read.

### `txStatusPresentation(snapshot)`

`{ status, text, explorerUrl }` with one line per state:

| Status | Line |
| --- | --- |
| `pending` | `Waiting for the network to confirm this transaction.` |
| `success` | `The transaction is on the ledger.` |
| `failed` | `The transaction failed: <code> / <first operation code>.`, or `The transaction failed.` with no codes |
| `expired` | `Nothing reached the ledger before the transaction's max time, so it never landed.` |

A status outside `TX_STATUSES` throws `Unknown transaction status: <status>`.

## Tests

`frontend/src/tx-status-watch-*.test.js` (hash, deadline, record reading, the
polling walks, the two ways a watch starts, presentation). The two walks the
issue asks for are `walks pending then success` and `walks pending then expiry`
in `tx-status-watch-poll.test.js`. `tx-status-watch-flow.test.js` stubs the
call builder the way Horizon's does — the record only arrives from `.call()` —
so a default loader that forgets to call it reads nothing and the test fails.
Run with `npm test -w frontend`.
