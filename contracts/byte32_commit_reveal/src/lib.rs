//! # byte32_commit_reveal
//!
//! A generic, standalone Soroban contract implementing a **32-byte
//! commit-reveal primitive**. It is not tied to any other contract in this
//! workspace and carries no application-layer semantics — it simply stores
//! 32-byte SHA-256 commitments and verifies revealed pre-images.
//!
//! ## Concept
//!
//! The commit-reveal pattern hides a value `V` until a later point in time:
//!
//! 1. **Commit phase** — the committer computes
//!    `H = SHA-256(salt || value)` off-chain and calls
//!    [`Byte32CommitReveal::commit`] with `H`. The contract stores `H` under
//!    the key `(committer, id)`.
//! 2. **Reveal phase** — the committer calls
//!    [`Byte32CommitReveal::reveal`] with the original `salt` and `value`.
//!    The contract recomputes `SHA-256(salt || value)` and checks it against
//!    the stored hash. On match the slot is marked [`CommitStatus::Revealed`]
//!    and the verified `value` is returned.
//!
//! `id` is a caller-supplied 32-byte nonce that lets a single `committer`
//! address run multiple independent commit-reveal rounds simultaneously.
//!
//! ## Security invariants
//!
//! * A commitment hash must be exactly 32 bytes (`InvalidHashLength`).
//! * A slot can only be committed once (`AlreadyCommitted`).
//! * Only the original committer can reveal (`NotCommitter`).
//! * Only an unrevealed slot can be revealed (`AlreadyRevealed`).
//! * The hash must match or the call fails (`HashMismatch`).

#![no_std]

pub mod errors;
pub mod storage;
pub mod types;

pub use errors::Error;
pub use types::{CommitRecord, CommitStatus};

use soroban_sdk::{contract, contractimpl, Address, Bytes, Env};

use crate::errors::Error as ContractError;

#[contract]
pub struct Byte32CommitReveal;

#[contractimpl]
impl Byte32CommitReveal {
    /// Register a 32-byte commitment hash.
    ///
    /// # Parameters
    ///
    /// * `committer`  — the address making the commitment; must sign the call.
    /// * `id`         — a caller-chosen byte string scoping the slot (often
    ///                  32 bytes, but any length is accepted).
    /// * `commitment` — the 32-byte `SHA-256(salt || value)` hash.
    ///
    /// # Errors
    ///
    /// * [`Error::InvalidHashLength`] — `commitment` is not exactly 32 bytes.
    /// * [`Error::AlreadyCommitted`]  — a slot for `(committer, id)` already
    ///   exists (whether revealed or not).
    pub fn commit(
        env: Env,
        committer: Address,
        id: Bytes,
        commitment: Bytes,
    ) -> Result<(), ContractError> {
        committer.require_auth();

        if commitment.len() != 32 {
            return Err(ContractError::InvalidHashLength);
        }

        if storage::has(&env, &committer, &id) {
            return Err(ContractError::AlreadyCommitted);
        }

        let record = types::CommitRecord {
            commitment,
            committer: committer.clone(),
            status: types::CommitStatus::Committed,
        };
        storage::save(&env, &committer, &id, &record);

        Ok(())
    }

    /// Reveal the pre-image for a previously committed hash.
    ///
    /// The contract concatenates `salt || value`, computes
    /// `SHA-256(salt || value)`, and checks it against the stored commitment.
    /// On success the slot status is updated to [`CommitStatus::Revealed`] and
    /// the verified `value` bytes are returned.
    ///
    /// # Parameters
    ///
    /// * `committer` — must match the address that called `commit`.
    /// * `id`        — same nonce used in `commit`.
    /// * `salt`      — the secret salt mixed into the hash.
    /// * `value`     — the value being revealed.
    ///
    /// # Errors
    ///
    /// * [`Error::NotCommitted`]    — no slot exists for `(committer, id)`.
    /// * [`Error::AlreadyRevealed`] — the slot was already successfully revealed.
    /// * [`Error::NotCommitter`]    — caller does not match the stored committer.
    /// * [`Error::HashMismatch`]    — `SHA-256(salt || value)` ≠ stored hash.
    pub fn reveal(
        env: Env,
        committer: Address,
        id: Bytes,
        salt: Bytes,
        value: Bytes,
    ) -> Result<Bytes, ContractError> {
        committer.require_auth();

        let mut record = storage::load(&env, &committer, &id)
            .ok_or(ContractError::NotCommitted)?;

        if record.status == types::CommitStatus::Revealed {
            return Err(ContractError::AlreadyRevealed);
        }

        if record.committer != committer {
            return Err(ContractError::NotCommitter);
        }

        // Compute SHA-256(salt || value).
        let mut preimage = Bytes::new(&env);
        preimage.append(&salt);
        preimage.append(&value);
        let digest = env.crypto().sha256(&preimage);

        // Convert the 32-byte hash to Bytes for comparison.
        let digest_bytes = Bytes::from_array::<32>(&env, &digest.to_array());

        if digest_bytes != record.commitment {
            return Err(ContractError::HashMismatch);
        }

        record.status = types::CommitStatus::Revealed;
        storage::save(&env, &committer, &id, &record);

        Ok(value)
    }

    /// Return the current [`CommitRecord`] for `(committer, id)`, if any.
    ///
    /// Permissionless read — no auth required.
    pub fn get_commitment(
        env: Env,
        committer: Address,
        id: Bytes,
    ) -> Option<types::CommitRecord> {
        storage::load(&env, &committer, &id)
    }

    /// Return `true` if a slot for `(committer, id)` exists on-chain.
    ///
    /// Convenience predicate so callers do not have to inspect `Option`.
    pub fn has_commitment(env: Env, committer: Address, id: Bytes) -> bool {
        storage::has(&env, &committer, &id)
    }
}
