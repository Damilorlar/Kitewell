import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CONTRACT_ERROR_MESSAGES,
  KITEWELL_CONTRACT_SPEC,
  SOROBAN_RPC_URL,
  ZERO_ADDRESS,
  createKitewellClient,
  describeContractError,
} from "./kitewellClient";

/**
 * Issue #523: the generated client must stay in step with the contract.
 *
 * These tests read the Rust source and fail when the contract gains, drops,
 * renames, or re-shapes a method the client (or the Lab tab) relies on.
 */

const CONTRACT_PATH = fileURLToPath(
  new URL("../../contracts/kitewell/src/lib.rs", import.meta.url)
);
const CONTRACT_ID =
  "CCWLNS5HECRJ2GM3Q6JZZDV334ZXYO6EKZLFPLQRXO6SUDAKMS4U3E3X";

/** Parse `pub fn name(args)` signatures out of the contract source. */
function contractMethods() {
  const source = readFileSync(CONTRACT_PATH, "utf8");
  const methods = new Map();
  const pattern = /pub fn (\w+)\(([\s\S]*?)\)\s*(?:->|\{)/g;

  for (const match of source.matchAll(pattern)) {
    const [, name, rawArgs] = match;
    const args = rawArgs
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      // The first argument is the Soroban `Env`; callers never pass it.
      .filter((part) => !/^env:\s*Env$/.test(part));

    methods.set(name, args.length);
  }

  return methods;
}

describe("generated Kitewell client", () => {
  it("declares every method the client uses in the contract spec", () => {
    const contract = contractMethods();

    for (const [name, spec] of Object.entries(KITEWELL_CONTRACT_SPEC.methods)) {
      expect(contract.has(name), `contract is missing ${name}`).toBe(true);
      expect(
        contract.get(name),
        `${name} arity changed in contracts/kitewell/src/lib.rs`
      ).toBe(spec.args.length);
    }
  });

  it("covers the Lab tab's reads and writes", () => {
    const methods = KITEWELL_CONTRACT_SPEC.methods;

    for (const read of ["lab_name", "builder_count", "get_builder", "paused", "get_admin"]) {
      expect(methods[read]).toMatchObject({ read: true });
    }
    for (const write of ["register", "unregister", "set_paused"]) {
      expect(methods[write]).toMatchObject({ read: false });
    }
  });

  it("keeps the contract error messages aligned with the Error enum", () => {
    const source = readFileSync(CONTRACT_PATH, "utf8");
    const enumBody = source.match(/pub enum Error \{([\s\S]*?)\}/)?.[1] || "";
    const variants = [...enumBody.matchAll(/(\w+)\s*=\s*(\d+)/g)];

    expect(variants.length).toBeGreaterThan(0);
    expect(Object.keys(CONTRACT_ERROR_MESSAGES)).toHaveLength(variants.length);
  });

  it("builds the client from the spec and exposes each method", () => {
    const client = createKitewellClient({ contractId: CONTRACT_ID });

    expect(client.contractId).toBe(CONTRACT_ID);
    expect(SOROBAN_RPC_URL).toBe("https://soroban-testnet.stellar.org");
    expect(ZERO_ADDRESS).toMatch(/^G/);
    for (const method of ["labName", "builderCount", "getBuilder", "paused", "getAdmin"]) {
      expect(typeof client[method]).toBe("function");
    }
    for (const method of ["register", "unregister", "setPaused", "readState"]) {
      expect(typeof client[method]).toBe("function");
    }
  });

  it("rejects a non-contract id before any RPC call", () => {
    expect(() => createKitewellClient({ contractId: "GAAAAWTF" })).toThrow(
      "valid Soroban contract"
    );
  });
});

describe("describeContractError", () => {
  it("maps every known contract error code to plain language", () => {
    for (const code of Object.keys(CONTRACT_ERROR_MESSAGES)) {
      expect(describeContractError(new Error(`HostError: Error(Contract, #${code})`))).toBe(
        CONTRACT_ERROR_MESSAGES[code]
      );
    }
  });

  it("keeps an unknown host error message instead of hiding it", () => {
    expect(describeContractError(new Error("network down"))).toBe("network down");
  });
});
