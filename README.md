# Kitewell

![Demo](https://img.shields.io/badge/demo-🌐-brightgreen)

**Kitewell** is an open-source Stellar Testnet monorepo for builders and [Stellar Wave / Drips](https://www.drips.network/wave/stellar) contributors.

When you apply the repo on Drips, tag / describe it across all three layers:

| Layer | Path | Role |
|-------|------|------|
| **Frontend** | `frontend/` | React + Vite + Freighter wallet lab UI |
| **Backend** | `backend/` | Express API — Horizon helpers, network + contract config |
| **Contract** | `contracts/kitewell/` | Soroban registry (`register` / `get_builder` / `lab_name`) |

## Architecture

```
kitewell/
├── frontend/          # Freighter connect, fund, trustlines, send, history, lab panel
├── backend/           # /health, /api/network, /api/account, /api/payments
├── contracts/         # Soroban kitewell crate
├── docs/              # Wave backlog notes
└── README.md
```

## Quick start

```bash
# install JS workspaces
npm install

# terminal 1 — API
npm run dev:backend

# terminal 2 — UI (http://localhost:5173)
npm run dev:frontend
```

Freighter must be on **Testnet**.

## Backend configuration

The backend (`backend/`) is configured entirely through environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | HTTP port the API listens on |
| `HORIZON_URL` | `https://horizon-testnet.stellar.org` | Horizon API base URL |
| `NETWORK` | `TESTNET` | Network label reported by `/health` and `/api/network` |
| `FRIENDBOT_URL` | `https://friendbot.stellar.org` | Friendbot funding endpoint |
| `EXPLORER_BASE` | `https://stellar.expert/explorer/testnet` | Block explorer base for deep links |
| `KITEWELL_CONTRACT_ID` | _(unset)_ | Soroban contract ID once `contracts/kitewell` is deployed |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Fixed-window duration for the per-IP rate limiter on `/api/*` |
| `RATE_LIMIT_MAX` | `60` | Max requests per IP per window; excess requests get `429` with a `Retry-After` header |

Rate limiting is per-IP and in-memory (no external store); responses include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers. Every request emits one structured JSON log line with `method`, `path`, `status`, and `ms`.

## Demo

The frontend is deployed at https://kitewell.vercel.app or https://kitewell.github.io/kitewell/

### Contracts

```bash
rustup target add wasm32v1-none
cargo test --manifest-path contracts/kitewell/Cargo.toml
cargo build --manifest-path contracts/Cargo.toml --target wasm32v1-none --release
```

Deploy steps: [contracts/README.md](./contracts/README.md). After deploy, set `KITEWELL_CONTRACT_ID` for the backend.

With no `KITEWELL_CONTRACT_ID` configured, the **Lab** tab can also deploy the existing `contracts/kitewell` Wasm directly: choose the locally built `kitewell.wasm`, sign upload → create → `init(connected account)`, then copy the new id. The id is used for Lab reads and registers for that session only — the panel never writes backend env vars; it shows the `KITEWELL_CONTRACT_ID=...` line to set yourself. A second deploy in the same session asks for confirmation and keeps the first id visible.

### Tests (JS)

```bash
npm test
```

Vitest suite in `frontend/src/stellar.test.js` covers the stellar helpers (explorer URLs, asset/path parsing, Friendbot funding, balance/payment mapping, backend → Horizon fallback) with mocked Horizon SDK and API calls — CI-friendly, no Freighter wallet or network access required. `frontend/src/path-payment.test.js` covers amount normalization and path-payment operation building. `frontend/src/freighter.test.js` covers the Lab-tab Soroban registry reads and `register` invoke. `frontend/src/txInspector.test.js` covers decoding a payment envelope, a truncated XDR, the wrong-network passphrase error, and fee-bump inner transactions. `frontend/src/fee-setting.test.js` covers fee validation, persistence, and the per-operation fee used by payments, trustlines, and path payments; `frontend/src/fee-stats.test.js` covers the Horizon `/fee_stats` mapping.

## Screenshots

The Testnet lab UI, using the existing assets in [`screenshots/`](./screenshots):

### Home screen (tab navigation, including the Lab)
![Home screen](./screenshots/01-home.png)

### Wallet connected via Freighter
![Wallet connected](./screenshots/01-wallet-connected.png)

### Send a payment (optional memo)
![Send payment form](./screenshots/04-send-form.png)

### Transaction history with explorer links
![Transaction history](./screenshots/05-transaction-history.png)

## Features

- Freighter connect / disconnect (`setAllowed`, `getAddress`, `signTransaction`)
- Friendbot funding (Testnet only)
- Source-funded account creation with live source-reserve and fee checks
- Testnet / Futurenet network toggle (persisted in `localStorage`)
- Balances + `changeTrust` (open a trustline or remove an empty one), with a
  minimum-balance calculator and pre-sign reserve check
- XLM + credit-asset payments (asset picked from balances) + history
- Path payments (`pathPaymentStrictSend` / `pathPaymentStrictReceive`)
- Network fee selector: reads Horizon fee stats (mode / p10 / p99), accepts a custom
  stroop fee, and applies the saved choice per operation to the next payment,
  trustline, or path payment
- Read-only XDR inspector: paste a base64 transaction envelope to review its source, fee,
  sequence, memo, time bounds, and operations before signing (fee-bump aware). Nothing is
  submitted.
- Backend-backed account/payment reads (Horizon fallback)
- Latest-ledger header with sequence, UTC close time, base fee, and base reserve
- Lab panel for API + contract status
- Lab tab Soroban registry: Freighter-signed `register(caller, name)` check-in + `lab_name` / `builder_count` / `get_builder` reads
- Lab tab deploy: install the built `kitewell.wasm`, run `init(connected account)`, and use the new id for the session

Send supports optional text memos up to 28 UTF-8 bytes, uint64 ID memos, and 32-byte hash memos.
The reserve calculator and transaction checks use the base reserve reported by the latest
Horizon ledger; if that ledger cannot be loaded, reserve-dependent signing is disabled.

### Path payments (Testnet)

The **Path** tab builds a path payment, signs it in Freighter, and submits it to Horizon Testnet.
Pick **strict send** (fix the amount sent, set a minimum received) or **strict receive** (fix the
amount received, set a maximum to send). The send asset and destination asset can each be native
XLM or a credit asset (code + issuer). An optional intermediate path lets you pin the hops
(`CODE:ISSUER, XLM`); leave it empty to route through the direct order book.

Testnet limitations:

- **Testnet only** — no Mainnet assets or real funds are involved.
- **Liquidity is thin.** Paths depend on Testnet order books, so submissions often fail with
  `op_too_few_offers`, `op_no_path`, or `op_under_dest_min`. Try a direct XLM ⇄ asset route or
  raise/lower your bound.
- **Trustlines required.** The sender must hold the send asset and the destination account must
  already trust the destination asset, otherwise Horizon returns `op_no_trust` / `op_no_issuer`.
- **Slippage is only as good as your bound.** Strict send guarantees `destMin`; strict receive
  guarantees `sendMax`. There is no automatic slippage protection beyond those values.
- **No path finding UI.** Kitewell does not call Horizon's `strictSendPaths` / `strictReceivePaths`
  yet; you supply the assets and any intermediate hops yourself.

Successful submissions show a hash plus a StellarExpert transaction link.

## Drips Wave application tip

In the maintainer apply flow, present Kitewell as a **full-stack Stellar lab**:

1. **Frontend** — wallet UX and Freighter integration  
2. **Backend** — Horizon aggregation API for the lab  
3. **Smart contract** — Soroban builder check-in registry  

Point reviewers at this README, `contracts/`, `backend/src/index.js`, and open issues labeled `stellar-wave`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/wave-backlog.md](./docs/wave-backlog.md).

## License

MIT — [LICENSE](./LICENSE).

## Network

The header selector switches between **Testnet** (default) and **Futurenet**; the choice is
persisted in `localStorage`. The Horizon URL, network passphrase, explorer base and Friendbot URL
all live in `frontend/src/network.js`, so a switch updates transaction signing and submission in
one place.

- Friendbot is Testnet-only and is disabled on Futurenet.
- The Kitewell backend is configured for Testnet, so account/payment reads go straight to Horizon
  when another network is selected.
- Latest-ledger values come from the selected network's Horizon endpoint, refresh while the page
  is visible, and retain the last successful values with a warning when a refresh fails.
- No Mainnet funds are ever used.
