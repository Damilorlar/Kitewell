# SEP-10 web-auth challenge

`frontend/src/sep10WebAuth.js` runs the anchor sign-in flow (SEP-0001 / web
auth, issue #510): fetch the challenge, read it, sign it, post it, and report
the session the anchor returns.

The **Web auth** tab of `App.jsx` drives this module, and the module never
imports `@stellar/freighter-api` and never sees a secret key: the wallet is
called through the injected `sign(unsignedXdr)`, which the tab fills from
`signChallengeWithFreighter` in `./freighter.js`. The request function, the
clock and the network passphrase are injectable, so every rule below is tested
in the Node test environment with fixtures.

## Public API

### `normaliseAuthEndpoint(endpoint)`

Returns the anchor's web-auth endpoint as an `https://` URL. Rejects an empty
value, spaces, a non-HTTPS scheme, embedded credentials, a URL `URL` cannot
read, and a value that already carries query parameters (the account is
appended for you).

### `challengeRequestUrl(endpoint, { account, homeDomains })`

Builds the GET URL: `?account=<G…>`, plus `&home_domains=<a>,<b>` when
`homeDomains` holds anything. Blank and non-string entries are dropped.
`account` must be a valid Stellar public key.

### `fetchUnsignedChallenge({ endpoint, account, homeDomains, fetchFn, ... })`

GETs the request URL and returns `{ challengeXdr, requestUrl }`. A non-2xx
response, a body that is not JSON, and a body without `challenge` all fail
before any signing happens.

### `inspectChallenge({ challengeXdr, clientAccount, expectedServerAccount, networkPassphrase, nowMs })`

Returns `{ serverAccount, clientAccount, operationName, webAuthDomain,
operationCount, expiresAtMs, validFromMs }`. Every refusal below is raised
**before** the wallet is asked to sign, which is the point of the function:

| Refusal | Message |
| --- | --- |
| No XDR at all | `There is no challenge transaction to read.` |
| Invalid client or server account | `The client account must be a valid Stellar public key (G…).` / `The endpoint's server account must be…` |
| Wrong network passphrase | `The challenge is not a transaction for this network.` |
| Fee bump | `The challenge must be a base transaction, not a fee bump.` |
| Source account is not the endpoint's server | `Refused: the challenge's source account is X, not the endpoint's server Y.` |
| No operations | `Refused: the challenge holds no operations.` |
| First operation is not `manageData` | `Refused: the first challenge operation must be manageData, not <type>.` |
| First operation is not addressed to this account | `Refused: the challenge's first operation is not addressed to this account.` |
| No timebounds | `Refused: the challenge sets no expiry.` |
| Already expired | `Refused: the challenge expired at <ISO>.` |
| Not valid yet | `Refused: the challenge is not valid until <ISO>.` |

### `signChallengeEnvelope({ challengeXdr, sign })`

Awaits `sign(challengeXdr)` and returns the signed XDR. Fails when there is no
`sign` function or when the wallet returns nothing.

### `verifyChallengeSignatures({ signedXdr, serverAccount, clientAccount, networkPassphrase })`

Returns `{ serverSigned, clientSigned, signatureCount }` by verifying each
signature against the envelope hash with `Keypair.fromPublicKey(...).verify()`.
A key it cannot parse simply verifies as false.

### `assertEnvelopeUnchanged({ unsignedXdr, signedXdr, networkPassphrase })`

Requires the signed envelope to hash exactly like the unsigned one and to carry
strictly more signatures. An envelope that cannot be read fails with
`The signed challenge does not match the challenge that was shown.`; anything
else fails with `Refused: signing altered the challenge envelope.`

### `postSignedChallenge({ endpoint, signedXdr, fetchFn })`

POSTs `{ transaction: signedXdr }` and returns the access token from the JSON
body. Only the signed envelope is posted, and only after
`assertEnvelopeUnchanged` and both signatures pass.

### `readJwtClaims(token, { expectedSubject, nowMs })`

Decodes the JWT's payload segment (no signature verification: the token came
from the anchor over HTTPS) and returns `{ subject, expiresAtMs, issuedAtMs,
expired }`. Fails on a token that is not three segments, names no subject, was
issued for a different account, or carries no `exp`.

### `webAuthPresentation(challenge, session)`

Four display lines: the challenge source and operation name, its expiry, the
session subject and expiry, and whether the session token is current or
already expired.

### `completeWebAuthChallenge({ endpoint, account, serverAccount, homeDomains, sign, fetchFn, networkPassphrase, nowMs })`

Runs the whole dance and returns `{ requestUrl, challenge, session,
presentation }`. The returned data deliberately contains no token.

## Tests

`frontend/src/sep10-web-auth-*.test.js` (endpoint, request URL, fetch, inspect,
signatures, JWT, flow, presentation). Run with `npm test -w frontend`.
