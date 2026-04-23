export function detectImageMagic(bytes) {
    if (bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a) {
        return "image/png";
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
    }
    if (bytes.length >= 6 &&
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) &&
        bytes[5] === 0x61) {
        return "image/gif";
    }
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50) {
        return "image/webp";
    }
    return null;
}
/**
 * Heuristic check for binary content beyond known image formats. A
 * buffer is deemed binary if it contains a NUL byte in the first 4 KiB
 * - a common signal used by `file(1)` / git - or if known image magic
 * bytes match. Used to skip UTF-8 redaction over content that would
 * otherwise be silently corrupted by the round-trip.
 */
export function looksBinary(bytes) {
    if (detectImageMagic(bytes) !== null)
        return true;
    const scan = Math.min(bytes.length, 4096);
    for (let i = 0; i < scan; i++) {
        if (bytes[i] === 0x00)
            return true;
    }
    return false;
}
//# sourceMappingURL=detect-content-type.js.map