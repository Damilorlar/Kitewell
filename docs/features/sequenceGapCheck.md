# Sequence Gap Check

A pure, standalone frontend utility for detecting stale account sequence numbers on Stellar.

## Overview

On Stellar, every account has a sequence number that increments by 1 with each successful transaction. When building transactions locally (e.g., for Freighter signing), the SDK uses a cached sequence number. If the account submits transactions elsewhere before the locally-built transaction is submitted, the cached sequence becomes stale and the transaction will fail with `tx_bad_seq`.

This module compares a cached sequence against a freshly fetched on-chain sequence to detect staleness before signing, preventing avoidable submission failures.

## Installation

```js
import { checkSequenceGap, isSequenceFresh } from "./sequenceGapCheck";
```

## API

### `checkSequenceGap(cachedSequence, currentSequence)`

Compare a cached sequence number against the current on-chain sequence.

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cachedSequence` | `string \| number` | The sequence number from the local cache. |
| `currentSequence` | `string \| number` | The sequence number freshly fetched from Horizon (e.g., via `server.loadAccount(publicKey).then(a => a.sequenceNumber())`). |

**Returns**

`Promise<SequenceGapResult>` — an object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `stale` | `boolean` | `true` when `cached < current` (cache is out of date). |
| `cached` | `string` | Normalized cached sequence. |
| `current` | `string` | Normalized current sequence. |
| `gap` | `number` | `current - cached` when `stale` is true; otherwise `0`. |

**Throws**

- `Error("Cached sequence is required.")` — when `cachedSequence` is `undefined`, `null`, or empty string.
- `Error("Current sequence is required.")` — when `currentSequence` is `undefined`, `null`, or empty string.
- `Error("Cached sequence must be a non-negative integer.")` — when `cachedSequence` is not a valid non-negative integer string/number.
- `Error("Current sequence must be a non-negative integer.")` — when `currentSequence` is not a valid non-negative integer string/number.

**Example**

```js
// Cache is fresh
checkSequenceGap("100", "100");
// => { stale: false, cached: "100", current: "100", gap: 0 }

// Cache is stale by 3 transactions
checkSequenceGap("100", "103");
// => { stale: true, cached: "100", current: "103", gap: 3 }
```

---

### `isSequenceFresh(cachedSequence, currentSequence)`

Convenience wrapper that returns a simple boolean indicating whether the cache is up to date.

**Parameters**

Same as `checkSequenceGap`.

**Returns**

`boolean` — `true` when `cached === current` (cache is fresh), `false` otherwise.

**Throws**

Same validation errors as `checkSequenceGap`.

**Example**

```js
isSequenceFresh("100", "100"); // => true
isSequenceFresh("100", "101"); // => false
```

## Usage Example

```js
import { checkSequenceGap } from "./sequenceGapCheck";
import { getServer } from "./stellar";

async function buildAndSubmitPayment(sourcePublicKey, ...args) {
  // 1. Load fresh account from Horizon
  const account = await getServer().loadAccount(sourcePublicKey);
  const currentSeq = account.sequenceNumber();

  // 2. Compare with cached sequence (if any)
  const cachedSeq = localStorage.getItem(`seq:${sourcePublicKey}`) || "0";
  const gap = checkSequenceGap(cachedSeq, currentSeq);

  if (gap.stale) {
    console.warn(`Sequence gap detected: ${gap.gap} transaction(s) since cache.`);
    // Option: refresh UI, re-fetch, or prompt user
  }

  // 3. Build transaction with the fresh sequence
  // (TransactionBuilder uses the account object which has the current sequence)
  // ...

  // 4. After successful submission, update cache
  // localStorage.setItem(`seq:${sourcePublicKey}`, newSequence);
}
```

## Design Notes

- **Pure functions** — No side effects, no network calls, no global state. Easy to test and reuse.
- **BigInt-safe** — Uses `BigInt` internally for arithmetic, so it handles the full `u64` range of Stellar sequence numbers (up to `18446744073709551615`) without precision loss.
- **Input normalization** — Accepts strings or numbers; trims whitespace; validates non-negative integer format.
- **Error messages** — Human-readable, suitable for direct display in toasts or logs.
- **Zero-dependency** — Only uses standard JavaScript/TypeScript; no Stellar SDK or other deps.

## Testing

Run the Vitest suite from the frontend directory:

```bash
cd frontend
npm test
```

Test files (one behavior per file):

| File | Covers |
|------|--------|
| `sequence-gap-fresh.test.js` | Cache matches current (stale=false, gap=0) |
| `sequence-gap-stale.test.js` | Cache behind current (stale=true, gap>0) |
| `sequence-gap-cached-empty.test.js` | Missing/invalid cached input |
| `sequence-gap-current-empty.test.js` | Missing/invalid current input |
| `sequence-gap-nonnumeric.test.js` | Non-numeric strings, decimals, negatives, exponents |
| `sequence-gap-boundary.test.js` | Boundary values (gap=1, u64 max, zero) |
| `sequence-gap-fresh-wrapper.test.js` | `isSequenceFresh` boolean wrapper |
| `sequence-gap-error-cases.test.js` | Cached > current, BigInt precision, negative numbers |
| `sequence-gap-whitespace.test.js` | Whitespace trimming, number/string equivalence |
| `sequence-gap-zero-edge.test.js` | Zero as cached/current, string/number zero equivalence |

## When to Use

- **Before signing** a Freighter transaction, to warn the user if their cached sequence is stale.
- **In background sync** logic that periodically refreshes the local sequence cache.
- **In testing** to simulate sequence gaps and verify UI error handling.

## When Not to Use

- **As a replacement for Horizon's sequence** — Always fetch the current sequence from Horizon (`server.loadAccount`) immediately before building a transaction. This module only *compares*; it does not fetch.
- **For Mainnet without adaptation** — The module is network-agnostic, but the surrounding code (Horizon URLs, etc.) must match the target network.