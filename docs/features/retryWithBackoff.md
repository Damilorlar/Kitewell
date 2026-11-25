# Generic async retry helper

`frontend/src/retryWithBackoff.js` is a pure, standalone utility that
retries an async function with exponential backoff, up to a configurable
max-attempt cap. It is intended for flaky Horizon calls.

It is not wired into `App.jsx`, `freighter.js`, or `stellar.js` in this
change — that integration is left for a later issue.

## Public API

### `retryWithBackoff(fn, options?)`

Calls `fn(attempt)` (1-indexed) and returns its resolved value on
success. On rejection, retries with an exponentially growing delay until
`options.maxAttempts` is reached or `options.shouldRetry(error)` returns
`false`, whichever comes first — then rethrows the last error.

Options (all optional):

- `maxAttempts` (default `3`) — total attempts including the first; must
  be an integer `>= 1`, otherwise the call rejects with a `RangeError`.
- `baseDelayMs` (default `200`) — delay before the 2nd attempt.
- `factor` (default `2`) — multiplier applied to the delay after each
  failed attempt.
- `maxDelayMs` (default `Infinity`) — upper bound on any single delay.
- `shouldRetry(error)` (default: always retry) — return `false` to stop
  retrying immediately.
- `sleep(ms)` (default: a real `setTimeout`-based delay) — injectable,
  primarily for tests.

```js
import { retryWithBackoff } from "./retryWithBackoff";

const payments = await retryWithBackoff(
  () => horizonServer.payments().forAccount(id).call(),
  { maxAttempts: 4, baseDelayMs: 300 }
);
```

### `computeBackoffDelay(attempt, baseDelayMs?, factor?, maxDelayMs?)`

Computes the delay (ms) before the attempt that follows the given one:
`min(baseDelayMs * factor ** (attempt - 1), maxDelayMs)`.
