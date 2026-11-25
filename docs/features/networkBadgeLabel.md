# Network badge label/color resolver

`frontend/src/networkBadgeLabel.js` is a pure, standalone utility that maps a
Stellar network id to the label and color token a UI badge should display.

It is not wired into `App.jsx`, `freighter.js`, or `stellar.js` in this
change — that integration is left for a later issue.

## Public API

### `resolveNetworkBadge(networkId)`

Returns `{ label: string, color: string }` for a given network id.

- Recognized ids: `"testnet"`, `"futurenet"`, `"public"` (case-insensitive,
  surrounding whitespace is trimmed).
- Any other value — including `null`, `undefined`, an empty string, or a
  non-string — falls back to `{ label: "Unknown", color: "gray" }`.
- Each call returns a new object; mutating the result never affects future
  calls.

```js
import { resolveNetworkBadge } from "./networkBadgeLabel";

resolveNetworkBadge("testnet"); // { label: "Testnet", color: "yellow" }
resolveNetworkBadge("PUBLIC "); // { label: "Public", color: "green" }
resolveNetworkBadge("mainnet"); // { label: "Unknown", color: "gray" }
```

### `normalizeNetworkId(networkId)`

Lowercases and trims a network id string for lookup. Returns `""` for any
non-string input (including `null`/`undefined`). Exposed separately so
callers can normalize an id without needing the full badge object.
