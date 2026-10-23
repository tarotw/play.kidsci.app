#!/usr/bin/env python3
"""合併位置、上架狀態、實驗與單集內容，產生網站讀的 data/catalog.json。

輸入：data/source_titles.tsv、data/placements.json、data/tag_rules.json、data/labs.json、
data/status.json（status_check.py 產生）、data/episodes/<代碼>.json（build_episodes.py 產生，可缺）。
"""
from __future__ import annotations

import json
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
JOIN_URL = "https://kidsci.firstory.io/join"


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


def main() -> None:
    titles = drive_titles()
    placements = load("placements.json")
    rules = load("tag_rules.json")["rules"]
    labs = load("labs.json")
    status = load("status.json")["episodes"] if (DATA / "status.json").exists() else {}

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

        access = "subscriber" if code[:1] in ("c", "s") else "public"
        if access == "subscriber":
            state = "subscriber"
        elif best and not best["trailerOnly"]:
            state = "public"
        else:
            state = "unreleased"

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

        entry = {
            "code": code,
            "title": title,
            "home": home,
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


if __name__ == "__main__":
    main()
