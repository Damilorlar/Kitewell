# CORS allowlist builder

`backend/src/corsAllowlist.js` exports `buildCorsOptions(env = process.env)`. It
reads `env.CORS_ALLOWLIST`, a comma-separated list of HTTP or HTTPS origins, and
returns an options object for the backend's `cors` middleware:

```js
import cors from "cors";
import { buildCorsOptions } from "./corsAllowlist.js";

const options = buildCorsOptions({
  CORS_ALLOWLIST: "https://kitewell.example,http://localhost:5173",
});
// { origin: ["https://kitewell.example", "http://localhost:5173"] }
// In a later integration: app.use(cors(options));
```

Entries are trimmed, normalized to their URL origin, deduplicated, and kept in
their first-seen order. Empty entries are ignored. If the variable is unset or
empty, `origin` is an empty array, so no browser origin is allowed. Invalid
entries (including paths, credentials, wildcards, and non-HTTP schemes) throw
an `Error`; a non-string value throws `TypeError`.

This module is standalone and is not yet used by the app.
