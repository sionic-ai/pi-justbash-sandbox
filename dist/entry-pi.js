import { createBashToolDefinition, createEditToolDefinition, createReadToolDefinition, createWriteToolDefinition, } from "@mariozechner/pi-coding-agent";
import { createExtensionFactory } from "./extension-factory.js";
/**
 * pi-mono `ExtensionFactory` entry bound to the canonical
 * `@mariozechner/pi-coding-agent` host.
 *
 * Loaded by pi via `package.json#pi.extensions` when the host runtime
 * resolves `@mariozechner/pi-coding-agent` successfully. Other pi-compatible
 * hosts may need their own entry once pi-mono supports optional extension
 * entries without failing the whole load.
 */
export default createExtensionFactory({
    createBashToolDefinition,
    createReadToolDefinition,
    createWriteToolDefinition,
    createEditToolDefinition,
});
//# sourceMappingURL=entry-pi.js.map