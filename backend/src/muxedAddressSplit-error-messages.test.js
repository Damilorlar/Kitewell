import test from "node:test";
import assert from "node:assert/strict";

import { splitMuxedAddress, buildMuxedAddress } from "./muxedAddressSplit.js";

const G = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// Verifies that thrown errors carry enough context to be actionable.

test("splitMuxedAddress TypeError message names the received type", () => {
  try {
    splitMuxedAddress(42);
    assert.fail("expected to throw");
  } catch (err) {
    assert.ok(err instanceof TypeError, "expected TypeError");
    assert.ok(
      err.message.includes("number"),
      `expected error to mention 'number', got: "${err.message}"`,
    );
  }
});

test("splitMuxedAddress Error message quotes the invalid address", () => {
  const bad = "NOTANADDRESS";
  try {
    splitMuxedAddress(bad);
    assert.fail("expected to throw");
  } catch (err) {
    assert.ok(err instanceof Error, "expected Error");
    assert.ok(
      err.message.includes(bad),
      `expected error to include the address, got: "${err.message}"`,
    );
  }
});

test("buildMuxedAddress TypeError message names the received type for gAddress", () => {
  try {
    buildMuxedAddress(99, 1n);
    assert.fail("expected to throw");
  } catch (err) {
    assert.ok(err instanceof TypeError, "expected TypeError");
    assert.ok(
      err.message.includes("number"),
      `expected error to mention 'number', got: "${err.message}"`,
    );
  }
});

test("buildMuxedAddress TypeError message quotes a non-decimal string id", () => {
  const bad = "0x2a";
  try {
    buildMuxedAddress(G, bad);
    assert.fail("expected to throw");
  } catch (err) {
    assert.ok(err instanceof TypeError, "expected TypeError");
    assert.ok(
      err.message.includes(bad),
      `expected error to include the bad value, got: "${err.message}"`,
    );
  }
});

test("buildMuxedAddress Error message mentions the invalid G address", () => {
  const bad = "NOTVALID";
  try {
    buildMuxedAddress(bad, 1n);
    assert.fail("expected to throw");
  } catch (err) {
    assert.ok(err instanceof Error, "expected Error");
    assert.ok(
      err.message.includes(bad),
      `expected error to include the address, got: "${err.message}"`,
    );
  }
});
