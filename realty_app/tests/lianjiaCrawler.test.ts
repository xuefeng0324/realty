import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd();
const PYTHON = process.env.PYTHON || "python";

function runPython(code: string) {
  return spawnSync(PYTHON, ["-c", code], {
    cwd: APP_ROOT,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
  });
}

describe("lianjia crawler contracts", () => {
  it("write_csv accepts int listing_id instead of crashing on .strip()", () => {
    const probe = [
      "import csv, io, pathlib, sys, tempfile",
      "sys.path.insert(0, 'scripts')",
      "import crawl_lianjia_listings as m",
      "out = pathlib.Path(tempfile.mkdtemp()) / 'listings.csv'",
      "m.write_csv([{'listing_id': 7, 'title': 'a'}, {'listing_id': None, 'title': 'b'}], out)",
      "rows = list(csv.DictReader(io.open(out, encoding='utf-8-sig')))",
      "print(','.join(r['listing_id'] for r in rows))"
    ].join("\n");
    const result = runPython(probe);

    expect(result.status, result.stderr).toBe(0);
    // 显式 int 保持原值；空 id 回退为行号 2（模块自身会打印 wrote ...，取最后一行）
    expect(result.stdout.trim().split(/\r?\n/).pop()).toBe("7,2");
  });

  it("stops paging a city as soon as Lianjia serves the CAPTCHA page", () => {
    const probe = [
      "import json, sys",
      "sys.path.insert(0, 'scripts')",
      "import crawl_lianjia_listings as m",
      "calls = []",
      "def fake(url, city_code):",
      "    calls.append(url)",
      "    return 200, '<html><head><title>CAPTCHA</title></head><body></body></html>'",
      "m.fetch = fake",
      "cards, new_communities = m.fetch_city('深圳', 3, delay_sec=0)",
      "print(json.dumps({'calls': len(calls), 'cards': len(cards)}))"
    ].join("\n");
    const result = runPython(probe);

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(
      result.stdout.trim().split(/\r?\n/).pop() as string
    ) as { calls: number; cards: number };
    // 第一页命中风控后立刻停止，不再请求 pg2 / pg3
    expect(payload.calls).toBe(1);
    expect(payload.cards).toBe(0);
  });
});
