#!/usr/bin/env python3
"""找每一集在 Apple Podcasts 和 Spotify 上的連結，存成 data/platforms.json（build_catalog.py 會用）。

要連到 Apple 和 Spotify，所以在 GitHub Actions 上跑（.github/workflows/status.yml）。
- Apple：iTunes Lookup 只給公開 RSS 裡的集數；Apple Podcasts 網頁用的 API（amp-api）才有全部，
  包括「Apple Podcasts 訂閱頻道」的訂閱者專屬集數（VIP），每一集記下 sub=True。
- Spotify：有設定 SPOTIFY_CLIENT_ID、SPOTIFY_CLIENT_SECRET 就用官方 API（最完整）；
  沒有的話讀 Spotify 公開的節目頁和嵌入頁。節目 ID 用 SPOTIFY_SHOW_ID，沒設定就從 Firstory 的節目頁找。
找不到的集數，網站上就不顯示那個平台。
"""
from __future__ import annotations

import base64
import json
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from status_check import intro_text

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "platforms.json"
APPLE_ID = "1812447277"
SPOTIFY_SHOW = "1eyISRdcgDTwZqIqrP1qKv"  # 從 Firstory 節目頁找到的；SPOTIFY_SHOW_ID 可以蓋過
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


# ---------- Firstory 單集頁：上面有這一集在 Spotify、Apple 的連結（Firstory 自己發佈到這些平台） ----------
def firstory_pages(prev: dict) -> dict:
    path = ROOT / "data" / "status.json"
    if not path.exists():
        return prev
    status = json.loads(path.read_text(encoding="utf-8"))["episodes"]
    links = sorted({r["link"] for recs in status.values() for r in recs if r.get("link")})
    found = dict(prev)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    fetched = 0
    for url in links:
        old = found.get(url) or {}
        if old.get("spotify") and old.get("apple"):
            continue  # 兩個都有了，不用再看
        if old.get("checked", "") >= week_ago:
            continue  # 一週內看過、還沒有連結：下週再看（平台可能還在處理）
        try:
            html = get(url)
        except Exception as err:  # noqa: BLE001
            say(f"Firstory 單集頁讀不到：{url}（{err}）")
            continue
        sp = re.findall(r"open\.spotify\.com/episode/([A-Za-z0-9]{22})", html)
        ap = re.findall(r"podcasts\.apple\.com/(?:[a-z]{2}/)?podcast/(?:[^\"'\s<>\\?]*/)?id" + APPLE_ID + r"\?i=(\d+)", html)
        found[url] = {
            "spotify": f"https://open.spotify.com/episode/{sp[0]}" if sp else old.get("spotify"),
            "apple": f"https://podcasts.apple.com/tw/podcast/id{APPLE_ID}?i={ap[0]}" if ap else old.get("apple"),
            "checked": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }
        fetched += 1
        time.sleep(0.35)
    sp_n = sum(1 for v in found.values() if v.get("spotify"))
    ap_n = sum(1 for v in found.values() if v.get("apple"))
    say(f"Firstory 單集頁：這次看了 {fetched} 頁；{len(found)} 集裡有 Spotify 連結 {sp_n} 集、Apple 連結 {ap_n} 集")
    return found


# ---------- Apple ----------
def apple_rows(results: list[dict]) -> list[dict]:
    return [{"title": r.get("trackName", ""), "url": clean_url(r.get("trackViewUrl")), "guid": r.get("episodeGuid"), "date": r.get("releaseDate"), "ms": r.get("trackTimeMillis")}
            for r in results if (r.get("wrapperType") == "podcastEpisode" or r.get("kind") == "podcast-episode") and str(r.get("collectionId")) == APPLE_ID]


def apple_full() -> list[dict]:
    """Apple Podcasts 網頁上的全部單集（含訂閱者專屬）。權杖從網頁的 JS 裡拿（跟瀏覽器一樣）。"""
    page = get(f"https://podcasts.apple.com/tw/podcast/id{APPLE_ID}")
    token = None
    for path in re.findall(r'src="(/assets/index[^"]+\.js)"', page):
        m = re.search(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", get("https://podcasts.apple.com" + path))
        if m:
            token = m.group(0)
            break
    if not token:
        raise RuntimeError("Apple 網頁上找不到 API 權杖")
    headers = {"Authorization": f"Bearer {token}", "Origin": "https://podcasts.apple.com", "Referer": "https://podcasts.apple.com/"}

    def fetch(extra: str) -> list[dict]:
        rows, url = [], f"https://amp-api.podcasts.apple.com/v1/catalog/tw/podcasts/{APPLE_ID}/episodes?limit=100&l=zh-Hant-TW{extra}"
        for _ in range(20):
            d = json.loads(get(url, headers))
            for e in d.get("data", []):
                a = e.get("attributes", {})
                desc = a.get("description")
                desc = (desc.get("standard") or desc.get("short")) if isinstance(desc, dict) else desc
                rows.append({"title": a.get("name", ""), "url": clean_url(a.get("url")), "guid": a.get("guid"), "date": a.get("releaseDateTime"), "ms": a.get("durationInMilliseconds"),
                             "intro": intro_text(desc)})
            if not d.get("next"):
                break
            url = "https://amp-api.podcasts.apple.com" + d["next"] + "&l=zh-Hant-TW" + extra
        return rows

    sub = {r["url"] for r in fetch("&filter[podcasts:episodes:subscriber]=true")}
    rows = fetch("")
    for r in rows:
        r["sub"] = r["url"] in sub
    say(f"Apple 網頁：全部 {len(rows)} 集，其中訂閱者專屬 {len(sub)} 集")
    return rows


def apple_search(term: str) -> list[dict]:
    q = urllib.parse.urlencode({"term": term, "media": "podcast", "entity": "podcastEpisode", "limit": 200, "country": "tw"})
    return apple_rows(json.loads(get(f"https://itunes.apple.com/search?{q}")).get("results", []))


def missing_apple_codes() -> list[tuple[str, str]]:
    """已經上架（公開或訂閱）、但還沒有 Apple 連結的集數（代碼, 標題）。"""
    path = ROOT / "data" / "catalog.json"
    if not path.exists():
        return []
    eps = json.loads(path.read_text(encoding="utf-8"))["episodes"]
    return [(e["code"], e["title"]) for e in eps if not (e.get("listen") or {}).get("apple")]


def apple(prev: dict) -> dict:
    url = f"https://itunes.apple.com/lookup?id={APPLE_ID}&entity=podcastEpisode&limit=200&country=tw"
    results = json.loads(get(url)).get("results", [])
    show = next((r for r in results if r.get("wrapperType") == "track" or r.get("kind") == "podcast"), {})
    found = {e["url"]: e for e in (prev.get("episodes") or []) if e.get("url")}  # 以前找到的都留著（Apple 很少下架）
    before = len(found)
    for e in apple_rows(results):
        found[e["url"]] = e
    say(f"Apple：節目共 {show.get('trackCount')} 集；Lookup 拿到 {len(apple_rows(results))} 集")
    # 全部（含訂閱者專屬）：以網頁 API 為準，記下哪些是訂閱者專屬
    try:
        full = apple_full()
        if full:
            for e in found.values():
                e["sub"] = False
            for e in full:
                found[e["url"]] = {**found.get(e["url"], {}), **e}
    except Exception as err:  # noqa: BLE001
        say(f"Apple 網頁 API 失敗（保留上次的）：{err}")
    # Lookup 只給還在 RSS 裡的集數；舊的用搜尋找：先搜節目名稱，再一集一集搜標題
    try:
        for e in apple_search("科學好好聽"):
            found[e["url"]] = e
    except Exception as err:  # noqa: BLE001
        say(f"Apple 搜尋失敗：{err}")
    searched = dict(prev.get("searched") or {})
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    todo = [(c, t) for c, t in missing_apple_codes() if searched.get(c, "") < week_ago][:90]
    for code, title in todo:
        term = re.sub(r"[：:｜|，,。！!？?（）()「」『』〈〉\[\]]+", " ", title).strip()[:40]
        try:
            for e in apple_search(term):
                found[e["url"]] = e
            searched[code] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        except Exception as err:  # noqa: BLE001
            say(f"Apple 搜尋 {code} 失敗：{err}")
            if "429" in str(err):
                break
        time.sleep(3.2)  # iTunes 搜尋一分鐘大約 20 次
    say(f"Apple：一集一集搜尋 {len(todo)} 集；全部共 {len(found)} 集（之前 {before} 集）")
    return {"show": clean_url(show.get("collectionViewUrl")), "total": show.get("trackCount"), "episodes": list(found.values()), "searched": searched}


# ---------- Spotify ----------
def spotify_show_id() -> str | None:
    if os.environ.get("SPOTIFY_SHOW_ID"):
        return os.environ["SPOTIFY_SHOW_ID"]
    if SPOTIFY_SHOW:
        return SPOTIFY_SHOW
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


def spotify(prev: dict) -> dict:
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
    # 沒有 API 金鑰：公開頁面只看得到最新的一集，每天累積下來
    say("Spotify：沒有設定 SPOTIFY_CLIENT_ID／SPOTIFY_CLIENT_SECRET，只能從公開頁面找（通常只有最新一集）")
    found = {e["url"]: e for e in (prev.get("episodes") or []) if e.get("url")}
    for e in spotify_public(show):
        found[e["url"]] = e
    return {"show": f"https://open.spotify.com/show/{show}", "source": "public", "episodes": list(found.values())}


def main() -> None:
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    data = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    try:
        data["firstory"] = firstory_pages(old.get("firstory") or {})
    except Exception as err:  # noqa: BLE001
        say(f"Firstory 單集頁失敗：{err}")
        data["firstory"] = old.get("firstory") or {}
    for name, fn in (("apple", apple), ("spotify", spotify)):
        try:
            data[name] = fn(old.get(name) or {})
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
