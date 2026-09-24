# Security Policy

This document outlines the security architecture, signing expectations, and vulnerability reporting procedures for the Kitewell project.

---

## 1. Core Security Architecture & Key Management

Kitewell adheres to a non-custodial, client-side cryptographic architecture designed to prevent key exposure:

- **Freighter-Only Client-Side Signing:** All cryptographic transaction signing and credential authorization must occur strictly client-side via the [Freighter](https://www.freighter.app/) browser extension or compatible SEP-0007 / wallet providers.
- **Zero Backend Secret Keys:** The backend service and API layers must never receive, request, persist, log, or forward secret keys (`S...`), seed phrases, or private key material. All transactions are constructed as unsigned XDR blobs, signed in the user's browser, and submitted directly to the Horizon / Soroban RPC network.
- **Principle of Least Privilege:** Public keys (`G...`) are treated purely as public identifiers for querying on-chain state and account balances.

---

## 2. Network & Environment Isolation

- **Testnet-Only by Default:** The default configuration for all contracts, indexers, and frontend applications is strictly locked to **Stellar Testnet** (`Test SDF Network ; September 2015`).
- **Mainnet Protection:** Any accidental submission to or signing against Mainnet is blocked by client-side network passphrase validation. Do not deploy or run production funds against un-audited experimental smart contract endpoints.

---

## 3. Reporting a Vulnerability

We take the security of our platform and user assets seriously. If you discover a security vulnerability, please report it responsibly:

### How to Report
- Please do **not** open public GitHub issues for security vulnerabilities or exploit demonstrations.
- Email your findings directly to the repository maintainers or security team with a detailed description and steps to reproduce.

### What to Include in Your Report
1. **Description:** Clear summary of the issue, attack scenario, and potential blast radius.
2. **Affected Components:** Specific files, routes, or contract functions impacted.
3. **Proof of Concept (PoC):** Non-destructive reproduction steps or script on Testnet.
4. **Remediation:** Any suggested architectural or code-level mitigations.

### Response Timelines
- **Acknowledgment:** Within 48 hours of initial receipt.
- **Triage & Patching:** High/critical issues are triaged immediately and patched in a hotfix branch prior to public release.

---
*Last Updated: September 2026*
