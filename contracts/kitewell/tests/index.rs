use kitewell::{Kitewell, KitewellClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

/// The index starts empty and grows by exactly one row per first check-in, so
/// `builder_count` and the index length always agree.
#[test]
fn register_adds_each_builder_to_the_index_once() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    assert_eq!(client.list_builders(&0, &10).len(), 0);

    client.register(&a, &String::from_str(&env, "ada"));
    client.register(&b, &String::from_str(&env, "gus"));

    let page = client.list_builders(&0, &10);
    assert_eq!(page.len(), 2);
    assert_eq!(page.get(0), Some(a));
    assert_eq!(page.get(1), Some(b));
    assert_eq!(page.len(), client.builder_count());
}

/// A second register only overwrites the nickname; the index keeps one row.
#[test]
fn second_register_does_not_add_a_second_index_row() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let a = Address::generate(&env);

    client.register(&a, &String::from_str(&env, "ada"));
    client.register(&a, &String::from_str(&env, "ada-late"));

    assert_eq!(client.builder_count(), 1);
    let page = client.list_builders(&0, &10);
    assert_eq!(page.len(), 1);
    assert_eq!(page.get(0), Some(a.clone()));
    assert_eq!(
        client.get_builder(&a),
        Some(String::from_str(&env, "ada-late"))
    );
}

/// Unregister removes that address from the index, leaving the other rows.
#[test]
fn unregister_removes_the_index_row() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    client.register(&a, &String::from_str(&env, "ada"));
    client.register(&b, &String::from_str(&env, "gus"));
    client.unregister(&a);

    assert_eq!(client.builder_count(), 1);
    let page = client.list_builders(&0, &10);
    assert_eq!(page.len(), 1);
    assert_eq!(page.get(0), Some(b));
    assert_eq!(page.len(), client.builder_count());
}

/// Pages are slices of the index and a start past the end is an empty page.
#[test]
fn list_builders_pages_without_erroring_past_the_end() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Kitewell, ());
    let client = KitewellClient::new(&env, &id);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let c = Address::generate(&env);

    client.register(&a, &String::from_str(&env, "ada"));
    client.register(&b, &String::from_str(&env, "gus"));
    client.register(&c, &String::from_str(&env, "lin"));

    let first = client.list_builders(&0, &2);
    assert_eq!(first.len(), 2);
    assert_eq!(first.get(0), Some(a.clone()));
    assert_eq!(first.get(1), Some(b.clone()));

    let second = client.list_builders(&2, &2);
    assert_eq!(second.len(), 1);
    assert_eq!(second.get(0), Some(c));

    // Paging past the end is an empty page, not an error.
    assert_eq!(client.list_builders(&3, &2).len(), 0);
    assert_eq!(client.list_builders(&99, &10).len(), 0);
    // A zero limit asks for nothing.
    assert_eq!(client.list_builders(&0, &0).len(), 0);
}
