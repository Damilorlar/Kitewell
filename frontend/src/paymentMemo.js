import { Buffer } from "buffer";

function bytesFromBase64(value) {
  if (typeof value !== "string") return null;
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function mapPaymentMemo(transaction) {
  const record =
    transaction && typeof transaction === "object" ? transaction : {};
  const type = record.memo_type ?? "none";
  const bytes = bytesFromBase64(record.memo_bytes);

  if (type === "none") {
    return { label: "Memo", value: "None" };
  }

  if (type === "text") {
    if (bytes) {
      try {
        return {
          label: "Text memo",
          value: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        };
      } catch {
        return {
          label: "Text memo (unreadable UTF-8; hex)",
          value: toHex(bytes),
        };
      }
    }

    return {
      label: "Text memo",
      value: typeof record.memo === "string" ? record.memo : "",
    };
  }

  if (type === "id") {
    let value = typeof record.memo === "string" ? record.memo : null;
    if (value === null && bytes?.length === 8) {
      value = BigInt(`0x${toHex(bytes)}`).toString();
    }
    return { label: "ID memo", value: value ?? "Unavailable" };
  }

  if (type === "hash" || type === "return") {
    const value = bytes ? toHex(bytes) : String(record.memo ?? "Unavailable");
    return {
      label: type === "hash" ? "Hash memo" : "Return memo",
      value,
    };
  }

  return {
    label: `Unknown memo type (${String(type)})`,
    value: String(record.memo ?? "Unavailable"),
  };
}

export function paymentMemoFields(transaction) {
  if (
    !transaction ||
    typeof transaction !== "object" ||
    typeof transaction.memo_type !== "string"
  ) {
    return {};
  }

  return {
    memo_type: transaction.memo_type,
    memo: transaction.memo ?? null,
    memo_bytes: transaction.memo_bytes ?? null,
  };
}
