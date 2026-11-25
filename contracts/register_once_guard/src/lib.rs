//! Register a caller once. A later call from the same caller is a no-op.

#![no_std]

mod register;

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

pub use register::{decide, Decision, Registration};

#[contracttype]
enum DataKey {
    Registered(Address),
}

#[contract]
pub struct RegisterOnceGuard;

#[contractimpl]
impl RegisterOnceGuard {
    /// Records `caller` at the current ledger time.
    ///
    /// Returns true only on the first successful call. Later calls keep the
    /// original timestamp and return false.
    pub fn register(env: Env, caller: Address) -> bool {
        caller.require_auth();
        let key = DataKey::Registered(caller);
        let existing = env
            .storage()
            .persistent()
            .get(&key)
            .map(|at| Registration { at });
        match decide(existing, env.ledger().timestamp()) {
            Decision::Idempotent(_) => false,
            Decision::Created(registration) => {
                env.storage().persistent().set(&key, &registration.at);
                true
            }
        }
    }

    /// Ledger time of the first registration, if `caller` has registered.
    pub fn registered_at(env: Env, caller: Address) -> Option<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::Registered(caller))
    }
}

#[cfg(test)]
mod tests;
