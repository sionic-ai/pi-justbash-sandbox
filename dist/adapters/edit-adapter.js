import path from "node:path";
import { looksBinary } from "../fs/detect-content-type.js";
import { toVirtualPath } from "../fs/sandbox-paths.js";
import { Redactor } from "../security/redactor.js";
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
    #redactor;
    constructor(options) {
        this.#fs = options.fs;
        this.#root = options.root;
        this.#redactor = options.redactor ?? Redactor.noop();
    }
    async readFile(absolutePath) {
        const virtualPath = toVirtualPath(this.#root, absolutePath);
        const bytes = await this.#fs.readFileBuffer(virtualPath);
        const raw = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (this.#redactor.isNoop() || looksBinary(bytes)) {
            return raw;
        }
        return this.#redactor.redactBuffer(raw);
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