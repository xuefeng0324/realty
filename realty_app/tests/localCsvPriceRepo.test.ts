import { describe, expect, it } from "vitest";
import { parseCSV, rowsToObjects } from "../src/local/csv";
import {
  loadRepoFixingFromCSV,
  __setRepoFixingForTest,
  getRepoFixing,
  getLatestRepoFixing,
  getRepoFixingDeltaVsPrev,
  type RepoFixingRow
} from "../src/local/repoFixing";

/**
 * 2 个 src/local/ 文件合并测试（csv / repoFixing）：
 *  - csv.ts (76 行)：parseCSV 边界 + rowsToObjects
 *  - repoFixing.ts (82 行)：mapRow 过滤 + 排序 + delta 计算
 *
 * 合计 25 个用例覆盖。
 * （priceSemantics.ts 已于 v1.123.30 退役，其三轴标签/禁用词单测一并删除，
 *  只保留 tests/priceSemantics.test.ts 里的 3 条源码文案门禁。）
 */
describe("local/csv", () => {
  describe("parseCSV", () => {
    it("简单 3 行 2 列", () => {
      expect(parseCSV("a,b\nc,d\ne,f")).toEqual([
        ["a", "b"],
        ["c", "d"],
        ["e", "f"]
      ]);
    });

    it("去掉 UTF-8 BOM（\\ufeff）", () => {
      const result = parseCSV("\ufeffcity_id,city_name\n1,深圳");
      // header 应该是 "city_id" 而不是 "\ufeffcity_id"
      expect(result[0][0]).toBe("city_id");
      expect(result[1][0]).toBe("1");
    });

    it("CRLF（\\r\\n）行尾正确处理", () => {
      expect(parseCSV("a,b\r\nc,d\r\n")).toEqual([
        ["a", "b"],
        ["c", "d"]
      ]);
    });

    it("单独 CR（\\r）当行尾", () => {
      expect(parseCSV("a,b\rc,d")).toEqual([
        ["a", "b"],
        ["c", "d"]
      ]);
    });

    it("引号包含逗号", () => {
      expect(parseCSV('name\n"hello,world"')).toEqual([
        ["name"],
        ["hello,world"]
      ]);
    });

    it("引号包含换行", () => {
      expect(parseCSV('name\n"line1\nline2"')).toEqual([
        ["name"],
        ["line1\nline2"]
      ]);
    });

    it("双引号转义（\"\" → \"）", () => {
      expect(parseCSV('name\n"he said ""hi"""')).toEqual([
        ["name"],
        ['he said "hi"']
      ]);
    });

    it("末尾字段无换行也能解析", () => {
      expect(parseCSV("a,b")).toEqual([["a", "b"]]);
    });

    it("末尾空行不产生空行 row", () => {
      expect(parseCSV("a,b\nc,d\n")).toEqual([
        ["a", "b"],
        ["c", "d"]
      ]);
    });

    it("单行单字段（row.length=1 → 跳过）", () => {
      // source: `if (row.length > 1 || row[0] !== "") rows.push(row);`
      // 单行 [""a] row.length=1 && row[0]!="" → 保留
      expect(parseCSV("a\n")).toEqual([["a"]]);
    });

    it("空字符串 → 空数组", () => {
      expect(parseCSV("")).toEqual([]);
    });
  });

  describe("rowsToObjects", () => {
    it("rows<2 → 空数组", () => {
      expect(rowsToObjects([])).toEqual([]);
      expect(rowsToObjects([["a", "b"]])).toEqual([]);
    });

    it("rows[0] 是 header，slice(1) 转 objects", () => {
      const result = rowsToObjects([
        ["name", "age"],
        ["alice", "30"],
        ["bob", "25"]
      ]);
      expect(result).toEqual([
        { name: "alice", age: "30" },
        { name: "bob", age: "25" }
      ]);
    });

    it("行短于 header → 缺失字段填空字符串", () => {
      const result = rowsToObjects([
        ["a", "b", "c"],
        ["1", "2"] // 缺 c
      ] as any);
      expect(result[0]).toEqual({ a: "1", b: "2", c: "" });
    });
  });
});

describe("local/repoFixing", () => {
  const sampleCsv = [
    "date,fr001,fr007,fr014,fdr001,fdr007,fdr014,source,source_url",
    '2026-03-15,1.5,1.8,1.9,1.5,1.8,1.9,"CFETS","https://www.chinamoney.com.cn/fix/"',
    '2026-03-14,1.4,1.7,1.85,1.4,1.7,1.85,"CFETS","https://www.chinamoney.com.cn/fix/"',
    '2026-03-13,1.6,1.9,2.0,1.6,1.9,2.0,"CFETS","https://www.chinamoney.com.cn/fix/"'
  ].join("\n");

  const invalidCsv = [
    "date,fr007,fdr007,source_url",
    'bad-date-row,2.0,2.0,https://www.chinamoney.com.cn/fix/', // 缺 date 格式
    '2026-03-15,2.0,2.0,https://wrong-domain.com/' // 缺 chinamoney.com.cn
  ].join("\n");

  function reset() {
    __setRepoFixingForTest([]);
  }

  it("loadRepoFixingFromCSV：3 行 → 排序后最新在前", () => {
    const result = loadRepoFixingFromCSV(sampleCsv);
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe("2026-03-15");
    expect(result[1].date).toBe("2026-03-14");
    expect(result[2].date).toBe("2026-03-13");
  });

  it("mapRow 过滤：日期格式错误 → 跳过", () => {
    const result = loadRepoFixingFromCSV(invalidCsv);
    expect(result).toHaveLength(0);
  });

  it("mapRow 过滤：source_url 不含 chinamoney.com.cn → 跳过", () => {
    const csv = 'date,fr007,fdr007,source_url\n2026-03-15,2.0,2.0,https://wrong.com/';
    expect(loadRepoFixingFromCSV(csv)).toHaveLength(0);
  });

  it("mapRow 过滤：fr007=0 && fdr007=0 → 跳过", () => {
    const csv = 'date,fr007,fdr007,source_url\n2026-03-15,0,0,https://www.chinamoney.com.cn/fix/';
    expect(loadRepoFixingFromCSV(csv)).toHaveLength(0);
  });

  it("n() 处理带千位逗号的字符串", () => {
    // 直接测 n() 不能；用 loadRepoFixingFromCSV 间接测
    const csv = 'date,fr007,fdr007,source_url\n2026-03-15,"1,234.5","2,000",https://www.chinamoney.com.cn/fix/';
    const result = loadRepoFixingFromCSV(csv);
    expect(result[0].fr007).toBe(1234.5);
    expect(result[0].fdr007).toBe(2000);
  });

  describe("getRepoFixing / getLatestRepoFixing / getRepoFixingDeltaVsPrev", () => {
    it("getRepoFixing 返拷贝（外部修改不影响内部）", () => {
      reset();
      const rows = loadRepoFixingFromCSV(sampleCsv);
      __setRepoFixingForTest(rows);
      const a = getRepoFixing();
      a.push({} as RepoFixingRow);
      expect(getRepoFixing()).toHaveLength(3);
    });

    it("getLatestRepoFixing 返最新（rows[0]）", () => {
      reset();
      __setRepoFixingForTest(loadRepoFixingFromCSV(sampleCsv));
      const latest = getLatestRepoFixing();
      expect(latest?.date).toBe("2026-03-15");
    });

    it("getRepoFixingDeltaVsPrev：2 行时返 prev + pp 差", () => {
      reset();
      const rows = loadRepoFixingFromCSV([
        "date,fr007,fdr007,source_url",
        '2026-03-15,1.8,1.9,https://www.chinamoney.com.cn/fix/',
        '2026-03-14,1.6,1.7,https://www.chinamoney.com.cn/fix/'
      ].join("\n"));
      __setRepoFixingForTest(rows);
      const delta = getRepoFixingDeltaVsPrev();
      expect(delta).not.toBe(null);
      expect(delta!.prev.date).toBe("2026-03-14");
      expect(delta!.fr007DeltaPp).toBe(0.2); // 1.8 - 1.6
      expect(delta!.fdr007DeltaPp).toBe(0.2); // 1.9 - 1.7
    });

    it("getRepoFixingDeltaVsPrev：<2 行时返 null", () => {
      reset();
      expect(getRepoFixingDeltaVsPrev()).toBe(null);
      const oneRow = loadRepoFixingFromCSV([
        "date,fr007,fdr007,source_url",
        '2026-03-15,1.8,1.9,https://www.chinamoney.com.cn/fix/'
      ].join("\n"));
      __setRepoFixingForTest(oneRow);
      expect(getRepoFixingDeltaVsPrev()).toBe(null);
    });

    it("getRepoFixingDeltaVsPrev：pp 精度到 0.0001（极小差异被四舍五入到 0）", () => {
      reset();
      const rows = loadRepoFixingFromCSV([
        "date,fr007,fdr007,source_url",
        '2026-03-15,1.82345,1.9,https://www.chinamoney.com.cn/fix/',
        '2026-03-14,1.82344,1.7,https://www.chinamoney.com.cn/fix/'
      ].join("\n"));
      __setRepoFixingForTest(rows);
      const delta = getRepoFixingDeltaVsPrev();
      // 0.00001 * 10000 = 0.1 → Math.round(0.1) = 0 → 0 / 10000 = 0
      // 极小差异会被四舍五入到 0
      expect(delta!.fr007DeltaPp).toBe(0);
    });

    it("getRepoFixingDeltaVsPrev：pp 精度到 0.0001（差异 ≥ 0.0001 时不丢精度）", () => {
      reset();
      const rows = loadRepoFixingFromCSV([
        "date,fr007,fdr007,source_url",
        '2026-03-15,1.8235,1.9,https://www.chinamoney.com.cn/fix/',
        '2026-03-14,1.8234,1.7,https://www.chinamoney.com.cn/fix/'
      ].join("\n"));
      __setRepoFixingForTest(rows);
      const delta = getRepoFixingDeltaVsPrev();
      // 0.0001 * 10000 = 1 → Math.round(1) = 1 → 1 / 10000 = 0.0001
      expect(delta!.fr007DeltaPp).toBe(0.0001);
    });
  });
});