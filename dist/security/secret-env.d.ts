/**
 * Classify process environment variables as "secret" or "safe" using a
 * name-based heuristic tuned for the sandbox-escape scenario documented
 * in `docs/RESEARCH.md`.
 *
 * The classifier is intentionally conservative: it biases toward marking
 * a variable secret when in doubt, because the failure mode of a missed
 * secret (API key leaked to an LLM agent → network exfiltration) is much
 * worse than the failure mode of an over-redacted value (a legitimate
 * identifier that happens to match the regex gets replaced with
 * `[REDACTED]` in tool output).
 *
 * See {@link Redactor} in `./redactor.ts` for the downstream consumer.
 */
/**
 * Configuration knobs for {@link isSecretEnvName} and
 * {@link selectSecretEnv}.
 */
export interface SecretEnvClassifierOptions {
    /**
     * Extra names to always treat as non-secret (skip redaction). Matched
     * case-insensitively, then upper-cased for comparison. Takes priority
     * over every other rule — use this to un-redact a name that would
     * otherwise match the heuristic.
     */
    readonly allow?: readonly string[];
    /**
     * Extra names to always treat as secret (force redaction). Matched
     * case-insensitively. Takes priority over {@link SecretEnvClassifierOptions.allow}
     * for the same name (so an entry in both lists is redacted) to fail
     * safe.
     */
    readonly deny?: readonly string[];
}
/**
 * Return `true` when the env var named `name` should be treated as a
 * secret and its value redacted from tool output.
 *
 * Resolution order (first match wins):
 *   1. `options.deny` → secret (even if otherwise SAFE)
 *   2. `options.allow` → not secret (even if otherwise secret)
 *   3. {@link SAFE_NAMES} exact match → not secret
 *   4. {@link SECRET_EXACT_NAMES} exact match → secret
 *   5. Any `_`-separated segment is in {@link SECRET_SEGMENTS} → secret
 *   6. Otherwise → not secret (fail-open for unknown names so we do not
 *      explode the redaction set with every random env var).
 */
export declare function isSecretEnvName(name: string, options?: SecretEnvClassifierOptions): boolean;
/**
 * Select the subset of `env` whose values should be redacted, returning
 * a name→value map. Entries without a string value (undefined in
 * `NodeJS.ProcessEnv`) are skipped because there is nothing to redact.
 */
export declare function selectSecretEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, options?: SecretEnvClassifierOptions): Map<string, string>;
/**
 * Strip every secret-env entry from `env` and return a new, plain
 * `Record<string, string>` containing only the non-secret values.
 *
 * Used by {@link ../adapters/host-binary-bridge.ts} to prevent host
 * binaries (e.g. `storm`) from inheriting API keys they might otherwise
 * forward over the network.
 */
export declare function stripSecretEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, options?: SecretEnvClassifierOptions): Record<string, string>;
//# sourceMappingURL=secret-env.d.ts.map