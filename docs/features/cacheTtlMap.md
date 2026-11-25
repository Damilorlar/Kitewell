# In-memory TTL cache

`backend/src/cacheTtlMap.js` exports `createCacheTtlMap({ ttlMs, now })`, a small
cache for short-lived backend lookups such as Horizon account balances. Each
cache instance stores its own entries in memory. It is not connected to any
route yet.

```js
import { createCacheTtlMap } from "../../backend/src/cacheTtlMap.js";

const cache = createCacheTtlMap({ ttlMs: 5_000 });
cache.set("account:GABC", { balance: "12.5000000" });
cache.get("account:GABC"); // { balance: "12.5000000" }
cache.has("account:GABC"); // true until the entry expires
```

## API

- `createCacheTtlMap({ ttlMs, now = Date.now })`: `ttlMs` is a required,
  positive finite number of milliseconds. `now` is an optional function that
  returns finite epoch milliseconds; it can be replaced for tests. Invalid
  TTLs and clock readings throw `RangeError`; a non-function clock throws
  `TypeError`. Errors thrown by the clock are propagated.
- `set(key, value)`: stores any value under a Map-style key. Setting the same
  key again replaces its value and restarts its TTL.
- `get(key)`: returns the value or `undefined` if the key is absent or expired.
- `has(key)`: returns whether an unexpired entry exists, even when its stored
  value is `undefined`.

An entry expires when `now() >=` its insertion time plus `ttlMs`. Expired
entries are removed lazily when `get` or `has` reads their key. Unread expired
entries remain in memory; this cache is intended for small, short-lived data.
