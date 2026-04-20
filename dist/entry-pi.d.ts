/**
 * pi-mono `ExtensionFactory` entry bound to the canonical
 * `@mariozechner/pi-coding-agent` host.
 *
 * Loaded by pi via `package.json#pi.extensions` when the host runtime
 * resolves `@mariozechner/pi-coding-agent` successfully. Under
 * `@code-yeongyu/senpi`, jiti's virtualModules alias for
 * `@mariozechner/pi-coding-agent` is absent and the host loader silently
 * skips this entry, letting `entry-senpi.js` take over.
 */
declare const _default: (api: import("@mariozechner/pi-coding-agent").ExtensionAPI) => Promise<void>;
export default _default;
//# sourceMappingURL=entry-pi.d.ts.map