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
 * text. Values are sorted by descending length before replacement so a
 * value that happens to be a substring of a longer secret does not
 * corrupt the longer one's redaction. Replacement uses plain-string
 * split/join so secret values containing regex metacharacters ($, \,
 * ^, ...) are handled safely.
 */
export class Redactor {
  readonly #orderedValues: readonly string[];
  readonly #secretNames: readonly string[];
  readonly #marker: string;

  private constructor(values: readonly string[], names: readonly string[], marker: string) {
    this.#orderedValues = values;
    this.#secretNames = names;
    this.#marker = marker;
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
    const names: string[] = [];
    for (const [name, value] of Object.entries(env)) {
      if (!isSecretEnvName(name, classifierOptions)) continue;
      names.push(name);
      if (typeof value === "string" && value.length >= minLength) {
        uniqueValues.add(value);
      }
    }
    const ordered = Array.from(uniqueValues).sort((a, b) => b.length - a.length);
    return new Redactor(ordered, names, marker);
  }

  static noop(): Redactor {
    return new Redactor([], [], "[REDACTED]");
  }

  isNoop(): boolean {
    return this.#orderedValues.length === 0 && this.#secretNames.length === 0;
  }

  redact(text: string): string {
    if (this.#orderedValues.length === 0 && this.#secretNames.length === 0) {
      return text;
    }
    let out = text;
    for (const value of this.#orderedValues) {
      if (out.includes(value)) {
        out = out.split(value).join(this.#marker);
      }
    }
    if (this.#secretNames.length > 0) {
      out = redactKeyValueLines(out, this.#secretNames, this.#marker);
    }
    return out;
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

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Redact NAME=value lines as printed by env / printenv / declare -p
 * even when the value slipped past the value-based pass (empty string,
 * whitespace-only, etc.). Matches two forms:
 *   - NAME=value up to end-of-line
 *   - declare -x NAME="value" or declare -x NAME='value'
 */
function redactKeyValueLines(text: string, names: readonly string[], marker: string): string {
  if (names.length === 0) return text;
  const alternation = names.map(escapeRegex).join("|");
  const envLine = new RegExp(
    `(^|[\\n\\s;&|])(${alternation})=(?:"[^"\\n]*"|'[^'\\n]*'|[^\\s\\n;&|]*)`,
    "g",
  );
  const declareLine = new RegExp(
    `(declare\\s+-[a-zA-Z]+\\s+)(${alternation})=(?:"[^"\\n]*"|'[^'\\n]*'|\\S+)`,
    "g",
  );
  return text
    .replace(envLine, (_match, prefix: string, name: string) => `${prefix}${name}=${marker}`)
    .replace(declareLine, (_match, prefix: string, name: string) => `${prefix}${name}=${marker}`);
}
