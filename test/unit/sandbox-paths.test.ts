import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toVirtualPath } from "../../src/fs/sandbox-paths.js";

describe("toVirtualPath", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), "pi-justbash-test-")));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("maps a host-absolute path inside root to a virtual path", () => {
    // given
    const target = path.join(root, "sub", "dir");

    // when
    const virtualPath = toVirtualPath(root, target);

    // then
    expect(virtualPath).toBe("/sub/dir");
  });

  it("passes through an already-virtual absolute path", () => {
    // given
    const target = "/skills/foo.md";

    // when
    const virtualPath = toVirtualPath(root, target);

    // then
    expect(virtualPath).toBe("/skills/foo.md");
  });

  it("returns the virtual root for a host root path", () => {
    // given
    const target = root;

    // when
    const virtualPath = toVirtualPath(root, target);

    // then
    expect(virtualPath).toBe("/");
  });

  it("returns the virtual root for a virtual root input", () => {
    // given
    const target = "/";

    // when
    const virtualPath = toVirtualPath(root, target);

    // then
    expect(virtualPath).toBe("/");
  });

  it("normalizes a virtual path whose dot segments stay inside the virtual root", () => {
    // given
    const target = "/skills/agent/../foo.md";

    // when
    const virtualPath = toVirtualPath(root, target);

    // then
    expect(virtualPath).toBe("/skills/foo.md");
  });

  it("normalizes a virtual path whose dot segments climb above the virtual root", () => {
    // given
    const target = "/../etc/passwd";

    // when
    const virtualPath = toVirtualPath(root, target);

    // then
    expect(virtualPath).toBe("/etc/passwd");
  });

  it("treats a host-absolute path outside root as an already-virtual path", () => {
    // given
    const target = path.join(path.dirname(root), "outside.txt");

    // when
    const virtualPath = toVirtualPath(root, target);

    // then
    expect(virtualPath).toBe(target);
  });

  it("treats backslashes as literal characters on posix", () => {
    // given
    const target = "/skills\\foo.md";

    // when
    const virtualPath = toVirtualPath(root, target);

    // then
    expect(virtualPath).toBe("/skills\\foo.md");
  });

  it("strips a trailing slash from a virtual path", () => {
    // given
    const target = "/skills/foo/";

    // when
    const virtualPath = toVirtualPath(root, target);

    // then
    expect(virtualPath).toBe("/skills/foo");
  });

  it("throws SANDBOX_ESCAPE for a relative path", () => {
    // given
    const target = "skills/foo.md";

    // when
    const getVirtualPath = () => toVirtualPath(root, target);

    // then
    expect(getVirtualPath).toThrow(
      `path ${JSON.stringify(target)} escapes sandbox root ${JSON.stringify(root)}`,
    );

    try {
      getVirtualPath();
      throw new Error("expected toVirtualPath() to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "SANDBOX_ESCAPE" });
    }
  });
});
