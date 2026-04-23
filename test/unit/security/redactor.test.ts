import { describe, expect, it } from "vitest";
import { Redactor } from "../../../src/security/redactor.js";

describe("Redactor", () => {
  it("replaces occurrences of secret values with [REDACTED] by default", () => {
    // given
    const env = {
      ANTHROPIC_API_KEY: "sk-anthropic-secret-value",
      GITHUB_TOKEN: "ghp_abcdefghij",
    };
    const redactor = Redactor.fromEnv(env);
    const input = "key1=sk-anthropic-secret-value, key2=ghp_abcdefghij, safe=hello";

    // when
    const out = redactor.redact(input);

    // then
    expect(out).toBe("key1=[REDACTED], key2=[REDACTED], safe=hello");
  });

  it("never redacts PATH / HOME / USER values even when they are long", () => {
    // given
    const env = {
      HOME: "/Users/yeongyu",
      PATH: "/usr/local/bin:/usr/bin:/Users/yeongyu/bin",
      USER: "yeongyu",
    };
    const redactor = Redactor.fromEnv(env);
    const input = "HOME=/Users/yeongyu PATH=/usr/local/bin:/usr/bin USER=yeongyu";

    // when
    const out = redactor.redact(input);

    // then
    expect(out).toBe(input);
  });

  it("skips values shorter than minValueLength", () => {
    // given
    const env = { API_KEY: "abc" };
    const redactor = Redactor.fromEnv(env, { minValueLength: 4 });
    const input = "API_KEY=abc SOMETHING_ELSE=abc";

    // when
    const out = redactor.redact(input);

    // then
    expect(out).toContain("API_KEY=[REDACTED]");
    expect(out).toContain("SOMETHING_ELSE=abc");
  });

  it("redacts longer value first so a shorter substring does not corrupt it", () => {
    // given
    const env = {
      LONG_API_KEY: "PREFIXSECRETsuffix",
      SHORT_TOKEN: "PREFIX",
    };
    const redactor = Redactor.fromEnv(env);

    // when
    const out = redactor.redact("PREFIXSECRETsuffix PREFIX");

    // then
    expect(out).toBe("[REDACTED] [REDACTED]");
  });

  it("handles values containing regex metacharacters safely", () => {
    // given
    const env = { WEIRD_API_KEY: "a$b^c.(d)|e\\f" };
    const redactor = Redactor.fromEnv(env);

    // when
    const out = redactor.redact("leak=a$b^c.(d)|e\\f done");

    // then
    expect(out).toBe("leak=[REDACTED] done");
  });

  it("redacts NAME=value lines printed by env / printenv", () => {
    // given
    const env = { ANTHROPIC_API_KEY: "" };
    const redactor = Redactor.fromEnv(env);
    const envOutput = "PATH=/bin\nANTHROPIC_API_KEY=suddenlynewlongvalue\nHOME=/h";

    // when
    const out = redactor.redact(envOutput);

    // then
    expect(out).toBe("PATH=/bin\nANTHROPIC_API_KEY=[REDACTED]\nHOME=/h");
  });

  it('redacts declare -x NAME="value" lines', () => {
    // given
    const env = { ANTHROPIC_API_KEY: "" };
    const redactor = Redactor.fromEnv(env);
    const input = 'declare -x ANTHROPIC_API_KEY="runtimevalue"';

    // when
    const out = redactor.redact(input);

    // then
    expect(out).toBe("declare -x ANTHROPIC_API_KEY=[REDACTED]");
  });

  it("is idempotent — applying twice yields the same result", () => {
    // given
    const env = { API_KEY: "longenoughkey" };
    const redactor = Redactor.fromEnv(env);

    // when
    const once = redactor.redact("api=longenoughkey");
    const twice = redactor.redact(once);

    // then
    expect(twice).toBe(once);
  });

  it("returns the same buffer when no-op (empty env)", () => {
    // given
    const redactor = Redactor.fromEnv({});
    const buf = Buffer.from("anything");

    // when
    const out = redactor.redactBuffer(buf);

    // then
    expect(out).toBe(buf);
  });

  it("returns a new buffer when values are redacted", () => {
    // given
    const env = { API_KEY: "longenoughkey" };
    const redactor = Redactor.fromEnv(env);
    const buf = Buffer.from("leak=longenoughkey", "utf8");

    // when
    const out = redactor.redactBuffer(buf);

    // then
    expect(out.toString("utf8")).toBe("leak=[REDACTED]");
    expect(out).not.toBe(buf);
  });

  it("honours a custom marker", () => {
    // given
    const env = { API_KEY: "topsecretvalue" };
    const redactor = Redactor.fromEnv(env, { marker: "<<SECRET>>" });

    // when
    const out = redactor.redact("token=topsecretvalue");

    // then
    expect(out).toBe("token=<<SECRET>>");
  });

  it("allow list prevents redaction of a legitimate value", () => {
    // given
    const env = { PUBLIC_API_KEY: "pk-live-whatever" };
    const redactor = Redactor.fromEnv(env, { allow: ["PUBLIC_API_KEY"] });

    // when
    const out = redactor.redact("key=pk-live-whatever");

    // then
    expect(out).toBe("key=pk-live-whatever");
  });

  it("deny list forces redaction of otherwise-safe names", () => {
    // given
    const env = { HOSTNAME: "mymachine-yeongyu-local" };
    const redactor = Redactor.fromEnv(env, { deny: ["HOSTNAME"] });

    // when
    const out = redactor.redact("hostname=mymachine-yeongyu-local");

    // then
    expect(out).toBe("hostname=[REDACTED]");
  });

  it("noop redactor returns input unchanged", () => {
    // given
    const redactor = Redactor.noop();
    const input = "anything=value";

    // when
    const out = redactor.redact(input);

    // then
    expect(out).toBe(input);
    expect(redactor.isNoop()).toBe(true);
  });
});
