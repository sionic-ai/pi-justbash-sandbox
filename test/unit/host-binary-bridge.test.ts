import { describe, expect, it } from "vitest";
import { buildHostBridgeEnv, normalizePassThrough } from "../../src/adapters/host-binary-bridge.js";

describe("buildHostBridgeEnv", () => {
  it("strips secret-classified entries from process.env by default", () => {
    // given
    const env = {
      PATH: "/usr/bin",
      HOME: "/Users/me",
      ANTHROPIC_API_KEY: "sk-strip",
      GITHUB_TOKEN: "ghp_strip",
      SAFE_VAR: "keep-me",
    };

    // when
    const out = buildHostBridgeEnv(env, [], normalizePassThrough(), {});

    // then
    expect(out).toEqual({
      PATH: "/usr/bin",
      HOME: "/Users/me",
      SAFE_VAR: "keep-me",
    });
  });

  it("honours passThroughSecretEnv for named secret vars", () => {
    // given
    const env = {
      PATH: "/usr/bin",
      ANTHROPIC_API_KEY: "sk-should-pass-through",
      GITHUB_TOKEN: "ghp-stripped",
    };

    // when
    const out = buildHostBridgeEnv(env, [], normalizePassThrough(["ANTHROPIC_API_KEY"]), {});

    // then
    expect(out.ANTHROPIC_API_KEY).toBe("sk-should-pass-through");
    expect(out.GITHUB_TOKEN).toBeUndefined();
  });

  it("honours classifier deny override (force strip otherwise-safe var)", () => {
    // given
    const env = { PATH: "/usr/bin", HOSTNAME: "mybox" };

    // when
    const out = buildHostBridgeEnv(env, [], normalizePassThrough(), {
      deny: ["HOSTNAME"],
    });

    // then
    expect(out.HOSTNAME).toBeUndefined();
    expect(out.PATH).toBe("/usr/bin");
  });

  it("honours classifier allow override (keep otherwise-secret var)", () => {
    // given
    const env = { PUBLIC_API_KEY: "pk-marketing" };

    // when
    const out = buildHostBridgeEnv(env, [], normalizePassThrough(), {
      allow: ["PUBLIC_API_KEY"],
    });

    // then
    expect(out.PUBLIC_API_KEY).toBe("pk-marketing");
  });

  it("ctx.env overrides process.env while still honouring strip rules", () => {
    // given
    const processEnv = { SAFE_VAR: "from-process" };
    const ctxEnv = new Map<string, string>([
      ["SAFE_VAR", "from-ctx"],
      ["LATE_TOKEN", "late-secret-stripped"],
    ]);

    // when
    const out = buildHostBridgeEnv(processEnv, ctxEnv, normalizePassThrough(), {});

    // then
    expect(out.SAFE_VAR).toBe("from-ctx");
    expect(out.LATE_TOKEN).toBeUndefined();
  });

  it("skips undefined values from process.env", () => {
    // given
    const env: Record<string, string | undefined> = {
      PATH: "/usr/bin",
      SOMEVAR: undefined,
    };

    // when
    const out = buildHostBridgeEnv(env, [], normalizePassThrough(), {});

    // then
    expect(out.PATH).toBe("/usr/bin");
    expect("SOMEVAR" in out).toBe(false);
  });
});
