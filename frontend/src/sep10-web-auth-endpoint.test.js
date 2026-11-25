import { describe, expect, it } from "vitest";
import { normaliseAuthEndpoint } from "./sep10WebAuth";

describe("normaliseAuthEndpoint", () => {
  it("keeps a plain https endpoint as entered", () => {
    expect(normaliseAuthEndpoint("https://anchor.example.com/auth")).toBe(
      "https://anchor.example.com/auth"
    );
  });

  it("strips the trailing slash so paths can be appended safely", () => {
    expect(normaliseAuthEndpoint("https://anchor.example.com/auth/")).toBe(
      "https://anchor.example.com/auth"
    );
    expect(normaliseAuthEndpoint("https://anchor.example.com/")).toBe(
      "https://anchor.example.com"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseAuthEndpoint("  https://anchor.example.com/auth  ")).toBe(
      "https://anchor.example.com/auth"
    );
  });

  it("refuses a missing or blank endpoint", () => {
    expect(() => normaliseAuthEndpoint()).toThrow(
      "Enter the anchor's web-auth endpoint."
    );
    expect(() => normaliseAuthEndpoint("")).toThrow(
      "Enter the anchor's web-auth endpoint."
    );
    expect(() => normaliseAuthEndpoint("   ")).toThrow(
      "Enter the anchor's web-auth endpoint."
    );
    expect(() => normaliseAuthEndpoint(42)).toThrow(
      "Enter the anchor's web-auth endpoint."
    );
  });

  it("refuses an endpoint with embedded whitespace", () => {
    expect(() => normaliseAuthEndpoint("https://anchor.example.com/ auth")).toThrow(
      "The web-auth endpoint cannot contain spaces."
    );
  });

  it("refuses anything that is not https", () => {
    expect(() => normaliseAuthEndpoint("http://anchor.example.com/auth")).toThrow(
      "The web-auth endpoint must use https://."
    );
    expect(() => normaliseAuthEndpoint("anchor.example.com/auth")).toThrow(
      "The web-auth endpoint must use https://."
    );
    // The scheme check is case-insensitive; a signed challenge over an
    // uppercase HTTPS scheme is still https.
    expect(normaliseAuthEndpoint("HTTPS://anchor.example.com/auth")).toBe(
      "https://anchor.example.com/auth"
    );
  });

  it("refuses a URL that cannot be parsed", () => {
    expect(() => normaliseAuthEndpoint("https://")).toThrow(
      "The web-auth endpoint is not a readable URL."
    );
  });

  it("refuses credentials embedded in the URL", () => {
    expect(
      () => normaliseAuthEndpoint("https://user:secret@anchor.example.com/auth")
    ).toThrow("The web-auth endpoint cannot embed credentials.");
  });

  it("refuses query parameters because the account is appended for you", () => {
    expect(
      () => normaliseAuthEndpoint("https://anchor.example.com/auth?account=GST7")
    ).toThrow(
      "Enter the endpoint without query parameters; the account is appended for you."
    );
  });
});
