# Helios Lab — Wave backlog (draft issues)

Create these as GitHub issues after the repo is approved (or before, so the backlog is ready). In Drips, set complexity when adding to the Stellar Wave program.

Suggested labels: `good first issue`, `enhancement`, `documentation`, `stellar-wave`.

---

## 1. Path payment (Testnet) — High

**Goal:** Send XLM via a simple path payment (or document “native only” and add a path-payment prototype).

**Acceptance**
- [ ] UI to pick destination + amount
- [ ] Builds `pathPaymentStrictSend` or `pathPaymentStrictReceive` with Freighter sign
- [ ] Shows success/error + explorer link
- [ ] README notes Testnet limitations

**Files:** `frontend/src/freighter.js`, `frontend/src/App.jsx`, `README.md`

---

## 2. Network toggle (Testnet / Futurenet) — Medium

**Goal:** Allow selecting Horizon network with clear warnings; default stays Testnet.

**Acceptance**
- [ ] Network selector in header
- [ ] Horizon URL + passphrase update in one config module
- [ ] Friendbot disabled off Testnet
- [ ] Persistent preference (`localStorage`)

**Files:** `src/stellar.js`, `src/freighter.js`, `src/App.jsx`

---

## 3. Remove trustline (limit 0) — Medium

**Goal:** From Assets list, remove a credit trustline when balance is 0.

**Acceptance**
- [ ] “Remove” action per non-native asset
- [ ] Calls `changeTrust` with limit `0`
- [ ] Blocks when balance &gt; 0 with clear message
- [ ] Refreshes balances after submit

**Files:** `src/App.jsx`, `src/freighter.js`

---

## 4. Payment asset selector — Medium

**Goal:** Send credit assets (not only native XLM) when a trustline exists.

**Acceptance**
- [ ] Asset dropdown from balances
- [ ] Payment op uses selected `Asset`
- [ ] Validation for insufficient balance

**Files:** `src/freighter.js`, `src/App.jsx`

---

## 5. Account info panel — Trivial

**Goal:** Show sequence number, subentry count, and thresholds from Horizon.

**Acceptance**
- [ ] New info section under Wallet or Assets
- [ ] Refresh with balances
- [ ] Link to StellarExpert account

**Files:** `src/stellar.js`, `src/App.jsx`

---

## 6. Transaction memo types — Trivial

**Goal:** Support memo ID / hash in addition to text (with length checks).

**Acceptance**
- [ ] Memo type select
- [ ] Correct `Memo.*` construction
- [ ] Docs in README

**Files:** `src/freighter.js`, `src/App.jsx`

---

## 7. Accessibility pass — Medium

**Goal:** Keyboard focus rings, aria labels on tabs/toasts, contrast check.

**Acceptance**
- [ ] Tablist roles for tabs
- [ ] Toast announced via `aria-live`
- [ ] Visible focus styles

**Files:** `src/App.jsx`, `src/App.css`

---

## 8. Deploy preview (GitHub Pages or Vercel) — Medium

**Goal:** Public demo URL in README.

**Acceptance**
- [ ] CI or Pages/Vercel config
- [ ] `base` path correct for Vite if needed
- [ ] README badge + demo link

**Files:** `vite.config.js`, `.github/workflows/*`, `README.md`

---

## 9. Unit tests for helpers — Medium

**Goal:** Vitest coverage for address validation helpers and balance mapping (mocked Horizon).

**Acceptance**
- [ ] Vitest setup
- [ ] ≥3 tests for `stellar.js` mappers / validation wrappers
- [ ] `npm test` script

**Files:** `package.json`, `src/**/*.test.js`

---

## 11. Invoke `helios_lab.register` from the Lab tab — High

**Layer:** Frontend + Contract

**Goal:** After contract deploy, let Freighter sign a Soroban `register(caller, name)` invoke from the Lab tab.

**Acceptance**
- [ ] Reads contract id from backend `/api/network`
- [ ] Builds + signs Soroban tx via Freighter
- [ ] Shows `builder_count` / `get_builder` result

**Files:** `frontend/src/App.jsx`, `frontend/src/freighter.js`, `contracts/`

---

## 12. Backend rate limit + request logging — Medium

**Layer:** Backend

**Goal:** Protect Horizon proxy routes with simple rate limiting and structured logs.

**Acceptance**
- [ ] Per-IP rate limit on `/api/*`
- [ ] JSON request log line (method, path, status, ms)
- [ ] Document env vars in README

**Files:** `backend/src/index.js`, `README.md`

---

## 13. Contract: admin pause flag — Medium

**Layer:** Contract

**Goal:** Add optional admin + `set_paused` so `register` can be paused.

**Acceptance**
- [ ] `init(admin)` once
- [ ] `set_paused(admin, bool)`
- [ ] `register` rejects when paused
- [ ] Unit tests

**Files:** `contracts/helios_lab/src/lib.rs`

