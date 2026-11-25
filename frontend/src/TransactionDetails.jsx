import { useEffect, useState } from "react";
import { getTransactionDetails, explorerTxUrl } from "./stellar";
import { describeEffect, operationName } from "./txDetails";

export function TransactionDetailsView({ details, error, loading }) {
  if (loading) return <p className="muted">Loading transaction…</p>;
  if (error) {
    return <div className="info-box info-box--warning" role="alert">{error}</div>;
  }
  if (!details) return null;

  const { transaction, operations, effects } = details;
  return (
    <div className="info-box tx-details" aria-live="polite">
      <span className="eyebrow">
        Transaction · {transaction.successful ? "Success" : "Failed"}
      </span>
      <a href={explorerTxUrl(transaction.hash)} target="_blank" rel="noreferrer">
        View on StellarExpert ↗
      </a>
      <h4>Operations</h4>
      <ol className="tx-details__list">
        {operations.map((operation, index) => (
          <li key={operation.id ?? index}>
            {operationName(operation.type)}
            {operation.transaction_successful === false && " · Failed"}
          </li>
        ))}
      </ol>
      <h4>Effects</h4>
      {effects.length > 0 ? (
        <ul className="tx-details__list">
          {effects.map((effect, index) => (
            <li key={effect.id ?? index}>{describeEffect(effect)}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No effects.</p>
      )}
    </div>
  );
}

/** Loads a transaction once per hash; selecting the same hash again never refetches. */
export default function TransactionDetails({ hash }) {
  const [state, setState] = useState({ hash: null, details: null, error: null });

  useEffect(() => {
    let current = true;
    getTransactionDetails(hash)
      .then((details) => current && setState({ hash, details, error: null }))
      .catch((cause) =>
        current &&
        setState({ hash, details: null, error: cause.message || "Could not load transaction." })
      );
    return () => {
      current = false;
    };
  }, [hash]);

  return (
    <TransactionDetailsView
      loading={state.hash !== hash}
      details={state.details}
      error={state.error}
    />
  );
}
