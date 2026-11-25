import { describe, expect, it } from "vitest";
import { copyToClipboardResult } from "./copyToClipboardResult";

describe("copyToClipboardResult empty text", () => {
  it("rejects an empty string without calling the clipboard", async () => {
    const result = await copyToClipboardResult("", { writeText: async () => { throw new Error("called"); } });
    expect(result).toEqual({ ok: false, error: "empty_text" });
  });
});
