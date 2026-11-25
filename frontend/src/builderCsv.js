import { rowsToCsv } from "./csvExport";

/** Columns the builder-registry export always writes, in order. */
export const BUILDER_CSV_COLUMNS = ["address", "name"];

/**
 * Build the CSV for the builder page currently loaded in the Lab.
 *
 * `rowsToCsv` is reused so commas, double quotes and line breaks inside a
 * builder name are escaped exactly like every other CSV the app writes. An
 * empty page still exports the header row, which keeps the download valid.
 *
 * @param {Array<{ address: string, name?: string|null }>} rows
 * @returns {string} CSV text terminated with CRLF.
 */
export function buildersToCsv(rows) {
  return rowsToCsv(Array.isArray(rows) ? rows : [], BUILDER_CSV_COLUMNS);
}
