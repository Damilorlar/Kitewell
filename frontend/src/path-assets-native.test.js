import { describe, expect, it } from "vitest";
import { parsePathAssets } from "./stellar";

describe("parsePathAssets native word", () => {
  it.each(["native", "NATIVE"])("parses %s to one native hop", (word) => {
    const path = parsePathAssets(word);
    expect(path).toHaveLength(1);
    expect(path[0].isNative()).toBe(true);
  });
});
