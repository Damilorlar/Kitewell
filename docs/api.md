# Kitewell Backend API

Base URL: `http://localhost:8787` (default).

---

## GET /health

Liveness check.

**Success — 200**

```json
{
  "ok": true,
  "service": "kitewell-backend",
  "network": "TESTNET",
  "horizon": "https://horizon-testnet.stellar.org"
}
```

---

## GET /api/network

Returns network configuration and contract status.

**Success — 200**

```json
{
  "network": "TESTNET",
  "horizonUrl": "https://horizon-testnet.stellar.org",
  "friendbotUrl": "https://friendbot.stellar.org",
  "explorerBase": "https://stellar.expert/explorer/testnet",
  "sorobanRpcUrl": "https://soroban-testnet.stellar.org",
  "passphrase": "Test SDF Network ; September 2015",
  "contract": {
    "kitewell": null,
    "status": "not_deployed"
  }
}
```

`contract.status` is `"configured"` when `KITEWELL_CONTRACT_ID` is set.

Every other field is derived from `NETWORK` — see [Network configuration](#network-configuration). The same endpoint with `NETWORK=FUTURENET`:

```json
{
  "network": "FUTURENET",
  "horizonUrl": "https://horizon-futurenet.stellar.org",
  "friendbotUrl": null,
  "explorerBase": "https://stellar.expert/explorer/futurenet",
  "sorobanRpcUrl": "https://rpc-futurenet.stellar.org",
  "passphrase": "Test SDF Future Network ; October 2022",
  "contract": {
    "kitewell": null,
    "status": "not_deployed"
  }
}
```

`friendbotUrl` is `null` on Futurenet, which has no Friendbot. Set `FRIENDBOT_URL` on that network to expose one.

---

## Network configuration

`NETWORK` selects a preset; the passphrase and every URL follow it, so `/health` and `/api/network` can never report a passphrase that belongs to a different network than the URLs they return.

| `NETWORK` | `passphrase` | `horizonUrl` | `friendbotUrl` | `explorerBase` | `sorobanRpcUrl` |
|-----------|--------------|--------------|----------------|----------------|-----------------|
| `TESTNET` (default) | Test SDF Network ; September 2015 | `https://horizon-testnet.stellar.org` | `https://friendbot.stellar.org` | `https://stellar.expert/explorer/testnet` | `https://soroban-testnet.stellar.org` |
| `FUTURENET` | Test SDF Future Network ; October 2022 | `https://horizon-futurenet.stellar.org` | `null` | `https://stellar.expert/explorer/futurenet` | `https://rpc-futurenet.stellar.org` |

- `NETWORK` is case-insensitive, and blank or unset means `TESTNET`.
- An unsupported value aborts startup rather than silently serving Testnet:

  ```text
  Kitewell backend cannot start: Unsupported NETWORK "MAINNET". Supported networks: TESTNET, FUTURENET.
  ```

- `HORIZON_URL`, `FRIENDBOT_URL`, `EXPLORER_BASE`, and `SOROBAN_RPC_URL` each override the selected network's default. Blank values are ignored, so an empty variable cannot blank out a URL.
- Resolution lives in `backend/src/networkConfig.js` (`resolveNetwork(env)`); see `backend/.env.example` for the variables.

---

## Selecting a network

`GET /api/account/:address` and `GET /api/payments/:address` read from the
Horizon of the network the caller selects, so the frontend can follow the
Testnet / Futurenet switch without a second backend process.

Send either the `network` query parameter or the `x-kitewell-network` header:

```
GET /api/account/GABC…?network=FUTURENET
GET /api/payments/GABC…
X-Kitewell-Network: FUTURENET
```

| Value | Horizon used |
|-------|--------------|
| `TESTNET` | Testnet Horizon (`https://horizon-testnet.stellar.org` by default) |
| `FUTURENET` | Futurenet Horizon (`https://horizon-futurenet.stellar.org` by default) |
| omitted / blank | `TESTNET` (the default) |
| anything else | `400` with `{ "error": "Unsupported network \"…\"…" }` |

The value is case-insensitive and trimmed. The query parameter wins when both
are sent. Explorer URLs in the response follow the selected network.

`HORIZON_URL` / `EXPLORER_BASE` overrides apply to the server's own `NETWORK`;
every other network uses its preset URLs. Friendbot stays Testnet-only.

---

## GET /api/account/:address

Loads an account from the selected network's Horizon and returns balances.

**Path params**

| Param | Description |
|-------|-------------|
| `address` | Stellar public key (Ed25519) |

**Query params**

| Param | Default | Description |
|-------|---------|-------------|
| `network` | `TESTNET` | `TESTNET` or `FUTURENET` (see [Selecting a network](#selecting-a-network)) |

**Success — 200**

```json
{
  "id": "GABC…",
  "sequence": "123456789",
  "subentryCount": 0,
  "thresholds": { "low": 0, "med": 0, "high": 0 },
  "balances": [
    {
      "key": "native",
      "code": "XLM",
      "issuer": null,
      "balance": "100.0000000",
      "limit": null,
      "isNative": true
    }
  ],
  "explorerUrl": "https://stellar.expert/explorer/testnet/account/GABC…"
}
```

**Errors**

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid Stellar public key" }` | Bad address format |
| 400 | `{ "error": "Unsupported network \"…\". Supported networks: TESTNET, FUTURENET." }` | Unknown `network` |
| 404 | `{ "error": "Account not found on Testnet. Fund with Friendbot first." }` | Account doesn't exist on the selected network |
| 502 | `{ "error": "Horizon request failed", "detail": "…" }` | Horizon unreachable |

---

## GET /api/payments/:address

Returns recent payments for an account on the selected network, newest first.

**Path params**

| Param | Description |
|-------|-------------|
| `address` | Stellar public key (Ed25519) |

**Query params**

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `limit` | 15 | 50 | Number of payments to return |
| `cursor` | _(none)_ | — | Paging token to continue from; pass the previous response's `nextCursor` |
| `network` | `TESTNET` | — | `TESTNET` or `FUTURENET` (see [Selecting a network](#selecting-a-network)) |

**Success — 200**

```json
{
  "records": [
    {
      "id": "123…",
      "from": "GABC…",
      "to": "GDEF…",
      "amount": "10.0000000",
      "asset_type": "native",
      "asset_code": "XLM",
      "transaction_hash": "abc123…",
      "created_at": "2025-01-15T12:00:00Z",
      "explorerUrl": "https://stellar.expert/explorer/testnet/tx/abc123…"
    }
  ],
  "nextCursor": "9876543210-0"
}
```

Only records with `type === "payment"` are returned.

**Pagination**

`nextCursor` is the Horizon `paging_token` of the last **raw** record Horizon returned for this page (before non-payment records are filtered out), so nothing is skipped between pages. It is `null` when fewer than `limit` raw records came back, which means this was the last page. Request older payments by passing it straight back:

```
GET /api/payments/GABC…?limit=15&cursor=9876543210-0
```

**Errors**

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid Stellar public key" }` | Bad address format |
| 400 | `{ "error": "Unsupported network \"…\". Supported networks: TESTNET, FUTURENET." }` | Unknown `network` |
| 400 | `{ "error": "Invalid cursor" }` | Horizon rejected the `cursor` (HTTP 400) |
| 502 | `{ "error": "Could not load payments", "detail": "…" }` | Horizon unreachable |
