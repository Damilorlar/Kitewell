use crate::is_valid_builder_name;

#[test]
fn accepts_the_shortest_name() {
    assert!(is_valid_builder_name("A1"));
}

#[test]
fn accepts_the_longest_name() {
    let name = "A".repeat(31) + "Z";
    assert_eq!(name.len(), 32);
    assert!(is_valid_builder_name(&name));
}
