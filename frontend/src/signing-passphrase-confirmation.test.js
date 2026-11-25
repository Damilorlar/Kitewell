import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SigningPassphraseConfirmation from "./SigningPassphraseConfirmation";
import { NETWORKS } from "./network";

describe("signing passphrase confirmation", () => {
  it("renders the full Testnet passphrase", () => {
    const markup = renderToStaticMarkup(
      createElement(SigningPassphraseConfirmation, {
        network: NETWORKS.TESTNET,
        onConfirm: () => {},
        onCancel: () => {},
      })
    );

    expect(markup).toContain("Test SDF Network ; September 2015");
    expect(markup).toContain("Confirm passphrase &amp; open Freighter");
  });
});
