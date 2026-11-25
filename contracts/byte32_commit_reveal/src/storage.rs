//! Storage key helpers for the byte32 commit-reveal contract.
//!
//! Each commitment is stored in *persistent* storage under a composite key
//! `(committer, commitment_id)`. Persistent storage is used because a
//! commitment may need to survive ledger-close gaps between `commit` and
//! `reveal`. TTL extension is the caller's responsibility in production; the
//! tests use the default test-env behaviour.

use soroban_sdk::{symbol_short, Address, Bytes, Env, Symbol};

use crate::types::CommitRecord;

/// Short symbol used as the first element of every storage key, giving all
/// commit-reveal entries a predictable, collision-free namespace.
const COMMIT: Symbol = symbol_short!("COMMIT");

/// Returns the composite persistent-storage key for `(committer, id)`.
fn slot_key(committer: &Address, id: &Bytes) -> (Symbol, Address, Bytes) {
    (COMMIT, committer.clone(), id.clone())
}

/// Load the [`CommitRecord`] for `(committer, id)`, if any.
pub fn load(env: &Env, committer: &Address, id: &Bytes) -> Option<CommitRecord> {
    env.storage().persistent().get(&slot_key(committer, id))
}

/// Persist a [`CommitRecord`] for `(committer, id)`.
pub fn save(env: &Env, committer: &Address, id: &Bytes, record: &CommitRecord) {
    env.storage()
        .persistent()
        .set(&slot_key(committer, id), record);
}

/// Returns `true` if a commitment slot exists for `(committer, id)`.
pub fn has(env: &Env, committer: &Address, id: &Bytes) -> bool {
    env.storage()
        .persistent()
        .has(&slot_key(committer, id))
}
