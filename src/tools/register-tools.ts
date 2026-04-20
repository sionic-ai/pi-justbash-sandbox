import {
  createBashToolDefinition,
  createEditToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { BashAdapter } from "../adapters/bash-adapter.js";
import { EditAdapter } from "../adapters/edit-adapter.js";
import { ReadAdapter } from "../adapters/read-adapter.js";
import { WriteAdapter } from "../adapters/write-adapter.js";
import { createSandboxFs } from "../fs/create-sandbox-fs.js";
import type { SandboxSession } from "../session/sandbox-session.js";

/**
 * Options for {@link registerSandboxTools}.
 */
export interface RegisterSandboxToolsOptions {
  /** An already-ensured {@link SandboxSession}. */
  readonly session: SandboxSession;
  /** Override the max file read size passed to the sandbox fs. */
  readonly maxFileReadSize?: number;
}

/**
 * Register the sandboxed replacements for the built-in pi-mono tools
 * (`bash`, `read`, `write`, `edit`) on the given {@link ExtensionAPI}.
 *
 * pi-mono's `ExtensionRunner` applies a first-registration-wins rule per
 * tool name, so calling this during extension factory initialization
 * shadows the host-touching defaults with sandbox-bound equivalents.
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

  api.registerTool(createBashToolDefinition(root, { operations: bash }));
  api.registerTool(createReadToolDefinition(root, { operations: read }));
  api.registerTool(createWriteToolDefinition(root, { operations: write }));
  api.registerTool(createEditToolDefinition(root, { operations: edit }));
}
