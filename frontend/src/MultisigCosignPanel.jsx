import { useState } from "react";
import {
  inspectMultisigEnvelope,
  addSignatureToEnvelopeWithFreighter,
  submitMultisigEnvelope,
} from "./multisigEnvelope";

/** Paste a multi-sig envelope, co-sign it with Freighter, submit at medium threshold. */
export default function MultisigCosignPanel({ publicKey, onToast }) {
  const [xdr, setXdr] = useState("");
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (label, fn) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy("");
    }
  };

  const inspect = (value = xdr) =>
    run("inspect", async () => setSummary(await inspectMultisigEnvelope(value)));

  const me = summary?.signers.find((s) => s.key === publicKey);
  const canSign = Boolean(publicKey && me && !me.signed);

  return (
    <div className="section" id="multisig-cosign-section">
      <div className="section__row">
        <h2>Co-sign a multi-sig envelope</h2>
        <p className="muted">
          Paste an envelope to see who has signed. Existing signatures are kept.
        </p>
      </div>
      <textarea
        rows={4}
        value={xdr}
        placeholder="Transaction envelope XDR (base64)"
        onChange={(e) => {
          setXdr(e.target.value);
          setSummary(null);
        }}
      />
      <div className="section__row">
        <button type="button" disabled={!xdr.trim() || busy} onClick={() => inspect()}>
          {busy === "inspect" ? "Checking…" : "Check signatures"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {summary && (
        <>
          <ul>
            {summary.signers.map((s) => (
              <li key={s.key}>
                <code>{s.key}</code> · weight {s.weight} ·{" "}
                {s.signed ? "signed" : "not signed"}
                {s.key === publicKey ? " (you)" : ""}
              </li>
            ))}
          </ul>
          {summary.unknown > 0 && (
            <p className="muted">{summary.unknown} signature(s) from non-signers.</p>
          )}
          <p>
            Weight {summary.totalWeight} — low ({summary.thresholds.low}):{" "}
            {summary.meets.low ? "met" : "not met"}, medium ({summary.thresholds.medium}):{" "}
            {summary.meets.medium ? "met" : "not met"}, high ({summary.thresholds.high}):{" "}
            {summary.meets.high ? "met" : "not met"}
          </p>
          {publicKey && !me && (
            <p className="muted">The connected account is not a signer on this envelope.</p>
          )}
          <div className="section__row">
            <button
              type="button"
              disabled={!canSign || busy}
              onClick={() =>
                run("sign", async () => {
                  const next = await addSignatureToEnvelopeWithFreighter(summary.xdr, publicKey);
                  setXdr(next.xdr);
                  setSummary(next);
                  onToast?.("Signature added.");
                })
              }
            >
              {busy === "sign" ? "Signing in Freighter…" : "Add my signature"}
            </button>
            <button
              type="button"
              disabled={!summary.meets.medium || busy}
              onClick={() =>
                run("submit", async () => {
                  const result = await submitMultisigEnvelope(summary.xdr);
                  onToast?.(`Submitted ${result.hash}`);
                })
              }
            >
              {busy === "submit" ? "Submitting…" : "Submit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
