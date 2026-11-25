import { describe, expect, it } from "vitest";
import { escapeCsvField } from "./csvExport";

describe("CSV escaping - embedded newlines", () => {
  it("quotes a field containing a line feed", () => {
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("quotes a field containing a carriage return", () => {
    expect(escapeCsvField("line one\rline two")).toBe('"line one\rline two"');
  });
});
