# Contributing to Helios Lab

Thanks for helping grow Helios Lab. This monorepo has three contribution surfaces:

| Area | Path | Typical skills |
|------|------|----------------|
| Frontend | `frontend/` | React, Freighter, Vite |
| Backend | `backend/` | Node, Express, Horizon |
| Contracts | `contracts/` | Rust, Soroban |

## Local setup

```bash
npm install
npm run dev:backend   # :8787
npm run dev:frontend  # :5173
```

Contract tests:

```bash
cargo test --manifest-path contracts/helios_lab/Cargo.toml
```

## PR guidelines

1. One issue per PR when possible
2. Label the area in the PR title: `[frontend]`, `[backend]`, `[contract]`
3. Run the relevant checks (`npm run lint`, `npm run build`, `cargo test`)
4. Keep signing in Freighter — never handle secret keys in the backend

## Wave maintainers

1. Apply the **whole** `helios-lab` repo to Stellar Wave (not three separate repos)
2. Describe layers as Frontend + Backend + Smart Contract in the application notes
3. Add scoped issues from [docs/wave-backlog.md](./docs/wave-backlog.md)
4. Assign quickly during the Wave week; merge before the Wave ends so contributors earn points

Docs: https://docs.drips.network/wave/maintainers/participating-in-a-wave/

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
