use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

use crate::{RegisterOnceGuard, RegisterOnceGuardClient};

fn client(env: &Env) -> RegisterOnceGuardClient<'_> {
    let id = env.register(RegisterOnceGuard, ());
    RegisterOnceGuardClient::new(env, &id)
}

#[test]
fn the_first_call_records_the_caller() {
    let env = Env::default();
    env.mock_all_auths();
    let caller = Address::generate(&env);
    let guard = client(&env);

    assert!(guard.register(&caller));
    assert_eq!(guard.registered_at(&caller), Some(0));
}
