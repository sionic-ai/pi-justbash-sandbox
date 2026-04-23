export declare function detectImageMagic(bytes: Uint8Array): string | null;
/**
 * Whitelist text detector. Returns true only when the buffer's prefix:
 *   - is not an image (magic-byte match),
 *   - contains no NUL bytes in the first TEXT_SAMPLE_BYTES (catches
 *     UTF-16, UTF-32, and most compiled / compressed formats), and
 *   - decodes as strict UTF-8 via `TextDecoder({ fatal: true })`.
 *
 * Before decoding we trim any dangling multibyte sequence at the sample
 * tail so a well-formed large file is not rejected by a mid-codepoint
 * truncation at the sample boundary.
 *
 * Used as the gate for UTF-8 round-trip redaction - any input that
 * fails the whitelist is returned untouched to avoid silent corruption.
 */
export declare function looksText(bytes: Uint8Array): boolean;
//# sourceMappingURL=detect-content-type.d.ts.map