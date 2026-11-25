use kitewell::{Kitewell, KitewellClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

/// Two different callers each check in once. Both are counted, and each
/// address keeps its own nickname.
#[test]
fn two_different_builders_both_count() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);
    let first = Address::generate(&env);
    let second = Address::generate(&env);

    client.register(&first, &String::from_str(&env, "ada"));
    client.register(&second, &String::from_str(&env, "gus"));

    assert_eq!(client.builder_count(), 2);
    assert_eq!(
        client.get_builder(&first),
        Some(String::from_str(&env, "ada"))
    );
    assert_eq!(
        client.get_builder(&second),
        Some(String::from_str(&env, "gus"))
    );
}
