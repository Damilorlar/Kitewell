# Log field redactor

`backend/src/logRedact.js` copies a query or body record and replaces sensitive field values before a structured log line is written. The HTTP app does not import it; `app.js` and `index.js` are unchanged.

## Rules

| Input | Result |
| --- | --- |
| Plain object | `{ ok: true, value }` with sensitive values replaced by `[redacted]` |
| Nested plain object | Redacted one level down (`query`, `body`) |
| Deeper object | Left as-is |
| `null`, arrays, and other non-objects | `{ ok: false }` and no throw |
| Field list is not an array of non-empty strings | `{ ok: false }` |
| Field list is `[]` | Nothing is redacted |

Name matching ignores case and `_` / `-`, so `API_KEY` matches `apiKey`. The input record is not modified. Unrelated values keep their original identity.

Default names: `password`, `secret`, `token`, `authorization`, `apiKey`, `seed`, `privateKey`.

## API

```js
import { redactFields } from "./logRedact.js";

redactFields({ account: "GABC", password: "hunter2" });
// { ok: true, value: { account: "GABC", password: "[redacted]" } }

redactFields({ query: { token: "raw" }, body: { secret: "seed" } });
// both nested values become "[redacted]"

redactFields(null);
// { ok: false, error: "Log record must be a plain object" }
```

## Tests

`npm test` from `backend/` runs the node:test files:

- `logRedact-happy.test.js`
- `logRedact-invalid.test.js`
- `logRedact-boundary.test.js`
- `logRedact-error.test.js`
- `logRedact-case.test.js`
- `logRedact-nested.test.js`
- `logRedact-immutable.test.js`
- `logRedact-extra.test.js`
