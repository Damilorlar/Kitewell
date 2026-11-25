// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getLatestLedgerMock } = vi.hoisted(() => ({
  getLatestLedgerMock: vi.fn(),
}));

vi.mock("./stellar", () => ({
  getLatestLedger: getLatestLedgerMock,
}));

const { default: LatestLedgerHeader } = await import("./LatestLedgerHeader");

const TEST_LEDGER = {
  sequence: 123456,
  closedAt: "2026-11-20T15:00:00.000Z",
  baseFeeInStroops: "100",
  baseReserveInStroops: "5000000",
};

let container;
let root;
let visibilityDescriptor;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  visibilityDescriptor = Object.getOwnPropertyDescriptor(
    document,
    "visibilityState"
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.clearAllMocks();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  if (visibilityDescriptor) {
    Object.defineProperty(document, "visibilityState", visibilityDescriptor);
  } else {
    delete document.visibilityState;
  }
});

describe("LatestLedgerHeader", () => {
  it("renders a ledger and retains its values when a refresh fails", async () => {
    vi.useFakeTimers();
    getLatestLedgerMock
      .mockResolvedValueOnce(TEST_LEDGER)
      .mockRejectedValueOnce(new Error("Horizon unavailable"));

    await act(async () => {
      root.render(createElement(LatestLedgerHeader, { networkId: "TESTNET" }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("#123456");
    expect(container.textContent).toContain("2026-11-20 15:00:00.000 UTC");
    expect(container.textContent).toContain("0.0000100 XLM · 100 stroops");
    expect(container.textContent).toContain(
      "0.5000000 XLM · 5,000,000 stroops"
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(container.textContent).toContain("#123456");
    expect(container.textContent).toContain("0.5000000 XLM · 5,000,000 stroops");
    expect(container.textContent).toContain("Could not load the latest ledger.");
    expect(container.textContent).toContain(
      "Showing last successfully loaded values."
    );
  });

  it("queries the selected network and pauses polling while hidden", async () => {
    vi.useFakeTimers();
    getLatestLedgerMock.mockResolvedValue(TEST_LEDGER);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    await act(async () => {
      root.render(createElement(LatestLedgerHeader, { networkId: "TESTNET" }));
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getLatestLedgerMock).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(getLatestLedgerMock).toHaveBeenCalledWith("TESTNET");

    await act(async () => {
      root.render(createElement(LatestLedgerHeader, { networkId: "FUTURENET" }));
      await Promise.resolve();
    });
    expect(getLatestLedgerMock).toHaveBeenLastCalledWith("FUTURENET");

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getLatestLedgerMock).toHaveBeenCalledTimes(2);
  });
});
