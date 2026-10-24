#!/usr/bin/env python3
"""（暫時）探查 Apple、Spotify 有哪些地方列得出全部的單集。只印摘要，不寫檔。"""
import json, re, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
SHOW = "1eyISRdcgDTwZqIqrP1qKv"
APPLE = "1812447277"


def get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "zh-TW,zh;q=0.9", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:300]
    except Exception as e:  # noqa: BLE001
        return 0, str(e)


def keys_tree(node, depth=0, path="", out=None, maxd=6):
    out = out if out is not None else []
    if depth > maxd:
        return out
    if isinstance(node, dict):
        for k, v in node.items():
            p = f"{path}.{k}"
            if isinstance(v, list):
                out.append(f"{p}[{len(v)}]")
                if v:
                    keys_tree(v[0], depth + 1, p + "[0]", out, maxd)
            elif isinstance(v, dict):
                keys_tree(v, depth + 1, p, out, maxd)
    return out


print("=== Spotify embed-podcast ===")
s, h = get(f"https://open.spotify.com/embed-podcast/show/{SHOW}")
print(s, len(h), "episode uris:", len(set(re.findall(r"spotify:episode:([A-Za-z0-9]{22})", h))), "links:", len(set(re.findall(r"/episode/([A-Za-z0-9]{22})", h))))
print("=== Spotify embed __NEXT_DATA__ ===")
s, h = get(f"https://open.spotify.com/embed/show/{SHOW}")
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', h, re.S)
if m:
    d = json.loads(m.group(1))
    for line in keys_tree(d)[:80]:
        print(" ", line)
print("episode uris in embed html:", len(set(re.findall(r"spotify:episode:([A-Za-z0-9]{22})", h))))
print("=== Spotify show page scripts ===")
s, h = get(f"https://open.spotify.com/show/{SHOW}")
print(s, len(h), [m.group(0)[:90] for m in re.finditer(r'<script[^>]*id="[^"]+"[^>]*>', h)][:10])
print("episode uris:", len(set(re.findall(r"spotify:episode:([A-Za-z0-9]{22})", h))), "links:", len(set(re.findall(r"/episode/([A-Za-z0-9]{22})", h))))
print("=== Spotify anonymous token (old endpoint) ===")
s, h = get("https://open.spotify.com/get_access_token?reason=transport&productType=web_player")
print(s, h[:160])
print("=== Apple page ===")
s, h = get(f"https://podcasts.apple.com/tw/podcast/id{APPLE}")
print(s, len(h), "episode links:", len(set(re.findall(r"[?&]i=(\d{9,})", h))))
tok = re.search(r'name="web-experience-app/config/environment" content="([^"]+)"', h)
token = None
if tok:
    env = json.loads(urllib.parse.unquote(tok.group(1)))
    token = env.get("MEDIA_API", {}).get("token")
    print("env token:", bool(token))
for m in re.finditer(r'<script[^>]*id="([^"]+)"[^>]*>', h):
    print(" script id:", m.group(1))
m = re.search(r'id="serialized-server-data"[^>]*>(.*?)</script>', h, re.S)
if m:
    try:
        d = json.loads(m.group(1))
        print(" serialized keys:", keys_tree(d, maxd=5)[:40])
    except Exception as e:  # noqa: BLE001
        print(" serialized parse fail", e)
if token:
    for url in [f"https://amp-api.podcasts.apple.com/v1/catalog/tw/podcasts/{APPLE}/episodes?limit=100&offset=0",
                f"https://amp-api.podcasts.apple.com/v1/catalog/tw/podcasts/{APPLE}/episodes?limit=100&offset=100"]:
        s, b = get(url, {"Authorization": f"Bearer {token}", "Origin": "https://podcasts.apple.com"})
        try:
            j = json.loads(b)
            data = j.get("data", [])
            print("amp", s, len(data), data[0]["attributes"]["name"] if data else "", "next:", j.get("next"))
        except Exception:  # noqa: BLE001
            print("amp", s, b[:200])
print("=== iTunes search ===")
s, b = get("https://itunes.apple.com/search?" + urllib.parse.urlencode({"term": "科學好好聽", "media": "podcast", "entity": "podcastEpisode", "limit": 200, "country": "tw"}))
try:
    r = json.loads(b)["results"]
    mine = [x for x in r if str(x.get("collectionId")) == APPLE]
    print("search results", len(r), "ours", len(mine))
except Exception:  # noqa: BLE001
    print(s, b[:200])
