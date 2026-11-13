#!/usr/bin/env python3
"""第二個頻道「科學好好聽：好奇號・宇宙大冒險」的單集資料，存成 data/curiosity.json。

這個頻道在 Apple（id6829127315）和 Spotify 上是獨立的節目。要連到 Apple 和 Spotify，所以在
GitHub Actions 上跑（.github/workflows/status.yml）：
- Apple：iTunes Lookup 拿節目資訊、公開 RSS 網址和單集；amp-api 拿全部單集（含訂閱者專屬）。
- RSS：讀 Apple 給的公開 RSS（Firstory），拿每一集的完整說明。
- Spotify：從已知的一集找到節目 ID，再用官方 API 列出全部單集。
哪一步失敗就保留上次的資料。
"""
from __future__ import annotations

import base64
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from platform_links import apple_full, artwork_url, clean_url, get, say, log
from status_check import firstory_items

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "curiosity.json"
APPLE_ID = "6829127315"
SPOTIFY_EPISODE = "7q4q5NHVEpWGIJDPtYlxDp"  # 使用者給的其中一集，用來找節目 ID；SPOTIFY_CURIOSITY_SHOW_ID 可以蓋過


def apple_lookup() -> tuple[dict, list[dict]]:
    results = json.loads(get(f"https://itunes.apple.com/lookup?id={APPLE_ID}&entity=podcastEpisode&limit=200&country=tw")).get("results", [])
    show = next((r for r in results if r.get("wrapperType") == "track" or r.get("kind") == "podcast"), {})
    eps = [r for r in results if (r.get("wrapperType") == "podcastEpisode" or r.get("kind") == "podcast-episode") and str(r.get("collectionId")) == APPLE_ID]
    rows = []
    for r in eps:
        rows.append({"title": r.get("trackName", ""), "url": clean_url(r.get("trackViewUrl")), "guid": r.get("episodeGuid"), "date": r.get("releaseDate"),
                     "ms": r.get("trackTimeMillis"), "artwork": artwork_url(r.get("artworkUrl600") or r.get("artworkUrl160")), "description": r.get("description")})
    info = {"name": show.get("collectionName") or show.get("trackName"), "apple": clean_url(show.get("collectionViewUrl")), "feed": show.get("feedUrl"),
            "artwork": artwork_url(show.get("artworkUrl600")), "total": show.get("trackCount")}
    return info, rows


def spotify() -> tuple[str | None, list[dict]]:
    cid, secret = os.environ.get("SPOTIFY_CLIENT_ID"), os.environ.get("SPOTIFY_CLIENT_SECRET")
    if not (cid and secret):
        say("好奇號 Spotify：沒有設定 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET")
        return None, []
    auth = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    token = json.loads(get("https://accounts.spotify.com/api/token", {"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"}, b"grant_type=client_credentials"))["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    show = os.environ.get("SPOTIFY_CURIOSITY_SHOW_ID") or json.loads(get(f"https://api.spotify.com/v1/episodes/{SPOTIFY_EPISODE}?market=TW", h))["show"]["id"]
    eps, url = [], f"https://api.spotify.com/v1/shows/{show}/episodes?market=TW&limit=50"
    while url:
        page = json.loads(get(url, h))
        eps += [{"title": e["name"], "url": e["external_urls"]["spotify"], "date": e.get("release_date"), "ms": e.get("duration_ms"),
                 "description": e.get("description"), "artwork": (e.get("images") or [{}])[0].get("url")} for e in page.get("items", []) if e]
        url = page.get("next")
    return show, eps


def main() -> None:
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    data = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "show": dict(old.get("show") or {})}
    try:
        info, rows = apple_lookup()
        data["show"].update({k: v for k, v in info.items() if v})
        say(f"好奇號 Apple Lookup：{info.get('name')}，共 {info.get('total')} 集，拿到 {len(rows)} 集；RSS {info.get('feed')}")
    except Exception as err:  # noqa: BLE001
        say(f"好奇號 Apple Lookup 失敗：{err}")
        rows = []
    try:
        full = apple_full(APPLE_ID)
        by_url = {r["url"]: r for r in rows}
        for r in full:
            by_url[r["url"]] = {**by_url.get(r["url"], {}), **{k: v for k, v in r.items() if v is not None and v != ""}}
        rows = list(by_url.values())
    except Exception as err:  # noqa: BLE001
        say(f"好奇號 Apple 網頁 API 失敗：{err}")
    data["apple"] = rows or old.get("apple") or []
    feed = data["show"].get("feed")
    try:
        if not feed:
            raise RuntimeError("沒有 RSS 網址")
        req = urllib.request.Request(feed, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=40) as resp:
            data["rss"] = firstory_items(resp.read())
        say(f"好奇號 RSS：{len(data['rss'])} 集")
    except Exception as err:  # noqa: BLE001
        say(f"好奇號 RSS 失敗：{err}")
        data["rss"] = old.get("rss") or []
    try:
        show, eps = spotify()
        if show:
            data["show"]["spotify"] = f"https://open.spotify.com/show/{show}"
        data["spotify"] = eps or old.get("spotify") or []
        say(f"好奇號 Spotify：節目 {show}，{len(eps)} 集")
    except Exception as err:  # noqa: BLE001
        say(f"好奇號 Spotify 失敗：{err}")
        data["spotify"] = old.get("spotify") or []
    data["log"] = log
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
