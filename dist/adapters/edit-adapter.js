import path from "node:path";
import { toVirtualPath } from "../fs/sandbox-paths.js";
/**
 * pi-mono {@link EditOperations} implementation. The edit tool drives a
 * read → mutate → write flow and expects all three operations to observe
 * the same fs. By delegating every step to the sandbox `ReadWriteFs`, the
 * diff pi computes is guaranteed to apply to the exact bytes that the
 * read returned.
 */
export class EditAdapter {
    #fs;
    #root;
    constructor(options) {
        this.#fs = options.fs;
        this.#root = options.root;
    }
    async readFile(absolutePath) {
        const virtualPath = toVirtualPath(this.#root, absolutePath);
        const bytes = await this.#fs.readFileBuffer(virtualPath);
        return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    async writeFile(absolutePath, content) {
        const virtualPath = toVirtualPath(this.#root, absolutePath);
        const parent = path.posix.dirname(virtualPath);
        if (parent !== "" && parent !== "/" && parent !== ".") {
            await this.#fs.mkdir(parent, { recursive: true });
        }
        await this.#fs.writeFile(virtualPath, content);
    }
    async access(absolutePath) {
        const virtualPath = toVirtualPath(this.#root, absolutePath);
        const exists = await this.#fs.exists(virtualPath);
        if (!exists) {
            const err = new Error(`ENOENT: no such file or directory, ${absolutePath}`);
            err.code = "ENOENT";
            throw err;
        }
    }
}
//# sourceMappingURL=edit-adapter.js.map