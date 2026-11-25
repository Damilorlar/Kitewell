import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { readJwtClaims } from "./sep10WebAuth";

const SUBJECT = StellarSdk.Keypair.random().publicKey();
const OTHER = StellarSdk.Keypair.random().publicKey();
const NOW_MS = 1_700_000_000_000;
const EXP_SECONDS = 4_000_000_000;

function encodeUrl(segment) {
  return Buffer.from(JSON.stringify(segment)).toString("base64url");
}

function token(payload, signature = "signature-not-verified-here") {
  return `${encodeUrl({ alg: "RS256", typ: "JWT" })}.${encodeUrl(payload)}.${encodeUrl(signature)}`;
}

describe("readJwtClaims", () => {
  it("reads the subject and expiry the panel shows", () => {
    const claims = readJwtClaims(token({ sub: SUBJECT, iat: 1_600_000_000, exp: EXP_SECONDS }), {
      expectedSubject: SUBJECT,
      nowMs: NOW_MS,
    });

    expect(claims).toEqual({
      subject: SUBJECT,
      expiresAtMs: EXP_SECONDS * 1000,
      issuedAtMs: 1_600_000_000_000,
      expired: false,
    });
  });

  it("marks a token past its expiry instead of refusing it", () => {
    const claims = readJwtClaims(token({ sub: SUBJECT, exp: 1_000_000_000 }), {
      expectedSubject: SUBJECT,
      nowMs: NOW_MS,
    });
    expect(claims.expired).toBe(true);
    expect(claims.issuedAtMs).toBeNull();
  });

  it("decodes a payload segment that uses the base64url alphabet", () => {
    const subject = `x${"~".repeat(9)}`;
    const segment = encodeUrl({ sub: subject, exp: EXP_SECONDS });
    expect(segment).toMatch(/[-_]/);

    const claims = readJwtClaims(`header.${segment}.signature`, { nowMs: NOW_MS });
    expect(claims.subject).toBe(subject);
    expect(claims.expiresAtMs).toBe(EXP_SECONDS * 1000);
  });

  it("never returns the token itself", () => {
    const good = token({ sub: SUBJECT, exp: EXP_SECONDS });
    const claims = readJwtClaims(good, { nowMs: NOW_MS });
    expect(JSON.stringify(claims)).not.toContain(good);
  });

  it("refuses to read a token that is not a compact JWS", () => {
    expect(() => readJwtClaims("", { nowMs: NOW_MS })).toThrow("There is no access token to read.");
    expect(() => readJwtClaims(42, { nowMs: NOW_MS })).toThrow("There is no access token to read.");
    for (const bad of ["   ", "abc", "a.b", "a.b.c.d"]) {
      expect(() => readJwtClaims(bad, { nowMs: NOW_MS })).toThrow(
        "The access token is not a JSON web token."
      );
    }
  });

  it("refuses a payload that is not a readable JSON object", () => {
    expect(() => readJwtClaims("header.!!!not base64!!!.sig", { nowMs: NOW_MS })).toThrow(
      "The access token's payload could not be read."
    );
    expect(
      () => readJwtClaims(`header.${encodeUrl(["not", "an", "object"])}.sig`, { nowMs: NOW_MS })
    ).toThrow("The access token's payload could not be read.");
  });

  it("refuses a token that names no subject", () => {
    for (const sub of [undefined, "", 7, null]) {
      expect(() => readJwtClaims(token({ sub, exp: EXP_SECONDS }), { nowMs: NOW_MS })).toThrow(
        "The access token names no subject."
      );
    }
  });

  it("refuses a token minted for a different account", () => {
    expect(() =>
      readJwtClaims(token({ sub: OTHER, exp: EXP_SECONDS }), {
        expectedSubject: SUBJECT,
        nowMs: NOW_MS,
      })
    ).toThrow("The access token was issued for a different account.");
  });

  it("refuses a token with no usable expiry claim", () => {
    for (const exp of [undefined, 0, null, "not-a-number", -1]) {
      expect(() => readJwtClaims(token({ sub: SUBJECT, exp }), { nowMs: NOW_MS })).toThrow(
        "The access token carries no expiry."
      );
    }
  });
});
