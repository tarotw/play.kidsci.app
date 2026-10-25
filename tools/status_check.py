#!/usr/bin/env python3
"""上架狀態檢查：每一集在 Firstory、Apple Podcasts、Spotify 的實際狀態，對照預期的公開／訂閱者限定。

預期規則：Drive 代碼 c、s 開頭是訂閱者限定，其餘公開。
輸出 data/status.json（給 build_catalog.py 用）與 STATUS.md（給人看的不一致清單）。

Spotify 只有在設定了 SPOTIFY_CLIENT_ID、SPOTIFY_CLIENT_SECRET 時才會檢查（節目 ID 預設已填好）。
"""
from __future__ import annotations

import argparse
import base64
import difflib
import html
import json
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ITUNES = "{http://www.itunes.com/dtds/podcast-1.0.dtd}"
LISTENSCI_RAW = "https://raw.githubusercontent.com/tarotw/listensci/main"

# 標題裡的節目代碼 → Drive 資料夾代碼
CODE_PATTERNS = [
    (re.compile(r"SP\.(\d+)"), "s{}"),
    (re.compile(r"VIP\.(\d+)"), "c{}"),
    (re.compile(r"[｜|]C(\d+)〉"), "c{}"),
    (re.compile(r"EP\.(\d+)"), "{}"),
]
# 去掉這些前綴後再拿標題跟 Drive 比對
TITLE_NOISE = re.compile(r"〈|〉|公開｜|熱門回顧-|[^｜]*專輯[^｜]*｜|[^｜]*特輯[^｜]*｜|[｜|](EP|SP|VIP|C|P)\.?\d+|EP\.\d+｜|SP\.\d+｜|VIP\.\d+｜")


def expected_access(code: str) -> str:
    return "subscriber" if code[:1] in ("c", "s") else "public"


def read_source(path_or_url: str) -> bytes:
    if re.match(r"https?://", path_or_url):
        with urllib.request.urlopen(path_or_url, timeout=30) as resp:
            return resp.read()
    return Path(path_or_url).read_bytes()


def load_drive_titles() -> dict[str, str]:
    titles = {}
    for line in (DATA / "source_titles.tsv").read_text(encoding="utf-8").splitlines():
        code, _, title = line.partition("\t")
        if code and title:
            titles[code] = title
    return titles


def clean_title(title: str) -> str:
    return TITLE_NOISE.sub("", title).strip(" ｜|")


def load_overrides() -> list[dict]:
    path = DATA / "feed_overrides.json"
    return json.loads(path.read_text(encoding="utf-8"))["overrides"] if path.exists() else []


def code_from_title(title: str, drive_titles: dict[str, str], overrides: list[dict]) -> tuple[str | None, str]:
    for o in overrides:
        if o["match"] in title:
            return o["code"], "override" if o.get("confirmed") else "override:unconfirmed"
    for pattern, fmt in CODE_PATTERNS:
        m = pattern.search(title)
        if m:
            return fmt.format(int(m.group(1))), "code"
    cleaned = clean_title(title)
    best, score = None, 0.0
    for code, drive_title in drive_titles.items():
        ratio = difflib.SequenceMatcher(None, cleaned, drive_title).ratio()
        if ratio > score:
            best, score = code, ratio
    if best and score >= 0.45:
        return best, f"title:{score:.2f}"
    return None, "none"


def parse_duration(value: str | None) -> int | None:
    if not value:
        return None
    if value.isdigit():
        return int(value)
    parts = [int(p) for p in value.split(":") if p.isdigit()]
    seconds = 0
    for p in parts:
        seconds = seconds * 60 + p
    return seconds


PROMO = re.compile(r"留言告訴我|科學好好聽實驗室|直接操作|Hosting provided|Powered by|訂閱|加入 ?VIP|贊助|收聽連結")


def intro_text(desc: str | None) -> str | None:
    """單集說明 → 給孩子看的介紹：第一段（太短就再接下一段），拿掉連結、「==>」和宣傳句。"""
    if not desc:
        return None
    s = re.sub(r"</p>|<br\s*/?>", "\n", desc.replace("\r", ""))
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    paras = [p.strip() for p in s.split("\n") if p.strip()]
    out = ""
    for p in paras:
        p = re.sub(r"=+\s*>.*$", "", p)
        p = re.sub(r"https?://\S+", "", p)
        # VIP 集數在 Apple 上的說明開頭是宣傳句（「👉 加入 VIP 專屬星球，一個月免費收聽～」）
        p = re.sub(r"^[👉\s]*加入\s*VIP[^～~！!。]*[～~！!。]", "", p).strip(" 　-—:：")
        if not p:
            continue
        if out and (PROMO.search(p) or len(out) >= 40):  # 第一段一定留（就算裡面剛好有「訂閱」）
            break
        out = f"{out} {p}".strip()
    out = re.sub(r"\s+", " ", out).strip()
    return out if len(out) >= 12 else None


def firstory_items(feed_xml: bytes) -> list[dict]:
    channel = ET.fromstring(feed_xml).find("channel")
    items = []
    for it in channel.findall("item"):
        enclosure = it.find("enclosure")
        items.append({
            "guid": it.findtext("guid"),
            "title": it.findtext("title") or "",
            "link": it.findtext("link"),
            "pubDate": it.findtext("pubDate"),
            "audio": enclosure.get("url") if enclosure is not None else None,
            "duration": parse_duration(it.findtext(ITUNES + "duration")),
            "episodeType": it.findtext(ITUNES + "episodeType"),
            "intro": intro_text(it.findtext("description")),
        })
    return items


def apple_episodes(apple_json: bytes) -> dict[str, dict]:
    results = json.loads(apple_json).get("results", [])
    return {r["episodeGuid"]: r for r in results
            if r.get("kind") == "podcast-episode" or r.get("wrapperType") == "podcastEpisode"}


def spotify_episode_names() -> set[str] | None:
    show = os.environ.get("SPOTIFY_SHOW_ID") or "1eyISRdcgDTwZqIqrP1qKv"  # 科學好好聽在 Spotify 的節目 ID
    cid = os.environ.get("SPOTIFY_CLIENT_ID")
    secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    if not (show and cid and secret):
        return None
    auth = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    req = urllib.request.Request(
        "https://accounts.spotify.com/api/token",
        data=b"grant_type=client_credentials",
        headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        token = json.load(resp)["access_token"]
    names, url = set(), f"https://api.spotify.com/v1/shows/{show}/episodes?market=TW&limit=50"
    while url:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            page = json.load(resp)
        names.update(ep["name"] for ep in page.get("items", []) if ep)
        url = page.get("next")
    return names


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--feed", default=f"{LISTENSCI_RAW}/soundon.xml", help="Firstory RSS（網址或本機檔）")
    ap.add_argument("--apple", default=f"{LISTENSCI_RAW}/apple.json", help="iTunes Lookup 結果（網址或本機檔）")
    args = ap.parse_args()

    drive_titles = load_drive_titles()
    overrides = load_overrides()
    apple = apple_episodes(read_source(args.apple))
    spotify = spotify_episode_names()

    episodes: dict[str, list[dict]] = {}
    unmatched = []
    for item in firstory_items(read_source(args.feed)):
        code, how = code_from_title(item["title"], drive_titles, overrides)
        apple_ep = apple.get(item["guid"])
        record = {
            **item,
            "matchedBy": how,
            "labeledPublic": "公開｜" in item["title"],
            "trailerOnly": item["episodeType"] == "trailer" or (item["duration"] or 0) < 60,
            "apple": {"trackId": apple_ep["trackId"], "url": apple_ep.get("trackViewUrl")} if apple_ep else None,
            "spotify": None if spotify is None else (item["title"] in spotify),
        }
        if code is None:
            unmatched.append(record)
        else:
            episodes.setdefault(code, []).append(record)

    issues = []
    for code, records in sorted(episodes.items()):
        if code == "studio":
            continue
        want = expected_access(code)
        for rec in records:
            if want == "subscriber" and rec["labeledPublic"]:
                issues.append((code, rec["title"], "代碼是訂閱者限定，但標題寫「公開｜」"))
            if want == "public" and re.search(r"VIP\.|SP\.", rec["title"]):
                issues.append((code, rec["title"], "代碼是公開，但標題帶 VIP／SP 編號"))
            if rec["apple"] is None:
                issues.append((code, rec["title"], "Apple Podcasts 找不到"))
            if rec["spotify"] is False:
                issues.append((code, rec["title"], "Spotify 找不到"))
            if rec["matchedBy"].startswith("title:") and float(rec["matchedBy"][6:]) < 0.9:
                issues.append((code, rec["title"], f"標題沒有代碼，依標題相似度對到 {code}（{rec['matchedBy'][6:]}），請確認"))
            if rec["matchedBy"] == "override:unconfirmed":
                issues.append((code, rec["title"], f"依 feed_overrides.json 推定為 {code}，請確認"))
    for rec in unmatched:
        issues.append(("—", rec["title"], "對不到任何 Drive 資料夾"))

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    (DATA / "status.json").write_text(json.dumps({
        "generated": now,
        "spotifyChecked": spotify is not None,
        "episodes": episodes,
        "unmatched": unmatched,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    lines = [
        "# 上架狀態檢查",
        "",
        f"產生時間：{now}（UTC）。Firstory 單集 {sum(len(v) for v in episodes.values()) + len(unmatched)} 筆，"
        f"對到 Drive 代碼 {len(episodes)} 個。Spotify：{'已檢查' if spotify is not None else '尚未設定，未檢查'}。",
        "",
        "規則：Drive 代碼 `c`、`s` 開頭是訂閱者限定，其餘公開。",
        "",
        f"## 需要確認（{len(issues)} 筆）",
        "",
        "| 代碼 | 標題 | 問題 |",
        "| --- | --- | --- |",
    ]
    lines += [f"| {c} | {t.replace('|', '｜')} | {p} |" for c, t, p in issues] or ["| — | — | 沒有問題 |"]
    (ROOT / "STATUS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(episodes)} codes, {len(unmatched)} unmatched, {len(issues)} issues")


if __name__ == "__main__":
    main()
