use kitewell::{Error, Kitewell, KitewellClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn unregister_happy_path() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let a = Address::generate(&env);

    client.register(&a, &String::from_str(&env, "cem"));
    assert_eq!(client.builder_count(), 1);
    assert_eq!(client.get_builder(&a), Some(String::from_str(&env, "cem")));

    assert!(client.try_unregister(&a).is_ok());

    // The persistent entry is gone and the count is back to zero.
    assert_eq!(client.get_builder(&a), None);
    assert_eq!(client.builder_count(), 0);
}

#[test]
fn unregister_rejects_not_registered() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let stranger = Address::generate(&env);

    // Nothing to remove for an address that never checked in.
    assert_eq!(
        client.try_unregister(&stranger),
        Err(Ok(Error::NotRegistered))
    );
    assert_eq!(client.builder_count(), 0);
}

#[test]
fn unregister_rejects_when_paused() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let admin = Address::generate(&env);
    let a = Address::generate(&env);

    client.init(&admin);
    client.register(&a, &String::from_str(&env, "cem"));
    client.set_paused(&admin, &true);

    // Pause blocks removal the same way it blocks registration.
    assert_eq!(client.try_unregister(&a), Err(Ok(Error::Paused)));

    // The rejected call left the entry and the count untouched.
    assert_eq!(client.get_builder(&a), Some(String::from_str(&env, "cem")));
    assert_eq!(client.builder_count(), 1);
}

#[test]
fn unregister_requires_caller_auth() {
    let env = Env::default();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let caller = Address::generate(&env);

    // No auth mocked: the require_auth gate rejects the call.
    assert!(client.try_unregister(&caller).is_err());
    assert_eq!(client.builder_count(), 0);
}

#[test]
fn re_registering_after_unregister_counts_as_new() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let a = Address::generate(&env);

    client.register(&a, &String::from_str(&env, "cem"));
    assert_eq!(client.builder_count(), 1);

    client.unregister(&a);
    assert_eq!(client.builder_count(), 0);

    // Coming back is a fresh check-in, with a new nickname and a count bump.
    client.register(&a, &String::from_str(&env, "cem-again"));
    assert_eq!(client.builder_count(), 1);
    assert_eq!(
        client.get_builder(&a),
        Some(String::from_str(&env, "cem-again"))
    );
}

#[test]
fn unregister_leaves_other_builders_untouched() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    client.register(&a, &String::from_str(&env, "cem"));
    client.register(&b, &String::from_str(&env, "ada"));
    assert_eq!(client.builder_count(), 2);

    client.unregister(&a);

    // Only the caller's row is removed; the other builder stays counted.
    assert_eq!(client.get_builder(&a), None);
    assert_eq!(
        client.get_builder(&b),
        Some(String::from_str(&env, "ada"))
    );
    assert_eq!(client.builder_count(), 1);
}

#[test]
fn error_discriminants_stay_stable_after_adding_not_registered() {
    assert_eq!(Error::EmptyName as u32, 1);
    assert_eq!(Error::AlreadyInit as u32, 2);
    assert_eq!(Error::NotAdmin as u32, 3);
    assert_eq!(Error::Paused as u32, 4);
    assert_eq!(Error::NotRegistered as u32, 6);
}
