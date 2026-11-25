# Balance list sorter

`sortBalances` orders a Horizon `balances` array for display.

Native XLM (`asset_type === "native"`) stays first. Every other balance is ordered alphabetically by `asset_code`. A missing code sorts as an empty string, after native and before named codes. The input array is not changed. Equal codes keep their original order.

```js
import { sortBalances } from "./balanceSort";

sortBalances(account.balances);
```

`sortBalances(balances)` returns a new array.

It throws `TypeError` when `balances` is not an array, or when an entry is not an object.
