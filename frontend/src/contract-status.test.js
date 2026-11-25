import { describe, expect, it } from "vitest";
import {
  CONTRACT_STATUS,
  canCallContract,
  contractStatusLabel,
  resolveContractStatus,
  rpcCallBlockReason,
} from "./contractStatus";

const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

describe("resolveContractStatus", () => {
  it("reports a readable instance as live", () => {
    expect(
      resolveContractStatus({ contractId: CONTRACT_ID, state: { labName: "kitewell" } })
    ).toBe(CONTRACT_STATUS.LIVE);
  });

  it("reports an archived instance as archived", () => {
    expect(
      resolveContractStatus({ contractId: CONTRACT_ID, state: { archived: true } })
    ).toBe(CONTRACT_STATUS.ARCHIVED);
  });

  it("reports unknown when the RPC did not respond", () => {
    expect(
      resolveContractStatus({
        contractId: CONTRACT_ID,
        error: "Soroban RPC unreachable",
      })
    ).toBe(CONTRACT_STATUS.UNKNOWN);
    expect(
      resolveContractStatus({ contractId: CONTRACT_ID, rpcReachable: false })
    ).toBe(CONTRACT_STATUS.UNKNOWN);
  });

  it("keeps the missing-contract state when no contract id is configured", () => {
    expect(resolveContractStatus({ contractId: undefined })).toBe(
      CONTRACT_STATUS.MISSING
    );
  });
});

describe("contract status presentation", () => {
  it("labels live and archived instances", () => {
    expect(contractStatusLabel(CONTRACT_STATUS.LIVE)).toBe("Live");
    expect(contractStatusLabel(CONTRACT_STATUS.ARCHIVED)).toBe("Archived");
    expect(contractStatusLabel(CONTRACT_STATUS.UNKNOWN)).toMatch(/Unknown/);
  });

  it("allows RPC calls only for a live instance", () => {
    expect(canCallContract(CONTRACT_STATUS.LIVE)).toBe(true);
    expect(canCallContract(CONTRACT_STATUS.ARCHIVED)).toBe(false);
    expect(canCallContract(CONTRACT_STATUS.UNKNOWN)).toBe(false);
    expect(canCallContract(CONTRACT_STATUS.MISSING)).toBe(false);
  });

  it("explains why an archived instance cannot be called", () => {
    expect(rpcCallBlockReason(CONTRACT_STATUS.LIVE)).toBeNull();
    expect(rpcCallBlockReason(CONTRACT_STATUS.ARCHIVED)).toMatch(/restore it/);
  });

  it("disables calls with an explanation when the status is unknown", () => {
    expect(rpcCallBlockReason(CONTRACT_STATUS.UNKNOWN)).toMatch(/did not respond/);
    expect(canCallContract(CONTRACT_STATUS.UNKNOWN)).toBe(false);
  });
});
