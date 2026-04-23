import path from "node:path";
import { toVirtualPath } from "../fs/sandbox-paths.js";
import { Redactor } from "../security/redactor.js";
/**
 * pi-mono {@link WriteOperations} implementation that writes through the
 * sandbox `ReadWriteFs`. `writeFile()` auto-creates missing parent
 * directories so callers don't have to pair every write with an explicit
 * mkdir; `mkdir()` is exposed so pi tools that do an explicit mkdir still
 * route through the sandbox gate.
 */
export class WriteAdapter {
    #fs;
    #root;
    #redactor;
    constructor(options) {
        this.#fs = options.fs;
        this.#root = options.root;
        this.#redactor = options.redactor ?? Redactor.noop();
    }
    async writeFile(absolutePath, content) {
        const virtualPath = toVirtualPath(this.#root, absolutePath);
        const parent = path.posix.dirname(virtualPath);
        if (parent !== "" && parent !== "/" && parent !== ".") {
            await this.#fs.mkdir(parent, { recursive: true });
        }
        const redacted = this.#redactor.isNoop() ? content : this.#redactor.redact(content);
        await this.#fs.writeFile(virtualPath, redacted);
    }
    async mkdir(dir) {
        const virtualPath = toVirtualPath(this.#root, dir);
        await this.#fs.mkdir(virtualPath, { recursive: true });
    }
}
//# sourceMappingURL=write-adapter.js.map