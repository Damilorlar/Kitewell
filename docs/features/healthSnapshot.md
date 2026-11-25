# Health snapshot builder

`buildHealthSnapshot` builds the JSON body for `GET /health` from values the caller already knows. It does not call Horizon and it is not imported by the server.

```js
import { buildHealthSnapshot } from "./healthSnapshot.js";

buildHealthSnapshot({
  uptimeSeconds: process.uptime(),
  network: "testnet",
  horizonReachable: true,
});
```

The result is `{ status, uptimeSeconds, network, horizonReachable, checkedAt }`. `status` is `"ok"` when Horizon is reachable and `"degraded"` when it is not. `uptimeSeconds` of `0` is valid. A negative or non-finite uptime, a blank `network`, or a non-boolean reachability flag throws `TypeError`.
