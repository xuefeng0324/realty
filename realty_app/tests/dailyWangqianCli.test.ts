import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const APP_ROOT = process.cwd();
const PYTHON = process.env.PYTHON || "python";

describe("daily wangqian CLI merge semantics", () => {
  it("default and hidden --merge preserve history while --no-merge rewrites the window", () => {
    const probe = [
      "import json, tempfile",
      "from pathlib import Path",
      "import scripts.crawl_daily_wangqian as crawler",
      "row = crawler.Row",
      "old = row('2026-07-31', '深圳', '二手', '住宅', '全市', 10, 900.0, 'city', 'old')",
      "same_day = row('2026-08-01', '深圳', '二手', '住宅', '全市', 20, 1800.0, 'city', 'fresh')",
      "newer = row('2026-08-02', '深圳', '二手', '住宅', '全市', 30, 2700.0, 'city', 'fresh')",
      "crawler._session = lambda: object()",
      "crawler.fetch_shenzhen = lambda _session, _days: [same_day, newer]",
      "result = {}",
      "with tempfile.TemporaryDirectory() as temp_dir:",
      "    out = Path(temp_dir) / 'daily.csv'",
      "    for name, extra in [('default', []), ('legacy_merge', ['--merge']), ('rewrite', ['--no-merge'])]:",
      "        crawler.write_csv(out, [old])",
      "        args = crawler.build_parser().parse_args(['fetch', '--city', '深圳', '--out', str(out), *extra])",
      "        code = args.func(args)",
      "        rows = crawler.read_existing(out)",
      "        result[name] = {'code': code, 'dates': [item.date for item in rows]}",
      "print(json.dumps(result, ensure_ascii=False))"
    ].join("\n");

    const run = spawnSync(PYTHON, ["-c", probe], {
      cwd: resolve(APP_ROOT),
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
    });

    expect(run.status, run.stderr).toBe(0);
    const result = JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1) ?? "{}") as Record<
      string,
      { code: number; dates: string[] }
    >;
    expect(result.default).toEqual({
      code: 0,
      dates: ["2026-07-31", "2026-08-01", "2026-08-02"]
    });
    expect(result.legacy_merge).toEqual(result.default);
    expect(result.rewrite).toEqual({
      code: 0,
      dates: ["2026-08-01", "2026-08-02"]
    });
  });
});
