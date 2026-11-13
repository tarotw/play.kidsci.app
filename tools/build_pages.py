"""每一集、每一座島各一個靜態頁面（ep/<代碼>/、isle/<島>/），給搜尋引擎收錄和分享用。

宇宙島本身是 3D 畫布，?ch=代碼 的網址都指向首頁，搜尋引擎只會收首頁。
這裡替每一集產生一頁真的 HTML：標題、隊長介紹、封面、住在哪座島、Apple／Spotify 按鈕
（免費集數加 Apple 內嵌播放器），再用按鈕回到 3D 的宇宙島。由 build_seo.py 呼叫，
跟著每天的目錄更新一起重建；頁面裡不放當天日期，內容沒變就不會產生差異。
"""
from __future__ import annotations

import html
import json
import shutil
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

MARK = "<!-- 由 tools/build_pages.py 產生，請不要手動修改 -->"


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def published(e: dict) -> datetime | None:
    raw = (e.get("listen") or {}).get("pubDate")
    if not raw:
        return None
    try:
        return parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None


def newest(e: dict) -> float:
    """排序用：新的在前，沒有日期的放最後。"""
    dt = published(e)
    return -dt.timestamp() if dt else 0.0


def apple_embed(url: str | None) -> str | None:
    """Apple Podcasts 單集網址 → 內嵌播放器網址（和 channel.js 的 appleEmbed 一樣）。"""
    if not url:
        return None
    u = urlsplit(url)
    q = dict(parse_qsl(u.query))
    if u.hostname != "podcasts.apple.com" or not q.get("i"):
        return None
    q["theme"] = "light"
    return urlunsplit((u.scheme, "embed.podcasts.apple.com", u.path, urlencode(q), ""))


def emoji_icon(icons: dict, code: str) -> str:
    icon = (icons.get(code) or {}).get("icon") or ""
    return "" if ":" in icon else icon  # topic-art 的向量圖（animal:…）在靜態頁不畫


STYLE = """
:root{--bg:#171b34;--panel:#232948;--panel-2:#2b3256;--line:#3f4774;--text:#f7f1e6;--muted:#bec1d8;--orange:#f2b38a;--gold:#efcf8e;--teal:#a6dccf}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.75 system-ui,-apple-system,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif}
a{color:var(--teal)}
:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.wrap{max-width:760px;margin:0 auto;padding:16px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
header img{display:block;width:180px;height:auto}
nav.crumbs{font-size:15px;color:var(--muted);margin:14px 0 6px}
nav.crumbs a{color:var(--muted)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px;margin:12px 0}
.hero{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
.hero img{width:180px;height:180px;border-radius:12px;object-fit:cover;flex:none}
.hero div{flex:1 1 260px;min-width:0}
h1{font-size:26px;line-height:1.4;margin:0 0 6px}
h2{font-size:20px;margin:0 0 10px}
.meta{color:var(--muted);font-size:15px;margin:0}
.tag{display:inline-block;border-radius:99px;padding:1px 10px;font-size:14px;background:var(--panel-2);margin-right:6px}
.tag.vip{background:#5a4520;color:var(--gold)}
.captain{display:flex;gap:12px;align-items:flex-start}
.captain img{width:56px;height:56px;border-radius:50%;flex:none}
.captain p{margin:0}
.label{color:var(--orange);font-weight:700;font-size:15px;margin:0 0 4px}
iframe{width:100%;max-width:660px;height:175px;border:0;border-radius:12px;margin-top:6px;background:#fff}
.buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.btn{display:inline-block;padding:10px 18px;border-radius:12px;text-decoration:none;font-weight:700;color:#1b1d33;background:var(--teal)}
.btn.go{background:linear-gradient(90deg,#f6c27a,#f2b38a);font-size:18px}
.btn.alt{background:var(--panel-2);color:var(--text);border:1px solid var(--line)}
ul.eps{list-style:none;margin:0;padding:0}
ul.eps li{padding:10px 0;border-top:1px solid var(--line)}
ul.eps li:first-child{border-top:0}
ul.eps a{font-weight:700}
ul.eps p{margin:2px 0 0;color:var(--muted);font-size:15px}
footer{color:var(--muted);font-size:14px;margin:24px 0 8px}
"""


def page(*, title: str, desc: str, url: str, image: str, image_alt: str, ld: list[dict], body: str, og_type: str = "website") -> str:
    ld_html = "\n".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False, separators=(",", ":"))}</script>' for x in ld)
    return f"""<!doctype html>
{MARK}
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{url}">
<meta property="og:type" content="{og_type}">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="科學好好聽-宇宙島">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:alt" content="{esc(image_alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{image}">
<link rel="icon" href="/assets/logo-square.jpg">
{ld_html}
<style>{STYLE}</style>
</head>
<body>
<div class="wrap">
<header><a href="/" aria-label="科學好好聽-宇宙島首頁"><img src="/assets/logo-banner.png" alt="科學好好聽" width="210" height="84"></a>
<a class="btn alt" href="/">🚀 打開宇宙島</a></header>
{body}
<footer>《科學好好聽》是給 4 到 12 歲孩子聽的科普 Podcast。在 <a href="https://podcasts.apple.com/tw/podcast/id1812447277">Apple Podcasts</a>、<a href="https://open.spotify.com/show/1eyISRdcgDTwZqIqrP1qKv">Spotify</a> 都能收聽。<br><a href="/">科學好好聽-宇宙島</a>：每一集故事都是住在浮空島上的小居民。</footer>
</div>
</body>
</html>
"""


def write_pages(root: Path, site: str, name: str, islands: list[dict], per: list[list[dict]], live: list, groups: dict, start: str, clean) -> list[tuple[str, str]]:
    """寫出所有頁面，回傳 sitemap 要列的 (網址, lastmod)。"""
    icons = (json.loads((root / "data/episode-icon-review.json").read_text(encoding="utf-8")).get("episodes") or {})
    home_of = {e["code"]: isl for isl, eps in zip(islands, per) for e in eps}
    series = {"@type": "PodcastSeries", "name": name, "url": "https://podcasts.apple.com/tw/podcast/id1812447277"}
    catalog = json.loads((root / "data/catalog.json").read_text(encoding="utf-8"))
    curiosity = (catalog.get("shows") or {}).get("curiosity") or {}
    curiosity_series = {"@type": "PodcastSeries", "name": curiosity.get("name") or "科學好好聽：好奇號・宇宙大冒險",
                        "url": curiosity.get("apple") or "https://podcasts.apple.com/tw/podcast/id6829127315"}
    urls: list[tuple[str, str]] = []
    keep_ep, keep_isle = set(), set()

    def day(dt: datetime | None) -> str:
        return dt.strftime("%Y-%m-%d") if dt else ""

    def ep_item(e: dict, show_intro: bool = True) -> str:
        icon = emoji_icon(icons, e["code"])
        vip = ' <span class="tag vip">👑 VIP</span>' if e["state"] == "subscriber" else ""
        vip += ' <span class="tag">🚀 好奇號</span>' if e.get("show") == "curiosity" else ""
        intro = f"<p>{esc(e['intro'])}</p>" if show_intro and e.get("intro") else ""
        return f'<li><a href="/ep/{e["code"]}/">{esc((icon + " ") if icon else "")}{esc(clean(e["title"]))}</a>{vip}{intro}</li>'

    # ---- 每一集 ----
    for isl, eps in zip(islands, per):
        for e in eps:
            code, title = e["code"], clean(e["title"])
            url = f"{site}ep/{code}/"
            dt = published(e)
            listen = e.get("listen") or {}
            icon = emoji_icon(icons, code)
            vip = e["state"] == "subscriber"
            intro = e.get("intro") or ""
            cover = f"/{e['artworkLocal']}" if e.get("artworkLocal") else "/assets/logo-square.jpg"
            meta = [dt.strftime("%Y/%-m/%-d") if dt else "", f"{round(listen['duration'] / 60)} 分鐘" if listen.get("duration") else ""]
            tags = '<span class="tag vip">👑 VIP 訂閱集數</span>' if vip else '<span class="tag">▶ 免費收聽</span>'
            from_curiosity = e.get("show") == "curiosity"
            if from_curiosity:
                tags = f'<span class="tag">🚀 好奇號・宇宙大冒險{esc("・" + e["series"]) if e.get("series") else ""}</span>' + tags
            embed = apple_embed(listen.get("apple")) if not vip else None
            player = (f'<iframe title="用 Apple Podcasts 收聽：{esc(title)}" src="{esc(embed)}" loading="lazy" allow="autoplay *; encrypted-media *; clipboard-write" '
                      'sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"></iframe>') if embed else ""
            buttons = "".join(f'<a class="btn" href="{esc(listen[k])}" rel="noopener">{label}</a>' for k, label in (("apple", "🍎 Apple Podcasts"), ("spotify", "🟢 Spotify")) if listen.get(k))
            how = "訂閱後就能在 App 裡收聽這一集。" if vip else "直接在這裡播放，或到 App 按「追蹤」，新的一集就會自己出現。"
            others = sorted((x for x in eps if x["code"] != code), key=newest)[:12]
            more = (f'<section class="card"><h2>{esc(isl["emoji"])} {esc(isl["name"])}的其他故事</h2><ul class="eps">'
                    + "".join(ep_item(x, False) for x in others)
                    + f'</ul><p><a href="/isle/{isl["id"]}/">看{esc(isl["name"])}全部 {len(eps)} 集 →</a></p></section>') if others else ""
            body = f"""<nav class="crumbs" aria-label="位置"><a href="/">宇宙島</a> › <a href="/isle/{isl['id']}/">{esc(isl['emoji'])} {esc(isl['name'])}</a></nav>
<main>
<article class="card">
<div class="hero"><img src="{cover}" alt="《{esc(title)}》封面" width="180" height="180">
<div><h1>{esc((icon + " ") if icon else "")}{esc(title)}</h1>
<p class="meta">{tags}{esc(" · ".join(x for x in meta if x))}</p>
<p class="meta">住在 <a href="/isle/{isl['id']}/">{esc(isl['emoji'])} {esc(isl['name'])}</a></p></div></div>
</article>
<section class="card"><div class="captain"><img src="/assets/avatar-captain.png" alt="科學隊長" width="56" height="56"><div><p class="label">科學隊長的小介紹</p><p>{esc(intro)}</p></div></div></section>
<section class="card"><h2>🎧 收聽這一集</h2><p class="meta">{how}</p>{player}<div class="buttons">{buttons}</div></section>
<section class="card"><h2>🚀 到宇宙島找這位小居民</h2><p class="meta">每一集故事都住在浮空島上。坐火箭到{esc(isl['name'])}，拖曳轉動畫面，還能拜訪其他故事。</p>
<div class="buttons"><a class="btn go" href="/?ch={code}">到宇宙島看這一集</a></div></section>
{more}
</main>"""
            desc = f"{intro[:110]}{'…' if len(intro) > 110 else ''}" if intro else f"《{name}》兒童科普 Podcast：{title}"
            ep_ld = {"@context": "https://schema.org", "@type": "PodcastEpisode", "@id": url + "#episode", "url": url, "name": title,
                     "description": intro, "inLanguage": "zh-TW", "image": site + cover.lstrip("/"), "partOfSeries": curiosity_series if from_curiosity else series,
                     "isAccessibleForFree": not vip, "sameAs": [listen[k] for k in ("apple", "spotify") if listen.get(k)]}
            if dt:
                ep_ld["datePublished"] = dt.strftime("%Y-%m-%d")
            if listen.get("duration"):
                ep_ld["timeRequired"] = f"PT{round(listen['duration'] / 60)}M"
            crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "科學好好聽-宇宙島", "item": site},
                {"@type": "ListItem", "position": 2, "name": isl["name"], "item": f"{site}isle/{isl['id']}/"},
                {"@type": "ListItem", "position": 3, "name": title, "item": url}]}
            out = root / "ep" / code / "index.html"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(page(title=f"{title}｜{name}-宇宙島", desc=desc, url=url, image=site + cover.lstrip("/"), image_alt=f"《{title}》封面",
                                ld=[ep_ld, crumbs], body=body, og_type="article"), encoding="utf-8")
            keep_ep.add(code)
            urls.append((url, day(dt)))

    # ---- 每一座島 ----
    for isl, eps in live:
        if isl["id"] == start:
            continue
        url = f"{site}isle/{isl['id']}/"
        eps = sorted(eps, key=newest)
        group = groups.get(isl.get("group") or "")
        group_line = f"{esc(group['emoji'])} {esc(group['name'])}的一座島 · " if group else ""
        tour = "".join(f"<h3>{esc(p['title'])}</h3><p>{esc(p['text'])}</p>" for p in isl.get("tour", []))
        body = f"""<nav class="crumbs" aria-label="位置"><a href="/">宇宙島</a> › {esc(isl['emoji'])} {esc(isl['name'])}</nav>
<main>
<section class="card"><h1>{esc(isl['emoji'])} {esc(isl['name'])}</h1><p class="meta">{group_line}住著 {len(eps)} 集故事</p>
<p>{esc(isl['intro'])}</p>{tour}
<div class="buttons"><a class="btn go" href="/?isle={isl['id']}">🚀 坐火箭到{esc(isl['name'])}</a></div></section>
<section class="card"><h2>島上的故事</h2><ul class="eps">{"".join(ep_item(e) for e in eps)}</ul></section>
<section class="card"><h2>其他的島</h2><p>{" · ".join(f'<a href="/isle/{o["id"]}/">{esc(o["emoji"])} {esc(o["name"])}</a>' for o, _ in live if o["id"] not in (start, isl["id"]))}</p></section>
</main>"""
        latest = max((published(e) for e in eps if published(e)), default=None)
        ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "url": url, "name": f"{isl['name']}｜{name}-宇宙島", "description": isl["intro"], "inLanguage": "zh-TW",
               "mainEntity": {"@type": "ItemList", "numberOfItems": len(eps), "itemListElement": [
                   {"@type": "ListItem", "position": n + 1, "url": f"{site}ep/{e['code']}/", "name": clean(e["title"])} for n, e in enumerate(eps)]}},
              {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                  {"@type": "ListItem", "position": 1, "name": "科學好好聽-宇宙島", "item": site},
                  {"@type": "ListItem", "position": 2, "name": isl["name"], "item": url}]}]
        out = root / "isle" / isl["id"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page(title=f"{isl['name']}：{len(eps)} 集兒童科學故事｜{name}-宇宙島", desc=f"{isl['intro']} {len(eps)} 集《{name}》兒童科普 Podcast 住在這座島上，點一下就能聽。",
                            url=url, image=f"{site}assets/og-cover.jpg", image_alt=f"科學好好聽-宇宙島：{isl['name']}", ld=ld, body=body), encoding="utf-8")
        keep_isle.add(isl["id"])
        urls.append((url, day(latest)))

    # 已經下架或改代碼的集數：拿掉舊頁面（只刪這支程式產生的）
    for folder, keep in (("ep", keep_ep), ("isle", keep_isle)):
        for d in (root / folder).iterdir():
            f = d / "index.html"
            if d.is_dir() and d.name not in keep and f.exists() and MARK in f.read_text(encoding="utf-8"):
                shutil.rmtree(d)
    return urls
