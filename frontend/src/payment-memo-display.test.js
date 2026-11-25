import { describe, expect, it } from "vitest";
import { mapPaymentMemo } from "./paymentMemo";

describe("mapPaymentMemo", () => {
  it("labels text memo content as text, even when it is numeric", () => {
    const memo = "123456";
    expect(
      mapPaymentMemo({
        memo_type: "text",
        memo,
        memo_bytes: Buffer.from(memo, "utf8").toString("base64"),
      })
    ).toEqual({ label: "Text memo", value: memo });
  });

  it("shows an id memo as a number", () => {
    expect(mapPaymentMemo({ memo_type: "id", memo: "123456" })).toEqual({
      label: "ID memo",
      value: "123456",
    });
  });

  it("shows all 32 bytes of a hash memo as hex", () => {
    const hash = "ab".repeat(32);
    expect(
      mapPaymentMemo({
        memo_type: "hash",
        memo: hash,
        memo_bytes: Buffer.from(hash, "hex").toString("base64"),
      })
    ).toEqual({ label: "Hash memo", value: hash });
  });

  it("shows unreadable text memo bytes as hex with an explicit label", () => {
    const bytes = Buffer.from([0xff, 0xfe]);
    expect(
      mapPaymentMemo({
        memo_type: "text",
        memo: "�",
        memo_bytes: bytes.toString("base64"),
      })
    ).toEqual({
      label: "Text memo (unreadable UTF-8; hex)",
      value: "fffe",
    });
  });

  it("says when a payment has no memo", () => {
    expect(mapPaymentMemo({ memo_type: "none" })).toEqual({
      label: "Memo",
      value: "None",
    });
    expect(mapPaymentMemo({})).toEqual({ label: "Memo", value: "None" });
  });
});
