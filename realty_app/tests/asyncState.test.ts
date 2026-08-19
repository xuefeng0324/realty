import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const COPY = {
  loading: { title: "正在加载", description: "请稍候，数据马上就好。", marker: "" },
  empty: { title: "暂时没有内容", description: "可以调整筛选条件后再试。", marker: "—" },
  error: { title: "加载失败", description: "请检查网络或稍后重试。", marker: "!" },
  offline: { title: "当前处于离线状态", description: "已优先展示本机可用的数据。", marker: "离线" },
  stale: { title: "正在显示缓存数据", description: "联网后会自动获取最新内容。", marker: "缓存" },
  refreshing: { title: "正在更新", description: "当前内容仍可继续查看。", marker: "" }
} as const;

describe("shared async state contract", () => {
  it("locks the six state names and their default copy", () => {
    const source = read("src/components/AsyncState.vue");

    for (const [status, copy] of Object.entries(COPY)) {
      expect(source, `${status} status`).toContain(`| "${status}"`);
      expect(source, `${status} copy`).toContain(
        `${status}: { title: "${copy.title}", description: "${copy.description}", marker: "${copy.marker}" }`
      );
    }

    expect(source).toContain(
      'props.status === "loading" || props.status === "refreshing"'
    );
  });

  it("PageShell blocks only loading/empty/error/offline and preserves stale content", () => {
    const source = read("src/components/PageShell.vue");
    const match = source.match(
      /const isBlocking = computed\(\(\) =>\s*\[([^\]]+)\]\.includes\(props\.state\)\s*\)/s
    );

    expect(match, "isBlocking computed").not.toBeNull();
    const blocking = Array.from(match?.[1].matchAll(/"([^"]+)"/g) ?? []).map(
      (item) => item[1]
    );
    expect(blocking).toEqual(["loading", "empty", "error", "offline"]);
    expect(blocking).not.toContain("stale");
    expect(blocking).not.toContain("refreshing");
    expect(source).toContain('v-if="state !== \'ready\'"');
    expect(source).toContain(':compact="!isBlocking"');
    expect(source).toContain('<slot v-if="!isBlocking" />');
  });
});
