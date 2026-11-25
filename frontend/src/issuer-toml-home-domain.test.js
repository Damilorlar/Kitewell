import { describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  fetchIssuerToml,
  issuerInputKind,
  resolveIssuerHomeDomain,
} from "./issuerToml";

const ISSUER = StellarSdk.Keypair.random().publicKey();

describe("resolveIssuerHomeDomain", () => {
  it("returns the home_domain the account published", async () => {
    const loadAccount = vi.fn(async () => ({ home_domain: "anchor.example.com" }));
    const result = await resolveIssuerHomeDomain({ issuerAccount: ISSUER, loadAccount });

    expect(loadAccount).toHaveBeenCalledWith(ISSUER);
    expect(result).toEqual({ homeDomain: "anchor.example.com", issuerAccount: ISSUER });
  });

  it("normalises the published value rather than trusting it", async () => {
    const loadAccount = vi.fn(async () => ({ home_domain: "https://anchor.example.com/toml" }));
    await expect(
      resolveIssuerHomeDomain({ issuerAccount: ISSUER, loadAccount })
    ).rejects.toThrow("A home domain is a hostname, not a URL with a scheme.");
  });

  it("reports no home domain instead of guessing one", async () => {
    for (const account of [{}, { home_domain: "" }, { home_domain: "   " }, { home_domain: null }, { home_domain: 42 }]) {
      const loadAccount = vi.fn(async () => account);
      await expect(
        resolveIssuerHomeDomain({ issuerAccount: ISSUER, loadAccount })
      ).resolves.toEqual({ homeDomain: null, issuerAccount: ISSUER });
    }
  });

  it("surfaces an account that cannot be loaded", async () => {
    const loadAccount = vi.fn(async () => {
      throw new Error("Horizon has no such account");
    });
    await expect(
      resolveIssuerHomeDomain({ issuerAccount: ISSUER, loadAccount })
    ).rejects.toThrow("Horizon has no such account");
  });

  it("refuses an account that is not an account", async () => {
    const loadAccount = vi.fn();
    for (const bad of ["anchor.example.com", "G0", "", undefined, 42]) {
      await expect(resolveIssuerHomeDomain({ issuerAccount: bad, loadAccount })).rejects.toThrow(
        "Enter a valid issuer account (G…)."
      );
    }
    expect(loadAccount).not.toHaveBeenCalled();
  });
});

describe("issuerInputKind", () => {
  it("tells an account from a domain", () => {
    expect(issuerInputKind(ISSUER)).toBe("account");
    expect(issuerInputKind(` ${ISSUER} `)).toBe("account");
    expect(issuerInputKind("anchor.example.com")).toBe("domain");
    expect(issuerInputKind(undefined)).toBe("domain");
    expect(issuerInputKind(42)).toBe("domain");
  });
});

describe("fetchIssuerToml", () => {
  function response({ ok = true, status = 200, body = "", url }) {
    return { ok, status, url, text: async () => body };
  }

  it("reads the well-known path over https", async () => {
    const fetchFn = vi.fn(async () => response({ body: 'VERSION = "0.1"' }));
    const result = await fetchIssuerToml({ domain: "anchor.example.com", fetchFn });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://anchor.example.com/.well-known/stellar.toml",
      { method: "GET", headers: { Accept: "text/plain" } }
    );
    expect(result.url).toBe("https://anchor.example.com/.well-known/stellar.toml");
    expect(result.text).toBe('VERSION = "0.1"');
  });

  it("reports a domain that publishes no stellar.toml", async () => {
    const fetchFn = vi.fn(async () => response({ ok: false, status: 404 }));
    await expect(
      fetchIssuerToml({ domain: "anchor.example.com", fetchFn })
    ).rejects.toThrow("No stellar.toml was published for this domain (404).");
  });

  it("refuses a response that left https", async () => {
    const fetchFn = vi.fn(
      async () => response({ url: "http://anchor.example.com/.well-known/stellar.toml" })
    );
    await expect(
      fetchIssuerToml({ domain: "anchor.example.com", fetchFn })
    ).rejects.toThrow("The stellar.toml redirect left HTTPS, so it was not read.");
  });

  it("still reads when the transport reports no final URL", async () => {
    const fetchFn = vi.fn(async () => response({ body: "VERSION = \"0.1\"" }));
    await expect(
      fetchIssuerToml({ domain: "anchor.example.com", fetchFn })
    ).resolves.toMatchObject({ text: 'VERSION = "0.1"' });
  });

  it("validates the domain before any request is made", async () => {
    const fetchFn = vi.fn();
    await expect(
      fetchIssuerToml({ domain: "anchor.example.com/stellar.toml", fetchFn })
    ).rejects.toThrow("A home domain cannot carry a path, query or fragment.");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses to run without a way to make the request", async () => {
    await expect(
      fetchIssuerToml({ domain: "anchor.example.com", fetchFn: null })
    ).rejects.toThrow("This session cannot make requests, so no stellar.toml can be read.");
  });
});
