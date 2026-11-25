import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CI-friendly tests for the Lab event tail. `getEvents` is mocked; the real SDK
 * builds ScVals so the parser is exercised on real RPC-shaped events.
 */

const { sorobanServerMock } = vi.hoisted(() => ({
  sorobanServerMock: {
    getEvents: vi.fn(),
    getLatestLedger: vi.fn(),
  },
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn(function () {
        return sorobanServerMock;
      }),
    },
  };
});

const StellarSdk = await import("@stellar/stellar-sdk");
const { mapKitewellEvents, readKitewellEvents } = await import("./freighter");

const CONTRACT_ID =
  "CCWLNS5HECRJ2GM3Q6JZZDV334ZXYO6EKZLFPLQRXO6SUDAKMS4U3E3X";
const OTHER_CONTRACT_ID =
  "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";
const CALLER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function registerEvent(contractId, id, caller, name, isNew) {
  return {
    id,
    ledger: 1234,
    contractId: new StellarSdk.Contract(contractId),
    topic: [
      StellarSdk.xdr.ScVal.scvSymbol("register"),
      StellarSdk.nativeToScVal(caller, { type: "address" }),
    ],
    value: StellarSdk.xdr.ScVal.scvVec([
      StellarSdk.nativeToScVal(name, { type: "string" }),
      StellarSdk.xdr.ScVal.scvBool(isNew),
    ]),
  };
}

function pausedEvent(contractId, id, paused) {
  return {
    id,
    ledger: 1235,
    contractId: new StellarSdk.Contract(contractId),
    topic: [StellarSdk.xdr.ScVal.scvSymbol("paused")],
    value: StellarSdk.xdr.ScVal.scvBool(paused),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mapKitewellEvents", () => {
  it("renders two fixture events and ignores a third contract", () => {
    const mapped = mapKitewellEvents(
      [
        registerEvent(CONTRACT_ID, "evt-register", CALLER, "alice", true),
        pausedEvent(CONTRACT_ID, "evt-paused", true),
        registerEvent(OTHER_CONTRACT_ID, "evt-other", CALLER, "mallory", true),
      ],
      CONTRACT_ID
    );

    expect(mapped).toHaveLength(2);
    expect(mapped.find((event) => event.type === "register")).toMatchObject({
      id: "evt-register",
      type: "register",
      functionName: "register",
      caller: CALLER,
      name: "alice",
      isNew: true,
      ledger: 1234,
    });
    expect(mapped.find((event) => event.type === "paused")).toMatchObject({
      id: "evt-paused",
      type: "paused",
      functionName: "set_paused",
      paused: true,
      ledger: 1235,
    });
    expect(mapped.some((event) => event.id === "evt-other")).toBe(false);
  });

  it("keeps unknown events with their raw topics and ledger", () => {
    const mapped = mapKitewellEvents(
      [
        {
          id: "evt-unknown",
          ledger: 1236,
          contractId: CONTRACT_ID,
          topic: [
            StellarSdk.xdr.ScVal.scvSymbol("unregister"),
            StellarSdk.xdr.ScVal.scvSymbol("not_an_address"),
          ],
          value: StellarSdk.xdr.ScVal.scvBool(true),
        },
      ],
      CONTRACT_ID
    );
    expect(mapped).toEqual([{
      id: "evt-unknown",
      ledger: 1236,
      type: "unknown",
      functionName: null,
      topics: ["unregister", "not_an_address"],
    }]);
  });

  it("does not treat a non-address register topic as a builder address", () => {
    const event = registerEvent(CONTRACT_ID, "evt-malformed", CALLER, "alice", true);
    event.topic[1] = StellarSdk.nativeToScVal(CALLER, { type: "string" });

    expect(mapKitewellEvents([event], CONTRACT_ID)).toEqual([{
      id: "evt-malformed",
      ledger: 1234,
      type: "unknown",
      functionName: null,
      topics: ["register", CALLER],
    }]);
  });

  it("decodes the new state when the contract is unpaused", () => {
    expect(mapKitewellEvents([pausedEvent(CONTRACT_ID, "evt-unpaused", false)], CONTRACT_ID))
      .toMatchObject([{ type: "paused", functionName: "set_paused", paused: false, ledger: 1235 }]);
  });
});

describe("readKitewellEvents", () => {
  it("starts the tail at the opening ledger and filters by contract id", async () => {
    sorobanServerMock.getLatestLedger.mockResolvedValue({ sequence: 1300 });
    sorobanServerMock.getEvents.mockResolvedValue({
      latestLedger: 1300,
      cursor: "cursor-1235",
      events: [
        registerEvent(CONTRACT_ID, "evt-register", CALLER, "alice", false),
        registerEvent(OTHER_CONTRACT_ID, "evt-other", CALLER, "bob", true),
      ],
    });

    const result = await readKitewellEvents(CONTRACT_ID, { startLedger: 1230 });

    expect(result.latestLedger).toBe(1300);
    expect(result.cursor).toBe("cursor-1235");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      id: "evt-register",
      caller: CALLER,
      name: "alice",
      isNew: false,
    });

    const request = sorobanServerMock.getEvents.mock.calls[0][0];
    expect(request.startLedger).toBe(1230);
    expect(request.cursor).toBeUndefined();
    expect(request.filters).toEqual([
      { type: "contract", contractIds: [CONTRACT_ID] },
    ]);
  });

  it("uses the cursor on subsequent polls", async () => {
    sorobanServerMock.getEvents.mockResolvedValue({
      latestLedger: 1400,
      events: [],
    });

    await readKitewellEvents(CONTRACT_ID, { cursor: "cursor-1235" });

    const request = sorobanServerMock.getEvents.mock.calls[0][0];
    expect(request.cursor).toBe("cursor-1235");
    expect(request.startLedger).toBeUndefined();
  });

  it("refuses a start ledger in the future", async () => {
    sorobanServerMock.getLatestLedger.mockResolvedValue({ sequence: 1500 });

    await expect(
      readKitewellEvents(CONTRACT_ID, { startLedger: 1501 })
    ).rejects.toThrow(/ahead of the latest ledger/);
    expect(sorobanServerMock.getEvents).not.toHaveBeenCalled();
  });

  it("replays at most 200 events in one read", async () => {
    await expect(
      readKitewellEvents(CONTRACT_ID, { startLedger: 1230, limit: 201 })
    ).rejects.toThrow(/between 1 and 200/);
    expect(sorobanServerMock.getEvents).not.toHaveBeenCalled();

    sorobanServerMock.getLatestLedger.mockResolvedValue({ sequence: 1300 });
    sorobanServerMock.getEvents.mockResolvedValue({
      latestLedger: 1300,
      events: [],
    });

    await readKitewellEvents(CONTRACT_ID, { startLedger: 1230, limit: 200 });

    expect(sorobanServerMock.getEvents.mock.calls[0][0].limit).toBe(200);
    expect(sorobanServerMock.getEvents.mock.calls[0][0].startLedger).toBe(1230);
  });

  it("starts at the latest ledger when no cursor is available", async () => {
    sorobanServerMock.getLatestLedger.mockResolvedValue({ sequence: 1500 });
    sorobanServerMock.getEvents.mockResolvedValue({
      latestLedger: 1500,
      events: [],
    });

    await readKitewellEvents(CONTRACT_ID);

    expect(sorobanServerMock.getLatestLedger).toHaveBeenCalledTimes(1);
    const request = sorobanServerMock.getEvents.mock.calls[0][0];
    expect(request.startLedger).toBe(1500);
    expect(request.cursor).toBeUndefined();
  });
});
