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

## Demo

The frontend is deployed at https://kitewell.vercel.app or https://kitewell.github.io/kitewell/

### Contracts

```bash
rustup target add wasm32v1-none
cargo test --manifest-path contracts/kitewell/Cargo.toml
cargo build --manifest-path contracts/Cargo.toml --target wasm32v1-none --release
```

Deploy steps: [contracts/README.md](./contracts/README.md). After deploy, set `KITEWELL_CONTRACT_ID` for the backend.

## Features

- Freighter connect / disconnect (`setAllowed`, `getAddress`, `signTransaction`)
- Friendbot funding
- Balances + `changeTrust`
- Native XLM payments + history
- Backend-backed account/payment reads (Horizon fallback)
- Lab panel for API + contract status

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

Testnet only by default. No Mainnet funds.
