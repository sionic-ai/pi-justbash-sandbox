import { describe, expect, it } from "vitest";
import { isSecretEnvName } from "../../../src/security/secret-env.js";

describe("isSecretEnvName - connection strings and DSN-style secrets", () => {
  it("classifies DATABASE_URL and DB_URL variants as secret", () => {
    // given
    const names = [
      "DATABASE_URL",
      "DATABASE_URI",
      "DATABASE_CONNECTION",
      "DATABASE_CONNECTION_STRING",
      "DB_URL",
      "DB_URI",
      "DB_CONNECTION",
      "DB_CONNECTION_STRING",
    ];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === true)).toBe(true);
  });

  it("classifies SENTRY_DSN and connection-string names as secret", () => {
    // given
    const names = ["SENTRY_DSN", "CONNECTION_STRING", "CONNECTIONSTRING"];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === true)).toBe(true);
  });

  it("classifies Postgres / MySQL / Redis / Mongo / queue URLs as secret", () => {
    // given
    const names = [
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
      "RABBITMQ_URL",
      "AMQP_URL",
      "KAFKA_URL",
    ];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === true)).toBe(true);
  });

  it("classifies *_PAT personal access token names as secret", () => {
    // given
    const names = ["GITHUB_PAT", "GITLAB_PAT", "BITBUCKET_PAT"];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === true)).toBe(true);
  });

  it("classifies CI platform tokens as secret", () => {
    // given
    const names = [
      "CIRCLE_TOKEN",
      "CIRCLECI_TOKEN",
      "TRAVIS_TOKEN",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_API_KEY",
      "HUGGING_FACE_HUB_TOKEN",
      "HF_TOKEN",
    ];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === true)).toBe(true);
  });

  it("classifies *_LICENSE segment names as secret (NEW_RELIC_LICENSE_KEY / *_LICENSE_KEY)", () => {
    // given
    const names = ["NEW_RELIC_LICENSE_KEY", "DATADOG_LICENSE_KEY", "APP_LICENSE"];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === true)).toBe(true);
  });

  it("still classifies random unknown names as non-secret (fail-open)", () => {
    // given
    const names = ["MY_APP_CONFIG", "FOOTER_COLOR", "MAX_RETRIES", "FEATURE_FLAGS"];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === false)).toBe(true);
  });

  it("classifies any prefixed *_CONNECTION_STRING as secret via suffix rule", () => {
    // given
    const names = [
      "AZURE_STORAGE_CONNECTION_STRING",
      "APP_CONNECTION_STRING",
      "SERVICE_BUS_CONNECTION_STRING",
      "COSMOSDB_CONNECTIONSTRING",
    ];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === true)).toBe(true);
  });

  it("classifies any prefixed *_DSN as secret via suffix rule", () => {
    // given
    const names = ["BACKEND_DSN", "LEGACY_APP_DSN", "CUSTOM_ERR_DSN"];

    // when
    const results = names.map((n) => isSecretEnvName(n));

    // then
    expect(results.every((r) => r === true)).toBe(true);
  });
});
