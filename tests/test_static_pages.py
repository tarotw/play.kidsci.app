"""每一集、每一座島的靜態頁面（tools/build_pages.py 產生）要跟目錄一致，sitemap 也要列到。"""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://play.kidsci.app/"


class StaticPagesTest(unittest.TestCase):
    def setUp(self):
        self.episodes = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))["episodes"]
        self.sitemap = set(re.findall(r"<loc>([^<]+)</loc>", (ROOT / "sitemap.xml").read_text(encoding="utf-8")))

    def test_every_episode_has_a_page_in_the_sitemap(self):
        for e in self.episodes:
            page = ROOT / "ep" / e["code"] / "index.html"
            self.assertTrue(page.exists(), e["code"])
            html = page.read_text(encoding="utf-8")
            self.assertIn(f'<link rel="canonical" href="{SITE}ep/{e["code"]}/">', html)
            self.assertIn(f'href="/?ch={e["code"]}"', html)
            self.assertIn(f"{SITE}ep/{e['code']}/", self.sitemap)

    def test_no_pages_for_removed_episodes(self):
        codes = {e["code"] for e in self.episodes}
        self.assertEqual({d.name for d in (ROOT / "ep").iterdir() if d.is_dir()}, codes)

    def test_island_pages_are_in_the_sitemap(self):
        isles = [d.name for d in (ROOT / "isle").iterdir() if d.is_dir()]
        self.assertTrue(isles)
        for isle in isles:
            self.assertIn(f"{SITE}isle/{isle}/", self.sitemap)


if __name__ == "__main__":
    unittest.main()
