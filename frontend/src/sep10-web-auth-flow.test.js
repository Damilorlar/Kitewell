import { beforeEach, describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { completeWebAuthChallenge } from "./sep10WebAuth";

const PASSPHRASE = StellarSdk.Networks.TESTNET;
const SERVER = StellarSdk.Keypair.random();
const OTHER_SERVER = StellarSdk.Keypair.random();
const CLIENT = StellarSdk.Keypair.random();
const ENDPOINT = "https://anchor.example.com/auth";
const NOW_MS = 1_700_000_000_000;
const EXP_SECONDS = 4_000_000_000;

function challengeXdr({
  server = SERVER,
  client = CLIENT,
  maxTime = EXP_SECONDS,
  minTime = 0,
} = {}) {
  const transaction = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(server.publicKey(), "1"),
    { fee: StellarSdk.BASE_FEE, networkPassphrase: PASSPHRASE }
  )
    .addOperation(
      StellarSdk.Operation.manageData({
        name: "auth",
        value: "kitewell-login",
        source: client.publicKey(),
      })
    )
    .addOperation(
      StellarSdk.Operation.manageData({
        name: "web_auth_domain",
        value: "anchor.example.com",
        source: server.publicKey(),
      })
    )
    .setTimebounds(minTime, maxTime)
    .build();
  transaction.sign(server);
  return transaction.toXDR();
}

function signWithClient(xdr) {
  const transaction = new StellarSdk.Transaction(xdr, PASSPHRASE);
  transaction.sign(CLIENT);
  return transaction.toXDR();
}

function encodeUrl(segment) {
  return Buffer.from(JSON.stringify(segment)).toString("base64url");
}

function accessToken(payload) {
  return `${encodeUrl({ alg: "RS256" })}.${encodeUrl(payload)}.${encodeUrl("sig")}`;
}

/** A fetch stub that answers the GET challenge request then the POST of it. */
function horizon({ token = accessToken({ sub: CLIENT.publicKey(), exp: EXP_SECONDS }) } = {}) {
  const unsigned = challengeXdr();
  const calls = [];
  const fetchFn = vi.fn(async (url, init = {}) => {
    calls.push({ url, init });
    if ((init.method || "GET") === "GET") {
      return { ok: true, status: 200, text: async () => JSON.stringify({ challenge: unsigned }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ token }) };
  });
  return { fetchFn, calls, unsigned };
}

describe("completeWebAuthChallenge", () => {
  let sign;
  let signedByWallet;

  beforeEach(() => {
    signedByWallet = null;
    sign = vi.fn(async (xdr) => {
      signedByWallet = signWithClient(xdr);
      return signedByWallet;
    });
  });

  it("posts exactly the envelope Freighter signed", async () => {
    const { fetchFn, calls, unsigned } = horizon();

    await completeWebAuthChallenge({
      endpoint: ENDPOINT,
      account: CLIENT.publicKey(),
      serverAccount: SERVER.publicKey(),
      homeDomains: ["anchor.example.com"],
      sign,
      fetchFn,
      networkPassphrase: PASSPHRASE,
      nowMs: NOW_MS,
    });

    expect(sign).toHaveBeenCalledWith(unsigned);
    const post = calls.find((call) => call.init.method === "POST");
    expect(post.url).toBe(ENDPOINT);
    expect(post.init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(post.init.body)).toEqual({ transaction: signedByWallet });
    expect(JSON.parse(post.init.body).transaction).not.toBe(unsigned);
  });

  it("reports the challenge and the session it bought", async () => {
    const { fetchFn } = horizon();

    const result = await completeWebAuthChallenge({
      endpoint: ENDPOINT,
      account: CLIENT.publicKey(),
      serverAccount: SERVER.publicKey(),
      sign,
      fetchFn,
      networkPassphrase: PASSPHRASE,
      nowMs: NOW_MS,
    });

    expect(result.requestUrl).toBe(`${ENDPOINT}?account=${CLIENT.publicKey()}`);
    expect(result.challenge).toEqual({
      serverAccount: SERVER.publicKey(),
      clientAccount: CLIENT.publicKey(),
      operationName: "auth",
      webAuthDomain: "anchor.example.com",
      operationCount: 2,
      expiresAtMs: EXP_SECONDS * 1000,
      validFromMs: null,
    });
    expect(result.session).toEqual({
      subject: CLIENT.publicKey(),
      expiresAtMs: EXP_SECONDS * 1000,
      issuedAtMs: null,
      expired: false,
    });
    expect(result.presentation).toHaveLength(4);
  });

  it("keeps the access token out of everything it returns", async () => {
    const token = accessToken({ sub: CLIENT.publicKey(), exp: EXP_SECONDS });
    const { fetchFn } = horizon({ token });
    const logged = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => logged.push(args.join(" ")));

    try {
      const result = await completeWebAuthChallenge({
        endpoint: ENDPOINT,
        account: CLIENT.publicKey(),
        serverAccount: SERVER.publicKey(),
        sign,
        fetchFn,
        networkPassphrase: PASSPHRASE,
        nowMs: NOW_MS,
      });

      expect(JSON.stringify(result)).not.toContain(token);
      expect(result.presentation.join("\n")).not.toContain(token);
    } finally {
      logSpy.mockRestore();
    }
    expect(logged.join("\n")).not.toContain(token);
  });

  it("refuses a challenge from the wrong server before asking the wallet to sign", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ challenge: challengeXdr({ server: OTHER_SERVER }) }),
    }));

    await expect(
      completeWebAuthChallenge({
        endpoint: ENDPOINT,
        account: CLIENT.publicKey(),
        serverAccount: SERVER.publicKey(),
        sign,
        fetchFn,
        networkPassphrase: PASSPHRASE,
        nowMs: NOW_MS,
      })
    ).rejects.toThrow(
      `Refused: the challenge's source account is ${OTHER_SERVER.publicKey()}, not the endpoint's server ${SERVER.publicKey()}.`
    );
    expect(sign).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("refuses an already expired challenge before signing", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ challenge: challengeXdr({ maxTime: Math.floor(NOW_MS / 1000) - 60 }) }),
    }));

    await expect(
      completeWebAuthChallenge({
        endpoint: ENDPOINT,
        account: CLIENT.publicKey(),
        serverAccount: SERVER.publicKey(),
        sign,
        fetchFn,
        networkPassphrase: PASSPHRASE,
        nowMs: NOW_MS,
      })
    ).rejects.toThrow("Refused: the challenge expired at");
    expect(sign).not.toHaveBeenCalled();
  });

  it("refuses a challenge signed for another network before posting it", async () => {
    const futurenetChallenge = (() => {
      const transaction = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(SERVER.publicKey(), "1"),
        { fee: StellarSdk.BASE_FEE, networkPassphrase: StellarSdk.Networks.FUTURENET }
      )
        .addOperation(
          StellarSdk.Operation.manageData({
            name: "auth",
            value: "kitewell-login",
            source: CLIENT.publicKey(),
          })
        )
        .setTimebounds(0, EXP_SECONDS)
        .build();
      transaction.sign(SERVER);
      return transaction.toXDR();
    })();
    const fetchFn = vi.fn(async (url, init = {}) => {
      if ((init.method || "GET") === "GET") {
        return { ok: true, status: 200, text: async () => JSON.stringify({ challenge: futurenetChallenge }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ token: "a.b.c" }) };
    });

    await expect(
      completeWebAuthChallenge({
        endpoint: ENDPOINT,
        account: CLIENT.publicKey(),
        serverAccount: SERVER.publicKey(),
        sign: async (xdr) => signWithClient(xdr),
        fetchFn,
        networkPassphrase: PASSPHRASE,
        nowMs: NOW_MS,
      })
    ).rejects.toThrow(
      "Refused: the signed challenge is not backed by both the server's and this account's signature."
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("refuses a wallet that returns the challenge untouched", async () => {
    const { fetchFn } = horizon();

    await expect(
      completeWebAuthChallenge({
        endpoint: ENDPOINT,
        account: CLIENT.publicKey(),
        serverAccount: SERVER.publicKey(),
        sign: async (xdr) => xdr,
        fetchFn,
        networkPassphrase: PASSPHRASE,
        nowMs: NOW_MS,
      })
    ).rejects.toThrow("Refused: signing altered the challenge envelope.");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("posts nothing when the wallet is unavailable", async () => {
    const { fetchFn, calls } = horizon();

    await expect(
      completeWebAuthChallenge({
        endpoint: ENDPOINT,
        account: CLIENT.publicKey(),
        serverAccount: SERVER.publicKey(),
        fetchFn,
        networkPassphrase: PASSPHRASE,
        nowMs: NOW_MS,
      })
    ).rejects.toThrow("Freighter is not available to sign the challenge.");
    expect(calls.every((call) => call.init.method === "GET")).toBe(true);
  });

  it("surfaces the endpoint refusing the signed challenge", async () => {
    const unsigned = challengeXdr();
    const fetchFn = vi.fn(async (url, init = {}) => {
      if ((init.method || "GET") === "GET") {
        return { ok: true, status: 200, text: async () => JSON.stringify({ challenge: unsigned }) };
      }
      return { ok: false, status: 401, text: async () => "Unauthorized" };
    });

    await expect(
      completeWebAuthChallenge({
        endpoint: ENDPOINT,
        account: CLIENT.publicKey(),
        serverAccount: SERVER.publicKey(),
        sign,
        fetchFn,
        networkPassphrase: PASSPHRASE,
        nowMs: NOW_MS,
      })
    ).rejects.toThrow("The web-auth endpoint rejected the signed challenge (401).");
  });

  it("refuses a token minted for a different account", async () => {
    const stranger = StellarSdk.Keypair.random().publicKey();
    const { fetchFn } = horizon({ token: accessToken({ sub: stranger, exp: EXP_SECONDS }) });

    await expect(
      completeWebAuthChallenge({
        endpoint: ENDPOINT,
        account: CLIENT.publicKey(),
        serverAccount: SERVER.publicKey(),
        sign,
        fetchFn,
        networkPassphrase: PASSPHRASE,
        nowMs: NOW_MS,
      })
    ).rejects.toThrow("The access token was issued for a different account.");
  });
});
