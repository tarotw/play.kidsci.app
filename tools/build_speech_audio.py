#!/usr/bin/env python3
"""Build the site's fixed Taiwan Mandarin female narration (pip install edge-tts)."""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import ssl

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'assets' / 'speech'
VOICE = 'zh-TW-HsiaoChenNeural'
EMOJI = re.compile('[\U0001f300-\U0001faff\u2600-\u27bf\ufe0f]')


def clean(text):
    return EMOJI.sub('', text).strip()


def collect_texts():
    texts = set()

    def add(text):
        text = clean(text)
        if text and not re.search(r'\{\w+\}|\$\{', text):
            texts.add(text)

    dialogue = json.loads((ROOT / 'data/dialogue.json').read_text())
    def visit(value):
        if isinstance(value, dict):
            if 'text' in value:
                add(value['text'])
            for key, child in value.items():
                if key not in ['cast', '_comment']:
                    visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(dialogue)
    for text in dialogue['answers'].values():
        add(text)
    for path in [ROOT / name for name in ['islands.js', 'app.js', 'mindmap.js']]:
        for text in re.findall(r"\btext:\s*'([^'\n]*)'", path.read_text()):
            add(text)
    islands = json.loads((ROOT / 'data/islands.json').read_text())['islands']
    for island in islands:
        intro = island.get('intro', '')
        add(intro)
        add(f"歡迎來到宇宙群島！這裡是{island['name']}。{intro}")
    episodes = json.loads((ROOT / 'data/catalog.json').read_text())['episodes']
    for episode in episodes:
        add(f"這一集是：{episode['title']}")
        intro = re.sub(r'^小朋友[，,]\s*', '', episode.get('intro', ''))
        sents = [s.strip() for s in re.findall(r'[^。！？!?]+[。！？!?]*[」』）)]*', intro) if s.strip()]
        if len(intro) > 90 and len(sents) > 2:
            half = (len(sents) + 1) // 2
            add(''.join(sents[:half]))
            add(''.join(sents[half:]))
        elif intro.strip():
            add(intro)
        elif episode.get('content'):
            content_path = ROOT / episode['content']
            if content_path.exists():
                content = json.loads(content_path.read_text())
                takeaways = content.get('takeaways', [])
                add(takeaways[0]['text'] if takeaways else content.get('card', {}).get('description', dialogue['answers']['fallback']))
        else:
            add(dialogue['answers']['fallback'])
    return sorted(texts)


async def build(limit=None):
    import edge_tts
    import edge_tts.communicate as communicate_module
    # Keep the execution environment's configured CA trust, including its proxy CA.
    communicate_module._SSL_CTX = ssl.create_default_context()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    texts = collect_texts()
    if limit:
        texts = texts[:limit]
    files = {text: hashlib.sha256(text.encode()).hexdigest()[:20] + '.mp3' for text in texts}
    semaphore = asyncio.Semaphore(4)
    complete = 0
    failures = []

    async def synthesize(text, filename):
        nonlocal complete
        path = OUTPUT / filename
        async with semaphore:
            if not path.exists() or path.stat().st_size < 1000:
                for attempt in range(3):
                    try:
                        await edge_tts.Communicate(text, VOICE, proxy=os.environ.get('HTTPS_PROXY'),
                                                   connect_timeout=10, receive_timeout=30).save(str(path) + '.tmp')
                        Path(str(path) + '.tmp').replace(path)
                        break
                    except Exception as error:
                        if attempt == 2:
                            failures.append({'file': filename, 'error': str(error)})
                        else:
                            await asyncio.sleep(1 + attempt)
            complete += 1
            if complete % 20 == 0 or complete == len(files):
                print(f'Narration {complete}/{len(files)}; failures={len(failures)}', flush=True)
    await asyncio.gather(*(synthesize(text, filename) for text, filename in files.items()))
    if failures:
        raise RuntimeError(json.dumps(failures, ensure_ascii=False))
    manifest = {'voice': VOICE, 'lang': 'zh-TW', 'clips': files}
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Ready: {len(files)} clips; {sum((OUTPUT / f).stat().st_size for f in files.values()) / 1e6:.1f} MB', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int)
    args = parser.parse_args()
    asyncio.run(build(args.limit))
