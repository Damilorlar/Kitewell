//! Event emission for `register` and `set_paused` (#223).
//!
//! Every test asserts the exact topics and data an indexer would see. Note that
//! the test env only exposes the events of the *last* contract invocation, so
//! each assertion is written right after the call it describes.

use kitewell::{Error, Kitewell, KitewellClient};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events as _},
    vec, Address, Env, IntoVal, String, Val, Vec,
};

/// The one event a successful `register` must publish: topics
/// `("register", caller)`, data `(name, is_new)`.
fn register_event(
    env: &Env,
    contract_id: &Address,
    caller: &Address,
    name: &String,
    is_new: bool,
) -> (Address, Vec<Val>, Val) {
    (
        contract_id.clone(),
        vec![
            env,
            symbol_short!("register").into_val(env),
            caller.clone().into_val(env),
        ],
        (name.clone(), is_new).into_val(env),
    )
}

/// The one event a successful `set_paused` must publish: topic `("paused",)`,
/// data the new flag.
fn paused_event(env: &Env, contract_id: &Address, paused: bool) -> (Address, Vec<Val>, Val) {
    (
        contract_id.clone(),
        vec![env, symbol_short!("paused").into_val(env)],
        paused.into_val(env),
    )
}

#[test]
fn register_publishes_event_for_new_builder() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let caller = Address::generate(&env);
    let name = String::from_str(&env, "cem");

    client.register(&caller, &name);

    assert_eq!(
        env.events().all(),
        vec![
            &env,
            register_event(&env, &contract_id, &caller, &name, true)
        ]
    );
}

#[test]
fn re_register_publishes_event_with_is_new_false() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let caller = Address::generate(&env);

    client.register(&caller, &String::from_str(&env, "cem"));
    let latest = String::from_str(&env, "cem-late");
    client.register(&caller, &latest);

    // A nickname change is still a `register` event, just not a new builder.
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            register_event(&env, &contract_id, &caller, &latest, false)
        ]
    );
    assert_eq!(client.builder_count(), 1);
}

#[test]
fn second_distinct_builder_is_also_is_new() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let first = Address::generate(&env);
    let second = Address::generate(&env);

    client.register(&first, &String::from_str(&env, "first"));
    let second_name = String::from_str(&env, "second");
    client.register(&second, &second_name);

    // `is_new` tracks the caller's own entry, not the global count.
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            register_event(&env, &contract_id, &second, &second_name, true)
        ]
    );
    assert_eq!(client.builder_count(), 2);
}

#[test]
fn pause_publishes_event_with_true() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.init(&admin);
    client.set_paused(&admin, &true);

    assert_eq!(
        env.events().all(),
        vec![&env, paused_event(&env, &contract_id, true)]
    );
}

#[test]
fn unpause_publishes_event_with_false() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.init(&admin);
    client.set_paused(&admin, &true);
    client.set_paused(&admin, &false);

    assert_eq!(
        env.events().all(),
        vec![&env, paused_event(&env, &contract_id, false)]
    );
}

#[test]
fn rejected_calls_publish_nothing() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let caller = Address::generate(&env);

    client.init(&admin);

    // Baseline: a successful call does publish, so a later empty list means
    // "nothing published" rather than "no event was ever possible".
    client.register(&caller, &String::from_str(&env, "cem"));
    assert_eq!(env.events().all().events().len(), 1);

    // Empty nickname: rejected before any event, even though auth passed.
    assert_eq!(
        client.try_register(&caller, &String::from_str(&env, "")),
        Err(Ok(Error::EmptyName))
    );
    assert!(env.events().all().events().is_empty());

    // Non-admin pause change: rejected before any event.
    let other = Address::generate(&env);
    assert_eq!(
        client.try_set_paused(&other, &true),
        Err(Ok(Error::NotAdmin))
    );
    assert!(env.events().all().events().is_empty());

    // Paused check-in: the pause itself is announced, the blocked
    // register is not.
    client.set_paused(&admin, &true);
    assert_eq!(
        client.try_register(&caller, &String::from_str(&env, "blocked")),
        Err(Ok(Error::Paused))
    );
    assert!(env.events().all().events().is_empty());
}

#[test]
fn unauthenticated_register_publishes_nothing() {
    let env = Env::default();
    // Deliberately no `mock_all_auths`: `require_auth` fails first.
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let caller = Address::generate(&env);

    assert!(client
        .try_register(&caller, &String::from_str(&env, "builder"))
        .is_err());
    assert!(env.events().all().events().is_empty());
}

#[test]
fn read_methods_publish_nothing() {
    let env = Env::default();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let stranger = Address::generate(&env);

    client.lab_name();
    assert!(env.events().all().events().is_empty());

    client.builder_count();
    assert!(env.events().all().events().is_empty());

    client.get_builder(&stranger);
    assert!(env.events().all().events().is_empty());
}
