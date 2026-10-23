#!/usr/bin/env python3
"""從 Drive 的 listensci 集數資料夾產生網站用的單集內容 data/episodes/<代碼>.json。

在你的電腦上執行，--drive 指向 Google Drive 同步資料夾，例如：
  python3 tools/build_episodes.py --drive "~/Library/CloudStorage/GoogleDrive-…/我的雲端硬碟/科學podcast/workspace/listensci"

讀取：key_takeaways.json、card_description.json、quiz.json、audio_question.json、
family_discussion.json、tags.json、3d_caption.txt、suspect.md、card_figure.jpg、3d.jpg。
suspect.md 有未處理的 ❌ 時，該集不輸出；確認處理完後把代碼加進 data/factcheck_ok.json。
測驗只有列在 data/quiz_reviewed.json 的集數才會在網站上出現。
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = DATA / "episodes"
IMAGES = ROOT / "assets" / "episodes"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def to_seconds(stamp: str) -> int | None:
    parts = [int(p) for p in stamp.split(":") if p.isdigit()]
    if not parts:
        return None
    seconds = 0
    for p in parts:
        seconds = seconds * 60 + p
    return seconds


def open_fact_issues(folder: Path) -> list[str]:
    path = folder / "suspect.md"
    if not path.exists():
        return []
    issues = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if "❌" in line and line.startswith("|"):
            issues.append(line.strip("| ").split("|")[0].strip())
    return issues


def split_answers(reference: str) -> tuple[str, list[str]]:
    """reference_answer 是「說明 + 參考回答：1. … 2. …」的格式。"""
    head, _, tail = reference.partition("參考回答")
    answers = [re.sub(r"^\d+\.\s*", "", line).strip() for line in tail.splitlines() if re.match(r"^\s*\d+\.", line)]
    return head.strip(), answers


def convert_image(src: Path, dest: Path, size: tuple[int, int]) -> bool:
    try:
        from PIL import Image
    except ImportError:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as img:
        img = img.convert("RGB")
        img.thumbnail(size)
        img.save(dest, "WEBP", quality=80)
    return True


def build(code: str, folder: Path, quiz_ok: set[str]) -> dict:
    episode: dict = {"code": code}

    takeaways = read_json(folder / "key_takeaways.json")
    if takeaways:
        episode["takeaways"] = [
            {"emoji": t.get("emoji", ""), "text": t["content"], "t": to_seconds(t.get("timestamp", ""))}
            for t in takeaways.get("KeyTakeaway", [])
        ]

    card = read_json(folder / "card_description.json")
    if card:
        episode["card"] = {"name": card["name"], "description": card["description"], "knowledge": card.get("knowledge", [])}

    quiz = read_json(folder / "quiz.json")
    if quiz:
        # 網站先只用第 1–2 級；第 3 級較難，也較常出錯。
        episode["quiz"] = {
            "reviewed": code in quiz_ok,
            "items": [q for q in quiz.get("quiz", []) if q.get("level", 1) <= 2],
        }

    question = read_json(folder / "audio_question.json")
    if question and question.get("AudioQuestion"):
        q = question["AudioQuestion"][0]
        note, answers = split_answers(q.get("reference_answer", ""))
        episode["question"] = {"topic": q.get("topic"), "text": q["description"], "note": note, "answers": answers}

    family = read_json(folder / "family_discussion.json")
    if family:
        episode["family"] = [{"topic": f.get("topic"), "text": f["description"]} for f in family.get("FamilyDiscussion", [])]

    tags = read_json(folder / "tags.json")
    if tags:
        episode["tags"] = tags.get("tags", [])

    caption = folder / "3d_caption.txt"
    if caption.exists():
        episode["caption"] = caption.read_text(encoding="utf-8").strip()

    if (folder / "card_figure.jpg").exists() and convert_image(folder / "card_figure.jpg", IMAGES / code / "card.webp", (512, 512)):
        episode["cardImage"] = f"assets/episodes/{code}/card.webp"
    if (folder / "3d.jpg").exists() and convert_image(folder / "3d.jpg", IMAGES / code / "pano.webp", (4096, 2048)):
        episode["panorama"] = f"assets/episodes/{code}/pano.webp"
    return episode


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--drive", required=True, help="listensci 集數資料夾的本機路徑")
    ap.add_argument("--codes", nargs="*", help="只處理這些代碼；預設處理 catalog.json 裡全部的集數")
    args = ap.parse_args()

    drive = Path(args.drive).expanduser()
    fact_ok = set(read_json(DATA / "factcheck_ok.json") or [])
    quiz_ok = set(read_json(DATA / "quiz_reviewed.json") or [])
    codes = args.codes or [e["code"] for e in read_json(DATA / "catalog.json")["episodes"]]

    OUT.mkdir(parents=True, exist_ok=True)
    report = {"built": [], "held": {}, "missing": []}
    for code in codes:
        folder = drive / code
        if not folder.is_dir():
            report["missing"].append(code)
            continue
        issues = open_fact_issues(folder)
        if issues and code not in fact_ok:
            report["held"][code] = issues
            (OUT / f"{code}.json").unlink(missing_ok=True)
            continue
        episode = build(code, folder, quiz_ok)
        (OUT / f"{code}.json").write_text(json.dumps(episode, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        report["built"].append(code)

    (OUT / "_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"built {len(report['built'])}, held for fact-check {len(report['held'])}, missing folder {len(report['missing'])}")
    for code, issues in report["held"].items():
        print(f"  held {code}: {'; '.join(issues)}")


if __name__ == "__main__":
    main()
