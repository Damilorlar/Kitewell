import { beforeEach, describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { fetchUnsignedChallenge } from "./sep10WebAuth";

const ACCOUNT = StellarSdk.Keypair.random().publicKey();
const ENDPOINT = "https://anchor.example.com/auth";
const CHALLENGE_XDR = "AAAAAgAAAAB0aGlzIGlzIGEgZmFrZSBlbnZlbG9wZQ==";

function response({ ok = true, status = 200, body }) {
  return { ok, status, text: async () => body };
}

describe("fetchUnsignedChallenge", () => {
  let fetchFn;

  beforeEach(() => {
    fetchFn = vi.fn();
  });

  it("requests the built URL and returns the challenge it carries", async () => {
    fetchFn.mockResolvedValue(
      response({ body: JSON.stringify({ challenge: CHALLENGE_XDR }) })
    );

    const result = await fetchUnsignedChallenge({
      endpoint: ENDPOINT,
      account: ACCOUNT,
      homeDomains: ["anchor.example.com"],
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(new URL(url).searchParams.get("account")).toBe(ACCOUNT);
    expect(init.method).toBe("GET");
    expect(init.headers.Accept).toBe("application/json");
    expect(result.challengeXdr).toBe(CHALLENGE_XDR);
    expect(result.requestUrl).toBe(url);
  });

  it("surfaces the endpoint's HTTP status instead of an empty challenge", async () => {
    fetchFn.mockResolvedValue(response({ ok: false, status: 404, body: "{}" }));

    await expect(
      fetchUnsignedChallenge({ endpoint: ENDPOINT, account: ACCOUNT, fetchFn })
    ).rejects.toThrow("The web-auth endpoint replied 404; no challenge was returned.");
  });

  it("refuses a body that is not JSON", async () => {
    fetchFn.mockResolvedValue(response({ body: "<html>nope</html>" }));

    await expect(
      fetchUnsignedChallenge({ endpoint: ENDPOINT, account: ACCOUNT, fetchFn })
    ).rejects.toThrow("The web-auth endpoint did not return a JSON challenge.");
  });

  it("refuses a JSON array or scalar", async () => {
    for (const body of ["[]", "null", '"a string"', "7"]) {
      fetchFn.mockResolvedValue(response({ body }));
      await expect(
        fetchUnsignedChallenge({ endpoint: ENDPOINT, account: ACCOUNT, fetchFn })
      ).rejects.toThrow("The web-auth endpoint did not return a JSON challenge.");
    }
  });

  it("refuses JSON that carries no challenge field", async () => {
    for (const body of ['{}', '{"transaction":""}', '{"challenge":null}', '{"challenge":123}']) {
      fetchFn.mockResolvedValue(response({ body }));
      await expect(
        fetchUnsignedChallenge({ endpoint: ENDPOINT, account: ACCOUNT, fetchFn })
      ).rejects.toThrow("The web-auth endpoint returned no challenge transaction.");
    }
  });

  it("refuses to run without a way to make the request", async () => {
    await expect(
      fetchUnsignedChallenge({ endpoint: ENDPOINT, account: ACCOUNT, fetchFn: "not a function" })
    ).rejects.toThrow("This session cannot make requests, so no challenge can be fetched.");
  });

  it("validates the endpoint before touching the network", async () => {
    await expect(
      fetchUnsignedChallenge({
        endpoint: "http://anchor.example.com/auth",
        account: ACCOUNT,
        fetchFn,
      })
    ).rejects.toThrow("The web-auth endpoint must use https://.");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
