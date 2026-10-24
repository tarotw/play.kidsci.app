import json, os, re, time, urllib.request, urllib.parse
os.makedirs('probe/out', exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept-Language': 'zh-TW'}
log = []
def get(url, headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={**UA, **(headers or {})}), timeout=40) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return str(e), b''
ID = '1812447277'
st, page = get(f'https://podcasts.apple.com/tw/podcast/id{ID}')
page = page.decode('utf-8', 'replace')
js = re.findall(r'src="(/assets/index[^"]+\.js)"', page)
token = None
for path in js:
    s, b = get('https://podcasts.apple.com' + path)
    m = re.search(rb'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', b)
    log.append(f'js {path}: {s} {len(b)} token={bool(m)}')
    if m: token = m.group(0).decode(); break
eps = []
if token:
    H = {'Authorization': f'Bearer {token}', 'Origin': 'https://podcasts.apple.com', 'Referer': 'https://podcasts.apple.com/'}
    for label, extra in [('all', ''), ('sub', '&filter[podcasts:episodes:subscriber]=true')]:
        url = f'https://amp-api.podcasts.apple.com/v1/catalog/tw/podcasts/{ID}/episodes?limit=100&l=zh-Hant-TW{extra}'
        got = []
        for _ in range(10):
            s, b = get(url, H)
            if s != 200:
                log.append(f'{label}: {s} {b[:200]!r}'); break
            d = json.loads(b)
            for e in d.get('data', []):
                a = e.get('attributes', {})
                got.append({'id': e.get('id'), 'title': a.get('name'), 'date': a.get('releaseDateTime'), 'url': a.get('url'),
                            'sub': a.get('subscribable') or a.get('isSubscriberOnly') or a.get('offers'), 'keys': sorted(a.keys())[:60]})
            nxt = d.get('next')
            if not nxt: break
            url = 'https://amp-api.podcasts.apple.com' + nxt + ('&' if '?' in nxt else '?') + 'l=zh-Hant-TW' + extra
        log.append(f'{label}: {len(got)} episodes')
        json.dump(got, open(f'probe/out/amp_{label}.json', 'w'), ensure_ascii=False, indent=1)
# 備用：只看訂閱者集數的頁面
s, b = get(f'https://podcasts.apple.com/tw/podcast/id{ID}?filter%5Bpodcasts%3Aepisodes%3Asubscriber%5D=true')
open('probe/out/subpage.html', 'wb').write(b)
log.append(f'subpage: {s} {len(b)}')
open('probe/out/log.txt', 'w').write('\n'.join(log))
print('\n'.join(log))
