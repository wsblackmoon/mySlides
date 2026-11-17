#!/usr/bin/env python3
"""采集新西兰各银行定存利率 → nz-rates/data/rates.json(用法见 CLAUDE.md「新西兰存款利率」)。

  python3 tools/nz-rates-scrape.py            # 采集并写入
  python3 tools/nz-rates-scrape.py --check    # 只采集和校验,不写文件

数据来自 termdepositrates.co.nz 的普通定存总表和 PIE 定存表(公开页面,各一天请求一次)。只取利率数字、评级、起存额这些事实数据。
普通定存校验不通过时以非零状态退出且不改动任何文件,页面继续显示上一份正常数据。
PIE 表采集失败时沿用上一份 PIE 数据并打印警告,不影响普通定存更新。
只用标准库,方便在 GitHub Actions 里直接跑。
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

SOURCE = "https://www.termdepositrates.co.nz/"
SOURCE_PIE = "https://www.termdepositrates.co.nz/pie-term-deposit-rates"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "nz-rates" / "data" / "rates.json"
HISTORY = ROOT / "nz-rates" / "data" / "history.jsonl"

# 银行分组(页面上银行统一显示英文名);没列出的归入 other
GROUPS = {
    "ANZ": "big4", "ASB": "big4", "BNZ": "big4", "Westpac": "big4",
    "Bank of China": "cn", "China Construction Bank": "cn", "ICBC": "cn",
}
NOTES = {"Bank of Baroda Freedom 60": "年长客户专属产品,年龄条件以银行为准"}


def term_months(label):
    m = re.match(r"(\d+)\s*(month|mth|year)", label.strip().lower())
    if not m:
        raise ValueError(f"无法识别的期限: {label!r}")
    n = int(m.group(1))
    return n * 12 if m.group(2) == "year" else n


class RateTable(HTMLParser):
    """解析带 data-rates-table 的总表:表头 th[data-sort-term],每行 tr[data-bank],每格 td[data-rate]。"""

    def __init__(self):
        super().__init__()
        self.in_table = False
        self.depth = 0
        self.terms = []
        self.rows = []
        self.row = None
        self.in_info = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table" and not self.in_table and not self.rows:
            self.in_table = True
        if not self.in_table:
            return
        if tag == "th" and "data-sort-term" in a:
            self.terms.append(term_months(a["data-sort-term"]))
        elif tag == "tr" and "data-bank" in a:
            self.row = {"name": a["data-bank"].strip().rstrip("."), "info": "", "rates": []}
        elif tag == "td" and self.row is not None:
            if "data-rate" in a:
                self.in_info = False
                self.row["rates"].append(float(a["data-rate"]))
            else:
                self.in_info = True

    def handle_endtag(self, tag):
        if not self.in_table:
            return
        if tag == "td":
            self.in_info = False
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        elif tag == "table":
            self.in_table = False

    def handle_data(self, data):
        if self.row is not None and self.in_info:
            self.row["info"] += " " + data


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; wsblackmoon-nz-rates/1.0; +https://wsblackmoon.github.io/mySlides/nz-rates/)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def parse(html):
    p = RateTable()
    p.feed(html)
    terms = p.terms
    banks = []
    for row in p.rows:
        info = re.sub(r"\s+", " ", row["info"])
        rating = re.search(r"Rating:\s*([A-Za-z0-9+\-]+)", info)
        mind = re.search(r"Min Deposit:\s*\$([\d,]+)", info)
        if len(row["rates"]) != len(terms):
            raise ValueError(f"{row['name']} 的列数({len(row['rates'])})与表头({len(terms)})不一致")
        bank = {
            "name": row["name"], "group": GROUPS.get(row["name"], "other"),
            "rating": rating.group(1) if rating else None,
            "min_deposit": int(mind.group(1).replace(",", "")) if mind else None,
            # 源表用 0 表示「该期限不提供」
            "rates": {str(m): r for m, r in sorted(zip(terms, row["rates"])) if r > 0},
        }
        if row["name"] in NOTES:
            bank["note"] = NOTES[row["name"]]
        banks.append(bank)
    m = re.search(r"Last updated:\s*([A-Za-z]+ \d{1,2}, \d{4}) at (\d{1,2}:\d{2} [AP]M)", html)
    if not m:
        raise ValueError("页面上找不到 Last updated 时间")
    updated = datetime.strptime(f"{m.group(1)} {m.group(2)}", "%B %d, %Y %I:%M %p").replace(tzinfo=ZoneInfo("Pacific/Auckland"))
    return sorted(terms), banks, updated


def validate(terms, banks, prev, min_banks=12, min_terms=6):
    errs = []
    if len(banks) < min_banks:
        errs.append(f"银行数只有 {len(banks)}(应不少于 {min_banks})")
    if len(terms) < 8 or len(set(terms)) != len(terms):
        errs.append(f"期限列异常: {terms}")
    cells = 0
    for b in banks:
        if len(b["rates"]) < min_terms:
            errs.append(f"{b['name']} 只有 {len(b['rates'])} 个期限有利率")
        for m, r in b["rates"].items():
            cells += 1
            if not 0.1 <= r <= 15:
                errs.append(f"{b['name']} {m} 个月利率 {r}% 超出合理范围")
    if prev:  # 与上一份比:单日大面积剧烈变动多半是页面改版或解析错位
        old = {b["name"]: b["rates"] for b in (prev or {}).get("banks", [])}
        jumps = sum(1 for b in banks for m, r in b["rates"].items() if m in old.get(b["name"], {}) and abs(r - old[b["name"]][m]) > 1.5)
        if cells and jumps / cells > 0.3:
            errs.append(f"{jumps}/{cells} 个利率单日变动超过 1.5 个百分点")
    return errs


def scrape_pie(prev, ratings):
    """PIE 表:结构与总表相同,但没有评级列(评级取自总表同名银行)。失败时返回上一份数据。"""
    old = (prev or {}).get("pie")
    try:
        terms, banks, updated = parse(fetch(SOURCE_PIE))
        for b in banks:
            b["rating"] = ratings.get(b["name"])
        errs = validate(terms, banks, old, min_banks=3, min_terms=3)
        if errs:
            raise ValueError("; ".join(errs))
        return {"source": SOURCE_PIE, "updated": updated.isoformat(timespec="minutes"), "terms": terms, "banks": banks}
    except Exception as e:  # noqa: BLE001 - PIE 是附加数据,任何失败都不该拖住主表
        print(f"::warning::PIE 利率采集失败,沿用上一份数据: {e}", file=sys.stderr)
        return old


def main():
    check_only = "--check" in sys.argv
    terms, banks, updated = parse(fetch(SOURCE))
    prev = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else None
    errs = validate(terms, banks, prev)
    if errs:
        print("校验未通过,保留原数据:\n  - " + "\n  - ".join(errs), file=sys.stderr)
        sys.exit(1)
    pie = scrape_pie(prev, {b["name"]: b["rating"] for b in banks})
    data = {
        "source": SOURCE,
        "updated": updated.isoformat(timespec="minutes"),
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "terms": terms,
        "banks": banks,
    }
    if pie:
        data["pie"] = pie
    print(f"普通定存 {len(banks)} 个产品 × {len(terms)} 个期限,源站更新于 {data['updated']}")
    if pie:
        print(f"PIE 定存 {len(pie['banks'])} 家银行 × {len(pie['terms'])} 个期限,源站更新于 {pie['updated']}")
    if check_only:
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # 除采集时间外都没变就不重写,避免每天产生只改了 fetched_at 的空提交
    same = lambda d: {k: v for k, v in (d or {}).items() if k != "fetched_at"}  # noqa: E731
    if same(prev) == same(data):
        print("数据没有变化,不改动文件")
        return
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    # 每天一行快照,给以后的利率走势用
    day = updated.date().isoformat()
    lines = HISTORY.read_text(encoding="utf-8").splitlines() if HISTORY.exists() else []
    lines = [ln for ln in lines if ln and json.loads(ln)["date"] != day]
    snap = {"date": day, "rates": {b["name"]: b["rates"] for b in banks}}
    if pie:
        snap["pie"] = {b["name"]: b["rates"] for b in pie["banks"]}
    lines.append(json.dumps(snap, ensure_ascii=False, separators=(",", ":")))
    HISTORY.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"已写入 {OUT.relative_to(ROOT)} 和 {HISTORY.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
