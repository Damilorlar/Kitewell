import { afterEach, describe, expect, it, vi } from "vitest";
import { setActiveNetwork } from "./network";
import { fundWithFriendbot } from "./stellar";

afterEach(() => {
  setActiveNetwork("TESTNET");
  vi.unstubAllGlobals();
});

describe("fundWithFriendbot on Futurenet", () => {
  it("rejects before fetch when no Friendbot URL exists", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setActiveNetwork("FUTURENET");

    await expect(fundWithFriendbot("GTEST")).rejects.toThrow(
      "Friendbot is only available on Testnet, not Futurenet."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
