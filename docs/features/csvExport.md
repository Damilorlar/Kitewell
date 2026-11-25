# CSV export builder

`frontend/src/csvExport.js` is a pure, standalone utility that turns an
array of row objects (e.g. payment/transaction rows) into an RFC
4126-style CSV string.

It is not wired into `App.jsx`, `freighter.js`, or `stellar.js` in this
change — that integration is left for a later issue.

## Public API

### `rowsToCsv(rows, columns?)`

Returns a CRLF-terminated CSV string with a header row followed by one
line per entry in `rows`.

- `rows`: array of plain objects. A non-array value (including `null` or
  `undefined`) is treated as an empty list instead of throwing.
- `columns` (optional): ordered array of column keys. Defaults to
  `Object.keys(rows[0])` when omitted. When both `rows` and `columns` are
  empty, returns `""`.
- A missing key on a given row, or a `null`/`undefined` value, renders as
  an empty cell.

```js
import { rowsToCsv } from "./csvExport";

rowsToCsv([
  { date: "2026-01-01", amount: "10.5", asset: "USDC" },
]);
// "date,amount,asset\r\n2026-01-01,10.5,USDC\r\n"
```

### `escapeCsvField(value)`

Escapes a single field value: wraps it in double quotes and doubles any
internal double quotes whenever the (stringified) value contains a comma,
a double quote, `\n`, or `\r`. `null`/`undefined` become `""`.
