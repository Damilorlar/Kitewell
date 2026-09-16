#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, String, Symbol};

const LAB: Symbol = symbol_short!("HELIOS");
const COUNT: Symbol = symbol_short!("COUNT");

#[contract]
pub struct HeliosLab;

#[contractimpl]
impl HeliosLab {
    /// Returns the lab name. Useful as a smoke-test invoke.
    pub fn lab_name(env: Env) -> String {
        String::from_str(&env, "Helios Lab")
    }

    /// How many builders have checked in.
    pub fn builder_count(env: Env) -> u32 {
        env.storage().instance().get(&COUNT).unwrap_or(0)
    }

    /// Check in a builder nickname for `caller`. Overwrites previous name.
    pub fn register(env: Env, caller: Address, name: String) {
        caller.require_auth();

        let key = (LAB, caller.clone());
        let is_new = !env.storage().persistent().has(&key);
        env.storage().persistent().set(&key, &name);

        if is_new {
            let count: u32 = env.storage().instance().get(&COUNT).unwrap_or(0);
            env.storage().instance().set(&COUNT, &(count + 1));
            env.storage().instance().extend_ttl(1000, 5000);
        }

        env.storage().persistent().extend_ttl(&key, 1000, 5000);
    }

    /// Look up a builder's registered nickname, if any.
    pub fn get_builder(env: Env, address: Address) -> Option<String> {
        let key = (LAB, address);
        env.storage().persistent().get(&key)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn lab_name_works() {
        let env = Env::default();
        let id = env.register(HeliosLab, ());
        let client = HeliosLabClient::new(&env, &id);
        assert_eq!(client.lab_name(), String::from_str(&env, "Helios Lab"));
    }

    #[test]
    fn register_and_count() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(HeliosLab, ());
        let client = HeliosLabClient::new(&env, &id);
        let a = Address::generate(&env);

        assert_eq!(client.builder_count(), 0);
        client.register(&a, &String::from_str(&env, "cem"));
        assert_eq!(client.builder_count(), 1);
        assert_eq!(
            client.get_builder(&a),
            Some(String::from_str(&env, "cem"))
        );
    }
}
