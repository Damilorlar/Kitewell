export default function SigningPassphraseConfirmation({
  network,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="info-box info-box--warning" role="dialog" aria-label="Confirm network passphrase">
      <span className="eyebrow">Confirm signing network</span>
      <p>
        Freighter will bind this signature to <strong>{network.label}</strong>
        {" "}using the full network passphrase:
      </p>
      <code style={{ wordBreak: "break-word" }}>{network.passphrase}</code>
      <div className="section__row" style={{ marginTop: 12 }}>
        <button className="btn btn--primary btn--sm" type="button" onClick={onConfirm}>
          Confirm passphrase &amp; open Freighter
        </button>
        <button className="btn btn--secondary btn--sm" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
