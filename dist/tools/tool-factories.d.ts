/**
 * Shape of the four tool-definition factory functions this extension
 * needs to bind sandboxed `bash`/`read`/`write`/`edit` tools.
 *
 * Both `@mariozechner/pi-coding-agent` (the canonical pi-mono host) and
 * `@code-yeongyu/senpi` (the code-yeongyu fork) expose the same public
 * surface for these factories, so the rest of the codebase can stay
 * agnostic about which runtime is active by accepting a `ToolFactories`
 * parameter and letting each entry file provide the concrete
 * implementation via its own static imports.
 *
 * Using a structural interface means there is no runtime dependency on
 * either module here — entry files wire the binding, so the compiled
 * `register-tools.js` contains no import of host-specific modules.
 */
export interface ToolFactories {
    readonly createBashToolDefinition: (...args: any[]) => unknown;
    readonly createReadToolDefinition: (...args: any[]) => unknown;
    readonly createWriteToolDefinition: (...args: any[]) => unknown;
    readonly createEditToolDefinition: (...args: any[]) => unknown;
}
//# sourceMappingURL=tool-factories.d.ts.map