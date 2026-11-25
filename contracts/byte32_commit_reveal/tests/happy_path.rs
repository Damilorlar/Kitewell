//! Happy-path tests for the byte32 commit-reveal contract.
//!
//! Every test here follows the complete, unobstructed success path:
//! commit → reveal → inspect.

use byte32_commit_reveal::{Byte32CommitReveal, Byte32CommitRevealClient, CommitStatus};
use soroban_sdk::{
    testutils::Address as _,
    Address, Bytes, Env,
};

/// Build the SHA-256 pre-image `salt || value` and return its digest as `Bytes`.
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

/// `commit` followed by `reveal` succeeds and returns the original value.
#[test]
fn commit_then_reveal_returns_value() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[1u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt0");
    let value = Bytes::from_array::<5>(&env, b"hello");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);

    let revealed = client.reveal(&committer, &id, &salt, &value);
    assert_eq!(revealed, value);
}

/// After a successful reveal, `get_commitment` shows `Revealed` status.
#[test]
fn status_is_revealed_after_reveal() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[2u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt1");
    let value = Bytes::from_array::<3>(&env, b"abc");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);
    client.reveal(&committer, &id, &salt, &value);

    let record = client.get_commitment(&committer, &id).unwrap();
    assert_eq!(record.status, CommitStatus::Revealed);
}

/// `has_commitment` returns `true` once `commit` is called.
#[test]
fn has_commitment_true_after_commit() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[3u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt2");
    let value = Bytes::from_array::<4>(&env, b"data");
    let commitment = sha256_commitment(&env, &salt, &value);

    assert!(!client.has_commitment(&committer, &id));
    client.commit(&committer, &id, &commitment);
    assert!(client.has_commitment(&committer, &id));
}

/// `get_commitment` returns `None` for an address that has never committed.
#[test]
fn get_commitment_returns_none_before_commit() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[4u8; 32]);
    assert!(client.get_commitment(&committer, &id).is_none());
}

/// The same committer can hold two independent slots with distinct ids.
#[test]
fn two_independent_slots_for_same_committer() {
    let (env, committer, client) = setup();
    let id_a = Bytes::from_array::<32>(&env, &[10u8; 32]);
    let id_b = Bytes::from_array::<32>(&env, &[11u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slta");
    let value_a = Bytes::from_array::<2>(&env, b"aa");
    let value_b = Bytes::from_array::<2>(&env, b"bb");

    client.commit(&committer, &id_a, &sha256_commitment(&env, &salt, &value_a));
    client.commit(&committer, &id_b, &sha256_commitment(&env, &salt, &value_b));

    let ra = client.reveal(&committer, &id_a, &salt, &value_a);
    let rb = client.reveal(&committer, &id_b, &salt, &value_b);

    assert_eq!(ra, value_a);
    assert_eq!(rb, value_b);
}

/// Two different committers can independently use the same id.
#[test]
fn different_committers_same_id_are_independent() {
    let (env, committer_a, client) = setup();
    let committer_b = Address::generate(&env);
    let id = Bytes::from_array::<32>(&env, &[20u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"sltx");
    let value_a = Bytes::from_array::<3>(&env, b"foo");
    let value_b = Bytes::from_array::<3>(&env, b"bar");

    client.commit(&committer_a, &id, &sha256_commitment(&env, &salt, &value_a));
    client.commit(&committer_b, &id, &sha256_commitment(&env, &salt, &value_b));

    assert_eq!(client.reveal(&committer_a, &id, &salt, &value_a), value_a);
    assert_eq!(client.reveal(&committer_b, &id, &salt, &value_b), value_b);
}
