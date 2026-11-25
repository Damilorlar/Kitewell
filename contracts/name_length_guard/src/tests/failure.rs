use crate::{validate_builder_name, NameError};

#[test]
fn rejects_empty_and_out_of_range_lengths() {
    assert_eq!(validate_builder_name("").unwrap_err(), NameError::Length);
    assert_eq!(validate_builder_name("A").unwrap_err(), NameError::Length);
    assert_eq!(
        validate_builder_name(&"A".repeat(33)).unwrap_err(),
        NameError::Length
    );
}

#[test]
fn rejects_an_emoji() {
    assert_eq!(validate_builder_name("Lab 🚀").unwrap_err(), NameError::Charset);
}
