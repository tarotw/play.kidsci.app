import json, os, re, time, urllib.request, urllib.parse
os.makedirs('probe/out', exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept-Language': 'zh-TW'}
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
            return r.status, r.read()
    except Exception as e:
        return str(e), b''
def save(name, url):
    st, b = get(url)
    open(f'probe/out/{name}', 'wb').write(b)
    return f'{name}: {st} {len(b)} bytes  {url}'
log = []
ID = '1812447277'
log.append(save('lookup200.json', f'https://itunes.apple.com/lookup?id={ID}&entity=podcastEpisode&limit=200&country=tw'))
log.append(save('lookup300.json', f'https://itunes.apple.com/lookup?id={ID}&entity=podcastEpisode&limit=300&country=tw'))
log.append(save('page.html', f'https://podcasts.apple.com/tw/podcast/id{ID}'))
log.append(save('seeall.html', f'https://podcasts.apple.com/tw/podcast/id{ID}?see-all=episodes'))
log.append(save('soundon.xml', 'https://feeds.soundon.fm/podcasts/cbbe3124-188a-4de6-87b4-2b65ed4f2d46.xml'))
log.append(save('firstory.xml', 'https://feed.firstory.me/rss/user/cmdpx4cs200ax01xldg5ta89p'))
# 用搜尋把節目所有單集撈出來（換幾個關鍵字）
found = {}
for term in ['科學好好聽', '科學好好聽 EP', '科學好好聽 宇宙', '科學好好聽 恐龍', '科學好好聽 動物', '科學好好聽 地球']:
    st, b = get('https://itunes.apple.com/search?' + urllib.parse.urlencode({'term': term, 'media': 'podcast', 'entity': 'podcastEpisode', 'limit': 200, 'country': 'tw'}))
    n = 0
    try:
        for r in json.loads(b).get('results', []):
            if str(r.get('collectionId')) == ID:
                found[r['trackId']] = {'title': r.get('trackName'), 'url': r.get('trackViewUrl'), 'date': r.get('releaseDate'), 'audio': r.get('episodeUrl'), 'dur': r.get('trackTimeMillis')}
                n += 1
    except Exception as e:
        log.append(f'search {term}: {e}')
    log.append(f'search {term}: {st} matched {n} (total {len(found)})')
    time.sleep(3.5)
json.dump(list(found.values()), open('probe/out/search.json', 'w'), ensure_ascii=False, indent=1)
open('probe/out/log.txt', 'w').write('\n'.join(log))
print('\n'.join(log))
