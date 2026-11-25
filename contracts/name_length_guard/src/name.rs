//! Length and character rules for a builder display name.
//!
//! A name is 2 to 32 bytes. Every byte is an ASCII letter, digit, space, or
//! hyphen, and the first and last bytes are letters or digits.

pub const MIN_NAME_LEN: usize = 2;
pub const MAX_NAME_LEN: usize = 32;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NameError {
    Length,
    Charset,
    Edge,
}

pub fn is_valid_builder_name(name: &str) -> bool {
    validate_builder_name(name).is_ok()
}

pub fn validate_builder_name(name: &str) -> Result<(), NameError> {
    let bytes = name.as_bytes();
    if bytes.len() < MIN_NAME_LEN || bytes.len() > MAX_NAME_LEN {
        return Err(NameError::Length);
    }
    if !bytes.iter().copied().all(is_name_byte) {
        return Err(NameError::Charset);
    }
    if !is_alnum(bytes[0]) || !is_alnum(bytes[bytes.len() - 1]) {
        return Err(NameError::Edge);
    }
    Ok(())
}

fn is_name_byte(byte: u8) -> bool {
    is_alnum(byte) || byte == b' ' || byte == b'-'
}

fn is_alnum(byte: u8) -> bool {
    byte.is_ascii_alphanumeric()
}
