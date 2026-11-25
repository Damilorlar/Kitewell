import { describe, expect, it, vi } from "vitest";
import { openPaymentsStream } from "./paymentStream";

const URL = "https://horizon-testnet.stellar.org/accounts/GBTEST/payments?limit=50&cursor=now";

function fakeSource() {
  const listeners = new Map();
  return {
    closed: 0,
    listeners,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    close() {
      this.closed += 1;
    },
    emit(type, event) {
      listeners.get(type)?.(event);
    },
  };
}

function transport() {
  const sources = [];
  const createEventSource = vi.fn((url) => {
    const source = fakeSource();
    source.url = url;
    sources.push(source);
    return source;
  });
  return { createEventSource, sources };
}

describe("openPaymentsStream", () => {
  it("opens one event source on the given URL", () => {
    const { createEventSource, sources } = transport();
    openPaymentsStream({ url: URL, createEventSource });
    expect(createEventSource).toHaveBeenCalledWith(URL);
    expect(sources).toHaveLength(1);
  });

  it("hands over the parsed JSON of each message", () => {
    const { createEventSource, sources } = transport();
    const onRecord = vi.fn();
    openPaymentsStream({ url: URL, createEventSource, onRecord });

    sources[0].emit("message", { data: '{"type":"payment","id":"1-1"}' });
    sources[0].emit("message", { data: '{"type":"payment","id":"1-2"}' });

    expect(onRecord.mock.calls.map(([payload]) => payload.id)).toEqual(["1-1", "1-2"]);
  });

  it("reports an unreadable record instead of throwing it at the caller", () => {
    const { createEventSource, sources } = transport();
    const onError = vi.fn();
    const onRecord = vi.fn();
    openPaymentsStream({ url: URL, createEventSource, onRecord, onError });

    sources[0].emit("message", { data: "{not json" });

    expect(onRecord).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      new Error("The payments stream sent an unreadable record.")
    );
  });

  it("forwards a transport error", () => {
    const { createEventSource, sources } = transport();
    const onError = vi.fn();
    openPaymentsStream({ url: URL, createEventSource, onError });

    const failure = new Error("Horizon closed the stream after 30s");
    sources[0].emit("error", { error: failure });
    expect(onError).toHaveBeenCalledWith(failure);

    sources[0].emit("error", { message: "network\ninterrupted" });
    expect(onError).toHaveBeenLastCalledWith(new Error("network interrupted"));

    sources[0].emit("error", {});
    expect(onError).toHaveBeenLastCalledWith(new Error("The payments stream failed."));
  });

  it("closes the source once and reports that it did", () => {
    const { createEventSource, sources } = transport();
    const onClose = vi.fn();
    const handle = openPaymentsStream({ url: URL, createEventSource, onClose });

    expect(handle.close()).toBe(true);
    expect(sources[0].closed).toBe(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    expect(handle.close()).toBe(false);
    expect(sources[0].closed).toBe(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("refuses a transport that is not an event source", () => {
    for (const broken of [null, undefined, {}, { addEventListener: "nope" }]) {
      expect(() =>
        openPaymentsStream({ url: URL, createEventSource: () => broken })
      ).toThrow("The payments stream transport is not usable.");
    }
  });

  it("refuses to invent a browser EventSource where there is none", () => {
    vi.stubGlobal("EventSource", undefined);
    try {
      expect(() => openPaymentsStream({ url: URL })).toThrow(
        "This session cannot open an event stream."
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("needs a URL before it will open anything", () => {
    const createEventSource = vi.fn();
    for (const url of ["", undefined, null, 42]) {
      expect(() => openPaymentsStream({ url, createEventSource })).toThrow(
        "There is no payments stream URL to open."
      );
    }
    expect(createEventSource).not.toHaveBeenCalled();
  });
});
