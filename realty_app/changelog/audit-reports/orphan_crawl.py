"""检查 crawl_*.py 是否被引用"""
import re, pathlib

ROOT = pathlib.Path(r'E:\github\application\realty')
SCRIPTS = ROOT / 'realty_app' / 'scripts'
WORKFLOWS = ROOT / '.github' / 'workflows'

# 加载所有爬虫脚本名
scripts = sorted(p.name for p in SCRIPTS.glob('crawl_*.py') if p.name != 'crawl_common.py')

# 加载所有"可能引用"的文本
referenced_in: dict[str, list[str]] = {s: [] for s in scripts}

# 1) .github/workflows/*.yml
for p in WORKFLOWS.glob('*.yml'):
    txt = p.read_text(encoding='utf-8', errors='replace')
    for s in scripts:
        if s in txt:
            referenced_in[s].append(str(p.relative_to(ROOT)))

# 2) realty_app/scripts/*.py (run_*_group.py + 其它调度)
for p in SCRIPTS.glob('*.py'):
    txt = p.read_text(encoding='utf-8', errors='replace')
    for s in scripts:
        if s in txt:
            referenced_in[s].append(str(p.relative_to(ROOT)))

# 3) 排除本审计脚本自己
for s in scripts:
    if 'orphan_check' in s:
        continue

# 输出
out = pathlib.Path(r'C:\Users\Admin\AppData\Local\Temp\orphan_check.txt')
lines = [f"orphan script   (no .yml / run_*.py / scripts/*.py reference)", "-" * 80]
referenced_count = 0
orphan_count = 0
for s in scripts:
    refs = referenced_in[s]
    # 跳过 audit 自身的递归
    refs = [r for r in refs if 'orphan_check' not in r]
    if refs:
        referenced_count += 1
    else:
        orphan_count += 1
        lines.append(f"  {s}")

lines.append("")
lines.append(f"summary: orphan={orphan_count} referenced={referenced_count} total={len(scripts)}")
out.write_text('\n'.join(lines), encoding='utf-8')
print(f"wrote {out}")