#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, symbol_short, Address, Env, String,
    Symbol, Vec,
};

const LAB: Symbol = symbol_short!("KITEWELL");
const COUNT: Symbol = symbol_short!("COUNT");
const INDEX: Symbol = symbol_short!("INDEX");

/// Hard cap on one `list_builders` page, so a single read stays small.
const BUILDER_PAGE_MAX: u32 = 50;

fn read_index(env: &Env) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&INDEX)
        .unwrap_or(Vec::new(env))
}

fn index_position(index: &Vec<Address>, address: &Address) -> Option<u32> {
    let mut cursor = 0;
    while cursor < index.len() {
        if index.get(cursor).as_ref() == Some(address) {
            return Some(cursor);
        }
        cursor += 1;
    }
    None
}
const ADMIN: Symbol = symbol_short!("ADMIN");
const PENDING_ADMIN: Symbol = symbol_short!("PENDING");
const PAUSED: Symbol = symbol_short!("PAUSED");

/// Contract errors.
///
/// Pattern chosen: a `#[contracterror]` enum returned as `Result<_, Error>`.
/// Compared with a stringly `panic!`, this keeps `EmptyName` in the contract
/// spec and lets the generated `try_register` surface it as
/// `Err(Ok(Error::EmptyName))`. (`panic_with_error!(&env, Error::EmptyName)` is
/// the equivalent for a fn that must keep a non-`Result` signature.)
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    EmptyName = 1,
    AlreadyInit = 2,
    NotAdmin = 3,
    Paused = 4,
    NoPendingAdmin = 5,
    NotRegistered = 6,
}

/// Emitted by every successful `register`.
///
/// Topics: `("register", caller)`, data: `(name, is_new)` — `is_new` is true
/// only for the caller's first check-in, so an indexer can follow the builder
/// count without re-reading state.
#[contractevent(topics = ["register"], data_format = "vec")]
pub struct Register {
    #[topic]
    pub caller: Address,
    pub name: String,
    pub is_new: bool,
}

/// Emitted by every successful `set_paused`.
///
/// Topics: `("paused",)`, data: the new pause flag, so both pausing and
/// unpausing are visible off-chain.
#[contractevent(topics = ["paused"], data_format = "single-value")]
pub struct Paused {
    pub paused: bool,
}

#[contract]
pub struct Kitewell;

#[contractimpl]
impl Kitewell {
    /// One-time initialiser that sets the admin address.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&ADMIN) {
            return Err(Error::AlreadyInit);
        }
        env.storage().instance().set(&ADMIN, &admin);
        Ok(())
    }

    /// Propose a successor admin. Current admin only.
    ///
    /// `admin` must be the stored admin and must sign the call. The successor
    /// is recorded as *pending* only — it gains no rights until it calls
    /// `accept_admin`, so a mistaken proposal never moves control on its own.
    /// Proposing again overwrites any earlier pending admin.
    pub fn propose_admin(
        env: Env,
        admin: Address,
        new_admin: Address,
    ) -> Result<(), Error> {
        admin.require_auth();
        let stored: Address = env
            .storage()
            .instance()
            .get(&ADMIN)
            .ok_or(Error::NotAdmin)?;
        if admin != stored {
            return Err(Error::NotAdmin);
        }
        env.storage().instance().set(&PENDING_ADMIN, &new_admin);
        Ok(())
    }

    /// Accept a pending admin transfer. Must be called by the pending admin.
    ///
    /// The caller signs the call and must equal the address stored by
    /// `propose_admin`; on success it becomes the live admin and the pending
    /// slot is cleared.
    pub fn accept_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        new_admin.require_auth();
        let pending: Address = env
            .storage()
            .instance()
            .get(&PENDING_ADMIN)
            .ok_or(Error::NoPendingAdmin)?;
        if new_admin != pending {
            return Err(Error::NotAdmin);
        }
        env.storage().instance().set(&ADMIN, &new_admin);
        env.storage().instance().remove(&PENDING_ADMIN);
        Ok(())
    }

    /// Read the current admin, if `init` has run.
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&ADMIN)
    }

    /// Read the pending admin, if one has been proposed.
    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&PENDING_ADMIN)
    }

    /// Admin-only pause / unpause toggle.
    ///
    /// On success it publishes the `paused` event: topic `("paused",)`, data
    /// the new `paused` flag. A rejected caller publishes nothing.
    pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), Error> {
        admin.require_auth();
        let stored: Address = env
            .storage()
            .instance()
            .get(&ADMIN)
            .ok_or(Error::NotAdmin)?;
        if admin != stored {
            return Err(Error::NotAdmin);
        }
        env.storage().instance().set(&PAUSED, &paused);

        // Off-chain observers (indexers, the Lab tab) follow pause changes
        // through this event. Published after the write and after every check,
        // so a rejected caller announces nothing.
        Paused { paused }.publish(&env);

        Ok(())
    }

    /// Returns the lab name. Useful as a smoke-test invoke.
    pub fn lab_name(env: Env) -> String {
        String::from_str(&env, "Kitewell")
    }

    /// How many builders have checked in.
    pub fn builder_count(env: Env) -> u32 {
        env.storage().instance().get(&COUNT).unwrap_or(0)
    }

    /// Page through the addresses in the registry index.
    ///
    /// The index holds one row per registered builder, in check-in order, so
    /// the length always matches `builder_count`. `start` past the end returns
    /// an empty page rather than an error. Pages are capped at
    /// `BUILDER_PAGE_MAX` entries so a single read cannot grow unbounded.
    pub fn list_builders(env: Env, start: u32, limit: u32) -> Vec<Address> {
        let index = read_index(&env);
        let len = index.len();
        let mut page = Vec::new(&env);

        if limit == 0 || start >= len {
            return page;
        }

        let end = start.saturating_add(limit.min(BUILDER_PAGE_MAX)).min(len);
        let mut cursor = start;
        while cursor < end {
            if let Some(address) = index.get(cursor) {
                page.push_back(address);
            }
            cursor += 1;
        }

        page
    }

    /// Check in a builder nickname for `caller`. Overwrites previous name.
    ///
    /// Rejects an empty nickname, so a stored builder always has a name.
    ///
    /// On success it publishes the `register` event: topics
    /// `("register", caller)`, data `(name, is_new)` where `is_new` is true
    /// only when this was the caller's first check-in.
    pub fn register(env: Env, caller: Address, name: String) -> Result<(), Error> {
        caller.require_auth();

        // Empty-name guard: payload validation only, so it stays independent of
        // the admin pause flag (#13) and of any other state-based check.
        if name.is_empty() {
            return Err(Error::EmptyName);
        }

        let paused: bool = env.storage().instance().get(&PAUSED).unwrap_or(false);
        if paused {
            return Err(Error::Paused);
        }

        let key = (LAB, caller.clone());
        let is_new = !env.storage().persistent().has(&key);
        env.storage().persistent().set(&key, &name);

        if is_new {
            let count: u32 = env.storage().instance().get(&COUNT).unwrap_or(0);
            env.storage().instance().set(&COUNT, &(count + 1));
            env.storage().instance().extend_ttl(1000, 5000);

            // The index carries one row per registered builder. It is only
            // appended for a first check-in, so a second register for the same
            // address cannot add a duplicate row.
            let mut index = read_index(&env);
            index.push_back(caller.clone());
            env.storage().persistent().set(&INDEX, &index);
            env.storage().persistent().extend_ttl(&INDEX, 1000, 5000);
        }

        env.storage().persistent().extend_ttl(&key, 1000, 5000);

        // Emitted only after every check passed and storage was written, so a
        // rejected check-in (empty name, paused) publishes nothing.
        Register {
            caller: caller.clone(),
            name,
            is_new,
        }
        .publish(&env);

        Ok(())
    }

    /// Rename a builder's existing nickname. Count unchanged.
    ///
    /// Auth-gated to `caller`. Requires the caller to already be registered,
    /// and rejects an empty new name just like `register`. Blocked while
    /// paused. On success the stored name updates and `COUNT` stays stable,
    /// so a builder who mistyped can edit in place without inflating the
    /// count.
    pub fn rename(env: Env, caller: Address, new_name: String) -> Result<(), Error> {
        caller.require_auth();

        // Empty-name guard: payload validation.
        if new_name.is_empty() {
            return Err(Error::EmptyName);
        }

        let paused: bool = env.storage().instance().get(&PAUSED).unwrap_or(false);
        if paused {
            return Err(Error::Paused);
        }

        let key = (LAB, caller.clone());
        if !env.storage().persistent().has(&key) {
            return Err(Error::NotRegistered);
        }

        env.storage().persistent().set(&key, &new_name);
        env.storage().persistent().extend_ttl(&key, 1000, 5000);

        Ok(())
    }

    /// Remove the caller's own check-in.
    ///
    /// Auth-gated to `caller`, and blocked while paused just like `register`.
    /// Rejects an address that has no entry with `NotRegistered`, so the count
    /// can never be decremented for a builder that was never counted. The
    /// stored nickname is removed and `COUNT` goes down by one; re-registering
    /// later therefore counts as a brand new builder again.
    pub fn unregister(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();

        let paused: bool = env.storage().instance().get(&PAUSED).unwrap_or(false);
        if paused {
            return Err(Error::Paused);
        }

        let key = (LAB, caller.clone());
        if !env.storage().persistent().has(&key) {
            return Err(Error::NotRegistered);
        }
        env.storage().persistent().remove(&key);

        // Drop the caller's row from the index so its length keeps matching
        // `COUNT`. The entry is known to exist, so a stored index built by
        // `register` must contain it.
        let mut index = read_index(&env);
        if let Some(position) = index_position(&index, &caller) {
            index.remove(position);
            env.storage().persistent().set(&INDEX, &index);
            env.storage().persistent().extend_ttl(&INDEX, 1000, 5000);
        }

        // `COUNT` is only bumped together with a stored entry, so it is at
        // least 1 here; saturating_sub keeps the never-below-zero invariant.
        let count: u32 = env.storage().instance().get(&COUNT).unwrap_or(0);
        env.storage().instance().set(&COUNT, &count.saturating_sub(1));

        Ok(())
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
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        assert_eq!(client.lab_name(), String::from_str(&env, "Kitewell"));
    }

    #[test]
    fn register_and_count() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let a = Address::generate(&env);

        assert_eq!(client.builder_count(), 0);
        client.register(&a, &String::from_str(&env, "cem"));
        assert_eq!(client.builder_count(), 1);
        assert_eq!(
            client.get_builder(&a),
            Some(String::from_str(&env, "cem"))
        );
    }

    #[test]
    fn register_rejects_empty_name() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let a = Address::generate(&env);

        assert_eq!(
            client.try_register(&a, &String::from_str(&env, "")),
            Err(Ok(Error::EmptyName))
        );

        // The rejected check-in wrote nothing: no nickname and no count bump.
        assert_eq!(client.get_builder(&a), None);
        assert_eq!(client.builder_count(), 0);
    }

    #[test]
    fn register_rejects_empty_name_while_paused() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);
        let a = Address::generate(&env);

        client.init(&admin);
        client.set_paused(&admin, &true);

        // Empty name is payload validation, so pause does not change the error.
        assert_eq!(
            client.try_register(&a, &String::from_str(&env, "")),
            Err(Ok(Error::EmptyName))
        );
        assert_eq!(client.get_builder(&a), None);
        assert_eq!(client.builder_count(), 0);
    }

    #[test]
    fn get_builder_never_registered_is_none() {
        let env = Env::default();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let stranger = Address::generate(&env);

        // Lookup is a pure read: no auth and nothing written for an unknown addr.
        assert_eq!(client.get_builder(&stranger), None);
    }

    #[test]
    fn register_twice_keeps_count_and_latest_name() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let a = Address::generate(&env);

        client.register(&a, &String::from_str(&env, "cem"));
        assert_eq!(client.builder_count(), 1);

        // Re-registering is idempotent for the count and overwrites the nickname.
        client.register(&a, &String::from_str(&env, "cem-late"));
        assert_eq!(client.builder_count(), 1);
        assert_eq!(
            client.get_builder(&a),
            Some(String::from_str(&env, "cem-late"))
        );
    }

    #[test]
    fn init_sets_admin() {
        let env = Env::default();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);

        assert!(client.try_init(&admin).is_ok());
        // The connected account that signs the Lab deploy becomes the admin.
        assert_eq!(client.get_admin(), Some(admin));
    }

    #[test]
    fn init_fails_if_already_set() {
        let env = Env::default();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);

        client.init(&admin);
        assert_eq!(client.try_init(&admin), Err(Ok(Error::AlreadyInit)));
    }

    #[test]
    fn set_paused_works_as_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);

        client.init(&admin);
        assert!(client.try_set_paused(&admin, &true).is_ok());
    }

    #[test]
    fn set_paused_rejects_non_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);
        let other = Address::generate(&env);

        client.init(&admin);
        assert_eq!(
            client.try_set_paused(&other, &true),
            Err(Ok(Error::NotAdmin))
        );
    }

    #[test]
    fn set_paused_rejects_before_init() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);

        assert_eq!(
            client.try_set_paused(&admin, &true),
            Err(Ok(Error::NotAdmin))
        );
    }

    #[test]
    fn register_rejects_when_paused() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);
        let a = Address::generate(&env);

        client.init(&admin);
        client.set_paused(&admin, &true);

        assert_eq!(
            client.try_register(&a, &String::from_str(&env, "blocked")),
            Err(Ok(Error::Paused))
        );
        assert_eq!(client.builder_count(), 0);
    }

    #[test]
    fn register_resumes_after_unpause() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);
        let a = Address::generate(&env);

        client.init(&admin);
        client.set_paused(&admin, &true);
        client.set_paused(&admin, &false);

        client.register(&a, &String::from_str(&env, "cem"));
        assert_eq!(client.builder_count(), 1);
    }

    #[test]
    fn paused_defaults_false_and_follows_set_paused() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);

        // A contract that was never paused reports false, not a missing value.
        assert!(!client.paused());

        client.init(&admin);
        client.set_paused(&admin, &true);
        assert!(client.paused());

        client.set_paused(&admin, &false);
        assert!(!client.paused());
    }

    #[test]
    fn get_builder_unregistered_address_is_none() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let known = Address::generate(&env);
        let stranger = Address::generate(&env);

        // Populate the registry so the miss is not just an empty contract.
        client.register(&known, &String::from_str(&env, "cem"));
        assert_eq!(
            client.get_builder(&known),
            Some(String::from_str(&env, "cem"))
        );

        // A never-registered address has no entry even alongside real ones.
        assert_eq!(client.get_builder(&stranger), None);
        assert_eq!(client.builder_count(), 1);
    }

    #[test]
    fn rename_changes_name_without_changing_count() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let a = Address::generate(&env);

        // Register first
        client.register(&a, &String::from_str(&env, "typo"));
        assert_eq!(client.builder_count(), 1);
        assert_eq!(
            client.get_builder(&a),
            Some(String::from_str(&env, "typo"))
        );

        // Rename keeps the count stable
        client.rename(&a, &String::from_str(&env, "fixed"));
        assert_eq!(client.builder_count(), 1);
        assert_eq!(
            client.get_builder(&a),
            Some(String::from_str(&env, "fixed"))
        );
    }

    #[test]
    fn rename_twice_keeps_count_stable() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let a = Address::generate(&env);

        client.register(&a, &String::from_str(&env, "first"));
        assert_eq!(client.builder_count(), 1);

        client.rename(&a, &String::from_str(&env, "second"));
        assert_eq!(client.builder_count(), 1);

        client.rename(&a, &String::from_str(&env, "third"));
        assert_eq!(client.builder_count(), 1);
        assert_eq!(
            client.get_builder(&a),
            Some(String::from_str(&env, "third"))
        );
    }

    #[test]
    fn rename_rejects_unregistered_caller() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let a = Address::generate(&env);

        assert_eq!(
            client.try_rename(&a, &String::from_str(&env, "nope")),
            Err(Ok(Error::NotRegistered))
        );
        assert_eq!(client.get_builder(&a), None);
        assert_eq!(client.builder_count(), 0);
    }

    #[test]
    fn rename_rejects_empty_name() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let a = Address::generate(&env);

        client.register(&a, &String::from_str(&env, "valid"));
        assert_eq!(
            client.try_rename(&a, &String::from_str(&env, "")),
            Err(Ok(Error::EmptyName))
        );
        // Name unchanged
        assert_eq!(
            client.get_builder(&a),
            Some(String::from_str(&env, "valid"))
        );
    }

    #[test]
    fn rename_rejects_when_paused() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(Kitewell, ());
        let client = KitewellClient::new(&env, &id);
        let admin = Address::generate(&env);
        let a = Address::generate(&env);

        client.init(&admin);
        client.register(&a, &String::from_str(&env, "before"));
        client.set_paused(&admin, &true);

        assert_eq!(
            client.try_rename(&a, &String::from_str(&env, "blocked")),
            Err(Ok(Error::Paused))
        );
        // Name unchanged
        assert_eq!(
            client.get_builder(&a),
            Some(String::from_str(&env, "before"))
        );
    }
}
