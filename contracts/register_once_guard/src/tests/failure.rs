use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

use crate::{RegisterOnceGuard, RegisterOnceGuardClient};

#[test]
#[should_panic]
fn register_panics_without_authorization() {
    let env = Env::default();
    let caller = Address::generate(&env);
    let id = env.register(RegisterOnceGuard, ());
    let guard = RegisterOnceGuardClient::new(&env, &id);

    guard.register(&caller);
}
