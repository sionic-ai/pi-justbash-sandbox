import { createBashToolDefinition, createEditToolDefinition, createReadToolDefinition, createWriteToolDefinition, } from "@mariozechner/pi-coding-agent";
import { createExtensionFactory } from "./extension-factory.js";
/**
 * pi-mono `ExtensionFactory` entry bound to the canonical
 * `@mariozechner/pi-coding-agent` host.
 *
 * Loaded by pi via `package.json#pi.extensions` when the host runtime
 * resolves `@mariozechner/pi-coding-agent` successfully. Under
 * `@code-yeongyu/senpi`, jiti's virtualModules alias for
 * `@mariozechner/pi-coding-agent` is absent and the host loader silently
 * skips this entry, letting `entry-senpi.js` take over.
 */
export default createExtensionFactory({
    createBashToolDefinition,
    createReadToolDefinition,
    createWriteToolDefinition,
    createEditToolDefinition,
});
//# sourceMappingURL=entry-pi.js.map