use kitewell::{Kitewell, KitewellClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn register_requires_caller_auth() {
    let env = Env::default();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let caller = Address::generate(&env);

    assert!(client
        .try_register(&caller, &String::from_str(&env, "builder"))
        .is_err());
    assert_eq!(client.builder_count(), 0);
}
