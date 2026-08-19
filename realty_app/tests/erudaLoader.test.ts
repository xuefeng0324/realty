import { describe, expect, it } from "vitest";
import { shouldLoadEruda } from "../src/utils/erudaLoader";

describe("optional Eruda loader", () => {
  it("is opt-in so the floating entry cannot cover the native TabBar by default", () => {
    expect(shouldLoadEruda("")).toBe(false);
    expect(shouldLoadEruda("?city=4401")).toBe(false);
    expect(shouldLoadEruda("?eruda=0")).toBe(false);
    expect(shouldLoadEruda("?eruda=1")).toBe(true);
    expect(shouldLoadEruda("?city=4401&eruda=1")).toBe(true);
  });
});
