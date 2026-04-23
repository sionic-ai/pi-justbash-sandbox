import { isSecretEnvName, type SecretEnvClassifierOptions } from "./secret-env.js";

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
export class Redactor {
  readonly #orderedValues: readonly string[];
  readonly #marker: string;
  readonly #classifierOptions: SecretEnvClassifierOptions;
  readonly #noop: boolean;

  private constructor(
    values: readonly string[],
    marker: string,
    classifierOptions: SecretEnvClassifierOptions,
    noop: boolean,
  ) {
    this.#orderedValues = values;
    this.#marker = marker;
    this.#classifierOptions = classifierOptions;
    this.#noop = noop;
  }

  static fromEnv(
    env: NodeJS.ProcessEnv | Record<string, string | undefined>,
    options?: RedactorOptions,
  ): Redactor {
    const marker = options?.marker ?? "[REDACTED]";
    const minLength = Math.max(0, options?.minValueLength ?? 4);
    const classifierOptions: SecretEnvClassifierOptions = {};
    if (options?.allow !== undefined) {
      Object.assign(classifierOptions, { allow: options.allow });
    }
    if (options?.deny !== undefined) {
      Object.assign(classifierOptions, { deny: options.deny });
    }

    const uniqueValues = new Set<string>();
    for (const [name, value] of Object.entries(env)) {
      if (!isSecretEnvName(name, classifierOptions)) continue;
      if (typeof value === "string" && value.length >= minLength) {
        uniqueValues.add(value);
      }
    }
    const ordered = Array.from(uniqueValues).sort((a, b) => b.length - a.length);
    return new Redactor(ordered, marker, classifierOptions, false);
  }

  static noop(): Redactor {
    return new Redactor([], "[REDACTED]", {}, true);
  }

  isNoop(): boolean {
    return this.#noop;
  }

  getClassifierOptions(): SecretEnvClassifierOptions {
    return this.#classifierOptions;
  }

  redact(text: string): string {
    if (this.isNoop()) return text;
    let out = text;
    for (const value of this.#orderedValues) {
      if (out.includes(value)) {
        out = out.split(value).join(this.#marker);
      }
    }
    out = redactNameValueForms(out, this.#classifierOptions, this.#marker);
    if (!this.#anyValueStillVisible(out)) return out;
    let stripped = stripAnsi(out);
    for (const value of this.#orderedValues) {
      if (stripped.includes(value)) {
        stripped = stripped.split(value).join(this.#marker);
      }
    }
    stripped = redactNameValueForms(stripped, this.#classifierOptions, this.#marker);
    return stripped;
  }

  #anyValueStillVisible(text: string): boolean {
    if (this.#orderedValues.length === 0) return false;
    const stripped = stripAnsi(text);
    for (const value of this.#orderedValues) {
      if (stripped.includes(value)) return true;
    }
    return false;
  }

  /**
   * Redact over a Buffer via UTF-8 round-trip. Callers that pass binary
   * data MUST gate this behind a content-type check - redacting
   * arbitrary bytes as UTF-8 will mangle non-text content.
   */
  redactBuffer(buf: Buffer): Buffer {
    if (this.isNoop()) return buf;
    const text = buf.toString("utf8");
    const redacted = this.redact(text);
    if (redacted === text) return buf;
    return Buffer.from(redacted, "utf8");
  }
}

/**
 * ANSI CSI / OSC / ESC control-sequence stripper. We remove these
 * before matching so a secret split across a color escape still gets
 * caught, and so the marker output is clean text for the LLM.
 */
const ANSI_PATTERN =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences require literal control bytes.
  /\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1B]*(?:\x07|\x1B\\)|\]|\(.|\).|[@-Z\\_])/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

/**
 * Match any shell-style NAME=value occurrence (with or without a
 * surrounding declare / export prefix) and ask the classifier per name.
 * A name must be preceded by a word boundary (`\b`) so `FOO_KEY` inside
 * `SNEAKY_FOO_KEY` does not match.
 *
 * Value body is either:
 *   - double-quoted up to the next unescaped double quote or newline
 *   - single-quoted up to the next single quote or newline
 *   - otherwise bare: any run of characters that is not whitespace /
 *     newline / statement separator / closing bracket-like delimiter.
 */
const NAME_VALUE_PATTERN =
  /\b([A-Z][A-Z0-9_]*)=(?:"((?:\\.|[^"\\\n])*)"|'([^'\n]*)'|([^\s\n;&|)`'"}\]]*))/g;
function redactNameValueForms(
  text: string,
  classifierOptions: SecretEnvClassifierOptions,
  marker: string,
): string {
  return text.replace(NAME_VALUE_PATTERN, (match, name: string) => {
    if (!isSecretEnvName(name, classifierOptions)) return match;
    return `${name}=${marker}`;
  });
}
