import { useEffect, useRef, useState } from "react";
import { getTransactionByHash, explorerTxUrl } from "./stellar";

const OPERATION_FIELDS = [
  ["source_account", "Source"],
  ["from", "From"],
  ["to", "To"],
  ["amount", "Amount"],
  ["asset_code", "Asset"],
  ["asset_issuer", "Issuer"],
  ["destination", "Destination"],
  ["starting_balance", "Starting balance"],
  ["limit", "Limit"],
  ["trustor", "Trustor"],
  ["authorize", "Authorized"],
];

export function TransactionHashDetails({ transaction, operations }) {
  return (
    <div className="section" aria-live="polite">
      <div className="info-box">
        <span className="eyebrow">Transaction</span>
        <div className="metadata-grid">
          <div>
            <span className="metadata-label">Hash</span>
            <span className="metadata-value">{transaction.hash}</span>
          </div>
          <div>
            <span className="metadata-label">Result</span>
            <span className="metadata-value">{transaction.successful ? "Success" : "Failed"}</span>
          </div>
          <div>
            <span className="metadata-label">Fee charged</span>
            <span className="metadata-value">{transaction.fee_charged} stroops</span>
          </div>
        </div>
        <a href={explorerTxUrl(transaction.hash)} target="_blank" rel="noreferrer">
          View on StellarExpert ↗
        </a>
      </div>
      <h3>Operations</h3>
      {operations.map((operation, index) => (
        <div className="info-box" key={operation.id ?? index}>
          <span className="eyebrow">Operation {index + 1} · {operation.type}</span>
          <div className="metadata-grid">
            {OPERATION_FIELDS.filter(([key]) => operation[key] != null).map(([key, label]) => (
              <div key={key}>
                <span className="metadata-label">{label}</span>
                <span className="metadata-value">{String(operation[key])}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TransactionHashOutcome({ result, error }) {
  return (
    <>
      {error && <div className="info-box info-box--warning" role="alert">{error}</div>}
      {result && <TransactionHashDetails {...result} />}
    </>
  );
}

export default function TransactionHashLookup() {
  const [hash, setHash] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const load = async (event) => {
    event.preventDefault();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const found = await getTransactionByHash(hash, { signal: controller.signal });
      if (!controller.signal.aborted) setResult(found);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause.message || "Could not load transaction.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return (
    <div className="section">
      <h3>Load a transaction by hash</h3>
      <p className="muted">Read one transaction from Horizon on the selected network. No wallet or signing is needed.</p>
      <form className="form" onSubmit={load}>
        <label className="label" htmlFor="lookup-transaction-hash">Transaction hash</label>
        <input
          id="lookup-transaction-hash"
          className="input"
          type="text"
          value={hash}
          onChange={(event) => setHash(event.target.value)}
          placeholder="64 hexadecimal characters"
          spellCheck={false}
        />
        <button className="btn btn--primary" type="submit" disabled={loading}>
          {loading ? "Loading…" : "Load transaction"}
        </button>
      </form>
      <TransactionHashOutcome result={result} error={error} />
    </div>
  );
}
