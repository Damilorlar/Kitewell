# Path Payment Quote

A pure, standalone frontend utility for building path payment operation payloads from form state.

## Overview

The Stellar network supports two types of path payments:
- **Strict Send** — Fix the amount sent (`sendAmount`), set a minimum received (`destMin`)
- **Strict Receive** — Fix the amount received (`destAmount`), set a maximum sent (`sendMax`)

This module transforms a path-payment form state object into the exact payload shape required by the Stellar SDK's `Operation.pathPaymentStrictSend` or `Operation.pathPaymentStrictReceive`, without any network calls.

## Installation

```js
import { buildPathPaymentPayload, validatePathPaymentForm } from "./pathPaymentQuote";
```

## API

### `buildPathPaymentPayload(formState, destination)`

Build the SDK-ready path payment payload from a form state object.

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `formState` | `PathPaymentFormState` | Form state from the Path tab UI |
| `destination` | `string` | Destination account public key (G...) |

**Returns**

`PathPaymentPayload` — SDK-ready operation parameters for either strict send or strict receive.

**Throws**

`Error` with descriptive message if:
- `formState` is missing or not an object
- `mode` is not `"strictSend"` or `"strictReceive"`
- Required fields are missing (`sendAsset`, `destAsset`, `amount`, `destination`, `destMin`/`sendMax`)
- Asset descriptors are invalid (missing code, invalid issuer, code too long)
- Path parsing fails (missing issuer for credit asset hop)

**Form State Shape**

```typescript
interface PathPaymentFormState {
  mode: "strictSend" | "strictReceive";
  sendAsset: { isNative?: boolean; code?: string; issuer?: string };
  destAsset: { isNative?: boolean; code?: string; issuer?: string };
  amount: string;           // Amount to send (strictSend) or receive (strictReceive)
  destMin?: string;         // Required for strictSend: minimum to receive
  sendMax?: string;         // Required for strictReceive: maximum to send
  path?: string;            // Optional: comma-separated intermediate hops
}
```

**Strict Send Payload**

```typescript
{
  type: "pathPaymentStrictSend",
  sendAsset: StellarSdk.Asset,      // SDK Asset
  sendAmount: string,               // 7-decimal string
  destination: string,              // G...
  destAsset: StellarSdk.Asset,
  destMin: string,                  // 7-decimal string
  path: StellarSdk.Asset[]          // Intermediate hops
}
```

**Strict Receive Payload**

```typescript
{
  type: "pathPaymentStrictReceive",
  sendAsset: StellarSdk.Asset,
  sendMax: string,                  // 7-decimal string
  destination: string,
  destAsset: StellarSdk.Asset,
  destAmount: string,               // 7-decimal string
  path: StellarSdk.Asset[]
}
```

**Example: Strict Send**

```js
const payload = buildPathPaymentPayload({
  mode: "strictSend",
  sendAsset: { isNative: true },
  destAsset: { isNative: false, code: "USDC", issuer: "GUSDC..." },
  amount: "10",
  destMin: "9.5",
  path: "EUR:GEUR..."
}, "GDEST...");

// Result:
{
  type: "pathPaymentStrictSend",
  sendAsset: Asset.native(),
  sendAmount: "10.0000000",
  destination: "GDEST...",
  destAsset: new Asset("USDC", "GUSDC..."),
  destMin: "9.5000000",
  path: [new Asset("EUR", "GEUR...")]
}
```

**Example: Strict Receive**

```js
const payload = buildPathPaymentPayload({
  mode: "strictReceive",
  sendAsset: { isNative: true },
  destAsset: { isNative: false, code: "USDC", issuer: "GUSDC..." },
  amount: "25",
  sendMax: "26",
  path: ""
}, "GDEST...");

// Result:
{
  type: "pathPaymentStrictReceive",
  sendAsset: Asset.native(),
  sendMax: "26.0000000",
  destination: "GDEST...",
  destAsset: new Asset("USDC", "GUSDC..."),
  destAmount: "25.0000000",
  path: []
}
```

---

### `validatePathPaymentForm(formState, destination)`

Validate a form state object without building the payload. Useful for early UI validation.

**Parameters**

Same as `buildPathPaymentPayload`.

**Returns**

```typescript
{
  valid: boolean;
  errors: string[];
}
```

**Example**

```js
const result = validatePathPaymentForm({
  mode: "strictSend",
  sendAsset: { isNative: true },
  destAsset: { isNative: false, code: "USDC", issuer: "GUSDC..." },
  amount: "10",
  destMin: "9.5"
}, "GDEST...");

// => { valid: true, errors: [] }
```

```js
const result = validatePathPaymentForm({
  mode: "strictSend",
  sendAsset: { isNative: true },
  destAsset: { isNative: true },
  amount: "10"
  // missing destMin
}, "GDEST...");

// => { valid: false, errors: ["Minimum received (destMin) is required for strict send."] }
```

## Design Notes

- **Pure functions** — No side effects, no network calls, no global state
- **SDK-native output** — Returns actual `StellarSdk.Asset` objects ready for `Operation.pathPaymentStrictSend/Receive`
- **Amount normalization** — Converts input amounts to 7-decimal fixed-point strings (stroop precision)
- **Asset descriptor flexibility** — Accepts UI-friendly descriptors (`{ isNative: true }` or `{ isNative: false, code, issuer }`) and converts to SDK Assets
- **Path parsing** — Parses comma-separated intermediate hops (e.g., `"USDC:G..., XLM"`) into Asset arrays
- **Case normalization** — Uppercases asset codes automatically
- **Whitespace tolerant** — Trims whitespace from all string inputs
- **Zero dependencies** — Only imports `buildAsset` and `parsePathAssets` from `./stellar` (internal)

## Testing

Run the Vitest suite from the frontend directory:

```bash
cd frontend
npm test
```

Test files (one behavior per file):

| File | Covers |
|------|--------|
| `path-payment-quote-strict-send.test.js` | Strict send happy path (native/credit assets, path hops, amount normalization) |
| `path-payment-quote-strict-receive.test.js` | Strict receive happy path |
| `path-payment-quote-missing-form.test.js` | Missing/invalid formState object |
| `path-payment-quote-missing-fields.test.js` | Missing required fields (mode, assets, amount, destination) |
| `path-payment-quote-missing-bounds.test.js` | Missing `destMin` (strictSend) or `sendMax` (strictReceive) |
| `path-payment-quote-invalid-assets.test.js` | Invalid asset descriptors (missing code, bad issuer, long code) |
| `path-payment-quote-boundary.test.js` | Boundary values (1 stroop, max code length, empty path, u64 max) |
| `path-payment-quote-validate.test.js` | `validatePathPaymentForm` valid/invalid cases |
| `path-payment-quote-whitespace.test.js` | Whitespace trimming, asset code uppercasing |
| `path-payment-quote-error-cases.test.js` | Edge cases (zero amounts, user errors, malformed paths) |
| `path-payment-quote-mode-edge.test.js` | Mode case sensitivity, whitespace |
| `path-payment-quote-path-edges.test.js` | Path parsing (multiple hops, trailing/leading commas, SDK Asset types) |

## When to Use

- **In the Path tab UI** — Transform form state to SDK payload before calling `pathPaymentWithFreighter`
- **For validation** — Use `validatePathPaymentForm` for real-time form validation feedback
- **In testing** — Mock form state and verify payload shape without network

## When Not to Use

- **As a replacement for `pathPaymentWithFreighter`** — This module only builds the payload; signing and submission are separate
- **For direct Horizon submission** — The payload is for the SDK's `Operation` builder, not raw Horizon
- **Without a destination** — The destination public key is required and validated

## Integration Example

```js
// In your Path tab component
import { buildPathPaymentPayload, validatePathPaymentForm } from "./pathPaymentQuote";
import { pathPaymentWithFreighter } from "./freighter";

async function handleSubmit(formState) {
  // 1. Validate early for UX
  const validation = validatePathPaymentForm(formState, destination);
  if (!validation.valid) {
    setErrors(validation.errors);
    return;
  }

  // 2. Build payload
  const payload = buildPathPaymentPayload(formState, destination);

  // 3. Submit via existing Freighter flow
  try {
    const result = await pathPaymentWithFreighter({
      publicKey: sourcePublicKey,
      destination: payload.destination,
      mode: formState.mode,
      sendAsset: payload.sendAsset,
      destAsset: payload.destAsset,
      amount: formState.mode === "strictSend" ? payload.sendAmount : payload.destAmount,
      destMin: payload.destMin,
      sendMax: payload.sendMax,
      path: formState.path,
    });
    // Handle success...
  } catch (e) {
    // Handle error...
  }
}
```