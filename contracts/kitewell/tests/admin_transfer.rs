use kitewell::{Error, Kitewell, KitewellClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn admin_transfer_happy_path() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    client.init(&admin);
    assert_eq!(client.get_admin(), Some(admin.clone()));

    // Proposing does not move control: the current admin is still in charge.
    assert!(client.try_propose_admin(&admin, &new_admin).is_ok());
    assert_eq!(client.get_admin(), Some(admin.clone()));

    // Only after the successor accepts does it become the live admin.
    assert!(client.try_accept_admin(&new_admin).is_ok());
    assert_eq!(client.get_admin(), Some(new_admin.clone()));

    // And the new admin can exercise admin-only powers.
    assert!(client.try_set_paused(&new_admin, &true).is_ok());
}

#[test]
fn propose_rejected_for_non_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let admin = Address::generate(&env);
    let other = Address::generate(&env);
    let new_admin = Address::generate(&env);

    client.init(&admin);

    assert_eq!(
        client.try_propose_admin(&other, &new_admin),
        Err(Ok(Error::NotAdmin))
    );
    // The rejected proposal left the admin untouched.
    assert_eq!(client.get_admin(), Some(admin.clone()));
}

#[test]
fn propose_rejected_before_init() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let anyone = Address::generate(&env);

    // With no admin stored, nobody can propose a successor.
    assert_eq!(
        client.try_propose_admin(&anyone, &anyone),
        Err(Ok(Error::NotAdmin))
    );
}

#[test]
fn accept_rejected_for_wrong_account() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let admin = Address::generate(&env);
    let pending = Address::generate(&env);
    let stranger = Address::generate(&env);

    client.init(&admin);
    client.propose_admin(&admin, &pending);

    // A signed call from anyone but the pending admin is refused...
    assert_eq!(
        client.try_accept_admin(&stranger),
        Err(Ok(Error::NotAdmin))
    );
    assert_eq!(client.get_admin(), Some(admin.clone()));

    // ...and the failed attempt does not consume the pending proposal.
    assert!(client.try_accept_admin(&pending).is_ok());
    assert_eq!(client.get_admin(), Some(pending.clone()));
}

#[test]
fn accept_rejected_with_nothing_pending() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let admin = Address::generate(&env);

    client.init(&admin);

    // Even the live admin cannot accept when no successor was proposed.
    assert_eq!(
        client.try_accept_admin(&admin),
        Err(Ok(Error::NoPendingAdmin))
    );
    assert_eq!(client.get_admin(), Some(admin.clone()));
}

#[test]
fn accept_rejected_before_init() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let anyone = Address::generate(&env);

    assert_eq!(
        client.try_accept_admin(&anyone),
        Err(Ok(Error::NoPendingAdmin))
    );
}

#[test]
fn old_admin_loses_rights_after_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    client.init(&admin);
    client.propose_admin(&admin, &new_admin);
    client.accept_admin(&new_admin);

    // The previous admin no longer passes the stored-address check.
    assert_eq!(
        client.try_set_paused(&admin, &true),
        Err(Ok(Error::NotAdmin))
    );
    assert!(client.try_set_paused(&new_admin, &true).is_ok());
}

#[test]
fn re_proposing_overwrites_pending() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let admin = Address::generate(&env);
    let first = Address::generate(&env);
    let second = Address::generate(&env);

    client.init(&admin);
    client.propose_admin(&admin, &first);
    client.propose_admin(&admin, &second);

    // The second proposal replaces the first, which can no longer accept.
    assert_eq!(client.try_accept_admin(&first), Err(Ok(Error::NotAdmin)));
    assert!(client.try_accept_admin(&second).is_ok());
    assert_eq!(client.get_admin(), Some(second.clone()));
}

#[test]
fn get_admin_is_none_before_init() {
    let env = Env::default();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);

    assert_eq!(client.get_admin(), None);
}

#[test]
fn error_discriminants_stay_stable_after_adding_no_pending_admin() {
    assert_eq!(Error::EmptyName as u32, 1);
    assert_eq!(Error::AlreadyInit as u32, 2);
    assert_eq!(Error::NotAdmin as u32, 3);
    assert_eq!(Error::Paused as u32, 4);
    assert_eq!(Error::NoPendingAdmin as u32, 5);
}
