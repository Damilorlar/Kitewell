use crate::{validate_builder_name, NameError};

#[test]
fn rejects_characters_outside_the_allowed_set() {
    assert_eq!(validate_builder_name("Lab_1").unwrap_err(), NameError::Charset);
    assert_eq!(validate_builder_name("lab.1").unwrap_err(), NameError::Charset);
}

#[test]
fn rejects_a_name_that_starts_or_ends_with_a_separator() {
    assert_eq!(validate_builder_name(" Lab").unwrap_err(), NameError::Edge);
    assert_eq!(validate_builder_name("Lab ").unwrap_err(), NameError::Edge);
    assert_eq!(validate_builder_name("-Lab").unwrap_err(), NameError::Edge);
    assert_eq!(validate_builder_name("Lab-").unwrap_err(), NameError::Edge);
}
