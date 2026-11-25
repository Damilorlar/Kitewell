import { describe, expect, it } from "vitest";
import { copyToClipboardResult } from "./copyToClipboardResult";

describe("copyToClipboardResult settled rejection", () => {
  it("does not reject the returned promise", async () => {
    await expect(
      copyToClipboardResult("hello", {
        writeText: async () => {
          throw new Error("blocked");
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: "write_failed" });
  });
});
