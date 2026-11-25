import { describe, expect, it, vi } from "vitest";
import {
  createSubmitGuard,
  DUPLICATE_SUBMIT_WINDOW_MS,
} from "./submitGuard";

describe("createSubmitGuard", () => {
  it("records one build when two clicks arrive before the first settles", async () => {
    const guard = createSubmitGuard();
    let release;
    const build = vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );

    async function click() {
      const gate = guard.begin("send", "dest|10|native|text|");
      if (!gate.allowed) return;
      try {
        await build();
      } finally {
        guard.end("send");
      }
    }

    const firstClick = click();
    const secondClick = click();

    expect(build).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([firstClick, secondClick]);
    expect(build).toHaveBeenCalledTimes(1);

    // Once settled, the button accepts a new submission again.
    expect(guard.begin("send", "dest|10|native|text|").allowed).toBe(true);
  });

  it("flags an identical submit inside the 15 second window", () => {
    let clock = 0;
    const guard = createSubmitGuard({ now: () => clock });
    const fingerprint = "dest|10|native|text|";

    expect(guard.begin("send", fingerprint)).toEqual({
      allowed: true,
      duplicate: false,
    });
    guard.end("send");
    guard.succeed("send", fingerprint);

    clock = DUPLICATE_SUBMIT_WINDOW_MS - 1;
    expect(guard.begin("send", fingerprint)).toEqual({
      allowed: true,
      duplicate: true,
    });
    guard.end("send");

    // A different amount is not the same submit.
    expect(guard.begin("send", "dest|11|native|text|").duplicate).toBe(false);
  });

  it("does not flag the same form once the window has passed", () => {
    let clock = 0;
    const guard = createSubmitGuard({ now: () => clock });

    guard.begin("send", "same");
    guard.end("send");
    guard.succeed("send", "same");

    clock = DUPLICATE_SUBMIT_WINDOW_MS;
    expect(guard.begin("send", "same").duplicate).toBe(false);
  });

  it("resets when the account or the network changes", () => {
    const guard = createSubmitGuard();

    guard.begin("send", "same");
    guard.end("send");
    guard.succeed("send", "same");

    guard.reset();

    expect(guard.begin("send", "same")).toEqual({
      allowed: true,
      duplicate: false,
    });
  });
});
