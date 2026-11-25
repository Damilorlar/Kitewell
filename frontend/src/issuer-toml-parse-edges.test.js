import { describe, expect, it } from "vitest";
import { parseStellarToml } from "./issuerToml";

describe("parseStellarToml value types", () => {
  it("reads the scalars a stellar.toml uses", () => {
    const parsed = parseStellarToml(`
string = "USD"
literal = 'C:\\anchors\\keys'
integer = 42
negative = -7
float = 3.5
exponent = 1.2e3
truthy = true
falsy = false
grouped = 1_000_000
`);

    expect(parsed.values).toEqual({
      string: "USD",
      literal: "C:\\anchors\\keys",
      integer: 42,
      negative: -7,
      float: 3.5,
      exponent: 1200,
      truthy: true,
      falsy: false,
      grouped: 1000000,
    });
  });

  it("unescapes basic strings but not literal ones", () => {
    const parsed = parseStellarToml(
      `escaped = "line\\nbreak \\t tab \\"quote\\" back\\\\slash \\u0041"\nliteral = 'no\\nescape here'`
    );
    expect(parsed.values.escaped).toBe('line\nbreak \t tab "quote" back\\slash A');
    expect(parsed.values.literal).toBe("no\\nescape here");
  });

  it("reads inline arrays, including empty and trailing-comma forms", () => {
    const parsed = parseStellarToml(`
accounts = ["GA7", "GB8"]
mixed = [1, 2, 3]
empty = []
trailing = ["GA7",]
nested = [["a"], ["b"]]
`);
    expect(parsed.values.accounts).toEqual(["GA7", "GB8"]);
    expect(parsed.values.mixed).toEqual([1, 2, 3]);
    expect(parsed.values.empty).toEqual([]);
    expect(parsed.values.trailing).toEqual(["GA7"]);
    expect(parsed.values.nested).toEqual([["a"], ["b"]]);
  });

  // Published files such as centre.io's and circle.com's spread ACCOUNTS over
  // several lines, so the reader has to follow the array to its ].
  it("reads an array the issuer spread over several lines", () => {
    const parsed = parseStellarToml(`
ACCOUNTS=[
"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", "GDEWOLMOPAVRTGNJVWOE6U6LHZVAWIJZVWM6PDLCFTUTJJEKSU32TO5W"
]

[DOCUMENTATION]
ORG_NAME="Centre Consortium LLC"

[[CURRENCIES]]
code = "USD"
issuer = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
display_decimals = 2
`);
    expect(parsed.values.ACCOUNTS).toEqual([
      "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "GDEWOLMOPAVRTGNJVWOE6U6LHZVAWIJZVWM6PDLCFTUTJJEKSU32TO5W",
    ]);
    expect(parsed.tables.DOCUMENTATION.ORG_NAME).toBe("Centre Consortium LLC");
    expect(parsed.arrays.CURRENCIES).toEqual([
      {
        code: "USD",
        issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        display_decimals: 2,
      },
    ]);
  });

  it("keeps reading lines until the array closes, comments and blanks aside", () => {
    const parsed = parseStellarToml(
      'accounts = [\n  "GA7", # one\n\n  "GB8",\n]\nnext = 2'
    );
    expect(parsed.values.accounts).toEqual(["GA7", "GB8"]);
    expect(parsed.values.next).toBe(2);
  });

  it("accepts quoted keys and dotted-free table names", () => {
    const parsed = parseStellarToml('"ORG_NAME" = "Top level"\n[CURRENCIES]\ncode = "USD"');
    expect(parsed.values.ORG_NAME).toBe("Top level");
    expect(parsed.tables.CURRENCIES).toEqual({ code: "USD" });
  });

  it("splits a table across repeats of the same array header", () => {
    const parsed = parseStellarToml(`
[[CURRENCIES]]
code = "USD"

[OTHER]
x = 1

[[CURRENCIES]]
code = "EUR"
`);
    expect(parsed.arrays.CURRENCIES.map((row) => row.code)).toEqual(["USD", "EUR"]);
    expect(parsed.tables.OTHER).toEqual({ x: 1 });
  });
});

describe("parseStellarToml failures", () => {
  const cases = [
    ['key "USD"', 1, "a key is not followed by ="],
    ["!not a key", 1, "a line is neither a table header nor a key"],
    ['unclosed = "USD', 1, "a string is not closed on its line"],
    ["count = @12", 1, "@12 is not a toml value"],
    ["count = 1 2", 1, "extra text follows the value"],
    ["[BAD NAME]", 1, "BAD NAME is not a table name"],
    ["[[BAD NAME]]", 1, "BAD NAME is not a table name"],
    ["key =\n", 1, "a key has no value"],
    ['accounts = ["GA7",', 1, "an array is not closed"],
    ['accounts = ["GA7" "GB8"]', 1, "an array item is not followed by , or ]"],
    ['bad = "unknown \\q escape"', 1, "unknown string escape"],
    ['bad = "short \\u12 escape"', 1, "a string escape is not a code point"],
    ['[DOCUMENTATION]\ncode = "A"\ncode = "B"', 3, "code is set twice"],
  ];

  it.each(cases)("refuses %o on its own line", (text, line, reason) => {
    expect(() => parseStellarToml(text)).toThrow(`stellar.toml line ${line}: ${reason}`);
  });

  it("reports the line an unclosed array opened on", () => {
    expect(() => parseStellarToml('accounts = [\n"GA7",\n"GB8",\n')).toThrow(
      "stellar.toml line 1: an array is not closed"
    );
  });

  it("reports the line the failure is on, not the first line", () => {
    const text = `VERSION = "0.1"

[DOCUMENTATION]
ORG_NAME = "Kitewell"
broken line here
`;
    expect(() => parseStellarToml(text)).toThrow("stellar.toml line 5:");
  });

  it("refuses a body that is not text", () => {
    expect(() => parseStellarToml(undefined)).toThrow("There is no stellar.toml body to read.");
    expect(() => parseStellarToml(null)).toThrow("There is no stellar.toml body to read.");
    expect(() => parseStellarToml({})).toThrow("There is no stellar.toml body to read.");
  });

  it("returns nothing at all once a line fails", () => {
    // The panel must show the failure and no partial invented rows.
    const broken = `[[CURRENCIES]]\ncode = "USD"\ncode = "EUR"\n`;
    let parsed;
    try {
      parsed = parseStellarToml(broken);
    } catch {
      parsed = undefined;
    }
    expect(parsed).toBeUndefined();
  });
});
