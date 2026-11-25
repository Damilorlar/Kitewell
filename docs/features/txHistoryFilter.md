# Transaction history filter

`filterTransactionHistory` filters an in-memory Horizon operations or payments list.

Optional criteria:

- `type` matches `record.type` exactly.
- `asset` matches `asset_code`. `"native"` and `"XLM"` match `asset_type === "native"`.
- `from` and `to` are inclusive ISO timestamps compared with `created_at`.

An empty filter returns a shallow copy of every record. The input array is not changed.

```js
import { filterTransactionHistory } from "./txHistoryFilter";

filterTransactionHistory(records, { type: "payment", asset: "USD", from, to });
```

It throws `TypeError` when `records` is not an array, a date is not an ISO string, or a record is not an object. It throws `RangeError` when `from` is later than `to`.
