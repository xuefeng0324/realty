"""统计仓库里各城市数据源数量，找出重点关注城市。"""
import csv, pathlib, re
from collections import Counter

ROOT = pathlib.Path(r'E:\github\application\realty\realty_app\static')

def has_city(rows, name_col=0):
    return name_col

# 扫描所有 csv 的列头找 city / 城市 / city_id / city 列
city_counter: Counter = Counter()
file_counter: Counter = Counter()

for csv_path in sorted(ROOT.rglob('*.csv')):
    try:
        with open(csv_path, encoding='utf-8-sig', newline='') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            # 优先 city 列；否则找包含 city / 城市 的列
            city_col = None
            for cand in ('city', 'city_id', '城市', 'city_name'):
                if cand in headers:
                    city_col = cand
                    break
            if not city_col:
                continue
            n = 0
            for row in reader:
                val = (row.get(city_col) or '').strip()
                if val:
                    city_counter[val] += 1
                    n += 1
            if n > 0:
                file_counter[csv_path.name] = (city_col, n)
    except Exception as e:
        pass

# 输出
out = pathlib.Path(r'C:\Users\Admin\AppData\Local\Temp\city_audit.txt')
buf = []
buf.append(f"city distribution across {len(file_counter)} csv files")
buf.append("=" * 80)
for city, cnt in city_counter.most_common(20):
    files = [f for f, (col, n) in file_counter.items() if city in ['']]
    buf.append(f"  {city:<20} {cnt:>5} 行")

buf.append("")
buf.append("by file (only files that have a city column)")
buf.append("-" * 80)
for fname, (col, n) in sorted(file_counter.items()):
    buf.append(f"  {fname:<40} col={col:<10} {n} rows")

out.write_text('\n'.join(buf), encoding='utf-8')
print(f"wrote {out}; total rows tagged by city: {sum(city_counter.values())}")