import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LabAdminPanel from "./LabAdminPanel";

const ADMIN = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const OTHER_WALLET = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB5S";

function renderPanel({ adminState, publicKey }) {
  return renderToStaticMarkup(
    createElement(LabAdminPanel, {
      adminState,
      publicKey,
      proposeAdminForm: { address: "" },
      setProposeAdminForm: vi.fn(),
      onProposeAdmin: vi.fn(),
      onAcceptAdmin: vi.fn(),
      loading: "",
      Spinner: () => null,
    })
  );
}

describe("LabAdminPanel", () => {
  it("shows the full admin address and admin actions for the admin wallet", () => {
    const markup = renderPanel({
      adminState: { admin: ADMIN, pendingAdmin: null },
      publicKey: ADMIN,
    });

    expect(markup).toContain(ADMIN);
    expect(markup).toContain("Connected wallet is the contract admin.");
    expect(markup).toContain("Propose admin");
  });

  it("identifies a non-admin wallet and hides admin-only actions", () => {
    const markup = renderPanel({
      adminState: { admin: ADMIN, pendingAdmin: null },
      publicKey: OTHER_WALLET,
    });

    expect(markup).toContain(ADMIN);
    expect(markup).toContain("Connected wallet is not the contract admin.");
    expect(markup).not.toContain("Propose admin");
  });

  it("shows the admin address without a connected wallet", () => {
    const markup = renderPanel({
      adminState: { admin: ADMIN, pendingAdmin: null },
      publicKey: null,
    });

    expect(markup).toContain(ADMIN);
    expect(markup).toContain("Connect a wallet to check whether it is the admin.");
    expect(markup).not.toContain("Propose admin");
  });

  it("describes an unset contract admin", () => {
    const markup = renderPanel({
      adminState: { admin: null, pendingAdmin: null },
      publicKey: OTHER_WALLET,
    });

    expect(markup).toContain("Current admin");
    expect(markup).toContain("Unset");
    expect(markup).toContain("The contract admin is unset.");
    expect(markup).not.toContain("Propose admin");
  });
});
