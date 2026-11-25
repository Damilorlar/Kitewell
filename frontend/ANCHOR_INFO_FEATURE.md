# Anchor Info Feature - Issue #573

## Overview

This feature adds the ability to read an anchor's transfer server information from their `stellar.toml` file without initiating deposits or withdrawals.

## New Functions

### `fetchStellarToml(domainOrIssuer)`

Fetches and parses a stellar.toml file for a given domain or issuer address.

**Parameters:**
- `domainOrIssuer` (string): Either a domain (e.g., "anchor.example.com") or a Stellar public key (G...)

**Returns:** Promise resolving to the parsed stellar.toml object

**Example:**
```javascript
const toml = await fetchStellarToml("anchor.example.com");
console.log(toml.TRANSFER_SERVER);
console.log(toml.WEB_AUTH_ENDPOINT);
console.log(toml.KYC_SERVER);
```

### `fetchTransferServerInfo(transferServerUrl)`

Fetches the SEP-24 info endpoint from a transfer server URL.

**Parameters:**
- `transferServerUrl` (string): The TRANSFER_SERVER URL from stellar.toml (must be HTTPS)

**Returns:** Promise resolving to the parsed JSON response from the /info endpoint

**Example:**
```javascript
const info = await fetchTransferServerInfo("https://anchor.example.com/sep24");
console.log(info.deposit.USDC.min_amount);
console.log(info.deposit.USDC.max_amount);
```

### `fetchAnchorInfo(domainOrIssuer)`

Convenience function that fetches both stellar.toml and transfer server info in one call.

**Parameters:**
- `domainOrIssuer` (string): Either a domain or Stellar public key

**Returns:** Promise resolving to an object with:
- `toml`: The parsed stellar.toml
- `transferServerInfo`: The parsed /info response (null if TRANSFER_SERVER is absent or the fetch fails)

**Example:**
```javascript
const { toml, transferServerInfo } = await fetchAnchorInfo("anchor.example.com");

// Check if web auth is required
if (toml.WEB_AUTH_ENDPOINT) {
  console.log("This anchor requires SEP-10 authentication");
}

// List deposit assets with their limits
if (transferServerInfo) {
  Object.entries(transferServerInfo.deposit).forEach(([asset, details]) => {
    console.log(`${asset}: ${details.min_amount} - ${details.max_amount}`);
  });
}
```

## Security Features

- **HTTPS Only**: Only HTTPS URLs are fetched for security
- **No Authentication**: Does not perform SEP-10 authentication
- **Read-Only**: Does not initiate deposits, withdrawals, or any state-changing operations

## Edge Cases Handled

1. **Missing TRANSFER_SERVER**: Returns null for transferServerInfo when not present
2. **Failed Info Endpoint**: Returns null for transferServerInfo if the endpoint fails, but still provides toml data
3. **Missing SEP-24 Keys**: Gracefully handles stellar.toml files without TRANSFER_SERVER, WEB_AUTH_ENDPOINT, or KYC_SERVER
4. **Input Validation**: Validates and trims input, rejects empty or invalid URLs

## Testing

Comprehensive test suite in `frontend/src/stellar-anchor-info.test.js` covering:
- stellar.toml fetching for domains and issuers
- SEP-24 info endpoint parsing
- Error handling and edge cases
- Security validations (HTTPS enforcement)
- Integration between toml and info fetching

Run tests:
```bash
npm test -- stellar-anchor-info.test.js
```

## Out of Scope

The following are intentionally NOT implemented:
- Completing SEP-10 authentication challenges
- Initiating deposits or withdrawals
- Updating the existing currency list UI (beyond linking to this new feature)
