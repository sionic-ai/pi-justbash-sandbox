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
 * Exact environment variable names that MUST NOT be redacted, even if
 * the segment heuristic below would otherwise classify them as secret.
 *
 * These are paths / identities / locale knobs that every shell relies on.
 * Redacting any of these would corrupt common command output
 * (`pwd`, `echo $HOME`, `ls $PATH`) and break the agent without
 * protecting any real secret.
 */
const SAFE_NAMES = new Set([
    "PATH",
    "HOME",
    "PWD",
    "OLDPWD",
    "SHELL",
    "SHLVL",
    "USER",
    "LOGNAME",
    "HOSTNAME",
    "TERM",
    "TERMINFO",
    "COLORTERM",
    "LANG",
    "LANGUAGE",
    "LC_ALL",
    "LC_CTYPE",
    "LC_MESSAGES",
    "LC_COLLATE",
    "LC_NUMERIC",
    "LC_TIME",
    "LC_MONETARY",
    "LC_PAPER",
    "LC_NAME",
    "LC_ADDRESS",
    "LC_TELEPHONE",
    "LC_MEASUREMENT",
    "LC_IDENTIFICATION",
    "TZ",
    "DISPLAY",
    "TMPDIR",
    "TEMP",
    "TMP",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_CACHE_HOME",
    "XDG_STATE_HOME",
    "XDG_RUNTIME_DIR",
    "XDG_SESSION_ID",
    "XDG_SESSION_TYPE",
    "XDG_CURRENT_DESKTOP",
    "EDITOR",
    "VISUAL",
    "PAGER",
    "MANPATH",
    "INFOPATH",
    "LD_LIBRARY_PATH",
    "DYLD_LIBRARY_PATH",
    "DYLD_FALLBACK_LIBRARY_PATH",
    "NODE_PATH",
    "PYTHONPATH",
    "CI",
    "NODE_ENV",
    "NO_COLOR",
    "FORCE_COLOR",
    "DEBUG",
    "VERBOSE",
]);
/**
 * Name segments (upper-cased, split by `_`) that mark a variable as a
 * secret. Matching is per-segment, so `DATABASE_PASSWORD` classifies as
 * secret (segment `PASSWORD`) and `PATH_CLEANUP` does not (no segment
 * hits).
 *
 * Keep this list in sync with the scenarios documented in the escape
 * report (`docs/RESEARCH.md` / sandbox escape writeup).
 */
const SECRET_SEGMENTS = new Set([
    "KEY",
    "KEYS",
    "APIKEY",
    "TOKEN",
    "TOKENS",
    "SECRET",
    "SECRETS",
    "PASSWORD",
    "PASSWORDS",
    "PASSWD",
    "PASSPHRASE",
    "CREDENTIAL",
    "CREDENTIALS",
    "CREDS",
    "AUTH",
    "AUTHORIZATION",
    "AUTHENTICATION",
    "JWT",
    "BEARER",
    "HMAC",
    "SIGNATURE",
    "SIGNING",
    "PRIVATE",
    "PRIVKEY",
    "PRIVATEKEY",
    "SSHKEY",
    "WEBHOOK",
    "COOKIE",
    "SESSION",
    "SESSIONID",
    "CSRF",
    "XSRF",
    "ACCESS",
    "REFRESH",
    "DSN",
    "PAT",
    "APIKEY",
    "LICENSE",
    "DATABASE",
    "POSTGRES",
    "POSTGRESQL",
    "MYSQL",
    "MARIADB",
    "REDIS",
    "MONGO",
    "MONGODB",
    "ELASTICSEARCH",
    "ELASTIC",
    "RABBITMQ",
    "AMQP",
    "KAFKA",
    "MEMCACHED",
    "CASSANDRA",
]);
/**
 * Specific full names that the escape report flagged as leaking even
 * though a strict segment match would disagree. Redact these by default.
 *
 * - `SSH_AUTH_SOCK`: value is a unix-socket path, but possession of the
 *   socket grants proxying of the user's SSH agent — treat as secret.
 *   (`AUTH` segment is in SECRET_SEGMENTS so this is also caught by
 *   the generic rule; listed here for documentation + safety.)
 * - `GPG_AGENT_INFO` / `GNUPGHOME`: ditto for GPG.
 */
const SECRET_EXACT_NAMES = new Set([
    "SSH_AUTH_SOCK",
    "GPG_AGENT_INFO",
    "GNUPGHOME",
    "NETRC",
    "AWS_PROFILE",
    "AWS_SESSION_TOKEN",
    "AWS_SECURITY_TOKEN",
    "DATABASE_URL",
    "DATABASE_URI",
    "DATABASE_CONNECTION",
    "DATABASE_CONNECTION_STRING",
    "DB_URL",
    "DB_URI",
    "DB_CONNECTION",
    "DB_CONNECTION_STRING",
    "POSTGRES_URL",
    "POSTGRESQL_URL",
    "PG_URL",
    "PG_CONNECTION",
    "MYSQL_URL",
    "MYSQL_CONNECTION",
    "MARIADB_URL",
    "REDIS_URL",
    "REDIS_URI",
    "REDIS_CONNECTION",
    "MONGO_URL",
    "MONGO_URI",
    "MONGODB_URL",
    "MONGODB_URI",
    "ELASTICSEARCH_URL",
    "ELASTIC_URL",
    "RABBITMQ_URL",
    "AMQP_URL",
    "KAFKA_URL",
    "CONNECTION_STRING",
    "CONNECTIONSTRING",
    "SENTRY_DSN",
    "ROLLBAR_ACCESS_TOKEN",
    "DOCKER_AUTH_CONFIG",
    "DOCKERHUB_PASSWORD",
    "NPM_TOKEN",
    "NPM_CONFIG_AUTHTOKEN",
    "GITHUB_PAT",
    "GITLAB_PAT",
    "BITBUCKET_PAT",
    "CIRCLE_TOKEN",
    "CIRCLECI_TOKEN",
    "TRAVIS_TOKEN",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_API_KEY",
    "HUGGING_FACE_HUB_TOKEN",
    "HF_TOKEN",
]);
function normalize(name) {
    return name.toUpperCase();
}
function toSet(names) {
    const set = new Set();
    if (names === undefined)
        return set;
    for (const name of names) {
        const trimmed = name.trim();
        if (trimmed.length > 0) {
            set.add(normalize(trimmed));
        }
    }
    return set;
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
export function isSecretEnvName(name, options) {
    const upper = normalize(name);
    const deny = toSet(options?.deny);
    if (deny.has(upper))
        return true;
    const allow = toSet(options?.allow);
    if (allow.has(upper))
        return false;
    if (SAFE_NAMES.has(upper))
        return false;
    if (SECRET_EXACT_NAMES.has(upper))
        return true;
    if (matchesSecretSuffix(upper))
        return true;
    const segments = upper.split(/[^A-Z0-9]+/g).filter((seg) => seg.length > 0);
    for (const segment of segments) {
        if (SECRET_SEGMENTS.has(segment))
            return true;
    }
    return false;
}
const SECRET_SUFFIXES = [
    "_CONNECTION_STRING",
    "_CONNECTIONSTRING",
    "CONNECTION_STRING",
    "_CONNECTION_URI",
    "_CONNECTION_URL",
    "_DSN",
];
function matchesSecretSuffix(upper) {
    for (const suffix of SECRET_SUFFIXES) {
        if (upper.endsWith(suffix) && upper.length > suffix.length)
            return true;
    }
    return false;
}
/**
 * Select the subset of `env` whose values should be redacted, returning
 * a name→value map. Entries without a string value (undefined in
 * `NodeJS.ProcessEnv`) are skipped because there is nothing to redact.
 */
export function selectSecretEnv(env, options) {
    const out = new Map();
    for (const [name, value] of Object.entries(env)) {
        if (typeof value !== "string")
            continue;
        if (value.length === 0)
            continue;
        if (isSecretEnvName(name, options)) {
            out.set(name, value);
        }
    }
    return out;
}
/**
 * Strip every secret-env entry from `env` and return a new, plain
 * `Record<string, string>` containing only the non-secret values.
 *
 * Used by {@link ../adapters/host-binary-bridge.ts} to prevent host
 * binaries (e.g. `storm`) from inheriting API keys they might otherwise
 * forward over the network.
 */
export function stripSecretEnv(env, options) {
    const out = {};
    for (const [name, value] of Object.entries(env)) {
        if (typeof value !== "string")
            continue;
        if (isSecretEnvName(name, options))
            continue;
        out[name] = value;
    }
    return out;
}
//# sourceMappingURL=secret-env.js.map