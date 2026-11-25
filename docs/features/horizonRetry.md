# Horizon call retry wrapper

`backend/src/horizonRetry.js` is a standalone utility that wraps a Horizon
fetch call with retry and exponential backoff, up to a configurable
max-attempt count.

It is not wired into `app.js`, `index.js`, or any Express route in this
change — that integration is left for a later issue.

## Public API

### `withHorizonRetry(fn, options?)`

Calls `fn(attempt)` (1-indexed) and returns its resolved value on
success. On rejection, retries with an exponentially growing delay until
`options.maxAttempts` is reached or `options.shouldRetry(error)` returns
`false`, whichever comes first — then rethrows the last error.

Options (all optional):

- `maxAttempts` (default `3`) — total attempts including the first; must
  be an integer `>= 1`, otherwise the call rejects with a `RangeError`
  before `fn` is ever called.
- `baseDelayMs` (default `200`) — delay before the 2nd attempt.
- `factor` (default `2`) — multiplier applied to the delay after each
  failed attempt.
- `maxDelayMs` (default `Infinity`) — upper bound on any single delay.
- `shouldRetry(error)` (default: always retry) — return `false` to stop
  retrying immediately.
- `sleep(ms)` (default: a real `setTimeout`-based delay) — injectable,
  primarily for tests.

```js
import { withHorizonRetry } from "./horizonRetry.js";

const account = await withHorizonRetry(
  () => fetch(`${horizonUrl}/accounts/${id}`).then((r) => r.json()),
  { maxAttempts: 4, baseDelayMs: 300 }
);
```

### `computeRetryDelayMs(attempt, baseDelayMs?, factor?, maxDelayMs?)`

Computes the delay (ms) before the attempt that follows the given one:
`min(baseDelayMs * factor ** (attempt - 1), maxDelayMs)`.

### Constants

`DEFAULT_MAX_ATTEMPTS` (`3`), `DEFAULT_BASE_DELAY_MS` (`200`),
`DEFAULT_FACTOR` (`2`).
