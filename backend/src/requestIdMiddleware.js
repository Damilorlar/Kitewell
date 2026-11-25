/**
 * Request id middleware.
 *
 * Express middleware that gives every incoming request a correlation id:
 *
 * - reuses a valid inbound `X-Request-Id` header, otherwise generates one;
 * - exposes it as `req.id`, `req.requestId`, and `res.locals.requestId`;
 * - echoes it back in the `X-Request-Id` response header;
 * - writes one structured JSON log line when the response finishes, including
 *   the request id alongside method, path, status, and duration.
 *
 * This module is standalone: it is not wired into `app.js`, `index.js`, or any
 * route yet, and it has no Express import — the middleware only uses the
 * `req`/`res` contract, which keeps it testable with plain objects.
 */

import { randomUUID } from "node:crypto";

/** Default request/response header carrying the correlation id. */
export const REQUEST_ID_HEADER = "X-Request-Id";

/** Longest accepted inbound request id. */
export const MAX_REQUEST_ID_LENGTH = 128;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Whether a value is safe to reuse as a request id.
 *
 * Accepted ids are 1–128 characters from `[A-Za-z0-9._-]`, which covers UUIDs
 * and the common tracing id formats while rejecting whitespace, arrays, and
 * header-injection attempts.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidRequestId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH &&
    REQUEST_ID_PATTERN.test(value)
  );
}

/** Read the inbound header from Node's lowercased headers or Express `req.get`. */
function readInboundId(req, headerName) {
  const fromHeaders = req?.headers?.[headerName.toLowerCase()];
  if (fromHeaders !== undefined) return fromHeaders;

  if (typeof req?.get === "function") return req.get(headerName);
  return undefined;
}

/** Write a log line, never letting a failing logger break the request. */
function writeLog(logger, line) {
  try {
    if (typeof logger === "function") logger(line);
    else if (typeof logger?.info === "function") logger.info(line);
    else if (typeof logger?.log === "function") logger.log(line);
  } catch {
    /* logging is best-effort */
  }
}

/**
 * Create a request id middleware.
 *
 * @param {object} [options]
 * @param {string} [options.headerName="X-Request-Id"] header to read and set
 * @param {() => string} [options.generate=randomUUID] id generator
 * @param {object|Function} [options.logger=console] `console`-like object or a
 *   function receiving the JSON line
 * @param {() => number} [options.now=Date.now] clock used for the duration field
 * @returns {(req: object, res: object, next: Function) => void} middleware
 * @throws {Error} when `headerName`, `generate`, or `now` is invalid
 */
export function createRequestIdMiddleware({
  headerName = REQUEST_ID_HEADER,
  generate = randomUUID,
  logger = console,
  now = Date.now,
} = {}) {
  if (typeof headerName !== "string" || !headerName.trim()) {
    throw new Error("headerName must be a non-empty string.");
  }
  if (typeof generate !== "function") {
    throw new Error("generate must be a function.");
  }
  if (typeof now !== "function") {
    throw new Error("now must be a function.");
  }

  return function requestId(req, res, next) {
    const inbound = readInboundId(req, headerName);
    const requestId = isValidRequestId(inbound) ? inbound : generate();

    req.id = requestId;
    req.requestId = requestId;

    if (res.locals && typeof res.locals === "object") {
      res.locals.requestId = requestId;
    }
    res.setHeader(headerName, requestId);

    const startedAt = now();

    if (typeof res.on === "function") {
      res.on("finish", () => {
        writeLog(
          logger,
          JSON.stringify({
            ts: new Date().toISOString(),
            level: "info",
            requestId,
            method: req.method,
            path: req.originalUrl ?? req.url,
            status: res.statusCode,
            ms: Math.max(0, now() - startedAt),
          }),
        );
      });
    }

    if (typeof next === "function") next();
  };
}

/** Ready-to-use middleware with the default options. */
export const requestIdMiddleware = createRequestIdMiddleware();
