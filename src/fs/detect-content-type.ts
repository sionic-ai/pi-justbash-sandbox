export function detectImageMagic(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

const TEXT_SAMPLE_BYTES = 8192;

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
export function looksText(bytes: Uint8Array): boolean {
  if (detectImageMagic(bytes) !== null) return false;
  const limit = Math.min(bytes.length, TEXT_SAMPLE_BYTES);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0x00) return false;
  }
  const safeEnd = trimmedUtf8BoundaryEnd(bytes, limit);
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, safeEnd));
  } catch {
    return false;
  }
  return true;
}

function trimmedUtf8BoundaryEnd(bytes: Uint8Array, end: number): number {
  if (end <= 0) return 0;
  for (let i = end - 1, n = 0; i >= 0 && n < 4; i--, n++) {
    const byte = bytes[i];
    if (byte === undefined) return end;
    if ((byte & 0x80) === 0x00) return i + 1;
    if ((byte & 0xc0) === 0x80) continue;
    if ((byte & 0xe0) === 0xc0) return n >= 1 ? end : i;
    if ((byte & 0xf0) === 0xe0) return n >= 2 ? end : i;
    if ((byte & 0xf8) === 0xf0) return n >= 3 ? end : i;
    return i;
  }
  return end;
}
