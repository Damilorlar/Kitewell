# Payment record mapper

`backend/src/paymentRecordMap.js` maps raw Horizon payment operation records
into the simplified payment shape the Kitewell API returns to the frontend. It
is standalone: not wired into `app.js`, `index.js`, or any route, and it has no
Horizon or Express dependency, so it can be tested with plain fixtures.

## Output shape

```js
{
  id: "1234567890",
  from: "G...",
  to: "G...",
  amount: "12.5000000",
  asset_type: "native",
  asset_code: "XLM",
  transaction_hash: "abc123hash",
  created_at: "2026-10-21T10:00:00Z",
  explorerUrl: "https://stellar.expert/explorer/testnet/tx/abc123hash",
}
```

- `amount` is kept as Horizon's decimal string (seven decimals) so precision is
  not lost.
- `asset_code` falls back to `XLM` for native payments.
- `created_at` falls back to `null` when Horizon omits it.
- `explorerUrl` is `<explorerBase>/tx/<transaction_hash>`; trailing slashes on
  the base are removed.

## Public API

### `mapPaymentRecord(record, options)`

Maps one Horizon payment record.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `record` | `object` | — | Horizon payment operation (`type: "payment"`) |
| `options.explorerBase` | `string` | `https://stellar.expert/explorer/testnet` | Base used for `explorerUrl` |

```js
import { mapPaymentRecord } from "./paymentRecordMap.js";

mapPaymentRecord(horizonRecord);
mapPaymentRecord(horizonRecord, {
  explorerBase: "https://stellar.expert/explorer/futurenet",
});
```

Throws a `TypeError` when:

| Condition | Message |
| --- | --- |
| `record` is `null`, an array, or not an object | `Payment record must be an object.` |
| `record.type` is present and not `"payment"` | `Unsupported operation type: <type>.` |
| A required field is missing or blank | `Payment record is missing "<field>".` |

Required fields: `id`, `from`, `to`, `amount`, `transaction_hash`.

### `mapPaymentRecords(records, options)`

Maps a list of Horizon operation records, drops non-payment operations such as
`create_account`, and preserves order. Non-array input returns `[]`. A
payment-shaped record with missing fields still throws, so data problems are not
silently hidden.

```js
import { mapPaymentRecords } from "./paymentRecordMap.js";

mapPaymentRecords(horizonRecords); // [{ ... }, { ... }]
```

### Constants

- `DEFAULT_EXPLORER_BASE` — Testnet Stellar Expert base URL.

## Notes

- Reference implementation of the current inline mapping in
  `backend/src/index.js` (`GET /api/payments/:address`); wiring it in is a
  separate issue.
- Tests live in `backend/src/paymentRecordMap-*.test.js` and run with
  `npm test` from `backend/`.
