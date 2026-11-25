import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { webAuthPresentation } from "./sep10WebAuth";

const SERVER = StellarSdk.Keypair.random().publicKey();
const CLIENT = StellarSdk.Keypair.random().publicKey();
const EXPIRES_AT_MS = 4_000_000_000_000;

function challenge(overrides = {}) {
  return {
    serverAccount: SERVER,
    clientAccount: CLIENT,
    operationName: "auth",
    webAuthDomain: "anchor.example.com",
    operationCount: 2,
    expiresAtMs: EXPIRES_AT_MS,
    validFromMs: null,
    ...overrides,
  };
}

function session(overrides = {}) {
  return {
    subject: CLIENT,
    expiresAtMs: 4_500_000_000_000,
    issuedAtMs: 1_600_000_000_000,
    expired: false,
    ...overrides,
  };
}

describe("webAuthPresentation", () => {
  it("names the server, the operation and both expiries", () => {
    const lines = webAuthPresentation(challenge(), session());

    expect(lines).toEqual([
      `Challenge from ${SERVER}, operation auth.`,
      `Valid until ${new Date(EXPIRES_AT_MS).toISOString()}.`,
      `Session subject ${CLIENT}, expires ${new Date(4_500_000_000_000).toISOString()}.`,
      "The session token is current.",
    ]);
  });

  it("says so when the session token has already expired", () => {
    const lines = webAuthPresentation(challenge(), session({ expired: true }));
    expect(lines[3]).toBe("The session token has already expired.");
  });

  it("keeps every line a plain string", () => {
    for (const line of webAuthPresentation(challenge(), session())) {
      expect(typeof line).toBe("string");
    }
  });

  it("shows the default web_auth_domain reading even when it is absent", () => {
    const lines = webAuthPresentation(challenge({ webAuthDomain: null }), session());
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(`Challenge from ${SERVER}, operation auth.`);
  });
});
