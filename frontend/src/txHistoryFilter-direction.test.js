import { describe, expect, it } from "vitest";
import { filterTransactionHistory } from "./txHistoryFilter";

const ACCOUNT = "GACCOUNT";

describe("filterTransactionHistory direction", () => {
  const records = [
    { id: "sent", from: ACCOUNT, to: "GOTHER", asset_type: "native" },
    { id: "received", from: "GOTHER", to: ACCOUNT, asset_code: "USD" },
    { id: "other", from: "GOTHER", to: "GTHIRD", asset_code: "USD" },
  ];

  it("filters sent and received payments for the connected account", () => {
    expect(
      filterTransactionHistory(records, {
        direction: "sent",
        publicKey: ACCOUNT,
      }).map(({ id }) => id)
    ).toEqual(["sent"]);
    expect(
      filterTransactionHistory(records, {
        direction: "received",
        publicKey: ACCOUNT,
      }).map(({ id }) => id)
    ).toEqual(["received"]);
  });

  it("returns an empty list when no records match the selected asset", () => {
    expect(
      filterTransactionHistory(records, {
        asset: "EUR",
        direction: "received",
        publicKey: ACCOUNT,
      })
    ).toEqual([]);
  });
});
