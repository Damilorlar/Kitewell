# register_once_guard

Registers a caller exactly once. A later call from the same caller is idempotent: the original ledger timestamp stays, and the call returns false.

`decide(existing: Option<Registration>, now: u64) -> Decision` returns `Created` when `existing` is absent and `Idempotent` with the stored registration otherwise.

`RegisterOnceGuard::register(env, caller) -> bool` requires the caller to authorize. It returns true only the first time.

`RegisterOnceGuard::registered_at(env, caller) -> Option<u64>` reads the stored ledger time.

```bash
cd contracts/register_once_guard
cargo test
cargo clippy --all-targets -- -D warnings
```
