import { type SecretEnvClassifierOptions } from "./secret-env.js";
export interface RedactorOptions extends SecretEnvClassifierOptions {
    readonly marker?: string;
    /**
     * Values shorter than this are never redacted, even if their name is
     * classified secret. Protects against catastrophic over-redaction of
     * short strings like "0", "1", "", "ok". Default 4; set to 0 to
     * redact every secret value regardless of length.
     */
    readonly minValueLength?: number;
}
/**
 * Replace known-secret env values with a constant marker in arbitrary
 * text. Two cooperating passes run on every input:
 *
 *   1. Value pass: every env value that was classified secret at
 *      snapshot time is replaced via plain-string split/join (longest
 *      first so a shorter value cannot eat a longer one's prefix, and
 *      regex metacharacters are safe).
 *   2. Generic name pass: a regex finds ANY shell-style `NAME=value`,
 *      `(NAME=value)`, `$(NAME=value)`, `export NAME=...`,
 *      `declare -x NAME=...` occurrence and asks the classifier whether
 *      NAME is secret. This covers values the agent set at runtime
 *      (outside the snapshot) and values that names we have never seen.
 *
 * Before either pass we strip ANSI control sequences so an agent cannot
 * split a secret with a color escape and bypass the value pass.
 */
export declare class Redactor {
    #private;
    private constructor();
    static fromEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, options?: RedactorOptions): Redactor;
    static noop(): Redactor;
    isNoop(): boolean;
    getClassifierOptions(): SecretEnvClassifierOptions;
    redact(text: string): string;
    /**
     * Redact over a Buffer via UTF-8 round-trip. Callers that pass binary
     * data MUST gate this behind a content-type check - redacting
     * arbitrary bytes as UTF-8 will mangle non-text content.
     */
    redactBuffer(buf: Buffer): Buffer;
}
//# sourceMappingURL=redactor.d.ts.map