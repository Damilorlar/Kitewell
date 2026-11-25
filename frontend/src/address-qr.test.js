import { describe, expect, it } from "vitest";
import { generateAddressQrCode } from "./addressQr";

describe("generateAddressQrCode", () => {
  it("returns a data URL for an address", async () => {
    const url = await generateAddressQrCode("GABC123");
    expect(typeof url).toBe("string");
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it("returns null when no address is provided", async () => {
    expect(await generateAddressQrCode(null)).toBeNull();
    expect(await generateAddressQrCode("")).toBeNull();
    expect(await generateAddressQrCode(undefined)).toBeNull();
  });
});
