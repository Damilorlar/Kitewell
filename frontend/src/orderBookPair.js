import { buildAsset } from "./stellar";

export const ORDER_BOOK_PAIR_STORAGE_KEY = "kitewell.orderBookPair";

/** Parse one book field into an SDK asset. Empty or malformed fields are invalid. */
export function parseOrderBookAsset(value) {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (input.toUpperCase() === "XLM") return buildAsset({ isNative: true });

  const parts = input.split(":");
  if (parts.length !== 2) return null;
  try {
    return buildAsset({ isNative: false, code: parts[0], issuer: parts[1] });
  } catch {
    return null;
  }
}

export function formatOrderBookAsset(asset) {
  return asset.isNative() ? "XLM" : `${asset.getCode()}:${asset.getIssuer()}`;
}

/** A book needs two valid, distinct assets before it can be requested. */
export function parseOrderBookPair(pair) {
  const selling = parseOrderBookAsset(pair?.selling);
  const buying = parseOrderBookAsset(pair?.buying);
  if (!selling || !buying || formatOrderBookAsset(selling) === formatOrderBookAsset(buying)) {
    return null;
  }
  return { selling, buying };
}

export function readStoredOrderBookPair() {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(ORDER_BOOK_PAIR_STORAGE_KEY) || "null");
    const selling = parseOrderBookAsset(stored?.selling);
    const buying = parseOrderBookAsset(stored?.buying);
    return {
      selling: selling ? formatOrderBookAsset(selling) : "",
      buying: buying ? formatOrderBookAsset(buying) : "",
    };
  } catch {
    return { selling: "", buying: "" };
  }
}

export function saveOrderBookPair(pair) {
  const parsed = parseOrderBookPair(pair);
  if (!parsed) return;
  try {
    globalThis.localStorage?.setItem(ORDER_BOOK_PAIR_STORAGE_KEY, JSON.stringify({
      selling: formatOrderBookAsset(parsed.selling),
      buying: formatOrderBookAsset(parsed.buying),
    }));
  } catch {
    // Browsers may deny local storage; the live book still works.
  }
}

export function clearStoredOrderBookPair() {
  try {
    globalThis.localStorage?.removeItem(ORDER_BOOK_PAIR_STORAGE_KEY);
  } catch {
    // The visible fields can still be cleared.
  }
}
