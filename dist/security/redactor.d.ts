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
 * text. Values are sorted by descending length before replacement so a
 * value that happens to be a substring of a longer secret does not
 * corrupt the longer one's redaction. Replacement uses plain-string
 * split/join so secret values containing regex metacharacters ($, \,
 * ^, ...) are handled safely.
 */
export declare class Redactor {
    #private;
    private constructor();
    static fromEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, options?: RedactorOptions): Redactor;
    static noop(): Redactor;
    isNoop(): boolean;
    redact(text: string): string;
    /**
     * Redact over a Buffer via UTF-8 round-trip. Callers that pass binary
     * data MUST gate this behind a content-type check - redacting
     * arbitrary bytes as UTF-8 will mangle non-text content.
     */
    redactBuffer(buf: Buffer): Buffer;
}
//# sourceMappingURL=redactor.d.ts.map