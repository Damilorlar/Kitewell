import { describe, expect, it } from "vitest";
import { copyToClipboardResult } from "./copyToClipboardResult";

describe("copyToClipboardResult success", () => {
  it("returns ok after writeText resolves", async () => {
    const written = [];
    const result = await copyToClipboardResult("hello", {
      writeText: async (value) => {
        written.push(value);
      },
    });

    expect(result).toEqual({ ok: true, error: null });
    expect(written).toEqual(["hello"]);
  });
});
