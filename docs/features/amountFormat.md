# Amount formatting

`frontend/src/amountFormat.js` converts decimal XLM amounts to integer stroops
and back without floating-point arithmetic.

## API

- `toStroops(amount)` accepts a non-negative decimal string and returns a
  `BigInt` number of stroops. It accepts either `.` or `,` as the single decimal
  separator, allows up to seven fractional digits, and rejects grouping
  separators or ambiguous input.
- `formatStroops(stroops)` accepts a non-negative `BigInt`, integer string, or
  safe integer number and returns a canonical decimal string with unnecessary
  fractional trailing zeros removed.

Examples: `toStroops("1.25")` returns `12500000n`, and
`formatStroops(12500000n)` returns `"1.25"`.