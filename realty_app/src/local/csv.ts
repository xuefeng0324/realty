/**
 * 轻量 CSV 解析器。
 *
 * 设计目标：
 * - 浏览器兼容（H5 + App 都跑得起来）
 * - 支持 RFC 4180 引号转义、双引号包含逗号/换行
 * - 返回字符串二维数组，避免对类型做假设；类型转换交给 schema mapper
 */

export function parseCSV(input: string): string[][] {
  // 去掉 UTF-8 BOM（\ufeff）—— seed CSVs 是 utf-8-sig 写出来的。
  // 不去 BOM 会让 header 第一列变成 "\ufeffcity_id" 而不是 "city_id"，
  // 整张表所有匹配都失败，runtime 数据全为 null。
  if (input.length > 0 && input.charCodeAt(0) === 0xfeff) {
    input = input.slice(1);
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  // last field
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

export function rowsToObjects<T>(rows: string[][]): T[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = r[i] ?? "";
    }
    return obj as T;
  });
}