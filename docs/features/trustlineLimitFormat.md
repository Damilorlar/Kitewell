# Trustline Limit Format

A pure, standalone frontend utility for formatting and validating trustline limits for Stellar's `changeTrust` operation.

## Overview

Stellar's `changeTrust` operation requires a limit parameter that specifies the maximum amount of an asset the account is willing to hold. This module handles three distinct cases:

1. **Default max limit** — When no limit is specified, the SDK uses a default of 1,000,000 XLM
2. **Custom numeric limit** — User-specified limit, normalized to 7 decimal places (stroop precision)
3. **Zero limit** — Special value "0" that removes the trustline (when balance is zero)

## Installation

```js
import { formatTrustlineLimit, validateTrustlineLimit, parseTrustlineLimit, MAX_TRUSTLINE_LIMIT, DEFAULT_TRUSTLINE_LIMIT } from "./trustlineLimitFormat";
```

## API

### `formatTrustlineLimit(limit)`

Format and validate a trustline limit string, returning an SDK-ready value with metadata.

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | `string \| number \| null \| undefined` | The limit value from the UI |

**Returns**

`TrustlineLimitResult` — Object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `formatted` | `string` | The limit formatted to 7 decimal places for the SDK |
| `type` | `"default" \| "custom" \| "zero"` | The type of limit |
| `isZero` | `boolean` | True when the limit is zero (removes trustline) |
| `isDefault` | `boolean` | True when the limit equals the default max (1,000,000) |

**Throws**

`Error` with descriptive message if:
- The limit is negative
- The limit exceeds `MAX_TRUSTLINE_LIMIT` (922337203685.4775807)
- The limit has more than 7 decimal places
- The limit is not a valid number, "max", or "zero"

**Input Handling**

| Input | Result |
|-------|--------|
| `undefined`, `null`, `""`, `" "` | Default limit (1,000,000.0000000) |
| `"max"`, `"MAX"`, `"Max"` | Maximum limit (922337203685.4775807) |
| `"0"`, `"0.0"`, `"0.0000000"`, `"zero"` | Zero limit (0.0000000) |
| `"1000000"` | Default limit (1000000.0000000, type: default) |
| `"1.5"` | Custom limit (1.5000000, type: custom) |
| `"000000"` | Zero limit (0.0000000, type: zero) |

**Example**

```js
// Default limit (no input)
formatTrustlineLimit()
// => { formatted: "1000000.0000000", type: "default", isZero: false, isDefault: true }

// Maximum limit
formatTrustlineLimit("max")
// => { formatted: "922337203685.4775807", type: "default", isZero: false, isDefault: true }

// Remove trustline
formatTrustlineLimit("0")
// => { formatted: "0.0000000", type: "zero", isZero: true, isDefault: false }

// Custom limit
formatTrustlineLimit("1.5")
// => { formatted: "1.5000000", type: "custom", isZero: false, isDefault: false }

// Explicit default value
formatTrustlineLimit("1000000")
// => { formatted: "1000000.0000000", type: "default", isZero: false, isDefault: true }
```

---

### `validateTrustlineLimit(limit)`

Validate a trustline limit without formatting. Useful for real-time UI validation feedback.

**Parameters**

Same as `formatTrustlineLimit`.

**Returns**

```typescript
{
  valid: boolean;
  errors: string[];
}
```

**Example**

```js
validateTrustlineLimit("1.5")
// => { valid: true, errors: [] }

validateTrustlineLimit("-5")
// => { valid: false, errors: ["Trustline limit cannot be negative."] }

validateTrustlineLimit("1.12345678")
// => { valid: false, errors: ["Trustline limit supports at most 7 decimal places."] }

validateTrustlineLimit("abc")
// => { valid: false, errors: ["Trustline limit must be a non-negative number, 'max', or 'zero'."] }
```

---

### `parseTrustlineLimit(formattedLimit)`

Parse a formatted trustline limit (7 decimal places) back to a human-readable string by removing trailing zeros.

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `formattedLimit` | `string` | The 7-decimal formatted limit from `formatTrustlineLimit` |

**Returns**

`string` — Human-readable limit string.

**Example**

```js
parseTrustlineLimit("1000000.0000000")  // => "1000000"
parseTrustlineLimit("1.5000000")        // => "1.5"
parseTrustlineLimit("1.2300000")        // => "1.23"
parseTrustlineLimit("0.0000000")        // => "0"
parseTrustlineLimit("922337203685.4775807")  // => "922337203685.4775807"
```

---

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_TRUSTLINE_LIMIT` | `"922337203685.4775807"` | Maximum possible trustline limit (INT64_MAX stroops / 10^7) |
| `DEFAULT_TRUSTLINE_LIMIT` | `"1000000.0000000"` | Default trustline limit used by SDK |

## Design Notes

- **Pure functions** — No side effects, no network calls, no global state
- **Precision-safe** — Uses `BigInt` and string comparison for range checking to avoid floating-point precision issues with large numbers
- **Stroop precision** — All limits normalized to exactly 7 decimal places (1 XLM = 10^7 stroops)
- **Flexible input** — Accepts strings, numbers, null, undefined; handles whitespace and case variations
- **Zero detection** — Automatically detects zero values even with leading zeros (e.g., "000000")
- **Default detection** — Automatically detects when a custom value equals the default limit
- **Zero dependencies** — Only uses standard JavaScript/TypeScript

## Testing

Run the Vitest suite from the frontend directory:

```bash
cd frontend
npm test
```

Test files (one behavior per file):

| File | Covers |
|------|--------|
| `trustline-limit-default.test.js` | Default limit (empty, null, whitespace, "max" keyword) |
| `trustline-limit-zero.test.js` | Zero limit ("0", "0.0", "zero", case variations) |
| `trustline-limit-custom.test.js` | Custom numeric limits (integers, decimals, number inputs) |
| `trustline-limit-invalid.test.js` | Invalid inputs (negative, >max, >7 decimals, non-numeric) |
| `trustline-limit-boundary.test.js` | Boundary values (1 stroop, max, default, zero boundary) |
| `trustline-limit-validate.test.js` | `validateTrustlineLimit` valid/invalid cases |
| `trustline-limit-parse.test.js` | `parseTrustlineLimit` formatting |
| `trustline-limit-edge-cases.test.js` | Edge cases (leading zeros, large numbers, round-trip) |
| `trustline-limit-type-detection.test.js` | Type detection (default vs custom vs zero) |
| `trustline-limit-whitespace.test.js` | Whitespace and case handling |

## When to Use

- **In the Assets tab UI** — Format user-entered trustline limit before calling `changeTrustWithFreighter`
- **For validation** — Use `validateTrustlineLimit` for real-time form validation feedback
- **For display** — Use `parseTrustlineLimit` to show formatted limits in a human-readable way
- **In testing** — Mock limit values and verify formatting without network

## When Not to Use

- **As a replacement for `changeTrustWithFreighter`** — This module only formats the limit; the actual operation is separate
- **For other Stellar operations** — The limit format is specific to `changeTrust`
- **Without user input handling** — The module expects UI-formatted strings, not raw stroop values

## Integration Example

```js
// In your Assets tab component
import { formatTrustlineLimit, validateTrustlineLimit, parseTrustlineLimit } from "./trustlineLimitFormat";
import { changeTrustWithFreighter } from "./freighter";

async function handleTrustlineSubmit(assetCode, assetIssuer, limitInput) {
  // 1. Validate early for UX
  const validation = validateTrustlineLimit(limitInput);
  if (!validation.valid) {
    setErrors(validation.errors);
    return;
  }

  // 2. Format for SDK
  const { formatted: limit, isZero } = formatTrustlineLimit(limitInput);

  // 3. Submit via existing Freighter flow
  try {
    const result = await changeTrustWithFreighter(
      sourcePublicKey,
      assetCode,
      assetIssuer,
      limit  // Pass the formatted limit
    );
    // Handle success...
  } catch (e) {
    // Handle error...
  }
}

// For display
function TrustlineLimitDisplay({ formattedLimit }) {
  const readable = parseTrustlineLimit(formattedLimit);
  return <span>{readable} XLM</span>;
}
```