export default function TransactionFailureNotice({ failure }) {
  if (!failure) return null;

  const operations = failure.operations ?? [];

  return (
    <section className="info-box info-box--warning" role="alert">
      <span className="eyebrow">Transaction failed</span>
      {operations.length > 0 ? (
        <ul className="transaction-failure__operations">
          {operations.map(({ index, code, explanation }) => (
            <li key={`${index}-${code}`}>
              Operation index {index} · <code>{code}</code>
              {explanation ? ` — ${explanation}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p>Transaction-level failure; no operation index was returned.</p>
      )}
      {failure.transactionCode && (
        <p>
          Transaction result code: <code>{failure.transactionCode}</code>
          {failure.transactionExplanation
            ? ` — ${failure.transactionExplanation}`
            : ""}
        </p>
      )}
    </section>
  );
}
