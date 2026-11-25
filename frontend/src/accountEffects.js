/**
 * Account-effect helpers.
 *
 * Horizon's payment stream only carries payments. Trustlines, offers, trades,
 * and account merges arrive on the effects endpoint. These helpers turn an
 * effect record into a one-line label and append streamed effects without
 * adding the same paging token twice. Unknown effect types are left raw.
 *
 * @module accountEffects
 */

/**
 * Asset text for an effect, using the fields Horizon provides.
 *
 * @param {string|undefined} type `asset_type` from the effect.
 * @param {string|undefined} code `asset_code` from the effect.
 * @param {string|undefined} issuer `asset_issuer` from the effect.
 * @returns {string} `"XLM"`, `"CODE:ISSUER"`, or `"unknown asset"`.
 */
function assetText(type, code, issuer) {
  if (!type || type === "native") return "XLM";
  if (code) return issuer ? `${code}:${issuer}` : code;
  return "unknown asset";
}

function amountText(amount, type, code, issuer) {
  return `${amount ?? "—"} ${assetText(type, code, issuer)}`;
}

const LABEL_BUILDERS = {
  trustline_created: (effect) =>
    `Trustline created for ${assetText(
      effect.asset_type,
      effect.asset_code,
      effect.asset_issuer
    )}`,
  trustline_updated: (effect) =>
    `Trustline updated for ${assetText(
      effect.asset_type,
      effect.asset_code,
      effect.asset_issuer
    )}`,
  trustline_removed: (effect) =>
    `Trustline removed for ${assetText(
      effect.asset_type,
      effect.asset_code,
      effect.asset_issuer
    )}`,
  trade: (effect) =>
    `Trade: ${amountText(
      effect.sold_amount,
      effect.sold_asset_type,
      effect.sold_asset_code,
      effect.sold_asset_issuer
    )} → ${amountText(
      effect.bought_amount,
      effect.bought_asset_type,
      effect.bought_asset_code,
      effect.bought_asset_issuer
    )}`,
  offer_created: (effect) =>
    `Offer created: selling ${amountText(
      effect.amount,
      effect.asset_type,
      effect.asset_code,
      effect.asset_issuer
    )}`,
  offer_updated: (effect) =>
    `Offer updated: selling ${amountText(
      effect.amount,
      effect.asset_type,
      effect.asset_code,
      effect.asset_issuer
    )}`,
  offer_removed: (effect) =>
    `Offer removed: was selling ${amountText(
      effect.amount,
      effect.asset_type,
      effect.asset_code,
      effect.asset_issuer
    )}`,
  account_credited: (effect) =>
    `Account credited ${amountText(
      effect.amount,
      effect.asset_type,
      effect.asset_code,
      effect.asset_issuer
    )}`,
  account_debited: (effect) =>
    `Account debited ${amountText(
      effect.amount,
      effect.asset_type,
      effect.asset_code,
      effect.asset_issuer
    )}`,
};

/**
 * Describe an effect for display.
 *
 * @param {object} effect A Horizon effect record.
 * @returns {{type: string, label: string|null}} The raw type plus a one-line
 *   label, or `label: null` for a type we do not have a story for.
 * @throws {TypeError} When the effect is not an object.
 */
export function labelEffect(effect) {
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    throw new TypeError("effect must be an object");
  }

  const type =
    typeof effect.type === "string" && effect.type ? effect.type : "unknown";
  const build = LABEL_BUILDERS[type];

  return { type, label: build ? build(effect) : null };
}

function pagingToken(effect) {
  return effect.paging_token ?? effect.id ?? null;
}

/**
 * Append a streamed effect, skipping a paging token that is already shown.
 *
 * @param {object[]} effects Effects already shown.
 * @param {object} effect The newest effect from the stream.
 * @returns {object[]} A new list, or the same list when the effect is a
 *   duplicate or malformed.
 */
export function appendEffect(effects, effect) {
  if (!Array.isArray(effects)) {
    throw new TypeError("effects must be an array");
  }
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    return effects;
  }

  const token = pagingToken(effect);
  if (token !== null && effects.some((shown) => pagingToken(shown) === token)) {
    return effects;
  }

  return [...effects, effect];
}
