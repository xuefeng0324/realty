"""审计覆盖式爬虫（v4 - 识别 if not rows: return 防护）"""
import re, pathlib

ROOT = pathlib.Path(r'E:\github\application\realty')
SCRIPTS = ROOT / 'realty_app' / 'scripts'
STATIC = ROOT / 'realty_app' / 'static'

def csv_lines(p):
    try:
        return len(p.read_bytes().splitlines())
    except Exception:
        return 0

def classify(body):
    has_merge_fn = bool(re.search(r"def (read_existing|merge_rows)\s*\(", body))
    has_csv_read = bool(re.search(r"csv\.DictReader|csv\.reader", body))
    has_dict_update = bool(re.search(r"\bmerged\b.*=.*\{|\bmerged\[", body))
    has_out_exists_check = bool(re.search(r"(if|elif)\s+(OUT|out|path|args\.out|csv_path)\.exists\(\)", body))
    has_inline_merge = has_csv_read and has_dict_update and has_out_exists_check

    has_append = bool(re.search(r"open\([^)]*['\"]a['\"]", body))
    has_atomic = bool(re.search(r"NamedTemporaryFile|tmp_path\.replace", body))
    has_overwrite = bool(re.search(r"open\([^)]*['\"]w['\"]", body))

    # refuse-guard: rows 空时不写
    has_refuse = bool(re.search(
        r"(if\s+not\s+rows?|if\s+len\(rows?\)\s*[<=])", body
    )) and bool(re.search(r"return\s+\d+", body))

    if has_merge_fn or has_inline_merge:
        return "merge"
    if has_append:
        return "append"
    if has_atomic and has_refuse:
        return "atomic-refuse"
    if has_atomic:
        return "atomic-overwrite"
    if has_overwrite:
        return "overwrite"
    return "?"

results = []
for p in sorted(SCRIPTS.glob('crawl_*.py')):
    name = p.name
    if name == 'crawl_common.py':
        continue
    body = p.read_text(encoding='utf-8', errors='replace')

    m = re.search(r'OUT\s*=\s*(?:REPO_ROOT|ROOT)\s*/\s*[\'"]static[\'"]\s*/\s*[\'"](\S+\.csv)[\'"]', body)
    if not m:
        m = re.search(r'DEFAULT_OUT\s*=\s*(?:REPO_ROOT|ROOT)\s*/\s*[\'"]static[\'"]\s*/\s*[\'"](\S+\.csv)[\'"]', body)
    if not m:
        continue
    csv_rel = m.group(1)
    csv_path = STATIC / csv_rel
    if not csv_path.exists():
        continue

    head_lines = csv_lines(csv_path)
    mode = classify(body)
    results.append((name, csv_rel, head_lines, mode))

out = pathlib.Path(r'C:\Users\Admin\AppData\Local\Temp\audit_overwrite.txt')
lines = [f"{'flag':<3} {'script':<40} {'csv':<32} {'HEAD':>5} {'mode':<16}", '-' * 100]
risky = 0
for name, csv, ln, mode in results:
    flag = '!!!' if mode == 'atomic-overwrite' and ln > 10 else '   '
    if flag == '!!!':
        risky += 1
    lines.append(f"{flag:<3} {name:<38} {csv:<32} {ln:>5} {mode:<16}")
lines.append("")
lines.append(f"!! REAL risky (atomic-overwrite + HEAD>10 + no refuse-guard): {risky}")
out.write_text('\n'.join(lines), encoding='utf-8')
print(f"wrote {out}; risky={risky}")