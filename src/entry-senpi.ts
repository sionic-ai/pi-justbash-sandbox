/**
 * @deprecated senpi support is not yet integrated into the pi.extensions
 * manifest. This entry file is retained for future use when pi-mono's
 * extension loader can handle failed entries without exiting the entire
 * process.
 *
 * See ARCHITECTURE.md for the rationale and migration path.
 */

import {
  createBashToolDefinition,
  createEditToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
} from "@code-yeongyu/senpi";
import { createExtensionFactory } from "./extension-factory.js";

const factories = {
  createBashToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  createEditToolDefinition,
};

export default createExtensionFactory(factories);
