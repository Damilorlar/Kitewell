# byte32_commit_reveal

A generic, standalone [Soroban](https://soroban.stellar.org) smart-contract
crate implementing a **32-byte commit-reveal primitive**.

This crate is self-contained. It is **not** a member of the parent
`contracts/Cargo.toml` workspace and has no dependency on the `kitewell`
registry contract. Integration into higher-level contracts is left to a
separate issue.

---

## Concept

The commit-reveal pattern is a two-phase protocol that lets a participant
lock in a value without revealing it until a later point in time.

```
Phase 1 — Commit
  off-chain: H = SHA-256(salt || value)
  on-chain:  commit(committer, id, H)

Phase 2 — Reveal
  on-chain:  reveal(committer, id, salt, value)
             ↳ contract recomputes SHA-256(salt || value)
             ↳ checks it equals the stored H
             ↳ marks slot as Revealed and returns value
```

* **`committer`** — the `Address` that owns the commitment.
  Only they can call `reveal` for their own slots.
* **`id`**         — a caller-chosen byte string (typically 32 bytes) that
  scopes the slot, allowing one address to manage multiple independent
  commit-reveal rounds simultaneously.
* **`salt`**       — a secret nonce mixed into the hash before committing,
  preventing observers from brute-forcing the value from the hash alone.
* **`value`**      — the payload being committed; any `Bytes` length is
  accepted (including empty).

---

## Public function signatures

```rust
// Register a 32-byte SHA-256 commitment.
fn commit(env: Env, committer: Address, id: Bytes, commitment: Bytes) -> Result<(), Error>

// Reveal the pre-image and verify it matches the stored commitment.
fn reveal(env: Env, committer: Address, id: Bytes, salt: Bytes, value: Bytes) -> Result<Bytes, Error>

// Read the on-chain CommitRecord (status + stored hash), if any.
fn get_commitment(env: Env, committer: Address, id: Bytes) -> Option<CommitRecord>

// Quick existence check — true once commit() has been called.
fn has_commitment(env: Env, committer: Address, id: Bytes) -> bool
```

### Types

```rust
// Returned by get_commitment().
pub struct CommitRecord {
    pub commitment: Bytes,      // the 32-byte hash stored by commit()
    pub committer:  Address,    // address that called commit()
    pub status:     CommitStatus,
}

pub enum CommitStatus {
    Committed,  // commit() called; reveal() not yet
    Revealed,   // reveal() succeeded
}
```

### Error codes

| Code | Variant             | When                                            |
|------|---------------------|-------------------------------------------------|
| 1    | `InvalidHashLength` | `commitment` passed to `commit` is not 32 bytes |
| 2    | `AlreadyCommitted`  | slot `(committer, id)` already has a record     |
| 3    | `NotCommitted`      | `reveal` called with no prior `commit`          |
| 4    | `HashMismatch`      | `SHA-256(salt \|\| value)` ≠ stored commitment  |
| 5    | `AlreadyRevealed`   | slot was already successfully revealed          |
| 6    | `NotCommitter`      | `reveal` caller ≠ address that called `commit`  |

---

## Security notes

* **Auth-gated.** Both `commit` and `reveal` call `committer.require_auth()`,
  so every operation must be signed by the `committer` argument.
* **No re-commit.** Once a slot exists it cannot be overwritten, whether
  `Committed` or `Revealed`. This prevents a committer from silently
  substituting a new hash after seeing an opponent's move.
* **Salt prevents brute-force.** Without a salt, an observer could hash
  a small value space and recover the value from the commitment. The salt
  should be a 32-byte random nonce generated off-chain and kept secret until
  reveal time.
* **Final state.** `Revealed` is a terminal state. A revealed slot cannot
  be re-committed or re-revealed.

---

## Build

Requires Rust with the `wasm32v1-none` target (or any Soroban-compatible
toolchain). Unit and integration tests run on the host target:

```bash
# Run all tests
cargo test --manifest-path contracts/byte32_commit_reveal/Cargo.toml

# Lint (zero warnings policy)
cargo clippy --manifest-path contracts/byte32_commit_reveal/Cargo.toml \
  --all-targets -- -D warnings

# Build the release WASM (requires Stellar CLI ≥ v25.2.0)
stellar contract build --manifest-path contracts/byte32_commit_reveal/Cargo.toml
```

---

## Test coverage

| File                     | Scenarios                                              |
|--------------------------|--------------------------------------------------------|
| `tests/happy_path.rs`    | Full commit → reveal round-trips; multi-slot; multi-committer |
| `tests/error_cases.rs`   | Every error variant; stable discriminants              |
| `tests/edge_cases.rs`    | Empty value, empty salt, empty id, large value, all-zeros hash |
| `tests/lifecycle.rs`     | State transitions; re-commit after reveal; failed reveal leaves slot intact |
| `tests/auth.rs`          | Auth gate on commit and reveal; slot isolation between committers |

---

## Crate layout

```
contracts/byte32_commit_reveal/
├── Cargo.toml
├── README.md
├── .gitignore
└── src/
    ├── lib.rs       # contract entry-point, public functions
    ├── errors.rs    # Error enum with stable u32 discriminants
    ├── storage.rs   # persistent-storage key helpers
    └── types.rs     # CommitRecord, CommitStatus contracttype definitions
```
