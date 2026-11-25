# Startup environment validator

`backend/src/envValidate.js` checks required environment variables before a process continues. It does not read `process.env` itself. The HTTP app does not import it; `app.js` and `index.js` are unchanged.

## Rules

| Input | Result |
| --- | --- |
| Every required name has a non-blank string | `{ ok: true, values }` with trimmed strings |
| Any name is missing, empty, or not a string | `{ ok: false, missing }` listing every gap, in request order |
| `env` is not a plain object | type error, `missing: []` |
| `required` is not an array of non-empty strings | required-list error, `missing: []` |
| `required` is `[]` | success with an empty `values` object |

Duplicate names are checked once. The input object is not modified.

## API

```js
import { assertEnv, validateEnv } from "./envValidate.js";

validateEnv({ PORT: "3000", NETWORK: "testnet" }, ["PORT", "NETWORK"]);
// { ok: true, values: { PORT: "3000", NETWORK: "testnet" } }

validateEnv({ PORT: "3000" }, ["PORT", "RPC"]);
// { ok: false, error: "Missing required environment variables: RPC", missing: ["RPC"] }

assertEnv({ PORT: "" }, ["PORT"]);
// throws Error("Missing required environment variables: PORT")
```

`validateEnv(env, required)` never throws. `assertEnv(env, required)` throws one `Error` whose message lists every missing name.

## Tests

`npm test` from `backend/` runs the node:test files:

- `envValidate-happy.test.js`
- `envValidate-missing.test.js`
- `envValidate-invalid.test.js`
- `envValidate-boundary.test.js`
- `envValidate-error.test.js`
- `envValidate-empty.test.js`
- `envValidate-partial.test.js`
- `envValidate-immutable.test.js`
