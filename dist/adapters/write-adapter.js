import path from "node:path";
import { toVirtualPath } from "../fs/sandbox-paths.js";
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
    constructor(options) {
        this.#fs = options.fs;
        this.#root = options.root;
    }
    async writeFile(absolutePath, content) {
        const virtualPath = toVirtualPath(this.#root, absolutePath);
        const parent = path.posix.dirname(virtualPath);
        if (parent !== "" && parent !== "/" && parent !== ".") {
            await this.#fs.mkdir(parent, { recursive: true });
        }
        await this.#fs.writeFile(virtualPath, content);
    }
    async mkdir(dir) {
        const virtualPath = toVirtualPath(this.#root, dir);
        await this.#fs.mkdir(virtualPath, { recursive: true });
    }
}
//# sourceMappingURL=write-adapter.js.map