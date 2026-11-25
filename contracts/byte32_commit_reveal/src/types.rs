//! Shared types for the byte32 commit-reveal primitive.

use soroban_sdk::{contracttype, Address, Bytes};

/// Status of a commitment slot.
///
/// A slot starts `Committed` once `commit` is called and transitions to
/// `Revealed` after a successful `reveal`. There is no `None` variant — a
/// missing slot is simply absent from storage.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CommitStatus {
    /// The commitment has been registered but not yet revealed.
    Committed,
    /// The value has been revealed and the hash verified.
    Revealed,
}

/// On-chain record stored for each (committer, commitment_id) pair.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommitRecord {
    /// The 32-byte SHA-256 hash of `(salt || value)`.
    pub commitment: Bytes,
    /// Owner who called `commit`; only they can `reveal`.
    pub committer: Address,
    /// Current lifecycle phase.
    pub status: CommitStatus,
}
