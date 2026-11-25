import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test suite for stellar.toml and SEP-24 transfer server info fetching.
 *
 * These tests mock:
 * - StellarSdk.StellarTomlResolver for stellar.toml parsing
 * - globalThis.fetch for the SEP-24 /info endpoint
 */

const { stellarTomlResolveMock } = vi.hoisted(() => ({
  stellarTomlResolveMock: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    StellarTomlResolver: {
      resolve: stellarTomlResolveMock,
    },
  };
});

const {
  fetchStellarToml,
  fetchTransferServerInfo,
  fetchAnchorInfo,
} = await import("./stellar");

/** Minimal stellar.toml fixture with SEP-24 endpoints */
function stellarTomlFixture() {
  return {
    TRANSFER_SERVER: "https://anchor.example.com/sep24",
    WEB_AUTH_ENDPOINT: "https://anchor.example.com/auth",
    KYC_SERVER: "https://anchor.example.com/kyc",
    CURRENCIES: [
      {
        code: "USDC",
        issuer: "GISSUER123",
        status: "live",
      },
    ],
  };
}

/** Minimal SEP-24 /info fixture */
function transferServerInfoFixture() {
  return {
    deposit: {
      USDC: {
        enabled: true,
        min_amount: 0.1,
        max_amount: 10000,
      },
      BTC: {
        enabled: true,
        min_amount: 0.0001,
        max_amount: 1,
      },
    },
    withdraw: {
      USDC: {
        enabled: true,
        min_amount: 1,
        max_amount: 5000,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stellarTomlResolveMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchStellarToml", () => {
  it("fetches and parses stellar.toml for a domain", async () => {
    const toml = stellarTomlFixture();
    stellarTomlResolveMock.mockResolvedValue(toml);

    const result = await fetchStellarToml("anchor.example.com");

    expect(result).toEqual(toml);
    expect(stellarTomlResolveMock).toHaveBeenCalledWith("anchor.example.com", {
      allowHttp: false,
    });
  });

  it("fetches stellar.toml for an issuer address", async () => {
    const toml = stellarTomlFixture();
    stellarTomlResolveMock.mockResolvedValue(toml);

    const issuer = "GISSUER123";
    const result = await fetchStellarToml(issuer);

    expect(result).toEqual(toml);
    expect(stellarTomlResolveMock).toHaveBeenCalledWith(issuer, {
      allowHttp: false,
    });
  });

  it("rejects empty domain or issuer", async () => {
    await expect(fetchStellarToml("")).rejects.toThrow(
      "Domain or issuer address is required."
    );
    await expect(fetchStellarToml("   ")).rejects.toThrow(
      "Domain or issuer address is required."
    );
    await expect(fetchStellarToml(null)).rejects.toThrow(
      "Domain or issuer address is required."
    );
    await expect(fetchStellarToml(undefined)).rejects.toThrow(
      "Domain or issuer address is required."
    );
  });

  it("trims whitespace from domain", async () => {
    const toml = stellarTomlFixture();
    stellarTomlResolveMock.mockResolvedValue(toml);

    await fetchStellarToml("  anchor.example.com  ");

    expect(stellarTomlResolveMock).toHaveBeenCalledWith("anchor.example.com", {
      allowHttp: false,
    });
  });

  it("propagates errors from StellarTomlResolver", async () => {
    stellarTomlResolveMock.mockRejectedValue(
      new Error("stellar.toml not found")
    );

    await expect(fetchStellarToml("missing.example.com")).rejects.toThrow(
      "stellar.toml not found"
    );
  });

  it("enforces HTTPS by passing allowHttp: false", async () => {
    const toml = stellarTomlFixture();
    stellarTomlResolveMock.mockResolvedValue(toml);

    await fetchStellarToml("anchor.example.com");

    expect(stellarTomlResolveMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ allowHttp: false })
    );
  });

  it("returns toml without required SEP-24 keys", async () => {
    stellarTomlResolveMock.mockResolvedValue({
      CURRENCIES: [{ code: "USDC", issuer: "GISSUER" }],
    });

    const result = await fetchStellarToml("minimal.example.com");

    expect(result).toEqual({
      CURRENCIES: [{ code: "USDC", issuer: "GISSUER" }],
    });
    expect(result.TRANSFER_SERVER).toBeUndefined();
    expect(result.WEB_AUTH_ENDPOINT).toBeUndefined();
  });
});

describe("fetchTransferServerInfo", () => {
  it("fetches and parses the /info endpoint", async () => {
    const info = transferServerInfoFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(info),
      })
    );

    const result = await fetchTransferServerInfo(
      "https://anchor.example.com/sep24"
    );

    expect(result).toEqual(info);
    expect(fetch).toHaveBeenCalledWith("https://anchor.example.com/sep24/info");
  });

  it("handles trailing slash in transfer server URL", async () => {
    const info = transferServerInfoFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(info),
      })
    );

    await fetchTransferServerInfo("https://anchor.example.com/sep24/");

    expect(fetch).toHaveBeenCalledWith("https://anchor.example.com/sep24/info");
  });

  it("rejects non-HTTPS URLs", async () => {
    await expect(
      fetchTransferServerInfo("http://anchor.example.com/sep24")
    ).rejects.toThrow("Transfer server URL must use HTTPS.");
  });

  it("rejects empty URL", async () => {
    await expect(fetchTransferServerInfo("")).rejects.toThrow(
      "Transfer server URL is required."
    );
    await expect(fetchTransferServerInfo("   ")).rejects.toThrow(
      "Transfer server URL is required."
    );
    await expect(fetchTransferServerInfo(null)).rejects.toThrow(
      "Transfer server URL is required."
    );
    await expect(fetchTransferServerInfo(undefined)).rejects.toThrow(
      "Transfer server URL is required."
    );
  });

  it("rejects when fetch returns non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      })
    );

    await expect(
      fetchTransferServerInfo("https://anchor.example.com/sep24")
    ).rejects.toThrow("Failed to fetch transfer server info: 404 Not Found");
  });

  it("propagates network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    await expect(
      fetchTransferServerInfo("https://anchor.example.com/sep24")
    ).rejects.toThrow("Network error");
  });

  it("trims whitespace from URL", async () => {
    const info = transferServerInfoFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(info),
      })
    );

    await fetchTransferServerInfo("  https://anchor.example.com/sep24  ");

    expect(fetch).toHaveBeenCalledWith("https://anchor.example.com/sep24/info");
  });
});

describe("fetchAnchorInfo", () => {
  it("fetches both toml and transfer server info when present", async () => {
    const toml = stellarTomlFixture();
    const info = transferServerInfoFixture();

    stellarTomlResolveMock.mockResolvedValue(toml);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(info),
      })
    );

    const result = await fetchAnchorInfo("anchor.example.com");

    expect(result).toEqual({
      toml,
      transferServerInfo: info,
    });
    expect(stellarTomlResolveMock).toHaveBeenCalledWith("anchor.example.com", {
      allowHttp: false,
    });
    expect(fetch).toHaveBeenCalledWith("https://anchor.example.com/sep24/info");
  });

  it("returns null transferServerInfo when TRANSFER_SERVER is absent", async () => {
    stellarTomlResolveMock.mockResolvedValue({
      WEB_AUTH_ENDPOINT: "https://anchor.example.com/auth",
      CURRENCIES: [],
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchAnchorInfo("anchor.example.com");

    expect(result).toEqual({
      toml: {
        WEB_AUTH_ENDPOINT: "https://anchor.example.com/auth",
        CURRENCIES: [],
      },
      transferServerInfo: null,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null transferServerInfo when info endpoint fails", async () => {
    const toml = stellarTomlFixture();
    stellarTomlResolveMock.mockResolvedValue(toml);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })
    );

    const result = await fetchAnchorInfo("anchor.example.com");

    expect(result).toEqual({
      toml,
      transferServerInfo: null,
    });
  });

  it("returns null transferServerInfo when info endpoint throws", async () => {
    const toml = stellarTomlFixture();
    stellarTomlResolveMock.mockResolvedValue(toml);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await fetchAnchorInfo("anchor.example.com");

    expect(result).toEqual({
      toml,
      transferServerInfo: null,
    });
  });

  it("propagates stellar.toml fetch errors", async () => {
    stellarTomlResolveMock.mockRejectedValue(
      new Error("stellar.toml not found")
    );

    await expect(fetchAnchorInfo("missing.example.com")).rejects.toThrow(
      "stellar.toml not found"
    );
  });

  it("works with issuer addresses", async () => {
    const toml = stellarTomlFixture();
    const info = transferServerInfoFixture();

    stellarTomlResolveMock.mockResolvedValue(toml);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(info),
      })
    );

    const result = await fetchAnchorInfo("GISSUER123");

    expect(result).toEqual({
      toml,
      transferServerInfo: info,
    });
  });

  it("lists deposit assets with min and max from info endpoint", async () => {
    const toml = stellarTomlFixture();
    const info = transferServerInfoFixture();

    stellarTomlResolveMock.mockResolvedValue(toml);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(info),
      })
    );

    const result = await fetchAnchorInfo("anchor.example.com");

    expect(result.transferServerInfo.deposit).toHaveProperty("USDC");
    expect(result.transferServerInfo.deposit.USDC).toMatchObject({
      enabled: true,
      min_amount: 0.1,
      max_amount: 10000,
    });
    expect(result.transferServerInfo.deposit).toHaveProperty("BTC");
    expect(result.transferServerInfo.deposit.BTC).toMatchObject({
      enabled: true,
      min_amount: 0.0001,
      max_amount: 1,
    });
  });

  it("includes WEB_AUTH_ENDPOINT and KYC_SERVER from toml", async () => {
    const toml = stellarTomlFixture();
    stellarTomlResolveMock.mockResolvedValue(toml);

    const result = await fetchAnchorInfo("anchor.example.com");

    expect(result.toml.WEB_AUTH_ENDPOINT).toBe(
      "https://anchor.example.com/auth"
    );
    expect(result.toml.KYC_SERVER).toBe("https://anchor.example.com/kyc");
  });

  it("indicates when WEB_AUTH_ENDPOINT is absent", async () => {
    stellarTomlResolveMock.mockResolvedValue({
      TRANSFER_SERVER: "https://anchor.example.com/sep24",
      CURRENCIES: [],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(transferServerInfoFixture()),
      })
    );

    const result = await fetchAnchorInfo("anchor.example.com");

    expect(result.toml.WEB_AUTH_ENDPOINT).toBeUndefined();
    expect(result.toml.KYC_SERVER).toBeUndefined();
  });

  it("does not start a deposit or withdraw", async () => {
    const toml = stellarTomlFixture();
    const info = transferServerInfoFixture();

    stellarTomlResolveMock.mockResolvedValue(toml);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(info),
      })
    );

    await fetchAnchorInfo("anchor.example.com");

    // We only fetch /info, never POST to /deposit or /withdraw
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/info")
    );
  });

  it("does not start a SEP-10 challenge", async () => {
    const toml = stellarTomlFixture();
    stellarTomlResolveMock.mockResolvedValue(toml);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(transferServerInfoFixture()),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchAnchorInfo("anchor.example.com");

    // We never call WEB_AUTH_ENDPOINT
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth")
    );
  });
});
