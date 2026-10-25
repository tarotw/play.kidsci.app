import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tools'))
from platform_links import artwork_url, merge_apple_episode
from status_check import firstory_items


class EpisodeArtworkTests(unittest.TestCase):
    def test_api_artwork_template(self):
        self.assertEqual(artwork_url({'url': 'https://example.com/{w}x{h}bb.{f}'}), 'https://example.com/600x600bb.jpg')
        self.assertIsNone(artwork_url('javascript:bad'))

    def test_partial_search_results_preserve_artwork_and_subscription(self):
        result = merge_apple_episode({'url': 'episode', 'sub': True, 'artwork': 'cover'}, {'url': 'episode', 'artwork': None, 'title': 'new title'})
        self.assertTrue(result['sub'])
        self.assertEqual(result['artwork'], 'cover')
        self.assertEqual(result['title'], 'new title')

    def test_rss_uses_episode_art_before_show_art(self):
        feed = b'''<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
        <itunes:image href="https://example.com/show.jpg"/><item><title>episode</title>
        <itunes:image href="https://example.com/episode.jpg"/></item><item><title>fallback</title></item>
        </channel></rss>'''
        items = firstory_items(feed)
        self.assertEqual(items[0]['artwork'], 'https://example.com/episode.jpg')
        self.assertTrue(items[0]['artworkIsEpisode'])
        self.assertEqual(items[1]['artwork'], 'https://example.com/show.jpg')
        self.assertFalse(items[1]['artworkIsEpisode'])


if __name__ == '__main__':
    unittest.main()
