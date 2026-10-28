#!/usr/bin/env python3
"""新集數檢查：每日自動更新之後，還有哪些集數需要人（或 Claude）處理。

列出：
  1. 還沒做「簡介判讀」的集數（data/episode-icon-review.json 沒有，或標題／簡介被換掉）→ 要選圖示
  2. 自動分配的集數（autoPlaced，通常掉到錄音室島）→ 要在 data/placements.json 指定島
  3. 有位置但落在錄音室（母島）的集數
  4. 沒有簡介、沒有 Apple 連結的集數
全部沒問題時結束碼是 0；有待辦就印出每一集的標題、簡介、目前位置，結束碼 1。
流程見 CLAUDE.md「新集數更新」。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))


def keys(texts: list[str]) -> list[str]:
    """用網站同一支 contentKey（episode-icons.js）算，不重寫一份。"""
    import subprocess
    out = subprocess.run(
        ["node", "-e", "import('./episode-icons.js').then(m=>{const t=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(JSON.stringify(t.map(m.contentKey)))})"],
        input=json.dumps(texts), capture_output=True, text=True, cwd=ROOT, check=True)
    return json.loads(out.stdout)


def island_of(e: dict, islands: list[dict]) -> str:
    for isl in islands:
        for src in isl["sources"]:
            if src.startswith(("era:", "lane:")) or ":" not in src:
                if e["home"] == src:
                    return isl["name"]
            else:
                h, z = src.split(":", 1)
                if e["home"] == h and e.get("zone") == z:
                    return isl["name"]
    return "（沒有對應的島，會掉到錄音室）"


def main() -> int:
    catalog = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))["episodes"]
    review = json.loads((ROOT / "data/episode-icon-review.json").read_text(encoding="utf-8"))["episodes"]
    islands = json.loads((ROOT / "data/islands.json").read_text(encoding="utf-8"))["islands"]
    todo: dict[str, list[str]] = {}

    def add(code: str, why: str) -> None:
        todo.setdefault(code, []).append(why)

    ck = dict(zip([e["code"] for e in catalog], keys([e.get("intro") or "" for e in catalog])))
    rk = dict(zip(list(review), keys([review[c]["siteIntro"] for c in review])))
    for e in catalog:
        r = review.get(e["code"])
        if not r:
            add(e["code"], "沒有簡介判讀（要選圖示）")
        elif r["title"] != e["title"] or rk[e["code"]] != ck[e["code"]]:
            add(e["code"], "標題或簡介變了，要重新判讀圖示")
        if e.get("autoPlaced"):
            add(e["code"], "自動分配的位置，要確認或在 placements.json 指定")
        elif e["home"] == "studio":
            add(e["code"], "放在錄音室（母島沒有居民），確認是不是真的要放這裡")
        if not e.get("intro"):
            add(e["code"], "沒有簡介")
        if not (e.get("listen") or {}).get("apple"):
            add(e["code"], "沒有 Apple 連結")
    by = {e["code"]: e for e in catalog}
    for code, whys in todo.items():
        e = by[code]
        print(f"\n== {code}（{'免費' if e['state'] == 'public' else 'VIP'}）{e['title']}")
        print(f"   目前在：{island_of(e, islands)}（home={e['home']} zone={e.get('zone')}）")
        print(f"   待辦：{'；'.join(whys)}")
        print(f"   簡介：{e.get('intro')}")
        print(f"   Apple：{(e.get('listen') or {}).get('apple')}")
    print(f"\n目錄 {len(catalog)} 集，待處理 {len(todo)} 集" if todo else f"目錄 {len(catalog)} 集，都處理好了")
    return 1 if todo else 0


if __name__ == "__main__":
    sys.exit(main())
