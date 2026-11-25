use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, Env};

use crate::{decide, Decision, RegisterOnceGuard, RegisterOnceGuardClient, Registration};

#[test]
fn a_zero_timestamp_is_a_valid_first_registration() {
    let created = decide(None, 0);
    assert_eq!(created, Decision::Created(Registration { at: 0 }));
}

#[test]
fn a_later_ledger_time_does_not_replace_the_original() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(0);
    let caller = Address::generate(&env);
    let id = env.register(RegisterOnceGuard, ());
    let guard = RegisterOnceGuardClient::new(&env, &id);

    assert!(guard.register(&caller));
    env.ledger().set_timestamp(50);
    assert!(!guard.register(&caller));
    assert_eq!(guard.registered_at(&caller), Some(0));
}
