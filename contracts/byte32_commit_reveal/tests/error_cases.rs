//! Failure / error-case tests for the byte32 commit-reveal contract.
//!
//! Every test here exercises a rejected call and checks the exact error code.

use byte32_commit_reveal::{Byte32CommitReveal, Byte32CommitRevealClient, Error};
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

/// `commit` with a hash shorter than 32 bytes returns `InvalidHashLength`.
#[test]
fn commit_rejects_short_hash() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[0u8; 32]);
    let short = Bytes::from_array::<16>(&env, &[0u8; 16]); // only 16 bytes

    assert_eq!(
        client.try_commit(&committer, &id, &short),
        Err(Ok(Error::InvalidHashLength))
    );
}

/// `commit` with a hash longer than 32 bytes returns `InvalidHashLength`.
#[test]
fn commit_rejects_long_hash() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[0u8; 32]);
    let long = Bytes::from_array::<48>(&env, &[0u8; 48]); // 48 bytes

    assert_eq!(
        client.try_commit(&committer, &id, &long),
        Err(Ok(Error::InvalidHashLength))
    );
}

/// A second `commit` for the same slot returns `AlreadyCommitted`.
#[test]
fn commit_twice_returns_already_committed() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[1u8; 32]);
    let hash = Bytes::from_array::<32>(&env, &[0xabu8; 32]);

    client.commit(&committer, &id, &hash);

    assert_eq!(
        client.try_commit(&committer, &id, &hash),
        Err(Ok(Error::AlreadyCommitted))
    );
}

/// `reveal` on a slot that was never committed returns `NotCommitted`.
#[test]
fn reveal_with_no_commit_returns_not_committed() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[2u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt0");
    let value = Bytes::from_array::<5>(&env, b"hello");

    assert_eq!(
        client.try_reveal(&committer, &id, &salt, &value),
        Err(Ok(Error::NotCommitted))
    );
}

/// `reveal` with the wrong value returns `HashMismatch`.
#[test]
fn reveal_wrong_value_returns_hash_mismatch() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[3u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt0");
    let real_value = Bytes::from_array::<5>(&env, b"hello");
    let wrong_value = Bytes::from_array::<5>(&env, b"world");
    let commitment = sha256_commitment(&env, &salt, &real_value);

    client.commit(&committer, &id, &commitment);

    assert_eq!(
        client.try_reveal(&committer, &id, &salt, &wrong_value),
        Err(Ok(Error::HashMismatch))
    );
}

/// `reveal` with the wrong salt returns `HashMismatch`.
#[test]
fn reveal_wrong_salt_returns_hash_mismatch() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[4u8; 32]);
    let real_salt = Bytes::from_array::<4>(&env, b"good");
    let bad_salt = Bytes::from_array::<4>(&env, b"evil");
    let value = Bytes::from_array::<4>(&env, b"data");
    let commitment = sha256_commitment(&env, &real_salt, &value);

    client.commit(&committer, &id, &commitment);

    assert_eq!(
        client.try_reveal(&committer, &id, &bad_salt, &value),
        Err(Ok(Error::HashMismatch))
    );
}

/// Revealing a slot a second time returns `AlreadyRevealed`.
#[test]
fn reveal_twice_returns_already_revealed() {
    let (env, committer, client) = setup();
    let id = Bytes::from_array::<32>(&env, &[5u8; 32]);
    let salt = Bytes::from_array::<4>(&env, b"slt1");
    let value = Bytes::from_array::<4>(&env, b"once");
    let commitment = sha256_commitment(&env, &salt, &value);

    client.commit(&committer, &id, &commitment);
    client.reveal(&committer, &id, &salt, &value);

    assert_eq!(
        client.try_reveal(&committer, &id, &salt, &value),
        Err(Ok(Error::AlreadyRevealed))
    );
}

/// Error discriminants must stay stable so that off-chain tooling can rely
/// on numeric codes rather than text matching.
#[test]
fn error_discriminants_are_stable() {
    assert_eq!(Error::InvalidHashLength as u32, 1);
    assert_eq!(Error::AlreadyCommitted as u32, 2);
    assert_eq!(Error::NotCommitted as u32, 3);
    assert_eq!(Error::HashMismatch as u32, 4);
    assert_eq!(Error::AlreadyRevealed as u32, 5);
    assert_eq!(Error::NotCommitter as u32, 6);
}
