#!/usr/bin/env python3
"""Build data/vocabulary.json from tab-separated source files in data/raw/.

Legacy: vocabulary.json is now edited directly (study order, CEFR-J levels and new words via
scripts/cefrj.py). Running this would overwrite those changes.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "vocabulary.json"

POS = {
    "noun",
    "verb",
    "adjective",
    "adverb",
    "pronoun",
    "preposition",
    "determiner",
    "conjunction",
    "interjection",
    "number",
}
LEVELS = {"A1", "A2", "B1", "B2"}

DECKS = [
    ("greetings", "Chào hỏi và giao tiếp"),
    ("numbers-time", "Số, ngày, giờ"),
    ("family-people", "Gia đình và người"),
    ("food-drink", "Đồ ăn và đồ uống"),
    ("daily-routine", "Sinh hoạt hàng ngày"),
    ("transport", "Đi lại và phương tiện"),
    ("shopping-money", "Mua sắm và tiền"),
    ("home-places", "Nhà cửa và nơi chốn"),
    ("health", "Sức khỏe"),
    ("work-study", "Công việc và học tập"),
    ("weather-nature", "Thời tiết và thiên nhiên"),
    ("adjectives", "Tính từ mô tả"),
    ("adverbs", "Trạng từ"),
    ("common-verbs", "Động từ thông dụng"),
    ("function-words", "Từ chức năng"),
    ("clothes", "Quần áo"),
    ("body-colors", "Cơ thể và màu sắc"),
    ("animals", "Động vật"),
    ("society-services", "Xã hội và dịch vụ"),
    ("feelings-opinions", "Cảm xúc và ý kiến"),
    ("travel-city", "Du lịch và thành phố"),
    ("academic-abstract", "Học thuật và trừu tượng"),
    ("tech-media-business", "Công nghệ, truyền thông, kinh doanh"),
]

DECK_TITLE = dict(DECKS)


def slug(word: str, pos: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", word.lower()).strip("-")
    return f"{base}-{pos}"


def load_rows() -> list[dict]:
    rows: list[dict] = []
    files = sorted(RAW.glob("*.tsv"))
    if not files:
        sys.exit(f"No TSV files in {RAW}")
    for path in files:
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) != 7:
                sys.exit(f"{path.name}:{lineno} expected 7 fields, got {len(parts)}")
            deck, word, pos, level, meaning, example, example_vi = [p.strip() for p in parts]
            if deck not in DECK_TITLE:
                sys.exit(f"{path.name}:{lineno} unknown deck {deck}")
            if pos not in POS:
                sys.exit(f"{path.name}:{lineno} unknown pos {pos}")
            if level not in LEVELS:
                sys.exit(f"{path.name}:{lineno} unknown level {level}")
            if not word or not meaning or not example or not example_vi:
                sys.exit(f"{path.name}:{lineno} empty field")
            rows.append(
                {
                    "deck": deck,
                    "word": word,
                    "pos": pos,
                    "level": level,
                    "meaningVi": meaning,
                    "example": example,
                    "exampleVi": example_vi,
                    "source": f"{path.name}:{lineno}",
                }
            )
    return rows


IPA_OVERRIDE = {
    "stepbrother": "/ˈstɛpˌbrʌðər/",
    "barcode": "/ˈbɑrkoʊd/",
    "toothache": "/ˈtuθeɪk/",
    "stomachache": "/ˈstʌməkeɪk/",
    "hygienic": "/haɪˈdʒɛnɪk/",
    "classwork": "/ˈklæswɜrk/",
    "highlighter": "/ˈhaɪˌlaɪtər/",
    "postgraduate": "/ˌpoʊstˈɡrædʒuət/",
    "hoodie": "/ˈhʊdi/",
    "touristy": "/ˈtʊrɪsti/",
    "username": "/ˈjuzərneɪm/",
    "ecommerce": "/ˈikɑmɜrs/",
    "smartphone": "/ˈsmɑrtfoʊn/",
    "inbox": "/ˈɪnbɑks/",
    "screenshot": "/ˈskrinʃɑt/",
    "influencer": "/ˈɪnfluənsər/",
    "login": "/ˈlɔɡɪn/",
    "logout": "/ˈlɔɡaʊt/",
    "t-shirt": "/ˈtiʃɜrt/",
    "o'clock": "/əˈklɑk/",
    "mother-in-law": "/ˈmʌðər ɪn lɔ/",
    "father-in-law": "/ˈfɑðər ɪn lɔ/",
    "brother-in-law": "/ˈbrʌðər ɪn lɔ/",
    "sister-in-law": "/ˈsɪstər ɪn lɔ/",
}


def ipa_for(word: str) -> str:
    key = word.lower()
    if key in IPA_OVERRIDE:
        return IPA_OVERRIDE[key]
    try:
        import eng_to_ipa as ipa
    except ImportError:
        return ""
    head = word.split()[0]
    pronounced = ipa.convert(head)
    if not pronounced or "*" in pronounced:
        return ""
    return f"/{pronounced}/"


def main() -> None:
    rows = load_rows()
    seen: dict[str, str] = {}
    unique: list[dict] = []
    dupes = []
    for row in rows:
        key = slug(row["word"], row["pos"])
        if key in seen:
            dupes.append(f"{key} ({row['source']} duplicates {seen[key]})")
            continue
        seen[key] = row["source"]
        row["id"] = key
        row["ipa"] = ipa_for(row["word"])
        unique.append(row)

    decks = []
    by_deck: dict[str, list] = {deck_id: [] for deck_id, _ in DECKS}
    for row in unique:
        by_deck[row["deck"]].append(
            {
                "id": row["id"],
                "word": row["word"],
                "ipa": row["ipa"],
                "pos": row["pos"],
                "level": row["level"],
                "meaningVi": row["meaningVi"],
                "example": row["example"],
                "exampleVi": row["exampleVi"],
            }
        )
    for deck_id, title in DECKS:
        words = by_deck[deck_id]
        if not words:
            continue
        decks.append({"id": deck_id, "titleVi": title, "words": words})

    payload = {
        "version": 1,
        "name": "Tu vung thong dung A1-B2",
        "description": (
            "Bo tu tieng Anh thong dung khoang 3000 muc, muc A1 den B2, "
            "co nghia tieng Viet, phien am, va cau vi du. "
            "Phien am la tieng Anh-My (CMU) khi tra duoc; de trong neu tu khong co trong tu dien phien am. "
            "Bo tu tu bien, khong phai danh sach Oxford 3000."
        ),
        "language": {"learning": "en", "gloss": "vi"},
        "count": len(unique),
        "decks": decks,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing_ipa = sum(1 for row in unique if not row["ipa"])
    levels = Counter(row["level"] for row in unique)
    print(f"words={len(unique)} decks={len(decks)} missing_ipa={missing_ipa}")
    print("levels", dict(levels))
    print("decks", {d["id"]: len(d["words"]) for d in decks})
    if dupes:
        print(f"skipped_dupes={len(dupes)}")
        for line in dupes[:30]:
            print("  ", line)
    if len(unique) < 3000:
        sys.exit(f"Need at least 3000 words, got {len(unique)}")


if __name__ == "__main__":
    main()
