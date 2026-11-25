import { describe, expect, it } from "vitest";
import { groupPaymentsByDay } from "./stellar";

const pay = (id, created_at) => ({ id, created_at });

describe("groupPaymentsByDay", () => {
  it("groups three payments into two UTC days, newest day first", () => {
    const groups = groupPaymentsByDay([
      pay("a", "2026-05-02T00:30:00Z"),
      pay("b", "2026-05-01T23:59:59Z"),
      pay("c", "2026-05-01T08:00:00Z"),
    ]);

    expect(groups.map((g) => g.day)).toEqual(["2026-05-02", "2026-05-01"]);
    expect(groups.map((g) => g.records.map((r) => r.id))).toEqual([["a"], ["b", "c"]]);
  });

  it("uses UTC, not the offset written in the timestamp", () => {
    const [group] = groupPaymentsByDay([pay("a", "2026-05-02T01:00:00+03:00")]);
    expect(group.day).toBe("2026-05-01");
  });

  it("appends a later page to its existing day", () => {
    const page1 = [pay("a", "2026-05-02T10:00:00Z"), pay("b", "2026-05-01T20:00:00Z")];
    const page2 = [pay("c", "2026-05-01T05:00:00Z"), pay("d", "2026-04-30T05:00:00Z")];
    const groups = groupPaymentsByDay([...page1, ...page2]);

    expect(groups.map((g) => [g.day, g.records.length])).toEqual([
      ["2026-05-02", 1],
      ["2026-05-01", 2],
      ["2026-04-30", 1],
    ]);
  });

  it("puts payments without a closed time in a trailing Unknown group", () => {
    const groups = groupPaymentsByDay([
      pay("a", undefined),
      pay("b", "2026-05-01T08:00:00Z"),
      pay("c", "not a date"),
    ]);

    expect(groups.map((g) => g.day)).toEqual(["2026-05-01", null]);
    expect(groups[1].records.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupPaymentsByDay([])).toEqual([]);
  });
});
