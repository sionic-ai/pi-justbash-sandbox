import { describe, expect, it } from "vitest";
import { detectImageMagic, looksText } from "../../src/fs/detect-content-type.js";

describe("looksText", () => {
  it("accepts plain ASCII", () => {
    // given
    const bytes = new TextEncoder().encode("hello world\n");

    // when
    const result = looksText(bytes);

    // then
    expect(result).toBe(true);
  });

  it("accepts valid UTF-8 with non-ASCII codepoints", () => {
    // given
    const bytes = new TextEncoder().encode("안녕 pi 🌱 — café");

    // when
    const result = looksText(bytes);

    // then
    expect(result).toBe(true);
  });

  it("rejects PNG magic bytes", () => {
    // given
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

    // when
    const result = looksText(bytes);

    // then
    expect(result).toBe(false);
  });

  it("rejects UTF-16 text (every other byte is NUL)", () => {
    // given
    const bytes = new Uint8Array([0x68, 0x00, 0x69, 0x00, 0x0a, 0x00]);

    // when
    const result = looksText(bytes);

    // then
    expect(result).toBe(false);
  });

  it("rejects invalid UTF-8 byte sequences", () => {
    // given
    const bytes = new Uint8Array([0x68, 0x69, 0xff, 0xfe, 0x68]);

    // when
    const result = looksText(bytes);

    // then
    expect(result).toBe(false);
  });

  it("rejects content that embeds a NUL byte later in the first 4 KiB", () => {
    // given
    const prefix = new TextEncoder().encode("text leading text ");
    const suffix = new Uint8Array([0x00, 0x01, 0x02]);
    const bytes = new Uint8Array(prefix.length + suffix.length);
    bytes.set(prefix, 0);
    bytes.set(suffix, prefix.length);

    // when
    const result = looksText(bytes);

    // then
    expect(result).toBe(false);
  });

  it("accepts a long UTF-8 file truncated mid-codepoint at the sample boundary", () => {
    // given
    const chunk = new TextEncoder().encode("안녕안녕 ".repeat(1024));
    const bytes = chunk.subarray(0, 8192);

    // when
    const result = looksText(bytes);

    // then
    expect(result).toBe(true);
  });

  it("detectImageMagic still identifies JPEG", () => {
    // given
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);

    // when
    const mime = detectImageMagic(bytes);

    // then
    expect(mime).toBe("image/jpeg");
  });
});
