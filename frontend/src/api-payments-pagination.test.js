import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPaymentsViaApi } from "./api";

/**
 * Issue #220: lock the cursor contract of the payments endpoint.
 *
 * The request must carry `limit` plus an optional `cursor`, and the response is
 * the page object `{ records, nextCursor }` — not a bare records array.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body, { ok = true } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchPaymentsViaApi pagination", () => {
  it("requests the first page without a cursor and returns the page", async () => {
    const fetchMock = stubFetch({
      records: [{ id: "p1" }],
      nextCursor: "token-1",
    });

    await expect(fetchPaymentsViaApi("GTEST")).resolves.toEqual({
      records: [{ id: "p1" }],
      nextCursor: "token-1",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/payments/GTEST?");
    expect(url).toContain("limit=15");
    expect(url).not.toContain("cursor=");
  });

  it("sends the cursor and a custom limit for the next page", async () => {
    const fetchMock = stubFetch({ records: [], nextCursor: null });

    await fetchPaymentsViaApi("GTEST", 5, "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("limit=5");
    expect(url).toContain("cursor=token-1");
  });

  it("returns nextCursor null on the last page", async () => {
    stubFetch({ records: [{ id: "p9" }] });

    await expect(fetchPaymentsViaApi("GTEST", 5, "token-8")).resolves.toEqual({
      records: [{ id: "p9" }],
      nextCursor: null,
    });
  });

  it("treats a missing nextCursor as null", async () => {
    stubFetch({ records: [{ id: "p1" }] });

    await expect(fetchPaymentsViaApi("GTEST")).resolves.toEqual({
      records: [{ id: "p1" }],
      nextCursor: null,
    });
  });

  it("throws the backend's Invalid cursor message on a 400", async () => {
    stubFetch({ error: "Invalid cursor" }, { ok: false });

    await expect(
      fetchPaymentsViaApi("GTEST", 15, "not-a-cursor")
    ).rejects.toThrow("Invalid cursor");
  });
});
