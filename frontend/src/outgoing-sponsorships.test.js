import { describe, expect, it } from "vitest";
import {
  mapOutgoingSponsorships,
  sponsorshipEntryType,
} from "./outgoingSponsorships";

const ME = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const FRIEND = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const STRANGER = "GAWU5QOHUDUU7OHTZM3SSFZGXM3DEGNTTSPLHHT67WN2UVKCYNERQHEW";

/** The account sponsored a friend's account (reserve for a new account). */
const ACCOUNT_SPONSORSHIP = [
  {
    id: "1",
    type: "begin_sponsoring_future_reserves",
    source_account: ME,
    transaction_hash: "tx-account",
  },
  {
    id: "2",
    type: "create_account",
    source_account: ME,
    account: FRIEND,
    starting_balance: "0.0000000",
    transaction_hash: "tx-account",
  },
  {
    id: "3",
    type: "end_sponsoring_future_reserves",
    source_account: ME,
    transaction_hash: "tx-account",
  },
];

/** The account sponsored a friend's trustline (reserve for a subentry). */
const TRUSTLINE_SPONSORSHIP = [
  {
    id: "4",
    type: "begin_sponsoring_future_reserves",
    source_account: ME,
    transaction_hash: "tx-trustline",
  },
  {
    id: "5",
    type: "change_trust",
    source_account: STRANGER,
    asset_code: "USDC",
    transaction_hash: "tx-trustline",
  },
  {
    id: "6",
    type: "end_sponsoring_future_reserves",
    source_account: ME,
    transaction_hash: "tx-trustline",
  },
];

/** Someone else sponsored this account — an incoming sponsorship. */
const INCOMING_SPONSORSHIP = [
  {
    id: "7",
    type: "begin_sponsoring_future_reserves",
    source_account: STRANGER,
    transaction_hash: "tx-incoming",
  },
  {
    id: "8",
    type: "change_trust",
    source_account: ME,
    asset_code: "USDC",
    transaction_hash: "tx-incoming",
  },
];

describe("mapOutgoingSponsorships", () => {
  it("lists the two sponsorships this account gave, with their entry types", () => {
    expect(
      mapOutgoingSponsorships(
        [...ACCOUNT_SPONSORSHIP, ...TRUSTLINE_SPONSORSHIP],
        ME
      )
    ).toEqual([
      { sponsoredAccount: FRIEND, entryType: "Account" },
      { sponsoredAccount: STRANGER, entryType: "Trustline" },
    ]);
  });

  it("returns an empty list when the account sponsors nothing", () => {
    expect(mapOutgoingSponsorships([], ME)).toEqual([]);
    expect(mapOutgoingSponsorships(undefined, ME)).toEqual([]);
  });

  it("excludes sponsorships received from other accounts", () => {
    expect(mapOutgoingSponsorships(INCOMING_SPONSORSHIP, ME)).toEqual([]);
  });

  it("does not repeat a sponsorship reported twice", () => {
    expect(
      mapOutgoingSponsorships(
        [...ACCOUNT_SPONSORSHIP, ...ACCOUNT_SPONSORSHIP],
        ME
      )
    ).toEqual([{ sponsoredAccount: FRIEND, entryType: "Account" }]);
  });

  it("labels unknown entry types instead of dropping the row", () => {
    expect(sponsorshipEntryType("set_options")).toBe("Other entry");
    expect(sponsorshipEntryType("change_trust")).toBe("Trustline");
  });
});
