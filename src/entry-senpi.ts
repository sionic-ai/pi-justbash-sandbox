import {
  createBashToolDefinition,
  createEditToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
} from "@code-yeongyu/senpi";
import { createExtensionFactory } from "./extension-factory.js";

/**
 * pi-mono `ExtensionFactory` entry bound to the
 * `@code-yeongyu/senpi` fork.
 *
 * Loaded by senpi via `package.json#pi.extensions` when the host runtime
 * resolves `@code-yeongyu/senpi` successfully. Under the canonical
 * `@mariozechner/pi-coding-agent` host, jiti's virtualModules alias for
 * `@code-yeongyu/senpi` is absent and the host loader silently skips
 * this entry, letting `entry-pi.js` take over.
 */
export default createExtensionFactory({
  createBashToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  createEditToolDefinition,
});
