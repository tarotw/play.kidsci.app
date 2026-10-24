#!/usr/bin/env python3
"""找每一集在 Apple Podcasts 和 Spotify 上的連結，存成 data/platforms.json（build_catalog.py 會用）。

要連到 Apple 和 Spotify，所以在 GitHub Actions 上跑（.github/workflows/status.yml）。
- Apple：iTunes Lookup（一次最多 200 集，從最新的開始）。
- Spotify：有設定 SPOTIFY_CLIENT_ID、SPOTIFY_CLIENT_SECRET 就用官方 API（最完整）；
  沒有的話讀 Spotify 公開的節目頁和嵌入頁。節目 ID 用 SPOTIFY_SHOW_ID，沒設定就從 Firstory 的節目頁找。
找不到的集數，網站上會顯示「即將推出」。
"""
from __future__ import annotations

import base64
import json
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "platforms.json"
APPLE_ID = "1812447277"
FIRSTORY_PAGES = ["https://open.firstory.fm/user/kidsci", "https://open.firstory.fm/user/kidsci/platforms"]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
log: list[str] = []


def say(msg: str) -> None:
    print(msg)
    log.append(msg)


def get(url: str, headers: dict | None = None, data: bytes | None = None) -> str:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept-Language": "zh-TW,zh;q=0.9", **(headers or {})})
    with urllib.request.urlopen(req, timeout=40) as resp:
        return resp.read().decode("utf-8", "replace")


def clean_url(url: str | None) -> str | None:
    if not url:
        return None
    return re.sub(r"[?&]uo=\d+$", "", url)


# ---------- Apple ----------
def apple() -> dict:
    url = f"https://itunes.apple.com/lookup?id={APPLE_ID}&entity=podcastEpisode&limit=200&country=tw"
    results = json.loads(get(url)).get("results", [])
    show = next((r for r in results if r.get("wrapperType") == "track" or r.get("kind") == "podcast"), {})
    eps = [{"title": r.get("trackName", ""), "url": clean_url(r.get("trackViewUrl")), "guid": r.get("episodeGuid"), "date": r.get("releaseDate"), "ms": r.get("trackTimeMillis")}
           for r in results if r.get("wrapperType") == "podcastEpisode" or r.get("kind") == "podcast-episode"]
    say(f"Apple：節目共 {show.get('trackCount')} 集，這次拿到 {len(eps)} 集")
    return {"show": clean_url(show.get("collectionViewUrl")), "total": show.get("trackCount"), "episodes": eps}


# ---------- Spotify ----------
def spotify_show_id() -> str | None:
    if os.environ.get("SPOTIFY_SHOW_ID"):
        return os.environ["SPOTIFY_SHOW_ID"]
    for page in FIRSTORY_PAGES:
        try:
            html = get(page)
        except Exception as err:  # noqa: BLE001
            say(f"Firstory 頁面讀不到：{page}（{err}）")
            continue
        links = sorted(set(re.findall(r"https?://(?:open\.spotify\.com|podcasts\.apple\.com|music\.youtube\.com|www\.youtube\.com|kkbox\.fm|podcast\.kkbox\.com)[^\"'<>\s\\]*", html)))
        say(f"Firstory {page}：{len(html)} 字，平台連結 {links[:8]}")
        m = re.search(r"open\.spotify\.com/show/([A-Za-z0-9]{22})", html)
        if m:
            return m.group(1)
    return None


def walk_episodes(node, out: dict) -> None:
    """在一大包 JSON 裡找出所有 Spotify 單集（有 spotify:episode: 的 uri 和標題）。"""
    if isinstance(node, dict):
        uri = node.get("uri") or node.get("_uri") or ""
        name = node.get("title") or node.get("name")
        if isinstance(uri, str) and uri.startswith("spotify:episode:") and isinstance(name, str):
            eid = uri.split(":")[-1]
            date = node.get("releaseDate") or node.get("release_date")
            if isinstance(date, dict):
                date = date.get("isoString") or date.get("date")
            out.setdefault(eid, {"title": name, "url": f"https://open.spotify.com/episode/{eid}", "date": date if isinstance(date, str) else None})
        for v in node.values():
            walk_episodes(v, out)
    elif isinstance(node, list):
        for v in node:
            walk_episodes(v, out)


def spotify_api(show: str) -> list[dict] | None:
    cid, secret = os.environ.get("SPOTIFY_CLIENT_ID"), os.environ.get("SPOTIFY_CLIENT_SECRET")
    if not (cid and secret):
        return None
    auth = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    token = json.loads(get("https://accounts.spotify.com/api/token", {"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"}, b"grant_type=client_credentials"))["access_token"]
    eps, url = [], f"https://api.spotify.com/v1/shows/{show}/episodes?market=TW&limit=50"
    while url:
        page = json.loads(get(url, {"Authorization": f"Bearer {token}"}))
        eps += [{"title": e["name"], "url": e["external_urls"]["spotify"], "date": e.get("release_date")} for e in page.get("items", []) if e]
        url = page.get("next")
    return eps


def spotify_public(show: str) -> list[dict]:
    found: dict = {}
    # 嵌入頁：__NEXT_DATA__ 裡有單集清單
    try:
        html = get(f"https://open.spotify.com/embed/show/{show}")
        m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
        if m:
            walk_episodes(json.loads(m.group(1)), found)
        say(f"Spotify 嵌入頁：{len(html)} 字，找到 {len(found)} 集")
    except Exception as err:  # noqa: BLE001
        say(f"Spotify 嵌入頁讀不到：{err}")
    # 節目頁：initialState（base64 的 JSON）和頁面上的單集連結
    try:
        html = get(f"https://open.spotify.com/show/{show}")
        before = len(found)
        for blob in re.findall(r'<script id="initialState" type="text/plain">([^<]+)</script>', html):
            try:
                walk_episodes(json.loads(base64.b64decode(blob + "==").decode("utf-8", "replace")), found)
            except Exception as err:  # noqa: BLE001
                say(f"initialState 解不開：{err}")
        for blob in re.findall(r'<script[^>]*type="application/(?:ld\+)?json"[^>]*>(.*?)</script>', html, re.S):
            try:
                walk_episodes(json.loads(blob), found)
            except Exception:  # noqa: BLE001
                pass
        ids = set(re.findall(r'/episode/([A-Za-z0-9]{22})', html))
        say(f"Spotify 節目頁：{len(html)} 字，多找到 {len(found) - before} 集；頁面上的單集連結 {len(ids)} 個")
        # 只有連結、沒有標題的，用單集頁的 og:title 補
        for eid in sorted(ids - set(found))[:400]:
            try:
                ep = get(f"https://open.spotify.com/episode/{eid}")
                t = re.search(r'<meta property="og:title" content="([^"]+)"', ep)
                d = re.search(r'"releaseDate":\s*\{"isoString":"([^"]+)"', ep)
                if t:
                    found[eid] = {"title": t.group(1), "url": f"https://open.spotify.com/episode/{eid}", "date": d.group(1) if d else None}
            except Exception:  # noqa: BLE001
                pass
    except Exception as err:  # noqa: BLE001
        say(f"Spotify 節目頁讀不到：{err}")
    return list(found.values())


def spotify() -> dict:
    show = spotify_show_id()
    if not show:
        say("Spotify：找不到節目 ID（可以在 repo 的 Secrets 設定 SPOTIFY_SHOW_ID）")
        return {"show": None, "source": "none", "episodes": []}
    say(f"Spotify 節目 ID：{show}")
    try:
        eps = spotify_api(show)
        if eps is not None:
            say(f"Spotify API：{len(eps)} 集")
            return {"show": f"https://open.spotify.com/show/{show}", "source": "api", "episodes": eps}
    except Exception as err:  # noqa: BLE001
        say(f"Spotify API 失敗：{err}")
    eps = spotify_public(show)
    return {"show": f"https://open.spotify.com/show/{show}", "source": "public", "episodes": eps}


def main() -> None:
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    data = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    for name, fn in (("apple", apple), ("spotify", spotify)):
        try:
            data[name] = fn()
        except Exception as err:  # noqa: BLE001
            say(f"{name} 失敗：{err}")
            data[name] = old.get(name) or {"show": None, "episodes": []}
        # 這次比上次少很多（網站暫時出錯）：保留上次的
        prev = (old.get(name) or {}).get("episodes", [])
        if len(data[name].get("episodes", [])) < len(prev) * 0.8:
            say(f"{name}：這次只有 {len(data[name].get('episodes', []))} 集，比上次 {len(prev)} 集少很多，先保留上次的")
            data[name] = old[name]
    data["log"] = log
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
