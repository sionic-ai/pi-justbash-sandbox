import { describe, expect, it } from "vitest";
import {
  isSecretEnvName,
  selectSecretEnv,
  stripSecretEnv,
} from "../../../src/security/secret-env.js";

describe("isSecretEnvName", () => {
  it("classifies API_KEY-like names as secret", () => {
    // given
    const names = [
      "ANTHROPIC_API_KEY",
      "OPENROUTER_API_KEY",
      "OPENAI_API_KEY",
      "GITHUB_TOKEN",
      "AWS_SECRET_ACCESS_KEY",
      "DATABASE_PASSWORD",
      "JWT_SECRET",
      "STRIPE_WEBHOOK_SECRET",
    ];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === true)).toBe(true);
  });

  it("never classifies shell-essential names as secret", () => {
    // given
    const names = [
      "PATH",
      "HOME",
      "PWD",
      "OLDPWD",
      "USER",
      "LOGNAME",
      "SHELL",
      "TERM",
      "LANG",
      "LC_ALL",
      "TZ",
      "TMPDIR",
      "HOSTNAME",
      "NODE_ENV",
    ];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.some((r) => r === true)).toBe(false);
  });

  it("classifies SSH_AUTH_SOCK as secret (AUTH segment and explicit entry)", () => {
    // given
    const name = "SSH_AUTH_SOCK";

    // when
    const isSecret = isSecretEnvName(name);

    // then
    expect(isSecret).toBe(true);
  });

  it("is case-insensitive for name lookup", () => {
    // given
    const upper = "ANTHROPIC_API_KEY";
    const lower = "anthropic_api_key";
    const mixed = "Anthropic_Api_Key";

    // when
    const u = isSecretEnvName(upper);
    const l = isSecretEnvName(lower);
    const m = isSecretEnvName(mixed);

    // then
    expect(u).toBe(true);
    expect(l).toBe(true);
    expect(m).toBe(true);
  });

  it("does not match a secret segment hidden inside a longer identifier", () => {
    // given
    const name = "AUTHORITATIVE_MODE";

    // when
    const isSecret = isSecretEnvName(name);

    // then
    expect(isSecret).toBe(false);
  });

  it("honours explicit deny list over SAFE_NAMES", () => {
    // given
    const name = "HOSTNAME";

    // when
    const baseline = isSecretEnvName(name);
    const forced = isSecretEnvName(name, { deny: ["HOSTNAME"] });

    // then
    expect(baseline).toBe(false);
    expect(forced).toBe(true);
  });

  it("honours explicit allow list over segment heuristic", () => {
    // given
    const name = "PUBLIC_API_KEY";

    // when
    const baseline = isSecretEnvName(name);
    const overridden = isSecretEnvName(name, { allow: ["PUBLIC_API_KEY"] });

    // then
    expect(baseline).toBe(true);
    expect(overridden).toBe(false);
  });

  it("deny list wins over allow list when a name is in both", () => {
    // given
    const name = "MYVAR";

    // when
    const result = isSecretEnvName(name, { allow: ["MYVAR"], deny: ["MYVAR"] });

    // then
    expect(result).toBe(true);
  });

  it("returns false for fully-unknown names to avoid over-redaction", () => {
    // given
    const name = "RANDOM_APP_CONFIG_VALUE";

    // when
    const result = isSecretEnvName(name);

    // then
    expect(result).toBe(false);
  });
});

describe("selectSecretEnv", () => {
  it("returns only entries whose name is classified secret and value is non-empty", () => {
    // given
    const env = {
      ANTHROPIC_API_KEY: "sk-test-1",
      OPENROUTER_API_KEY: "",
      PATH: "/usr/bin",
      HOME: "/Users/me",
      GITHUB_TOKEN: "ghp_XXX",
      MISSING: undefined,
    } as Record<string, string | undefined>;

    // when
    const selected = selectSecretEnv(env);

    // then
    expect([...selected.keys()].sort()).toEqual(["ANTHROPIC_API_KEY", "GITHUB_TOKEN"]);
    expect(selected.get("ANTHROPIC_API_KEY")).toBe("sk-test-1");
  });

  it("applies allow overrides", () => {
    // given
    const env = { CUSTOM_TOKEN: "noredact" };

    // when
    const selected = selectSecretEnv(env, { allow: ["CUSTOM_TOKEN"] });

    // then
    expect(selected.size).toBe(0);
  });
});

describe("stripSecretEnv", () => {
  it("removes secret entries and keeps only string-valued non-secrets", () => {
    // given
    const env = {
      PATH: "/usr/bin",
      HOME: "/Users/me",
      ANTHROPIC_API_KEY: "sk-x",
      SSH_AUTH_SOCK: "/tmp/ssh",
      NOT_STRING: undefined,
    } as Record<string, string | undefined>;

    // when
    const stripped = stripSecretEnv(env);

    // then
    expect(stripped).toEqual({ PATH: "/usr/bin", HOME: "/Users/me" });
  });
});
