import { describe, expect, it } from "vitest";
import { copyToClipboardResult } from "./copyToClipboardResult";

describe("copyToClipboardResult invalid text", () => {
  it("rejects a non-string", async () => {
    const result = await copyToClipboardResult(null, { writeText: async () => {} });
    expect(result).toEqual({ ok: false, error: "invalid_text" });
  });
});
