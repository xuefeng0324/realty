import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("dashboard visual system", () => {
  it("uses a centered content width and shared surface tokens", () => {
    const app = read("src/App.vue");
    expect(app).toContain("max-width: 1180px");
    expect(app).toContain("--shadow-card:");
    expect(app).toContain("radial-gradient");
  });

  it("uses a four-column desktop metric grid while retaining mobile wrapping", () => {
    const dashboard = read("src/pages/dashboard/dashboard.vue");
    expect(dashboard).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(dashboard).toContain("class=\"card filter-card\"");
    expect(dashboard).toContain("官方与公开数据");
    expect(dashboard).toContain("data-home-entry");
    expect(dashboard).toContain("data-home-kingkong");
  });
});
