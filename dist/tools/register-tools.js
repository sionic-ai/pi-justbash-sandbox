import { BashAdapter } from "../adapters/bash-adapter.js";
import { EditAdapter } from "../adapters/edit-adapter.js";
import { ReadAdapter } from "../adapters/read-adapter.js";
import { WriteAdapter } from "../adapters/write-adapter.js";
import { createSandboxFs } from "../fs/create-sandbox-fs.js";
/**
 * Register the sandboxed replacements for the built-in pi-mono tools
 * (`bash`, `read`, `write`, `edit`) on the given {@link ExtensionAPI}.
 *
 * pi-mono's `ExtensionRunner` applies a first-registration-wins rule per
 * tool name, so calling this during extension factory initialization
 * shadows the host-touching defaults with sandbox-bound equivalents.
 *
 * @see ToolFactories
 */
export function registerSandboxTools(api, options) {
    const root = options.session.getRoot();
    const fs = createSandboxFs({
        root,
        ...(options.maxFileReadSize !== undefined ? { maxFileReadSize: options.maxFileReadSize } : {}),
    });
    const bash = new BashAdapter({
        fs,
        root,
        ...(options.network !== undefined ? { network: options.network } : {}),
        ...(options.hostBinaryBridges !== undefined
            ? { customCommands: options.hostBinaryBridges }
            : {}),
    });
    const read = new ReadAdapter({ fs, root });
    const write = new WriteAdapter({ fs, root });
    const edit = new EditAdapter({ fs, root });
    const { createBashToolDefinition, createReadToolDefinition, createWriteToolDefinition, createEditToolDefinition, } = options.factories;
    api.registerTool(createBashToolDefinition(root, { operations: bash }));
    api.registerTool(createReadToolDefinition(root, { operations: read }));
    api.registerTool(createWriteToolDefinition(root, { operations: write }));
    api.registerTool(createEditToolDefinition(root, { operations: edit }));
}
//# sourceMappingURL=register-tools.js.map