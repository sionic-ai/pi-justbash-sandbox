import { describe, expect, it } from "vitest";

describe("vitest smoke", () => {
  it("runs a trivial assertion", () => {
    // given
    const value = 1 + 1;

    // when
    const result = value;

    // then
    expect(result).toBe(2);
  });
});
