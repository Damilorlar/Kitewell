import { createApp } from "./app.js";
import { resolveNetwork } from "./networkConfig.js";

const PORT = Number(process.env.PORT) || 8787;

/** Unknown NETWORK is fatal: fail fast instead of silently serving Testnet. */
let network;
try {
  network = resolveNetwork(process.env);
} catch (err) {
  console.error(`Kitewell backend cannot start: ${err.message}`);
  process.exit(1);
}

const app = createApp();

app.listen(PORT, () => {
  console.log(`Kitewell backend listening on http://localhost:${PORT}`);
  console.log(`Network: ${network.network} · Horizon: ${network.horizonUrl}`);
});
