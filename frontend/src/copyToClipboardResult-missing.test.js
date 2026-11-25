import { describe, expect, it } from "vitest";
import { copyToClipboardResult } from "./copyToClipboardResult";

describe("copyToClipboardResult missing clipboard", () => {
  it("returns a failure when writeText is absent", async () => {
    const result = await copyToClipboardResult("hello", null);
    expect(result).toEqual({ ok: false, error: "clipboard_unavailable" });
  });
});
