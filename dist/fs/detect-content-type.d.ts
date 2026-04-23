export declare function detectImageMagic(bytes: Uint8Array): string | null;
/**
 * Heuristic check for binary content beyond known image formats. A
 * buffer is deemed binary if it contains a NUL byte in the first 4 KiB
 * - a common signal used by `file(1)` / git - or if known image magic
 * bytes match. Used to skip UTF-8 redaction over content that would
 * otherwise be silently corrupted by the round-trip.
 */
export declare function looksBinary(bytes: Uint8Array): boolean;
//# sourceMappingURL=detect-content-type.d.ts.map