#!/usr/bin/env python3
"""Cache episode artwork without altering images, so previews load from this site."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/episode-covers'


def main():
    path = ROOT / 'data/catalog.json'
    catalog = json.loads(path.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    existing = {f.stem: f for f in OUT.iterdir() if f.is_file()}
    urls = {e['artwork'] for e in catalog['episodes'] if e.get('artwork', '').startswith('https://')}

    def download(url):
        key = hashlib.sha256(url.encode()).hexdigest()[:20]
        cached = existing.get(key)
        if cached and cached.stat().st_size > 1000:
            return url, cached.relative_to(ROOT).as_posix()
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(request, timeout=25) as response:
                content_type = response.headers.get_content_type()
                extension = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}.get(content_type)
                data = response.read()
            if not extension or len(data) < 1000:
                raise ValueError('Missing or invalid image response')
            target = OUT / (key + extension)
            temporary = target.with_suffix(target.suffix + '.tmp')
            temporary.write_bytes(data)
            temporary.replace(target)
            return url, target.relative_to(ROOT).as_posix()
        except Exception as error:
            print(f'Artwork unavailable; keeping remote URL: {type(error).__name__}', flush=True)
            return url, None

    with ThreadPoolExecutor(max_workers=6) as pool:
        cached = dict(pool.map(download, urls))
    for episode in catalog['episodes']:
        local = cached.get(episode.get('artwork'))
        if local:
            episode['artworkLocal'] = local
    path.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + '\n')
    print(f'Episode artwork: {sum(bool(e.get("artworkLocal")) for e in catalog["episodes"])}/{len(catalog["episodes"])} cached; {len(urls)} source images')


if __name__ == '__main__':
    main()
