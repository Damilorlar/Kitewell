# Explorer links

`frontend/src/explorerLink.js` creates Stellar Expert links for transactions
and accounts on Testnet, Futurenet, and the public network.

## API

- `buildExplorerUrl(network, resourceType, identifier)` accepts a network ID,
  `"tx"` or `"account"`, and a transaction hash or Stellar G/C account ID.
- `buildTransactionExplorerUrl(network, transactionHash)` is the transaction
  convenience function.
- `buildAccountExplorerUrl(network, accountId)` is the account convenience
  function.

Network IDs are case-insensitive. Transaction hashes must be exactly 64
hexadecimal characters; account and contract IDs must match the 56-character
Stellar StrKey shape. Invalid input throws a descriptive `TypeError` or
`RangeError`. The module is standalone and does not read application network
state or modify existing wallet/UI code.