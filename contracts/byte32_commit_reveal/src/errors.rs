//! Contract error codes for the byte32 commit-reveal primitive.

use soroban_sdk::contracterror;

/// Errors returned by the commit-reveal contract.
///
/// Each variant maps to a stable `u32` discriminant so that callers and
/// off-chain tools can identify failures without text matching.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// `commit` was called with a hash that is not exactly 32 bytes.
    InvalidHashLength = 1,

    /// `commit` was called for a slot that already holds a commitment.
    AlreadyCommitted = 2,

    /// `reveal` was called for a slot that has no commitment on record.
    NotCommitted = 3,

    /// The revealed `(salt, value)` does not hash to the stored commitment.
    HashMismatch = 4,

    /// `reveal` was called for a slot that has already been revealed.
    AlreadyRevealed = 5,

    /// The caller of `reveal` is not the address that called `commit`.
    NotCommitter = 6,
}
