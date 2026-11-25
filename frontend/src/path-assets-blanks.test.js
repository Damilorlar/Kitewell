import { describe, expect, it } from "vitest";
import { parsePathAssets } from "./stellar";

describe("path asset empty segments", () => {
  it("drops empty segments from an otherwise empty path", () => {
    expect(parsePathAssets(",,")).toEqual([]);
  });

  it("drops surrounding empty segments while retaining a native hop", () => {
    const path = parsePathAssets(" , XLM , ");

    expect(path).toHaveLength(1);
    expect(path[0].isNative()).toBe(true);
  });
});
