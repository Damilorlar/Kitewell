//! Soroban entry point for the builder-name length guard.

#![no_std]

mod name;

use soroban_sdk::{contract, contractimpl, Env, String};

pub use name::{is_valid_builder_name, validate_builder_name, NameError, MAX_NAME_LEN, MIN_NAME_LEN};

#[contract]
pub struct NameLengthGuard;

#[contractimpl]
impl NameLengthGuard {
    /// Returns true when `name` matches the builder-name rules.
    pub fn validate_name(_env: Env, name: String) -> bool {
        name_bytes_valid(&name)
    }
}

fn name_bytes_valid(name: &String) -> bool {
    let len = name.len() as usize;
    if len > MAX_NAME_LEN {
        return false;
    }
    let mut buffer = [0u8; MAX_NAME_LEN];
    name.copy_into_slice(&mut buffer[..len]);
    let Ok(text) = core::str::from_utf8(&buffer[..len]) else {
        return false;
    };
    is_valid_builder_name(text)
}

#[cfg(test)]
mod tests;
