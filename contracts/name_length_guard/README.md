# name_length_guard

Checks a Kitewell builder display name before it is stored.

`validate_builder_name(name: &str) -> Result<(), NameError>` accepts 2 to 32 bytes. Each byte is an ASCII letter, digit, space, or hyphen. The first and last bytes are letters or digits. `is_valid_builder_name` is the boolean form.

`NameLengthGuard::validate_name(env, name) -> bool` applies the same rules to a Soroban string.

```bash
cd contracts/name_length_guard
cargo test
cargo clippy --all-targets -- -D warnings
```
