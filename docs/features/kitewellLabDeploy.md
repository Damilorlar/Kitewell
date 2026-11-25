# Kitewell Lab deploy

`frontend/src/freighter.js` exposes a deploy flow for the existing
`contracts/kitewell` registry when the backend has no `KITEWELL_CONTRACT_ID`.

## Helpers

- `installKitewellContract(publicKey, wasmBytes, options?)` — validates the Wasm
  magic bytes, then submits two Freighter-signed Soroban transactions in order:
  `uploadContractWasm` and `createCustomContract` (deployer = connected account).
  The new contract id is read from the create transaction's host-function result.
  Returns `{ contractId, hash, uploadHash, confirmed }`. A failed upload or
  create throws, so no id is produced. `options.salt` can pin the 32-byte deploy
  salt; otherwise a random one is used per attempt.
- `initializeKitewellContract(publicKey, contractId)` — invokes `init(admin)` once
  with the connected account as `admin`. The contract rejects a second init.
- `deployKitewellContract(publicKey, wasmBytes, options?)` — validates inputs,
  calls install first, then init exactly once with the installed id. Returns
  `{ contractId, installHash, initHash, confirmed }`. If init throws, the error
  carries `contractId` from the successful install for diagnostics; install
  failures have none.

The two phases are injectable for tests:
`deployKitewellContract(publicKey, wasmBytes, { install, init })`. A test stubs
both and asserts the call order and that init receives the installed id.

## UI behavior

The Lab panel shows **Deploy from Wasm** only while the backend reports no
configured id. After a successful deploy:

- the id is displayed and copied to the clipboard when available;
- it becomes the active id for `readKitewellState` and `register` for the rest of
  the session, without a reload;
- the panel shows the `KITEWELL_CONTRACT_ID=<id>` line to set on the backend and
  explicitly does not write backend environment variables;
- a second deploy first asks for confirmation and keeps earlier ids listed.

Out of scope: pause, unregister, TTL, and deploying any contract other than
`contracts/kitewell`.
