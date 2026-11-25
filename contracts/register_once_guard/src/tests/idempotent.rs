use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

use crate::{decide, Decision, RegisterOnceGuard, RegisterOnceGuardClient, Registration};

#[test]
fn a_second_decision_keeps_the_original_registration() {
    let first = Registration { at: 10 };
    assert_eq!(
        decide(Some(first), 99),
        Decision::Idempotent(Registration { at: 10 })
    );
}

#[test]
fn two_callers_register_independently() {
    let env = Env::default();
    env.mock_all_auths();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let id = env.register(RegisterOnceGuard, ());
    let guard = RegisterOnceGuardClient::new(&env, &id);

    assert!(guard.register(&alice));
    assert!(guard.register(&bob));
    assert!(!guard.register(&alice));
    assert_eq!(guard.registered_at(&alice), Some(0));
    assert_eq!(guard.registered_at(&bob), Some(0));
}
