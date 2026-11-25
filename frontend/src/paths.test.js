import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchPathQuote,
  fetchStrictReceivePaths,
  fetchStrictSendPaths,
  formatPathHops,
} from "./paths";

/**
 * Issue #491: quote Horizon paths before signing.
 *
 * Horizon is mocked; nothing here signs or submits.
 */

const ISSUER = "GAWU5QOHUDUU7OHTZM3SSFZGXM3DEGNTTSPLHHT67WN2UVKCYNERQHEW";
const DESTINATION = "GAWU5QOHUDUU7OHTZM3SSFZGXM3DEGNTTSPLHHT67WN2UVKCYNERQHEW";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockHorizon(records) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ _embedded: { records } }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const CREDIT_HOP = {
  asset_type: "credit_alphanum4",
  asset_code: "USDC",
  asset_issuer: ISSUER,
};

describe("Horizon path quotes", () => {
  it("requests strict-send paths for native XLM into a credit asset", async () => {
    const fetchMock = mockHorizon([
      {
        source_amount: "10.0000000",
        destination_amount: "9.5000000",
        path: [CREDIT_HOP],
      },
    ]);

    const paths = await fetchStrictSendPaths({
      sendAsset: { isNative: true },
      destAsset: { isNative: false, code: "USDC", issuer: ISSUER },
      destination: DESTINATION,
      amount: "10",
      horizonUrl: "https://horizon.test.invalid",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("https://horizon.test.invalid/paths/strict-send?");
    expect(url).toContain("source_asset_type=native");
    expect(url).toContain("destination_asset_type=credit_alphanum4");
    expect(url).toContain("destination_asset_code=USDC");
    expect(url).toContain(`destination_asset_issuer=${ISSUER}`);
    expect(url).toContain("source_amount=10");
    expect(url).toContain(`destination=${DESTINATION}`);

    expect(paths).toEqual([
      {
        sourceAmount: "10.0000000",
        destinationAmount: "9.5000000",
        path: [{ isNative: false, code: "USDC", issuer: ISSUER }],
      },
    ]);
  });

  it("returns an empty list when Horizon finds no path", async () => {
    mockHorizon([]);

    await expect(
      fetchStrictSendPaths({
        sendAsset: { isNative: true },
        destAsset: { isNative: false, code: "USDC", issuer: ISSUER },
        destination: DESTINATION,
        amount: "10",
      })
    ).resolves.toEqual([]);
  });

  it("requests strict-receive paths with the destination amount", async () => {
    const fetchMock = mockHorizon([
      {
        source_amount: "11.0000000",
        destination_amount: "25.0000000",
        path: [{ asset_type: "native" }],
      },
    ]);

    const paths = await fetchStrictReceivePaths({
      sendAsset: { isNative: true },
      destAsset: { isNative: false, code: "USDC", issuer: ISSUER },
      destination: DESTINATION,
      amount: "25",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/paths/strict-receive?");
    expect(url).toContain("destination_amount=25");
    expect(paths[0].path[0]).toEqual({
      isNative: true,
      code: "XLM",
      issuer: null,
    });
  });

  it("encodes a credit hop as CODE:ISSUER and a direct path as empty", () => {
    expect(formatPathHops([{ isNative: false, code: "USDC", issuer: ISSUER }])).toBe(
      `USDC:${ISSUER}`
    );
    expect(formatPathHops([])).toBe("");
  });

  it("routes the mode-aware helper to the right endpoint", async () => {
    const fetchMock = mockHorizon([]);

    await fetchPathQuote({
      mode: "strictReceive",
      sendAsset: { isNative: true },
      destAsset: { isNative: false, code: "USDC", issuer: ISSUER },
      destination: DESTINATION,
      amount: "25",
    });
    await fetchPathQuote({
      mode: "strictSend",
      sendAsset: { isNative: true },
      destAsset: { isNative: false, code: "USDC", issuer: ISSUER },
      destination: DESTINATION,
      amount: "10",
    });

    expect(fetchMock.mock.calls[0][0]).toContain("/paths/strict-receive?");
    expect(fetchMock.mock.calls[1][0]).toContain("/paths/strict-send?");
  });

  it("surfaces a Horizon failure instead of pretending there is no path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    );

    await expect(
      fetchStrictSendPaths({
        sendAsset: { isNative: true },
        destAsset: { isNative: false, code: "USDC", issuer: ISSUER },
        destination: DESTINATION,
        amount: "10",
      })
    ).rejects.toThrow("Horizon path lookup failed (HTTP 503).");
  });
});
