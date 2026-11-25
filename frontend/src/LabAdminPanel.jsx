export default function LabAdminPanel({
  adminState,
  publicKey,
  proposeAdminForm,
  setProposeAdminForm,
  onProposeAdmin,
  onAcceptAdmin,
  loading,
  Spinner,
}) {
  if (!adminState) return null;

  const isAdmin = Boolean(publicKey && adminState.admin && publicKey === adminState.admin);

  return (
    <div className="info-box">
      <span className="eyebrow">Admin</span>
      <div style={{ marginBottom: 12 }}>
        <span className="metadata-label">Current admin</span>
        <code style={{ display: "block", marginTop: 4, overflowWrap: "anywhere" }}>
          {adminState.admin || "Unset"}
        </code>
      </div>
      <p className="muted">
        {!adminState.admin
          ? "The contract admin is unset."
          : !publicKey
            ? "Connect a wallet to check whether it is the admin."
            : isAdmin
              ? "Connected wallet is the contract admin."
              : "Connected wallet is not the contract admin."}
      </p>
      {adminState.pendingAdmin && (
        <div style={{ marginBottom: 12 }}>
          <span className="metadata-label">Pending admin</span>
          <code style={{ display: "block", marginTop: 4, overflowWrap: "anywhere" }}>
            {adminState.pendingAdmin}
          </code>
        </div>
      )}
      {isAdmin && (
        <form onSubmit={onProposeAdmin} style={{ marginTop: 12 }}>
          <label className="label" htmlFor="propose-admin-address">
            Propose successor admin
          </label>
          <input
            id="propose-admin-address"
            className="input"
            placeholder="G… address"
            value={proposeAdminForm.address}
            onChange={(event) =>
              setProposeAdminForm({ address: event.target.value })
            }
          />
          <button
            className="btn btn--primary"
            type="submit"
            disabled={loading === "propose-admin"}
          >
            {loading === "propose-admin" ? (
              <>
                <Spinner /> Proposing…
              </>
            ) : (
              "Propose admin"
            )}
          </button>
        </form>
      )}
      {publicKey && publicKey === adminState.pendingAdmin && (
        <div style={{ marginTop: 12 }}>
          <p className="muted" style={{ marginBottom: 8 }}>
            You are the pending admin. Accept to become the live admin.
          </p>
          <button
            className="btn btn--primary"
            type="button"
            onClick={onAcceptAdmin}
            disabled={loading === "accept-admin"}
          >
            {loading === "accept-admin" ? (
              <>
                <Spinner /> Accepting…
              </>
            ) : (
              "Accept admin"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
