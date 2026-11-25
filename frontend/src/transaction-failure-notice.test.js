import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TransactionFailureNotice from "./TransactionFailureNotice";

describe("TransactionFailureNotice", () => {
  it("renders operation index, result code, and known explanation", () => {
    const markup = renderToStaticMarkup(
      createElement(TransactionFailureNotice, {
        failure: {
          operations: [
            {
              index: 0,
              code: "op_underfunded",
              explanation: "Sending account does not have enough balance.",
            },
          ],
          transactionCode: "tx_failed",
          transactionExplanation: "Transaction failed during execution.",
        },
      })
    );

    expect(markup).toContain("Operation index 0");
    expect(markup).toContain("op_underfunded");
    expect(markup).toContain("Sending account does not have enough balance.");
  });

  it("renders an unknown code without an invented explanation", () => {
    const markup = renderToStaticMarkup(
      createElement(TransactionFailureNotice, {
        failure: {
          operations: [{ index: 2, code: "op_future_code", explanation: null }],
          transactionCode: null,
        },
      })
    );

    expect(markup).toContain("Operation index 2");
    expect(markup).toContain("op_future_code");
    expect(markup).not.toContain("No explanation");
  });

  it("renders no error block for a successful transaction", () => {
    expect(
      renderToStaticMarkup(
        createElement(TransactionFailureNotice, { failure: null })
      )
    ).toBe("");
  });

  it("marks a failure without operation results as transaction-level", () => {
    const markup = renderToStaticMarkup(
      createElement(TransactionFailureNotice, {
        failure: {
          operations: [],
          transactionCode: "tx_insufficient_fee",
          transactionExplanation: "Transaction fee is below the network minimum.",
        },
      })
    );

    expect(markup).toContain(
      "Transaction-level failure; no operation index was returned."
    );
    expect(markup).toContain("tx_insufficient_fee");
  });
});
