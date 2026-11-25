# Kitewell — Soroban contract

On-chain builder check-in for the Kitewell Testnet experience.

## Methods

| Method | Description |
|--------|-------------|
| `init(admin)` | One-time initialiser; stores the admin address |
| `get_admin()` | Returns the current admin, if initialised |
| `propose_admin(admin, new_admin)` | Current admin proposes a successor |
| `accept_admin(new_admin)` | Pending admin accepts and takes over |
| `set_paused(admin, paused)` | Admin-only pause / unpause toggle |
| `lab_name()` | Returns `"Kitewell"` |
| `builder_count()` | Number of unique registered builders |
| `register(caller, name)` | Auth-gated check-in; stores nickname |
| `unregister(caller)` | Auth-gated check-out; removes the caller's row |
| `get_builder(address)` | Lookup nickname |

## Behavior notes

**Auth gate.** `register(caller, name)` and `unregister(caller)` both call
`caller.require_auth()` before they touch storage, so every check-in and
check-out must be signed by the `caller` address passed in. The read methods
(`lab_name`, `builder_count`, `get_builder`, `get_admin`) are permissionless
and need no auth entry. The admin-bearing methods (`init`, `set_paused`,
`propose_admin`, `accept_admin`) are described below.

**Count on first register.** `builder_count()` is incremented only the first
time a given `caller` is seen: `register` checks whether the persistent
`(KITEWELL, caller)` entry already exists, writes the nickname, and bumps the
instance counter only when the entry was missing. Calling `register` again for
the same address overwrites the stored name without changing the count.

**Count on unregister.** `unregister(caller)` removes the persistent
`(KITEWELL, caller)` entry and decrements `builder_count()` by one (a
saturating subtraction, so it can never go below zero). It is rejected with
`NotRegistered` (`6`) when the caller has no entry, and with `Paused` (`4`)
while the registry is paused, matching `register`. Because a removed builder is
no longer counted, a later `register` for the same address counts as new again.

**TTL extend on write.** `register` is the only method that extends storage
TTL. When a new builder is added it extends the instance storage TTL with
`extend_ttl(1000, 5000)` alongside the counter update, and it always extends the
persistent `(KITEWELL, caller)` entry TTL with `extend_ttl(1000, 5000)` after
writing the name. Reads never extend TTL, so a long-idle registry can still
require a write to keep entries live.

## Admin transfer (two-step)

`init(admin)` stores the admin once and cannot be called again. To hand control
to a new address without a single irreversible call, use the two-step flow:

1. **Propose.** The current admin calls
   `propose_admin(admin, new_admin)`. It requires `admin.require_auth()` and
   checks the signer against the stored `ADMIN`; on mismatch it returns
   `NotAdmin` (3). On success `new_admin` is recorded as *pending* and the
   current admin keeps full control. Proposing again simply overwrites the
   pending address.
2. **Accept.** The pending address calls `accept_admin(new_admin)`. It requires
   `new_admin.require_auth()` and must match the pending address; a different
   signer returns `NotAdmin` (3). If nothing is pending it returns the new
   `NoPendingAdmin` (5). On success `new_admin` becomes the live `ADMIN` and the
   pending slot is cleared.

Because control only moves on the second step, a typo in the proposed address
leaves the current admin in charge, and the old admin loses admin-only rights
(such as `set_paused`) the moment the transfer completes. `get_admin()` reads
the current admin (or `None` before `init`). Multisig admins and timelocks are
out of scope.

## Events

The two state-changing methods each publish exactly one event, so an indexer can
follow check-ins and pause changes without polling storage. Events are published
only on success: a call that returns an error (`EmptyName`, `Paused`,
`NotAdmin`) publishes nothing at all.

| Event | Topics | Data | Published by |
|-------|--------|------|--------------|
| `register` | `("register", caller)` | `(name, is_new)` | every successful `register` |
| `paused` | `("paused",)` | `paused` (`bool`) | every successful `set_paused` |

**`register`** — topics `[Symbol("register"), Address(caller)]`, data
`[String(name), Bool(is_new)]` (a two-element vector in this order). `caller`
and `name` are the ones from that call, so on a re-register `name` is the newly
stored nickname. `is_new` is `true` only when the caller had no stored entry
before — exactly when `builder_count()` went up. Re-registering publishes the
same event with `is_new = false`; the event therefore carries everything needed
to keep a mirror of the registry in sync.

**`paused`** — topics `[Symbol("paused")]` (a single topic, no address), data
the new flag as a bare `Bool`. It is published for both pausing and unpausing,
so a sequence of these events is enough to reconstruct the current pause state.

`contracts/kitewell/tests/events.rs` asserts these topics and payloads
exactly, including that a rejected call publishes nothing. Note that
`env.events().all()` exposes only the events of the most recent contract
invocation, which is why each assertion is taken right after the call it
describes.

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

### Deploy from the Lab tab (no backend id)

When `KITEWELL_CONTRACT_ID` is unset, the frontend Lab tab can deploy this same
contract without leaving the browser:

1. Build the Wasm locally: `npm run build:contracts` (or `stellar contract build
   --manifest-path contracts/kitewell/Cargo.toml`). The file is
   `contracts/target/wasm32v1-none/release/kitewell.wasm`.
2. Start the backend, connect Freighter on Testnet, and open the **Lab** tab.
3. Choose the Wasm file under **Deploy from Wasm** and click **Install & init**.
   Three Freighter signatures are requested in order: upload Wasm, create
   contract, then `init(admin)` with the connected account as admin. `init` is
   called once; the contract itself rejects a second call.
4. The new contract id is shown, copied to the clipboard when available, and
   used for Lab reads and `register` for the rest of the session. Deploying
   again in the same session asks for confirmation and keeps every earlier id
   visible.

The panel never writes backend environment variables. To make the id survive a
reload, set it yourself:

```bash
export KITEWELL_CONTRACT_ID=C...   # the id shown in the Lab tab
```

A failed install shows no contract id. If install succeeds but `init` fails,
the panel reports the installed id with the failure so it can be inspected;
it is not activated for Lab reads.

## Register from the Lab tab

After deploy, the frontend Lab tab reads `lab_name()`, `builder_count()`, and
`get_builder(viewer)` via Soroban RPC, and lets Freighter sign a
`register(caller, name)` invoke:

1. Start the backend (`npm run dev:backend`) so `/api/network` serves
   `KITEWELL_CONTRACT_ID`, then open the Lab tab.
2. Enter a builder name (≤ 64 chars) and hit **Sign & register**. Freighter
   pops up to sign the assembled Soroban transaction.
3. The UI polls for on-chain confirmation, then refreshes `builder_count` and
   shows your nickname from `get_builder`, with an explorer link for the tx.

Reads and registration use the public Testnet RPC
(`https://soroban-testnet.stellar.org`, env-overridable via
`SOROBAN_RPC_URL` on both backend and frontend).
