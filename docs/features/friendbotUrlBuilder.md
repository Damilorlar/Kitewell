# Friendbot URL builder

`frontend/src/friendbotUrlBuilder.js` builds a Stellar Friendbot funding URL
for a network and a Stellar address. It is a pure, standalone helper: it does
not read the active network store, call the Stellar SDK, or touch the DOM.
Wallet integration (`App.jsx`, `freighter.js`, `stellar.js`) is intentionally
out of scope.

## What it does

- Maps a network id (`"TESTNET"`, `"FUTURENET"`) to its Friendbot base URL.
- Accepts a network descriptor object (`{ id, label, friendbotUrl }`) so the
  caller can pass an entry from `frontend/src/network.js` later.
- Rejects networks without a faucet — the public network (`PUBLIC`/`MAINNET`)
  and Futurenet descriptors without a `friendbotUrl`.
- Validates the address (56 characters, `G` prefix, base32 alphabet), trims it,
  and URL-encodes it before appending `?addr=`.
- Throws an `Error` with a user-facing message on every failure path.

## Public API

### `buildFriendbotUrl(network, address)`

Returns the funding URL for `address`.

```js
import { buildFriendbotUrl } from "./friendbotUrlBuilder";

buildFriendbotUrl(
  "TESTNET",
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
);
// => "https://friendbot.stellar.org?addr=GAAAAA...AAAWHF"

buildFriendbotUrl(
  { id: "TESTNET", friendbotUrl: "https://faucet.example.org/" },
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
);
// => "https://faucet.example.org?addr=GAAAAA...AAAWHF"
```

Throws when:

| Condition | Message |
| --- | --- |
| Network is `null`, `undefined`, or blank | `Network is required.` |
| Network id is `PUBLIC` or `MAINNET` | `Friendbot is not available on Public.` |
| Network id is not known | `Unknown network: <ID>.` |
| Descriptor has no `friendbotUrl` | `Friendbot is not available on <label>.` |
| Address is missing or not a string | `A Stellar address is required.` |
| Address is not a canonical G... key | `Invalid Stellar address. Expected a G... public key.` |

### `isFriendbotSupported(network)`

Returns `true` when the network has a Friendbot endpoint and `false` otherwise.
It never throws, so it is safe to call with input from storage or user
selection.

```js
isFriendbotSupported("TESTNET"); // true
isFriendbotSupported("PUBLIC"); // false
isFriendbotSupported(undefined); // false
```

### Constants

- `FRIENDBOT_URLS` — frozen map of `{ TESTNET, FUTURENET }` base URLs.
- `NETWORKS_WITHOUT_FRIENDBOT` — frozen list of known faucet-less network ids.

## Notes

- The StrKey checksum is not verified; Horizon/Friendbot remains the source of
  truth for whether an address is spendable.
- Tests live next to the module in `frontend/src/friendbotUrlBuilder-*.test.js`
  and run with `npm test` from `frontend/`.
