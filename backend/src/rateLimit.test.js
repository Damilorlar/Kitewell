import test from "node:test";
import assert from "node:assert/strict";

import { PRUNE_THRESHOLD, createRateLimiter } from "./rateLimit.js";

/** Controllable epoch-millisecond clock so no test ever sleeps. */
function createClock(start = 1_700_000_000_000) {
  let current = start;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      return current;
    },
  };
}

function fakeRequest(ip) {
  return ip === undefined ? {} : { ip };
}

/** Minimal Express res double that records status, headers and JSON body. */
function fakeResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = String(value);
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

/** Run one request through the middleware and report what it did. */
function call(middleware, ip) {
  const res = fakeResponse();
  let nexted = false;
  middleware(fakeRequest(ip), res, () => {
    nexted = true;
  });
  return { res, nexted };
}

function rateRemaining(res) {
  return res.headers["ratelimit-remaining"];
}

test("requests up to max pass and RateLimit-Remaining counts down to 0", () => {
  const clock = createClock();
  const middleware = createRateLimiter({ windowMs: 60_000, max: 3, now: clock.now });

  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    const { res, nexted } = call(middleware, "203.0.113.7");

    assert.equal(nexted, true, `request ${i + 1} should reach the route`);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, undefined);
    assert.equal(res.headers["ratelimit-limit"], "3");
    assert.equal(res.headers["ratelimit-reset"], "60");
    assert.equal(res.headers["retry-after"], undefined);
    seen.push(rateRemaining(res));
  }

  assert.deepEqual(seen, ["2", "1", "0"]);
  assert.equal(middleware.buckets.size, 1);
});

test("the request after max gets 429 with error, retryAfterMs and Retry-After", () => {
  const clock = createClock();
  const middleware = createRateLimiter({ windowMs: 30_000, max: 2, now: clock.now });

  call(middleware, "203.0.113.7");
  const allowed = call(middleware, "203.0.113.7");
  assert.equal(allowed.nexted, true);
  assert.equal(rateRemaining(allowed.res), "0");

  const blocked = call(middleware, "203.0.113.7");

  assert.equal(blocked.nexted, false, "the route must not run once the bucket is full");
  assert.equal(blocked.res.statusCode, 429);
  assert.equal(blocked.res.headers["retry-after"], "30");
  assert.equal(rateRemaining(blocked.res), "0");
  assert.deepEqual(blocked.res.body, {
    error: "Too many requests",
    retryAfterMs: 30_000,
  });

  // Still rejected inside the same window, with the remaining time shrinking.
  clock.advance(10_000);
  const stillBlocked = call(middleware, "203.0.113.7");
  assert.equal(stillBlocked.res.statusCode, 429);
  assert.equal(stillBlocked.res.headers["retry-after"], "20");
  assert.equal(stillBlocked.res.body.retryAfterMs, 20_000);
});

test("a new window resets the count", () => {
  const clock = createClock();
  const middleware = createRateLimiter({ windowMs: 60_000, max: 2, now: clock.now });

  call(middleware, "203.0.113.7");
  call(middleware, "203.0.113.7");
  assert.equal(call(middleware, "203.0.113.7").res.statusCode, 429);

  clock.advance(60_000); // exactly one window later

  const afterReset = call(middleware, "203.0.113.7");

  assert.equal(afterReset.nexted, true);
  assert.equal(afterReset.res.statusCode, 200);
  assert.equal(rateRemaining(afterReset.res), "1");
  assert.equal(afterReset.res.headers["ratelimit-reset"], "60");
  assert.equal(afterReset.res.headers["retry-after"], undefined);
  assert.deepEqual(middleware.buckets.get("203.0.113.7"), {
    count: 1,
    resetAt: clock.now() + 60_000,
  });
});

test("two IPs have separate buckets", () => {
  const clock = createClock();
  const middleware = createRateLimiter({ windowMs: 60_000, max: 1, now: clock.now });

  const first = call(middleware, "198.51.100.1");
  assert.equal(first.nexted, true);
  assert.equal(rateRemaining(first.res), "0");

  // The first IP is spent …
  assert.equal(call(middleware, "198.51.100.1").res.statusCode, 429);
  // … but a second IP still has its own full window.
  const second = call(middleware, "198.51.100.2");
  assert.equal(second.nexted, true);
  assert.equal(second.res.statusCode, 200);
  assert.equal(rateRemaining(second.res), "0");

  assert.equal(middleware.buckets.size, 2);
});

test("stale buckets are pruned once the map exceeds the threshold", () => {
  const clock = createClock(0);
  const middleware = createRateLimiter({ windowMs: 1_000, max: 100, now: clock.now });

  for (let i = 0; i < PRUNE_THRESHOLD + 1; i += 1) {
    call(middleware, `10.0.${Math.floor(i / 256)}.${i % 256}`);
  }

  // Over the threshold, but nothing has expired yet, so the sweep is a no-op.
  assert.equal(middleware.buckets.size, PRUNE_THRESHOLD + 1);

  clock.advance(1_000); // every existing bucket is now stale

  const fresh = call(middleware, "192.168.1.1");

  assert.equal(fresh.nexted, true);
  assert.equal(middleware.buckets.size, 1, "stale buckets should be swept");
  assert.equal(middleware.buckets.has("192.168.1.1"), true);
});

test("stale buckets below the threshold are kept", () => {
  const clock = createClock(0);
  const middleware = createRateLimiter({ windowMs: 1_000, max: 10, now: clock.now });

  call(middleware, "10.0.0.1");
  call(middleware, "10.0.0.2");
  clock.advance(5_000);

  call(middleware, "10.0.0.3");

  assert.equal(middleware.buckets.size, 3);
  assert.equal(middleware.buckets.has("10.0.0.1"), true);
});

test("falls back to the socket address, then to \"unknown\"", () => {
  const clock = createClock(0);
  const middleware = createRateLimiter({ windowMs: 60_000, max: 1, now: clock.now });

  const fromSocket = fakeResponse();
  middleware({ socket: { remoteAddress: "203.0.113.9" } }, fromSocket, () => {});
  assert.equal(middleware.buckets.has("203.0.113.9"), true);

  const anonymous = fakeResponse();
  middleware({}, anonymous, () => {});
  assert.equal(middleware.buckets.has("unknown"), true);
});

test("defaults to a 60 second window with 60 requests per IP", () => {
  const middleware = createRateLimiter();
  const { res, nexted } = call(middleware, "203.0.113.7");

  assert.equal(nexted, true);
  assert.equal(res.headers["ratelimit-limit"], "60");
  assert.equal(rateRemaining(res), "59");
  assert.equal(res.headers["ratelimit-reset"], "60");
});

test("each limiter owns its own bucket map", () => {
  const clock = createClock(0);
  const first = createRateLimiter({ windowMs: 60_000, max: 1, now: clock.now });
  const second = createRateLimiter({ windowMs: 60_000, max: 1, now: clock.now });

  call(first, "203.0.113.7");
  const other = call(second, "203.0.113.7");

  assert.equal(other.nexted, true);
  assert.equal(first.buckets.size, 1);
  assert.equal(second.buckets.size, 1);
  assert.notEqual(first.buckets, second.buckets);
});
