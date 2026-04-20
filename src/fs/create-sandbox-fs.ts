import { ReadWriteFs, type ReadWriteFsOptions } from "just-bash";

/**
 * Options for {@link createSandboxFs}.
 */
export interface CreateSandboxFsOptions {
  /** Absolute path to the sandbox root. */
  readonly root: string;
  /**
   * Maximum file size (bytes) for read operations. Defaults to 10 MiB —
   * the same default ReadWriteFs ships with.
   */
  readonly maxFileReadSize?: number;
}

const DEFAULT_MAX_FILE_READ_SIZE = 10 * 1024 * 1024;

/**
 * Build the sandbox filesystem used by every adapter. Always constructs
 * `ReadWriteFs` with `allowSymlinks: false` to inherit the upstream
 * symlink + TOCTOU defences; callers cannot opt out.
 */
export function createSandboxFs(options: CreateSandboxFsOptions): ReadWriteFs {
  const opts: ReadWriteFsOptions = {
    root: options.root,
    allowSymlinks: false,
    maxFileReadSize: options.maxFileReadSize ?? DEFAULT_MAX_FILE_READ_SIZE,
  };
  return new ReadWriteFs(opts);
}
