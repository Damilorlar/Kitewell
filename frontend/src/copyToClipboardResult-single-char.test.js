import { describe, expect, it } from "vitest";
import { copyToClipboardResult } from "./copyToClipboardResult";

describe("copyToClipboardResult single character", () => {
  it("copies a one-character string", async () => {
    let written = "";
    const result = await copyToClipboardResult("x", {
      writeText: async (value) => {
        written = value;
      },
    });

    expect(result.ok).toBe(true);
    expect(written).toBe("x");
  });
});
