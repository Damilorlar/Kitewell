import express from "express";
import cors from "cors";
import * as StellarSdk from "@stellar/stellar-sdk";
import { mapBalances } from "./mapBalances.js";
import { createRateLimiter } from "./rateLimit.js";
import { resolveNetwork } from "./networkConfig.js";
import { mapTransactionFee } from "./transactionFee.js";

/**
 * Build the Kitewell Express app.
 *
 * Every piece of ambient state (env vars, Horizon server, rate-limit buckets)
 * is created per call so tests can exercise routes without network access or
 * module-load side effects.
 *
 * @param {object} [options]
 * @param {object} [options.horizon] Horizon server to use for every request
 *   network, or a map `{ TESTNET, FUTURENET }` of servers (tests). Defaults to
 *   one real `StellarSdk.Horizon.Server` per network, created on first use.
 * @param {Record<string, string|undefined>} [options.env] Environment source;
 *   defaults to `process.env`.
 * @returns {import("express").Express} The configured app (not listening).
 */
export function createApp({ horizon, env = process.env } = {}) {
  const {
    network: NETWORK,
    passphrase: NETWORK_PASSPHRASE,
    horizonUrl: HORIZON_URL,
    friendbotUrl: FRIENDBOT_URL,
    explorerBase: EXPLORER_BASE,
    sorobanRpcUrl: SOROBAN_RPC_URL,
  } = resolveNetwork(env);

  /** Per-IP rate limiting on /api/* (in-memory, no external store) */
  const RATE_LIMIT_WINDOW_MS = Number(env.RATE_LIMIT_WINDOW_MS) || 60_000;
  const RATE_LIMIT_MAX = Number(env.RATE_LIMIT_MAX) || 60;

  /** Optional: set after deploying contracts/kitewell on Testnet */
  const KITEWELL_CONTRACT_ID = env.KITEWELL_CONTRACT_ID || null;

  /** Horizon servers created lazily per network, so a read for one network
   * can never reuse a client pointed at another network's Horizon. */
  const serversByNetwork = new Map();

  function serverFor(network) {
    if (horizon) {
      // A single injected server serves every network (existing tests); a map
      // lets a test give each network its own stub.
      return typeof horizon.loadAccount === "function"
        ? horizon
        : horizon[network];
    }
    if (!serversByNetwork.has(network)) {
      const url =
        network === NETWORK
          ? HORIZON_URL
          : resolveRequestNetwork(network).horizonUrl;
      serversByNetwork.set(network, new StellarSdk.Horizon.Server(url));
    }
    return serversByNetwork.get(network);
  }

  /**
   * Resolve `?network=` (or the `x-kitewell-network` header) for a read.
   * Sends a 400 and returns `null` for an unsupported value so every route
   * rejects unknown networks the same way.
   */
  function requestNetwork(req, res) {
    const requested = req.query.network ?? req.get("x-kitewell-network");
    let config;
    try {
      config = resolveRequestNetwork(requested);
    } catch (err) {
      res.status(400).json({ error: err.message });
      return null;
    }

    // The configured network keeps its env URL overrides; any other network
    // uses its own preset URLs.
    const isConfigured = config.network === NETWORK;
    return {
      ...config,
      horizonUrl: isConfigured ? HORIZON_URL : config.horizonUrl,
      explorerBase: isConfigured ? EXPLORER_BASE : config.explorerBase,
    };
  }

  const app = express();

  /** One JSON log line per request: method, path, status, ms */
  function requestLogger(req, res, next) {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms =
        Math.round((Number(process.hrtime.bigint() - start) / 1e6) * 10) / 10;
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          ms,
        }),
      );
    });
    next();
  }

  /** Fixed-window per-IP rate limiter (own bucket map per app) */
  const rateLimit = createRateLimiter({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
  });

  app.use(cors({ origin: true }));
  app.use(express.json());
  app.use(requestLogger);
  app.use("/api", rateLimit);

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "kitewell-backend",
      network: NETWORK,
      horizon: HORIZON_URL,
    });
  });

  app.get("/api/network", (_req, res) => {
    res.json({
      network: NETWORK,
      horizonUrl: HORIZON_URL,
      friendbotUrl: FRIENDBOT_URL,
      explorerBase: EXPLORER_BASE,
      sorobanRpcUrl: SOROBAN_RPC_URL,
      passphrase: NETWORK_PASSPHRASE,
      contract: {
        kitewell: KITEWELL_CONTRACT_ID,
        status: KITEWELL_CONTRACT_ID ? "configured" : "not_deployed",
      },
    });
  });

  app.get("/api/account/:address", async (req, res) => {
    const { address } = req.params;
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
      return res.status(400).json({ error: "Invalid Stellar public key" });
    }

    const network = requestNetwork(req, res);
    if (!network) return;

    try {
      const account = await serverFor(network.network).loadAccount(address);
      const balances = mapBalances(account.balances);

      res.json({
        id: account.id,
        sequence: account.sequenceNumber(),
        subentryCount: account.subentry_count,
        lastModifiedLedger: account.last_modified_ledger ?? null,
        thresholds: account.thresholds,
        balances,
        signers: account.signers || [],
        dataEntries: Object.entries(account.data_attr || {})
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, value]) => ({ name, value })),
        explorerUrl: `${EXPLORER_BASE}/account/${address}`,
      });
    } catch (err) {
      const status = err?.response?.status || 404;
      res.status(status === 404 ? 404 : 502).json({
        error:
          status === 404
            ? `Account not found on ${network.label}. Fund with Friendbot first.`
            : "Horizon request failed",
        detail: err?.message,
      });
    }
  });

  app.get("/api/payments/:address", async (req, res) => {
    const { address } = req.params;
    const limit = Math.min(Number(req.query.limit) || 15, 50);
    const cursor = req.query.cursor;

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
      return res.status(400).json({ error: "Invalid Stellar public key" });
    }

    const network = requestNetwork(req, res);
    if (!network) return;

    try {
      let request = serverFor(network.network)
        .payments()
        .forAccount(address)
        .limit(limit)
        .order("desc")
        // Embeds each payment's transaction record, the source of fee and operation count.
        .join("transactions");

      // Paging backwards from the caller's cursor; omit it for the first page.
      if (cursor) request = request.cursor(cursor);

      const payments = await request.call();

      const records = payments.records
        .filter((p) => p.type === "payment")
        .map((p) => ({
          id: p.id,
          from: p.from,
          to: p.to,
          amount: p.amount,
          asset_type: p.asset_type,
          asset_code: p.asset_code || "XLM",
          transaction_hash: p.transaction_hash,
          created_at: p.created_at,
          ...mapTransactionFee(p.transaction),
          explorerUrl: `${EXPLORER_BASE}/tx/${p.transaction_hash}`,
        }));

      // A full page of raw records means there may be older ones; the cursor
      // is the last raw record (pre-filter) so nothing is skipped between pages.
      const lastRaw = payments.records[payments.records.length - 1];
      const nextCursor =
        payments.records.length < limit ? null : (lastRaw?.paging_token ?? null);

      res.json({ records, nextCursor });
    } catch (err) {
      if (err?.response?.status === 400) {
        return res.status(400).json({ error: "Invalid cursor" });
      }
      res.status(502).json({
        error: "Could not load payments",
        detail: err?.message,
      });
    }
  });

  return app;
}
