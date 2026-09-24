# Contributing to Kitewell

Thanks for helping grow Kitewell. This monorepo has three contribution surfaces:

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
cargo test --manifest-path contracts/kitewell/Cargo.toml
```

## PR guidelines

1. One issue per PR when possible
2. Label the area in the PR title: `[frontend]`, `[backend]`, `[contract]`
3. Run the relevant checks (`npm run lint`, `npm run build`, `cargo test`)
4. Keep signing in Freighter — never handle secret keys in the backend

## Wave maintainer checklist

How maintainers run Kitewell during a [Stellar Wave](https://docs.drips.network/wave/maintainers/participating-in-a-wave/) week — from seeding issues to reviewing PRs and paying out points.

Docs: [Participating in a Wave](https://docs.drips.network/wave/maintainers/participating-in-a-wave/)

### 1. Before the Wave — add issues to Drips

- [ ] Apply the **whole** `kitewell` repo to Stellar Wave (not three separate repos) and describe the layers as Frontend + Backend + Smart Contract in the application notes
- [ ] Create GitHub issues from [docs/wave-backlog.md](./docs/wave-backlog.md) — keep one goal per issue
- [ ] Add each issue to Drips with a **complexity** (Trivial / Medium / High) and the `stellar-wave` label, plus an area label: `good first issue`, `frontend`, `backend`, `contract`, or `documentation`
- [ ] Write acceptance criteria as checkboxes so contributors (and reviewers) know when an issue is done
- [ ] Pin or link the issue list in the README so newcomers land on scoped work

### 2. During the Wave week — review PRs

- [ ] Assign issues quickly so contributors don't duplicate work
- [ ] Check the PR title carries the area label: `[frontend]`, `[backend]`, `[contract]` (or `[docs]`)
- [ ] Verify acceptance criteria box-by-box against the linked issue; one issue per PR when possible
- [ ] Run the relevant checks before approving: `npm run lint`, `npm test`, `npm run build`, and `cargo test` for contract changes
- [ ] Confirm no secret keys are handled anywhere — Freighter stays on the client, the backend never signs
- [ ] Leave review comments in the PR, not in chat, so decisions stay on the record

### 3. Before the Wave ends — merge and resolve

> **Tip:** merge (or resolve) PRs and issues **before the Wave ends** — work only counts toward contributor points once it is merged/resolved in Drips.

- [ ] Triage open PRs by Wave deadline and prioritize small, ready-to-merge ones
- [ ] Merge accepted PRs and close the linked issues so Drips can attribute the work
- [ ] Mark unresolved issues as carried over to the next Wave in [docs/wave-backlog.md](./docs/wave-backlog.md)
- [ ] Thank contributors in the merge commit or release notes 🪁

Full maintainer guide: https://docs.drips.network/wave/maintainers/participating-in-a-wave/

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
