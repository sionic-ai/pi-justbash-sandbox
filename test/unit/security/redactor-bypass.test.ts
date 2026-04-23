import { describe, expect, it } from "vitest";
import { Redactor } from "../../../src/security/redactor.js";

describe("Redactor - bypass-resistance", () => {
  it("redacts NAME=value inside parentheses", () => {
    // given
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "" });

    // when
    const out = redactor.redact("(ANTHROPIC_API_KEY=runtimevalue)");

    // then
    expect(out).toBe("(ANTHROPIC_API_KEY=[REDACTED])");
  });

  it("redacts NAME=value inside $(...) command substitution", () => {
    // given
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "" });

    // when
    const out = redactor.redact("$(ANTHROPIC_API_KEY=runtimevalue)");

    // then
    expect(out).toBe("$(ANTHROPIC_API_KEY=[REDACTED])");
  });

  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal shell parameter expansion
  it("redacts NAME=value inside ${...} parameter expansion", () => {
    // given
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "" });

    // when
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal shell syntax under test
    const out = redactor.redact("${ANTHROPIC_API_KEY=runtimevalue}");

    // then
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal shell syntax expected
    expect(out).toBe("${ANTHROPIC_API_KEY=[REDACTED]}");
  });

  it("redacts NAME=value after backtick command substitution", () => {
    // given
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "" });

    // when
    const out = redactor.redact("`ANTHROPIC_API_KEY=runtimevalue`");

    // then
    expect(out).toBe("`ANTHROPIC_API_KEY=[REDACTED]`");
  });

  it("redacts colored secret values while preserving surrounding ANSI codes", () => {
    // given
    const secret = "sk-fake-multi-color-secret-value";
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: secret });
    const ansiRed = "\x1b[31m";
    const ansiReset = "\x1b[0m";
    const input = `value=${ansiRed}${secret}${ansiReset}`;

    // when
    const out = redactor.redact(input);

    // then
    expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED]");
    expect(out).toBe(`value=${ansiRed}[REDACTED]${ansiReset}`);
  });

  it("falls back to ANSI strip only when ANSI actually splits a secret value", () => {
    // given
    const secret = "sk-fake-ansi-split-secret-value";
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: secret });
    const splitCodes = "\x1b[31m";
    const input = `leak=sk-fake-ansi${splitCodes}-split-secret-value`;

    // when
    const out = redactor.redact(input);

    // then
    expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED]");
  });

  it("catches runtime-set NAME=value whose name was never in process.env at snapshot", () => {
    // given
    const redactor = Redactor.fromEnv({ FOO_TOKEN: "xxx" });

    // when
    const out = redactor.redact("BAR_API_KEY=new-runtime-value-xyz");

    // then
    expect(out).toBe("BAR_API_KEY=[REDACTED]");
  });

  it("catches full secret name via word boundary (NEIGHBOUR_API_KEY redacts as a whole)", () => {
    // given
    const redactor = Redactor.fromEnv({ API_KEY: "" });
    const input = "NEIGHBOUR_API_KEY=neighbour-value";

    // when
    const out = redactor.redact(input);

    // then
    expect(out).toBe("NEIGHBOUR_API_KEY=[REDACTED]");
  });

  it("idempotent: redacting already-redacted output is unchanged", () => {
    // given
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "sk-real-value" });

    // when
    const first = redactor.redact("key=sk-real-value marker=[REDACTED]");
    const second = redactor.redact(first);

    // then
    expect(second).toBe(first);
  });

  it("noop redactor does NOT scrub anything (explicit opt-out)", () => {
    // given
    const redactor = Redactor.noop();
    const input = "NEW_API_KEY=some-long-secret-value";

    // when
    const out = redactor.redact(input);

    // then
    expect(out).toBe(input);
  });

  it("handles escaped double quotes inside a quoted value without leaking the suffix", () => {
    // given
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "" });

    // when
    const out = redactor.redact('declare -x ANTHROPIC_API_KEY="abc\\"def"');

    // then
    expect(out).not.toContain("def");
    expect(out).toContain("ANTHROPIC_API_KEY=[REDACTED]");
  });

  it("strips OSC escape sequences so OSC-split secrets still redact", () => {
    // given
    const secret = "sk-fake-osc-split-secret-value";
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: secret });
    const osc = "\x1b]0;title\x07";
    const input = `leak=${osc}${secret}`;

    // when
    const out = redactor.redact(input);

    // then
    expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED]");
  });

  it("preserves ANSI codes in text that does not contain any secret", () => {
    // given
    const redactor = Redactor.fromEnv({ ANTHROPIC_API_KEY: "sk-fake-present-but-not-in-text" });
    const colored = "\x1b[31merror\x1b[0m: bad config";

    // when
    const out = redactor.redact(colored);

    // then
    expect(out).toBe(colored);
  });
});
