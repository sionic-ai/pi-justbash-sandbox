import { detectImageMagic, looksBinary } from "../fs/detect-content-type.js";
import { toVirtualPath } from "../fs/sandbox-paths.js";
import { Redactor } from "../security/redactor.js";
/**
 * pi-mono {@link ReadOperations} implementation that delegates to the
 * sandbox `ReadWriteFs`. Host-absolute paths from pi are translated to
 * virtual paths before hitting the fs gate so the sandbox's built-in
 * symlink + TOCTOU protection keeps working. Paths that escape the
 * sandbox reject with the underlying fs error.
 */
export class ReadAdapter {
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
    async access(absolutePath) {
        const virtualPath = toVirtualPath(this.#root, absolutePath);
        const exists = await this.#fs.exists(virtualPath);
        if (!exists) {
            const err = new Error(`ENOENT: no such file or directory, ${absolutePath}`);
            err.code = "ENOENT";
            throw err;
        }
    }
    async detectImageMimeType(absolutePath) {
        const virtualPath = toVirtualPath(this.#root, absolutePath);
        const bytes = await this.#fs.readFileBuffer(virtualPath);
        return detectImageMagic(bytes);
    }
}
//# sourceMappingURL=read-adapter.js.map