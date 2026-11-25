/**
 * Copy text with `navigator.clipboard.writeText` and return a typed result.
 *
 * The returned promise always settles. A missing clipboard, invalid text, or
 * a rejected write becomes `{ ok: false }` instead of an unhandled rejection.
 *
 * @param {unknown} text Text to copy. Must be a non-empty string.
 * @param {{ writeText?: (value: string) => Promise<void> } | null} [clipboard]
 *   Clipboard implementation. Defaults to `navigator.clipboard`.
 * @returns {Promise<{ ok: true, error: null } | { ok: false, error: string, message?: string }>}
 */
export async function copyToClipboardResult(text, clipboard) {
  if (typeof text !== "string") {
    return { ok: false, error: "invalid_text" };
  }

  if (text.length === 0) {
    return { ok: false, error: "empty_text" };
  }

  const target = clipboard === undefined ? globalThis.navigator?.clipboard : clipboard;

  if (!target || typeof target.writeText !== "function") {
    return { ok: false, error: "clipboard_unavailable" };
  }

  try {
    await target.writeText(text);
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: "write_failed",
      message: error instanceof Error ? error.message : "write failed",
    };
  }
}
