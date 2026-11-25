import { describe, expect, it } from "vitest";
import { copyToClipboardResult } from "./copyToClipboardResult";

describe("copyToClipboardResult write failure", () => {
  it("returns a failure when writeText rejects", async () => {
    const result = await copyToClipboardResult("hello", {
      writeText: async () => {
        throw new Error("denied");
      },
    });

    expect(result).toEqual({ ok: false, error: "write_failed", message: "denied" });
  });
});
