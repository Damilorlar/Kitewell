import { describe, expect, it } from "vitest";
import {
  appendBuilderPage,
  isBuilderCountMismatch,
  pageBuilderAddresses,
} from "./builderDirectory";

describe("builder directory paging", () => {
  it("pages and appends three fixture builders in pages of two", () => {
    const addresses = ["G_BUILDER_1", "G_BUILDER_2", "G_BUILDER_3"];
    const firstPageAddresses = pageBuilderAddresses(addresses, 0, 2);
    const firstPage = {
      ...firstPageAddresses,
      start: 0,
      limit: 2,
    };

    expect(firstPage.nextStart).toBe(2);

    const secondPage = {
      ...pageBuilderAddresses(
        addresses.slice(firstPage.nextStart),
        firstPage.nextStart,
        2
      ),
      start: firstPage.nextStart,
      limit: 2,
    };
    const loaded = appendBuilderPage(
      { ...firstPage, contractId: "contract" },
      secondPage,
      "contract"
    );

    expect(loaded.rows).toEqual(addresses);
    expect(loaded.nextStart).toBe(null);
  });

  it("flags a reported builder count lower than the loaded list", () => {
    expect(isBuilderCountMismatch(3, 2, 3)).toBe(true);
    expect(isBuilderCountMismatch(2, 3, 2)).toBe(false);
  });
});
