use kitewell::Error;

#[test]
fn error_discriminants_match_contract_spec() {
    assert_eq!(Error::EmptyName as u32, 1);
    assert_eq!(Error::AlreadyInit as u32, 2);
    assert_eq!(Error::NotAdmin as u32, 3);
    assert_eq!(Error::Paused as u32, 4);
}
