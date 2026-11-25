import { describe, expect, it } from "vitest";
import { copyToClipboardResult } from "./copyToClipboardResult";

describe("copyToClipboardResult long text", () => {
  it("passes a long string through to writeText", async () => {
    const text = "a".repeat(10_000);
    let length = 0;
    const result = await copyToClipboardResult(text, {
      writeText: async (value) => {
        length = value.length;
      },
    });

    expect(result.ok).toBe(true);
    expect(length).toBe(10_000);
  });
});
