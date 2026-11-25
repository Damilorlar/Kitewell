# Network config resolver

`backend/src/networkConfigResolve.js` maps a network name to the Horizon URL, network passphrase, and Friendbot URL the backend would use for that network.

The module is standalone. It is not imported by `app.js`, `index.js`, or any route.

## Public API

### `resolveNetworkConfig(name)`

| Argument | Type | Notes |
| --- | --- | --- |
| `name` | `string` | Exact, case-sensitive name. Only `testnet` and `public` are accepted. |

Returns a new object:

| Field | `testnet` | `public` |
| --- | --- | --- |
| `horizonUrl` | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| `passphrase` | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| `friendbotUrl` | `https://friendbot.stellar.org` | `null` |

Matching does not trim and does not ignore case. `TESTNET`, `Public`, `futurenet`, `""`, and whitespace-only strings are rejected.

### `SUPPORTED_NETWORK_NAMES`

Frozen list of accepted names: `testnet`, `public`.

### `NetworkConfigError`

Thrown for unknown names, empty or whitespace-only strings, `null`, and any non-string. Also exported from `backend/src/networkConfigResolveErrors.js`.

| Property | Value |
| --- | --- |
| `name` | `NetworkConfigError` |
| `code` | `unsupported_network` |
| `input` | The original argument, unchanged |

The message states that the network is unsupported. It quotes string inputs and describes other values by type, so object fields are not copied into the message.
