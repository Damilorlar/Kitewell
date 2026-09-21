# Kitewell — Soroban contract

On-chain builder check-in for the Kitewell Testnet experience.

## Methods

| Method | Description |
|--------|-------------|
| `lab_name()` | Returns `"Kitewell"` |
| `builder_count()` | Number of unique registered builders |
| `register(caller, name)` | Auth-gated check-in; stores nickname |
| `get_builder(address)` | Lookup nickname |

## Build

Requires Rust. Unit tests:

```bash
cargo test --manifest-path contracts/kitewell/Cargo.toml
```

Release WASM (needs [Stellar CLI](https://developers.stellar.org/docs/tools/cli) **v25.2.0+**):

```bash
stellar contract build --manifest-path contracts/kitewell/Cargo.toml
```

> `cargo build --target wasm32v1-none` alone is not enough on soroban-sdk 28 — use `stellar contract build`.

## Deploy (Testnet)

With the [Stellar CLI](https://developers.stellar.org/docs/tools/cli):

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/kitewell.wasm \
  --source-account <IDENTITY> \
  --network testnet
```

Set the contract id on the backend:

```bash
export KITEWELL_CONTRACT_ID=C...
```
