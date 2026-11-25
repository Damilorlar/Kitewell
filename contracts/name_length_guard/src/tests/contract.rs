use soroban_sdk::{Env, String};

use crate::{NameLengthGuard, NameLengthGuardClient};

#[test]
fn the_contract_accepts_the_same_names_as_the_helper() {
    let env = Env::default();
    let id = env.register(NameLengthGuard, ());
    let client = NameLengthGuardClient::new(&env, &id);
    assert!(client.validate_name(&String::from_str(&env, "Lab 2")));
    assert!(!client.validate_name(&String::from_str(&env, "A")));
    assert!(!client.validate_name(&String::from_str(&env, "Lab_")));
}
