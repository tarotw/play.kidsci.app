#!/usr/bin/env python3
"""合併位置、上架狀態、實驗與單集內容，產生網站讀的 data/catalog.json。

輸入：data/source_titles.tsv、data/placements.json、data/tag_rules.json、data/labs.json、
data/status.json（status_check.py 產生）、data/episodes/<代碼>.json（build_episodes.py 產生，可缺）。
"""
from __future__ import annotations

import json
import re
import sys
from email.utils import parsedate_to_datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from status_check import code_from_title, load_drive_titles, load_overrides  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
JOIN_URL = "https://kidsci.firstory.cc/join"


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def drive_titles() -> dict[str, str]:
    titles = {}
    for line in (DATA / "source_titles.tsv").read_text(encoding="utf-8").splitlines():
        code, _, title = line.partition("\t")
        if code and title:
            titles[code] = title
    return titles


def home_by_rules(text: str, rules: list[dict]) -> str:
    for rule in rules:
        if any(word in text for word in rule["words"]):
            return rule["home"]
    return "studio"


def zone_for(title: str, home: str, levels: dict) -> str | None:
    """依 world.json 的區域關鍵字決定一集在那一格的哪一區；都不符合就放最後一區。"""
    level = levels.get(home)
    if not level:
        return None
    for zone in level["zones"]:
        if any(word in title for word in zone["words"]):
            return zone["name"]
    return level["zones"][-1]["name"]


def pick_record(records: list[dict]) -> dict | None:
    """同一集可能有多筆（VIP 版、後來的公開版、預告），優先完整版、再取最新。"""
    if not records:
        return None
    def key(r):
        try:
            when = parsedate_to_datetime(r["pubDate"]).timestamp()
        except (TypeError, ValueError):
            when = 0
        return (not r["trailerOnly"], r["labeledPublic"], when)
    return max(records, key=key)


def platform_links(status: dict) -> dict[str, dict[str, str]]:
    """data/platforms.json（platform_links.py 產生）→ 每個代碼在 Apple、Spotify 的連結。"""
    path = DATA / "platforms.json"
    if not path.exists():
        return {"apple": {}, "spotify": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    # Firstory 上的標題 → 代碼（平台上的標題通常一模一樣）；預告片不算
    by_title, trailers = {}, set()
    for code, records in status.items():
        for rec in records:
            by_title[rec["title"].strip()] = code
            if rec.get("trailerOnly"):
                trailers.add(rec["title"].strip())
    titles, overrides = load_drive_titles(), load_overrides()
    out: dict[str, dict[str, str]] = {"apple": {}, "spotify": {}}
    # 最準的：Firstory 單集頁上寫的連結（每一集自己的頁面）
    pages = data.get("firstory") or {}
    for code, records in status.items():
        for rec in sorted(records, key=lambda r: ("回顧" in r["title"], r.get("trailerOnly", False))):
            page = pages.get(rec.get("link") or "") or {}
            if rec.get("trailerOnly"):
                continue
            for name in ("apple", "spotify"):
                if page.get(name):
                    out[name].setdefault(code, page[name])
    chosen: dict[tuple[str, str], str] = {}
    for name in ("apple", "spotify"):
        for ep in (data.get(name) or {}).get("episodes", []):
            title = (ep.get("title") or "").strip()
            if not ep.get("url") or title in trailers or (ep.get("ms") and ep["ms"] < 60000):
                continue
            code = by_title.get(title)
            if not code:
                code, how = code_from_title(title, titles, overrides)
                if not code or (how.startswith("title:") and float(how[6:]) < 0.75):
                    continue
            if code == "studio":
                continue
            # 同一集有「熱門回顧」重播時，連到原本那一集；單集頁上已經有的就不換
            old = chosen.get((name, code))
            if code in out[name] and old is None:
                continue
            if old is None or ("回顧" in old and "回顧" not in title):
                out[name][code] = ep["url"]
                chosen[(name, code)] = title
    return out


def main() -> None:
    titles = drive_titles()
    placements = load("placements.json")
    rules = load("tag_rules.json")["rules"]
    labs = load("labs.json")
    status = load("status.json")["episodes"] if (DATA / "status.json").exists() else {}
    levels = {l["id"]: l for l in load("world.json")["levels"]}
    platforms = platform_links(status)

    labs_by_code: dict[str, list[dict]] = {}
    for lab in labs:
        for code in lab["episodes"]:
            labs_by_code.setdefault(code, []).append(
                {"id": lab["id"], "title": lab["title"], "question": lab["question"], "url": lab["url"]})

    codes = set(titles) | {c for c in status if c != "studio"}
    episodes = []
    for code in sorted(codes, key=lambda c: (c[:1].isdigit(), c)):
        placement = placements.get(code)
        records = status.get(code, [])
        best = pick_record(records)
        title = titles.get(code) or (best["title"].strip("〈〉") if best else code)
        if placement is None:
            home, also, auto = home_by_rules(title, rules), [], True
        else:
            home, also, auto = placement["home"], placement.get("also", []), False
        if home == "skip":
            continue

        # 只放 podcast 上真的找得到（不是只有預告片）的集數：還沒上架的不放進網站
        if not best or best["trailerOnly"]:
            continue
        # c、s 開頭是 VIP；但標題寫「公開｜」的那一版是公開放送，就當一般可以聽
        access = "subscriber" if code[:1] in ("c", "s") else "public"
        state = "public" if access == "public" or best["labeledPublic"] else "subscriber"

        listen = None
        if best:
            listen = {
                "firstory": best["link"],
                "audio": best["audio"] if state == "public" else None,
                "apple": best["apple"]["url"] if best["apple"] else None,
                "duration": best["duration"],
                "pubDate": best["pubDate"],
            }
        if state == "subscriber":
            listen = {**(listen or {}), "join": JOIN_URL}
        # Apple Podcasts、Spotify：找得到就放連結，找不到就不顯示
        apple_url = (listen or {}).get("apple") or platforms["apple"].get(code)
        spotify_url = platforms["spotify"].get(code)
        if apple_url:
            apple_url = re.sub(r"[?&]uo=\d+$", "", apple_url)
        if apple_url or spotify_url or listen:
            listen = {**(listen or {}), "apple": apple_url, "spotify": spotify_url}

        entry = {
            "code": code,
            "title": title,
            "home": home,
            "zone": zone_for(title, home, levels),
            "also": also,
            "state": state,
            "listen": listen,
            "labs": labs_by_code.get(code, []),
        }
        if auto:
            entry["autoPlaced"] = True
        content = DATA / "episodes" / f"{code}.json"
        if content.exists():
            entry["content"] = f"data/episodes/{code}.json"
        episodes.append(entry)

    (DATA / "catalog.json").write_text(json.dumps({
        "generated": load("status.json")["generated"] if (DATA / "status.json").exists() else None,
        "episodes": episodes,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    from collections import Counter
    homes = Counter(e["home"].split(":")[0] if not e["home"].startswith("l") else e["home"] for e in episodes)
    states = Counter(e["state"] for e in episodes)
    print(len(episodes), "episodes |", dict(sorted(homes.items())), "|", dict(states))
    print("auto-placed:", [e["code"] for e in episodes if e.get("autoPlaced")])
    has = lambda k: sum(1 for e in episodes if (e.get("listen") or {}).get(k))  # noqa: E731
    print(f"Apple 連結 {has('apple')} 集、Spotify 連結 {has('spotify')} 集（共 {len(episodes)} 集）")


if __name__ == "__main__":
    main()
