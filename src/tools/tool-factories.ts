/**
 * Shape of the four tool-definition factory functions this extension
 * needs to bind sandboxed `bash`/`read`/`write`/`edit` tools.
 *
 * Host runtimes expose the same public surface for these factories, so the
 * rest of the codebase can stay agnostic about which runtime is active by
 * accepting a `ToolFactories` parameter and letting each entry file provide the
 * concrete implementation via its own static imports.
 *
 * Using a structural interface means there is no runtime dependency on
 * any host module here — entry files wire the binding, so the compiled
 * `register-tools.js` contains no import of host-specific modules.
 */
export interface ToolFactories {
  // biome-ignore lint/suspicious/noExplicitAny: factory signatures vary slightly between host forks; structural typing is intentional
  readonly createBashToolDefinition: (...args: any[]) => unknown;
  // biome-ignore lint/suspicious/noExplicitAny: see note above
  readonly createReadToolDefinition: (...args: any[]) => unknown;
  // biome-ignore lint/suspicious/noExplicitAny: see note above
  readonly createWriteToolDefinition: (...args: any[]) => unknown;
  // biome-ignore lint/suspicious/noExplicitAny: see note above
  readonly createEditToolDefinition: (...args: any[]) => unknown;
}
