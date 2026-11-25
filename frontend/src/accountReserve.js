const STROOPS_PER_XLM = 10_000_000n;

function integerValue(value, label) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return BigInt(text);
}

export function parseXlmToStroops(value, label = "Amount") {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,7})?$/.test(text)) {
    throw new Error(`${label} must be a non-negative number with up to 7 decimals.`);
  }

  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, "0"));
}

export function formatStroops(value) {
  const stroops = BigInt(value);
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = String(stroops % STROOPS_PER_XLM).padStart(7, "0");
  return `${whole}.${fraction}`;
}

export function minimumBalanceInStroops(baseReserveInStroops, subentryCount) {
  const baseReserve = integerValue(baseReserveInStroops, "Base reserve");
  const subentries = integerValue(subentryCount, "Subentry count");
  return baseReserve * (2n + subentries);
}

export function calculateMinimumBalance(baseReserveInStroops, subentryCount) {
  return formatStroops(
    minimumBalanceInStroops(baseReserveInStroops, subentryCount)
  );
}

export function remainsAboveMinimum(
  balance,
  amount,
  feeInStroops,
  minimumInStroops
) {
  return (
    parseXlmToStroops(balance, "Balance") -
      parseXlmToStroops(amount, "Amount") -
      integerValue(feeInStroops, "Fee") >=
    BigInt(minimumInStroops)
  );
}
