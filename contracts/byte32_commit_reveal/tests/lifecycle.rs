//! Lifecycle and re-use tests specific to the commit-reveal concept.
//!
//! Explores the round-trip state transitions:
//!   absent → Committed → Revealed
//! and verifies that terminal states are enforced.

use byte32_commit_reveal::{
    Byte32CommitReveal, Byte32CommitRevealClient, CommitStatus, Error,
};
use soroban_sdk::{
    testutils::Address as _,
    Address, Bytes, Env,
};

fn sha256_commitment(env: &Env, salt: &Bytes, value: &Bytes) -> Bytes {
    let mut preimage = Bytes::new(env);
    preimage.append(salt);
    preimage.append(value);
    let digest = env.crypto().sha256(&preimage);
    Bytes::from_array::<32>(env, &digest.to_array())
}

fn setup() -> (Env, Address, Byte32CommitRevealClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Byte32CommitReveal, ());
    let client = Byte32CommitRevealClient::new(&env, &contract_id);
    let committer = Address::generate(&env);
    (env, committer, client)
}

/// Before any call, `has_commitment` is `false` and `get_commitment` is `None`.
#[test]
fn fresh_contract_has_no_commitments() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[0u8; 32]);
    assert!(!client.has_commitment(&committer, &id));
    assert!(client.get_commitment(&committer, &id).is_none());
}

/// After `commit` the status is `Committed`; `has_commitment` is `true`.
#[test]
fn commit_sets_committed_status() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[1u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt0");
    let value = Bytes::from_array::<4>(&env, b"data");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);

    let record = client.get_commitment(&committer, &id).unwrap();
    assert_eq!(record.status, CommitStatus::Committed);
    assert!(client.has_commitment(&committer, &id));
}

/// After `reveal` the status transitions from `Committed` to `Revealed`.
#[test]
fn reveal_transitions_to_revealed() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[2u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt1");
    let value = Bytes::from_array::<3>(&env, b"foo");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);
    assert_eq!(
        client.get_commitment(&committer, &id).unwrap().status,
        CommitStatus::Committed
    );

    client.reveal(&committer, &id, &salt, &value);
    assert_eq!(
        client.get_commitment(&committer, &id).unwrap().status,
        CommitStatus::Revealed
    );
}

/// A revealed slot cannot be re-committed (the slot still exists).
#[test]
fn cannot_recommit_after_reveal() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[3u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt2");
    let value = Bytes::from_array::<3>(&env, b"bar");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);
    client.reveal(&committer, &id, &salt, &value);

    // The slot is `Revealed` and still present — a second commit must fail.
    assert_eq!(
        client.try_commit(&committer, &id, &commitment),
        Err(Ok(Error::AlreadyCommitted))
    );
}

/// A failed `reveal` (hash mismatch) does NOT change the slot status — the
/// slot remains `Committed` and the correct pre-image can still be revealed.
#[test]
fn failed_reveal_leaves_slot_committed() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[4u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt3");
    let value = Bytes::from_array::<5>(&env, b"right");
    let wrong = Bytes::from_array::<5>(&env, b"wrong");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);

    // Bad reveal.
    assert_eq!(
        client.try_reveal(&committer, &id, &salt, &wrong),
        Err(Ok(Error::HashMismatch))
    );

    // Slot is still Committed — the correct reveal succeeds.
    assert_eq!(
        client.get_commitment(&committer, &id).unwrap().status,
        CommitStatus::Committed
    );
    assert!(client.try_reveal(&committer, &id, &salt, &value).is_ok());
}

/// The stored commitment bytes are readable via `get_commitment` after commit.
#[test]
fn get_commitment_returns_stored_hash() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[5u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt4");
    let value = Bytes::from_array::<4>(&env, b"peek");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);

    let record = client.get_commitment(&committer, &id).unwrap();
    assert_eq!(record.commitment, commitment);
    assert_eq!(record.committer, committer);
}

/// Many slots for the same committer are all independently addressable.
#[test]
fn many_slots_are_independent() {
    let (env, committer, client) = setup();
    let salt = Bytes::from_array::<4>(&env, b"slt5");

    // Commit 5 distinct slots.
    let slots: Vec<(Bytes, Bytes)> = (0u8..5)
        .map(|i| {
            let mut id_arr = [0u8; 32];
            id_arr[0] = i;
            let id = Bytes::from_array::<32>(&env, &id_arr);
            let val = Bytes::from_array::<1>(&env, &[i]);
            let commitment = sha256_commitment(&env, &salt, &val);
            client.commit(&committer, &id, &commitment);
            (id, val)
        })
        .collect();

    // Reveal each and verify independently.
    for (id, val) in &slots {
        let returned = client.reveal(&committer, id, &salt, val);
        assert_eq!(returned, *val);
    }

    // All five are now Revealed.
    for (id, _) in &slots {
        assert_eq!(
            client.get_commitment(&committer, id).unwrap().status,
            CommitStatus::Revealed
        );
    }
}
