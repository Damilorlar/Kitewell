import express from "express";
import cors from "cors";
import * as StellarSdk from "@stellar/stellar-sdk";

const PORT = Number(process.env.PORT) || 8787;
const HORIZON_URL =
  process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
const NETWORK = process.env.NETWORK || "TESTNET";
const FRIENDBOT_URL =
  process.env.FRIENDBOT_URL || "https://friendbot.stellar.org";
const EXPLORER_BASE =
  process.env.EXPLORER_BASE || "https://stellar.expert/explorer/testnet";

/** Optional: set after deploying contracts/helios_lab on Testnet */
const HELIOS_LAB_CONTRACT_ID = process.env.HELIOS_LAB_CONTRACT_ID || null;

const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "helios-lab-backend",
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
    passphrase: StellarSdk.Networks.TESTNET,
    contract: {
      heliosLab: HELIOS_LAB_CONTRACT_ID,
      status: HELIOS_LAB_CONTRACT_ID ? "configured" : "not_deployed",
    },
  });
});

app.get("/api/account/:address", async (req, res) => {
  const { address } = req.params;
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
    return res.status(400).json({ error: "Invalid Stellar public key" });
  }

  try {
    const account = await server.loadAccount(address);
    const balances = account.balances.map((b) => {
      if (b.asset_type === "native") {
        return {
          key: "native",
          code: "XLM",
          issuer: null,
          balance: b.balance,
          limit: null,
          isNative: true,
        };
      }
      return {
        key: `${b.asset_code}:${b.asset_issuer}`,
        code: b.asset_code,
        issuer: b.asset_issuer,
        balance: b.balance,
        limit: b.limit,
        isNative: false,
      };
    });

    res.json({
      id: account.id,
      sequence: account.sequenceNumber(),
      subentryCount: account.subentry_count,
      thresholds: account.thresholds,
      balances,
      explorerUrl: `${EXPLORER_BASE}/account/${address}`,
    });
  } catch (err) {
    const status = err?.response?.status || 404;
    res.status(status === 404 ? 404 : 502).json({
      error:
        status === 404
          ? "Account not found on Testnet. Fund with Friendbot first."
          : "Horizon request failed",
      detail: err?.message,
    });
  }
});

app.get("/api/payments/:address", async (req, res) => {
  const { address } = req.params;
  const limit = Math.min(Number(req.query.limit) || 15, 50);

  if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
    return res.status(400).json({ error: "Invalid Stellar public key" });
  }

  try {
    const payments = await server
      .payments()
      .forAccount(address)
      .limit(limit)
      .order("desc")
      .call();

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
        explorerUrl: `${EXPLORER_BASE}/tx/${p.transaction_hash}`,
      }));

    res.json({ records });
  } catch (err) {
    res.status(502).json({
      error: "Could not load payments",
      detail: err?.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Helios Lab backend listening on http://localhost:${PORT}`);
  console.log(`Network: ${NETWORK} · Horizon: ${HORIZON_URL}`);
});
