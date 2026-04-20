import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BashAdapter } from "../adapters/bash-adapter.js";
import { EditAdapter } from "../adapters/edit-adapter.js";
import { ReadAdapter } from "../adapters/read-adapter.js";
import { WriteAdapter } from "../adapters/write-adapter.js";
import { createSandboxFs } from "../fs/create-sandbox-fs.js";
import type { SandboxSession } from "../session/sandbox-session.js";
import type { ToolFactories } from "./tool-factories.js";

/**
 * Options for {@link registerSandboxTools}.
 */
export interface RegisterSandboxToolsOptions {
  /** An already-ensured {@link SandboxSession}. */
  readonly session: SandboxSession;
  /** Override the max file read size passed to the sandbox fs. */
  readonly maxFileReadSize?: number;
  /**
   * Host-specific `create{Bash,Read,Write,Edit}ToolDefinition` factories.
   *
   * Provided by the active entry file (`entry-pi.ts` or
   * `entry-senpi.ts`) so this module carries no hard import of either
   * host package. Only the `ExtensionAPI` type comes from
   * `@mariozechner/pi-coding-agent` and is erased at runtime.
   */
  readonly factories: ToolFactories;
}

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
export function registerSandboxTools(
  api: ExtensionAPI,
  options: RegisterSandboxToolsOptions,
): void {
  const root = options.session.getRoot();
  const fs = createSandboxFs({
    root,
    ...(options.maxFileReadSize !== undefined ? { maxFileReadSize: options.maxFileReadSize } : {}),
  });

  const bash = new BashAdapter({ fs, root });
  const read = new ReadAdapter({ fs, root });
  const write = new WriteAdapter({ fs, root });
  const edit = new EditAdapter({ fs, root });

  const {
    createBashToolDefinition,
    createReadToolDefinition,
    createWriteToolDefinition,
    createEditToolDefinition,
  } = options.factories;

  type RegisterableTool = Parameters<typeof api.registerTool>[0];
  api.registerTool(createBashToolDefinition(root, { operations: bash }) as RegisterableTool);
  api.registerTool(createReadToolDefinition(root, { operations: read }) as RegisterableTool);
  api.registerTool(createWriteToolDefinition(root, { operations: write }) as RegisterableTool);
  api.registerTool(createEditToolDefinition(root, { operations: edit }) as RegisterableTool);
}
