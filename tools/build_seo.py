#!/usr/bin/env python3
"""把「搜尋引擎看得到的內容」寫進 index.html、sitemap.xml、robots.txt。

宇宙群島整個畫面是 3D 畫布，搜尋引擎看不到字。所以這裡根據 data/islands.json、data/catalog.json
產生一份文字版（每座島、每一集的標題，連結用 ?ch=代碼）和結構化資料（JSON-LD），
放在 index.html 的標記之間；每次目錄更新後由 GitHub Actions 重跑。
文字版是給螢幕閱讀器和搜尋引擎用的真實內容（視覺上收起來，內容和畫面上一致），不是另外塞的關鍵字。
"""
from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://play.kidsci.app/"
APPLE = "https://podcasts.apple.com/tw/podcast/id1812447277"
SPOTIFY = "https://open.spotify.com/show/1eyISRdcgDTwZqIqrP1qKv"
NAME = "科學好好聽"


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def clean(title: str) -> str:
    return re.sub(r"^[〈\s]+|[〉\s]+$", "", title)


def assign(islands: list[dict], episodes: list[dict]) -> list[list[dict]]:
    def match(src: str, e: dict) -> bool:
        if src.startswith(("era:", "lane:")) or ":" not in src:
            return e["home"] == src
        h, z = src.split(":", 1)
        return e["home"] == h and e.get("zone") == z

    out = [[] for _ in islands]
    for e in episodes:
        for i, isl in enumerate(islands):
            if any(match(s, e) for s in isl["sources"]):
                out[i].append(e)
                break
    return out


def main() -> None:
    data = json.loads((ROOT / "data/islands.json").read_text(encoding="utf-8"))
    episodes = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))["episodes"]
    islands = data["islands"]
    groups = {g["id"]: g for g in data.get("groups", [])}
    per = assign(islands, episodes)
    total = sum(len(x) for x in per)
    free = sum(1 for x in per for e in x if e["state"] == "public")
    live = [(i, x) for i, x in zip(islands, per) if x or i['id'] == data['start']]

    # ---- 標題、描述（集數寫真的數字）----
    title = "科學好好聽｜兒童科普 Podcast 互動地圖・宇宙群島"
    desc = (f"《科學好好聽》兒童科普 Podcast 的 3D 互動地圖：{total} 集科學故事變成小居民，住在動物、恐龍、太空、人體、物理的浮空島上。"
            "坐火箭到雨林、深海、月亮拜訪他們，點一下就能聽介紹、連到 Apple Podcasts 和 Spotify 收聽，親子一起學科學。")
    og_desc = f"坐火箭去拜訪 {total} 個兒童科普故事：恐龍、太空、動物、人體、科技，點一下就能認識他們！"

    # ---- JSON-LD ----
    series = {
        "@type": "PodcastSeries", "@id": SITE + "#podcast", "name": NAME, "url": APPLE,
        "description": "給孩子的科學 Podcast：用故事講恐龍、太空、動物、人體、物理和科技。",
        "inLanguage": "zh-TW", "genre": ["兒童", "科學", "教育"], "audience": {"@type": "PeopleAudience", "suggestedMinAge": 4, "suggestedMaxAge": 12},
        "sameAs": [APPLE, SPOTIFY], "image": SITE + "assets/logo-banner.png",
    }
    ld = [
        {"@context": "https://schema.org", "@type": "WebSite", "@id": SITE + "#site", "url": SITE, "name": "宇宙好好聽・宇宙群島",
         "alternateName": [f"{NAME} 宇宙群島", "科學好好聽互動地圖"], "inLanguage": "zh-TW", "description": desc,
         "publisher": {"@id": SITE + "#podcast"}},
        {"@context": "https://schema.org", **series},
        {"@context": "https://schema.org", "@type": "ItemList", "name": "宇宙群島的島", "numberOfItems": len(live),
         "itemListElement": [{"@type": "ListItem", "position": n + 1, "name": isl["name"], "description": isl["intro"],
                              "url": f"{SITE}?isle={isl['id']}"} for n, (isl, _) in enumerate(live)]},
        {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": "科學好好聽是什麼？", "acceptedAnswer": {"@type": "Answer", "text": "科學好好聽是給孩子聽的科普 Podcast，用有趣的故事介紹恐龍、太空、動物、人體、物理和科技。"}},
            {"@type": "Question", "name": "宇宙群島怎麼玩？", "acceptedAnswer": {"@type": "Answer", "text": "每一集故事是一個住在浮空島上的小居民。拖曳轉動畫面、點小居民就能聽到這一集的介紹（還可以念出來），也可以按「去別的島」坐火箭到其他島。"}},
            {"@type": "Question", "name": "哪裡可以收聽科學好好聽？", "acceptedAnswer": {"@type": "Answer", "text": "在 Apple Podcasts 和 Spotify 都可以收聽。宇宙群島上點一下小居民就會看到這一集的介紹，免費的集數可以直接在卡片裡的 Apple Podcasts 播放器聽完整一集，也可以點按鈕到 Apple Podcasts 或 Spotify 收聽；金色皇冠是 VIP 訂閱集數。"}},
            {"@type": "Question", "name": "適合幾歲的孩子？", "acceptedAnswer": {"@type": "Answer", "text": "適合 4 到 12 歲的孩子，大人陪著一起聽也很有趣。"}},
        ]},
    ]
    ld_html = "\n".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False, separators=(",", ":"))}</script>' for x in ld)

    head = f"""<!--seo-head:start-->
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="keywords" content="科學好好聽,兒童科普,兒童 Podcast,親子 Podcast,科學故事,孩子學科學,恐龍,太空,動物,人體,物理,科普互動地圖,宇宙群島">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="website">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="宇宙好好聽">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(og_desc)}">
<meta property="og:image" content="{SITE}assets/logo-banner.png">
<meta property="og:image:alt" content="科學好好聽">
<meta property="og:url" content="{SITE}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(og_desc)}">
<meta name="twitter:image" content="{SITE}assets/logo-banner.png">
<link rel="canonical" href="{SITE}">
{ld_html}
<!--seo-head:end-->"""

    # ---- 文字版 ----
    parts = [f'<!--seo-body:start-->\n<section class="text-version" id="text-version" aria-label="宇宙群島文字版">',
             f"<h2>{NAME}・宇宙群島：兒童科普 Podcast 互動地圖</h2>",
             f"<p>《{NAME}》是給孩子聽的科普 Podcast。宇宙群島把 {total} 集科學故事變成住在浮空島上的小居民："
             f"拖曳轉動畫面、點一下小居民就能看到這一集的介紹，再到 "
             f'<a href="{APPLE}">Apple Podcasts</a> 或 <a href="{SPOTIFY}">Spotify</a> 收聽（其中 {free} 集免費，卡片裡就有播放器）。'
             "適合 4 到 12 歲的孩子，親子一起學恐龍、太空、動物、人體、物理和科技。</p>"]
    for gid in [None] + list(groups):
        sel = [(i, x) for i, x in live if i.get("group") == gid] if gid else [(i, x) for i, x in live if not i.get("group")]
        if not sel:
            continue
        if gid:
            parts.append(f"<h3>{esc(groups[gid]['emoji'] + ' ' + groups[gid]['name'])}</h3>")
        for isl, eps in sel:
            count = '母島・玩法說明' if isl['id'] == data['start'] else f'{len(eps)} 集'
            parts.append(f'<h4><a href="?isle={esc(isl["id"])}">{esc(isl["emoji"] + " " + isl["name"])}</a>（{count}）</h4><p>{esc(isl["intro"])}</p>')
            for page in isl.get('tour', []):
                parts.append(f'<h5>{esc(page["title"])}</h5><p>{esc(page["text"])}</p>')
            parts[-1] += '<ul>'
            for e in eps:
                vip = "（VIP）" if e["state"] == "subscriber" else ""
                intro = f"：{esc(e['intro'])}" if e.get("intro") else ""
                parts.append(f'<li><a href="?ch={esc(e["code"])}">{esc(clean(e["title"]))}</a>{vip}{intro}</li>')
            parts.append("</ul>")
    parts.append("<h3>常見問題</h3><dl>")
    for q in ld[3]["mainEntity"]:
        parts.append(f"<dt>{esc(q['name'])}</dt><dd>{esc(q['acceptedAnswer']['text'])}</dd>")
    parts.append("</dl></section>\n<!--seo-body:end-->")
    body = "\n".join(parts)

    p = ROOT / "index.html"
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"<!--seo-head:start-->.*?<!--seo-head:end-->", lambda m: head, s, flags=re.S) if "<!--seo-head:start-->" in s else s
    s = re.sub(r"<!--seo-body:start-->.*?<!--seo-body:end-->", lambda m: body, s, flags=re.S) if "<!--seo-body:start-->" in s else s
    p.write_text(s, encoding="utf-8")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"  <url><loc>{SITE}</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n", encoding="utf-8")
    (ROOT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nDisallow: /mindmap.html\nDisallow: /knob.html\nDisallow: /zoom.html\n\nSitemap: {SITE}sitemap.xml\n", encoding="utf-8")
    print(f"SEO：{len(live)} 座島、{total} 集寫進文字版和結構化資料")


if __name__ == "__main__":
    main()
