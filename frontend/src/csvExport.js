/**
 * Escape a single CSV field per RFC 4126 §2.6: wrap the value in double
 * quotes whenever it contains a comma, a double quote, or a line break,
 * doubling any internal double quotes. `null`/`undefined` become `""`.
 * Non-string values are stringified first.
 *
 * @param {*} value
 * @returns {string}
 */
export function escapeCsvField(value) {
  if (value === null || value === undefined) return "";

  const text = String(value);
  const needsQuoting = /[",\r\n]/.test(text);
  if (!needsQuoting) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string (with a header row) from an array of row objects.
 *
 * @param {Array<Object>} rows
 * @param {string[]} [columns] ordered column keys. Defaults to the keys of
 *   the first row, in their own iteration order, when omitted.
 * @returns {string} CRLF-terminated CSV, or `""` when there are no columns
 *   to export (empty `rows` and no explicit `columns`).
 */
export function rowsToCsv(rows, columns) {
  const list = Array.isArray(rows) ? rows : [];
  const keys = columns && columns.length > 0 ? columns : Object.keys(list[0] ?? {});

  if (keys.length === 0) return "";

  const lines = [keys.map(escapeCsvField)];
  for (const row of list) {
    lines.push(keys.map((key) => escapeCsvField(row ? row[key] : undefined)));
  }

  return lines.map((line) => line.join(",")).join("\r\n") + "\r\n";
}

/** Download CSV text as a file. Browser-only: the file is built from a Blob and never uploaded. */
export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
