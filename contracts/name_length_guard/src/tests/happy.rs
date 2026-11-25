use crate::{is_valid_builder_name, validate_builder_name};

#[test]
fn accepts_a_typical_builder_name() {
    assert!(is_valid_builder_name("Kitewell Lab"));
    assert!(validate_builder_name("Kitewell Lab").is_ok());
}

#[test]
fn accepts_letters_digits_spaces_and_hyphens() {
    assert!(is_valid_builder_name("Lab 2-B"));
}
