import { useEffect, useState } from "react";
import { NETWORKS } from "./network";
import { getLatestLedger } from "./stellar";

const REFRESH_INTERVAL_MS = 10_000;
const STROOPS_PER_XLM = 10_000_000n;

function formatStroops(value) {
  const stroops = BigInt(value);
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = String(stroops % STROOPS_PER_XLM).padStart(7, "0");
  return `${whole}.${fraction} XLM · ${stroops.toLocaleString()} stroops`;
}

function formatUtc(value) {
  return `${new Date(value).toISOString().replace("T", " ").replace("Z", " UTC")}`;
}

export default function LatestLedgerHeader({ networkId }) {
  const [ledgers, setLedgers] = useState({});
  const [failedNetworks, setFailedNetworks] = useState({});
  const network = NETWORKS[networkId];
  const ledger = ledgers[networkId] ?? null;
  const failed = failedNetworks[networkId] ?? false;

  useEffect(() => {
    let disposed = false;
    let requestPending = false;
    let intervalId;

    const refresh = async () => {
      if (requestPending || document.visibilityState === "hidden") return;
      requestPending = true;
      try {
        const latest = await getLatestLedger(networkId);
        if (disposed || document.visibilityState === "hidden") return;
        setLedgers((current) => ({ ...current, [networkId]: latest }));
        setFailedNetworks((current) => ({ ...current, [networkId]: false }));
      } catch {
        if (disposed || document.visibilityState === "hidden") return;
        setFailedNetworks((current) => ({ ...current, [networkId]: true }));
      } finally {
        requestPending = false;
      }
    };

    const startRefreshing = () => {
      if (intervalId === undefined) {
        intervalId = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearInterval(intervalId);
        intervalId = undefined;
      } else {
        void refresh();
        startRefreshing();
      }
    };

    if (document.visibilityState !== "hidden") {
      void refresh();
      startRefreshing();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [networkId]);

  return (
    <section
      className="ledger-status"
      aria-label={`Latest ledger on ${network?.label ?? networkId}`}
    >
      <div className="ledger-status__heading">
        <span className="eyebrow">Latest ledger · {network?.label ?? networkId}</span>
        <strong>{ledger ? `#${ledger.sequence}` : "—"}</strong>
      </div>
      <dl className="ledger-status__values">
        <div>
          <dt>Closed (UTC)</dt>
          <dd>{ledger ? formatUtc(ledger.closedAt) : "—"}</dd>
        </div>
        <div>
          <dt>Base fee</dt>
          <dd>{ledger ? formatStroops(ledger.baseFeeInStroops) : "—"}</dd>
        </div>
        <div>
          <dt>Base reserve</dt>
          <dd>{ledger ? formatStroops(ledger.baseReserveInStroops) : "—"}</dd>
        </div>
      </dl>
      {failed && (
        <p className="ledger-status__error" role="status">
          Could not load the latest ledger.
          {ledger && " Showing last successfully loaded values."}
        </p>
      )}
    </section>
  );
}
