//! Edge-case tests for the byte32 commit-reveal contract.
//!
//! Tests that probe boundary conditions: empty payloads, maximum-length
//! values, zero-byte salts, and committing with an empty id.

use byte32_commit_reveal::{Byte32CommitReveal, Byte32CommitRevealClient};
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

/// The `value` may be empty bytes — the contract does not validate its length.
#[test]
fn reveal_with_empty_value_succeeds() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[0u8; 32]);
    let salt = Bytes::from_array::<8>(&env, b"saltsalt");
    let value = Bytes::new(&env); // zero-length
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);
    let returned = client.reveal(&committer, &id, &salt, &value);
    assert_eq!(returned, value);
}

/// The `salt` may be empty — the commitment is still `SHA-256("" || value)`.
#[test]
fn reveal_with_empty_salt_succeeds() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[1u8; 32]);
    let salt = Bytes::new(&env); // zero-length
    let value = Bytes::from_array::<5>(&env, b"grain");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);
    let returned = client.reveal(&committer, &id, &salt, &value);
    assert_eq!(returned, value);
}

/// Both `salt` and `value` may be empty simultaneously.
#[test]
fn reveal_with_both_empty_salt_and_value_succeeds() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[2u8; 32]);
    let salt = Bytes::new(&env);
    let value = Bytes::new(&env);
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);
    let returned = client.reveal(&committer, &id, &salt, &value);
    assert_eq!(returned, value);
}

/// The `id` itself may be empty bytes — the key namespace handles this.
#[test]
fn commit_with_empty_id_succeeds() {
    let (env, committer, client) = setup();
    let id = Bytes::new(&env); // zero-length id
    let salt = Bytes::from_array::<4>(&env, b"slt0");
    let value = Bytes::from_array::<4>(&env, b"test");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);
    assert!(client.has_commitment(&committer, &id));
    let returned = client.reveal(&committer, &id, &salt, &value);
    assert_eq!(returned, value);
}

/// A commitment using all-zeros hash (valid 32-byte input) is accepted.
#[test]
fn all_zero_hash_is_a_valid_commitment() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[3u8; 32]);

    // We need a pre-image that hashes to all zeros — that's cryptographically
    // infeasible, so instead we just test that the contract stores the hash
    // without objection. `reveal` would fail with HashMismatch unless we find
    // a pre-image, so we only check commit + get here.
    let all_zeros = Bytes::from_array::<32>(&env, &[0u8; 32]);

    assert!(client.try_commit(&committer, &id, &all_zeros).is_ok());
    let record = client.get_commitment(&committer, &id).unwrap();
    assert_eq!(record.commitment, all_zeros);
}

/// A large value (1 KB) round-trips through commit and reveal correctly.
#[test]
fn large_value_round_trips() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[4u8; 32]);
    let salt = Bytes::from_array::<16>(&env, &[0xffu8; 16]);

    // Build a 256-byte value using repeated `push`.
    let mut big_value = Bytes::new(&env);
    for i in 0u8..=255 {
        big_value.push_back(i);
    }

    let commitment = sha256_commitment(&env, &salt, &big_value);
    client.commit(&committer, &id, &commitment);
    let returned = client.reveal(&committer, &id, &salt, &big_value);
    assert_eq!(returned, big_value);
}
