use kitewell::{Kitewell, KitewellClient};
use soroban_sdk::Env;

/// The count read is a permissionless pure read: a freshly registered contract
/// falls back to 0 when `COUNT` has never been written, so no `init` or
/// `register` call is needed to observe the default.
#[test]
fn builder_count_is_zero_on_fresh_contract() {
    let env = Env::default();
    let contract_id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &contract_id);

    assert_eq!(client.builder_count(), 0);
}
