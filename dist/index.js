/**
 * Public entry point for `@sionic-ai/pi-justbash-sandbox`.
 *
 * Most users should not import this module directly — pi-mono loads the
 * compiled `dist/entry-pi.js` (canonical pi host) or
 * `dist/entry-senpi.js` (senpi host) automatically through
 * `package.json#pi.extensions`.
 *
 * This module re-exports the pi-bound entry as the package default so
 * that existing inline consumers (e.g. embedding via
 * `DefaultResourceLoader`) keep working:
 *
 * ```ts
 * import { DefaultResourceLoader } from "@mariozechner/pi-coding-agent";
 * import justbashSandbox from "@sionic-ai/pi-justbash-sandbox";
 *
 * const resourceLoader = new DefaultResourceLoader({
 *   extensionFactories: [justbashSandbox],
 * });
 * ```
 *
 * @see {@link ./entry-pi.ts} — the pi-bound factory this file wraps.
 * @see {@link ./entry-senpi.ts} — the senpi-bound factory (loaded in parallel).
 */
export { default } from "./entry-pi.js";
// Lower-level building blocks for custom embeddings (e.g. binding a
// different host runtime's factories).
export { createExtensionFactory } from "./extension-factory.js";
export { registerSandboxTools } from "./tools/register-tools.js";
//# sourceMappingURL=index.js.map