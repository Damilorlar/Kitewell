# Muxed account address splitter

`backend/src/muxedAddressSplit.js` exports two pure, network-free utilities for
working with Stellar muxed account addresses (M...).

## Background

A Stellar **muxed account** (defined in
[SEP-23](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md))
encodes two pieces of information inside a single M... StrKey string:

1. A base Ed25519 public key — the normal on-chain G... account address.
2. A 64-bit unsigned integer **id** — a virtual sub-account discriminator,
   allowing multiple logical accounts to share the same on-chain balance.

This module provides the two inverse operations:

- **split** — decode an M... address into its G... base address and numeric id.
- **build** — encode a G... address and a numeric id into an M... address.

The module is standalone and is not wired into `app.js`, `index.js`, or any
route yet. Integration is a separate, later issue.

---

## Public API

### `splitMuxedAddress(muxedAddress)`

Splits an M... muxed account address into its components.

```js
import { splitMuxedAddress } from "../../backend/src/muxedAddressSplit.js";

const { gAddress, id } = splitMuxedAddress(
  "MAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALR6"
);
// gAddress → "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
// id       → 42n  (BigInt)
```

**Parameters**

| Name           | Type     | Description                          |
|----------------|----------|--------------------------------------|
| `muxedAddress` | `string` | A valid Stellar muxed account (M...) |

**Returns** `{ gAddress: string, id: bigint }`

| Field      | Type     | Description                            |
|------------|----------|----------------------------------------|
| `gAddress` | `string` | The base Ed25519 public key (G...)     |
| `id`       | `bigint` | The uint64 sub-account id              |

**Throws**

| Type        | When                                                    |
|-------------|---------------------------------------------------------|
| `TypeError` | `muxedAddress` is not a `string`                        |
| `Error`     | `muxedAddress` is not a valid M... address              |

---

### `buildMuxedAddress(gAddress, id)`

Combines a G... base address and a numeric id into an M... muxed address.

```js
import { buildMuxedAddress } from "../../backend/src/muxedAddressSplit.js";

const mAddress = buildMuxedAddress(
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  42n                  // also accepts number or decimal string
);
// → "MAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALR6"
```

**Parameters**

| Name       | Type                          | Description                            |
|------------|-------------------------------|----------------------------------------|
| `gAddress` | `string`                      | A valid Stellar Ed25519 public key     |
| `id`       | `BigInt` \| `number` \| `string` | The uint64 sub-account id (non-negative decimal) |

The `id` may be supplied as:
- A `BigInt` — used directly.
- A safe non-negative `number` integer — converted to `BigInt`.
- A decimal `string` of digits — converted to `BigInt` (no `0x` prefix, no
  `.`, no sign character).

**Returns** `string` — the corresponding M... muxed account address.

**Throws**

| Type        | When                                                              |
|-------------|-------------------------------------------------------------------|
| `TypeError` | `gAddress` is not a `string`                                      |
| `Error`     | `gAddress` is not a valid G... Ed25519 public key                 |
| `TypeError` | `id` is `null`, `undefined`, a float, a negative number, `NaN`,  |
|             | `Infinity`, a BigInt `< 0`, or a non-decimal string               |
| `Error`     | `id` exceeds the uint64 maximum (2^64 − 1)                        |

---

## Round-trip guarantee

`splitMuxedAddress(buildMuxedAddress(g, id))` always returns the original
`gAddress` and `id`. Likewise `buildMuxedAddress(...splitMuxedAddress(m))`
reproduces the original M... string exactly.

---

## Usage notes

- `id` is always returned as `BigInt` by `splitMuxedAddress`, even for small
  values, because uint64 can exceed `Number.MAX_SAFE_INTEGER`.
- Neither function validates that the G... account exists on-chain.
- Neither function touches the network or reads `process.env`.
- The underlying encoding is handled by `@stellar/stellar-sdk`'s `StrKey`
  codec (`encodeMed25519PublicKey` / `decodeMed25519PublicKey`).
