"""One-off: write data/placements.json, the hand-checked home of every episode as of 2026-10-23.

Each value is a home id: l01–l10 (萬物旋鈕的格), lane:<id>, era:<id>, studio or skip.
Edit data/placements.json directly from now on; this script only documents the first pass.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def r(a, b):
    return [str(i) for i in range(a, b + 1)]


def s(*nums):
    return ["s%d" % n for n in nums]


GROUPS = [
    ("skip", ["c4s", "c5s", "c6s", "c7s", "c8s", "c9s", "p1", "mother_p"]),
    ("studio", ["c13", "c3"]),
    ("era:earth", ["121", "148"]),
    ("era:life", r(149, 158) + ["170", "171", "172", "178"]),
    ("era:human", s(34, 35, 36, 37, 38, 39)),
    ("era:scientists", ["c21", "c22", "c23", "c25", "c26", "c27", "c29", "s2", "101", "s28"]),
    ("lane:relativity", r(45, 48) + ["c1", "s26"]),
    ("lane:force", ["63", "65", "66", "67", "c14"]),
    ("lane:gravity", ["71", "72"]),
    ("lane:energy", ["75", "76", "87", "88", "c32"]),
    ("lane:light", ["78", "81", "82"]),
    ("lane:sound", ["85", "86"]),
    ("lane:em", ["64", "69", "70"] + r(89, 92)),
    ("l01", r(53, 62) + ["93", "94", "c4"]),
    ("l02", ["c16", "c9", "c18", "s_future"] + s(53, 54, 55, 56, 57, 58)),
    ("l05", r(122, 147) + r(159, 162) + ["c2", "c7", "c17"]),
    ("l06", ["79", "80", "111", "112", "113", "114", "117", "118", "s8", "s9", "s16"]),
    ("l07", ["49"] + r(103, 110) + r(163, 165) + s(7, 10, 11, 12, 14, 15, 17, 19, 23, 61) + ["c30"]),
    ("l08", s(6, 13, 20) + ["83", "84", "115", "116", "119", "120"]),
    ("l09", ["51", "s25", "s3", "s18"]),
    ("l10", ["52", "77"] + s(4, 5, 21, 22, 24)),
    ("l04", ["50", "68", "73", "74"] + r(95, 100) + ["102", "c6", "c8", "c10", "c11", "c28", "c33"]
     + s(27, 29, 30, 31, 40, 47, 48, 49, 50, 51, 52, 59) + ["w1"]),
    ("l03", ["125"] + r(166, 169) + r(173, 177) + r(179, 274)
     + ["c5", "c12", "c15", "c19", "c20", "c24", "c31"] + s(32, 33, 41, 42, 43, 44, 45, 46, 60)),
]

# Secondary homes: the episode also shows up here, the first home stays its main one.
ALSO = {
    "s5": ["era:bigbang"], "s21": ["era:bigbang"], "77": ["era:bigbang"],
    "121": ["l05"], "148": ["l05"],
    "c25": ["lane:gravity"], "s2": ["lane:gravity"], "c26": ["lane:force", "lane:light"],
    "c21": ["lane:force"], "c22": ["lane:force"],
    "45": ["era:scientists"], "46": ["era:scientists"], "47": ["era:scientists"],
    "s24": ["l02"], "c30": ["lane:gravity"], "71": ["l06"], "72": ["l06"],
}

placements = {}
for home, codes in GROUPS:
    for code in codes:
        placements.setdefault(code, {"home": home, "also": ALSO.get(code, [])})

(ROOT / "data" / "placements.json").write_text(
    json.dumps(placements, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
print(len(placements), "placements")
