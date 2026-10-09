#!/usr/bin/env python3
"""Align data/vocabulary.json with the CEFR-J Wordlist (data/sources/cefrj-wordlist-1.6.csv).

  levels      set each word's level to its CEFR-J level (word + part of speech must match)
  candidates  write CEFR-J words that are missing from vocabulary.json to data/new-words/todo-XX.tsv
  merge       add the authored rows in data/new-words/done-XX.tsv to vocabulary.json

vocabulary.json is the master copy (study order was tuned after the data/raw TSV build).
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOCAB = ROOT / "data" / "vocabulary.json"
CEFRJ = ROOT / "data" / "sources" / "cefrj-wordlist-1.6.csv"
WORK = ROOT / "data" / "new-words"

LEVELS = ["A1", "A2", "B1", "B2"]
POS = {"noun", "verb", "adjective", "adverb", "pronoun", "preposition", "determiner", "conjunction", "interjection", "number"}
CHUNK = 250

DECKS = {
    "greetings": "Chào hỏi và giao tiếp",
    "numbers-time": "Số, ngày, giờ",
    "family-people": "Gia đình và người",
    "food-drink": "Đồ ăn và đồ uống",
    "daily-routine": "Sinh hoạt hàng ngày",
    "transport": "Đi lại và phương tiện",
    "shopping-money": "Mua sắm và tiền",
    "home-places": "Nhà cửa và nơi chốn",
    "health": "Sức khỏe",
    "work-study": "Công việc và học tập",
    "weather-nature": "Thời tiết và thiên nhiên",
    "adjectives": "Tính từ mô tả",
    "adverbs": "Trạng từ",
    "common-verbs": "Động từ thông dụng",
    "function-words": "Từ chức năng",
    "clothes": "Quần áo",
    "body-colors": "Cơ thể và màu sắc",
    "animals": "Động vật",
    "society-services": "Xã hội và dịch vụ",
    "feelings-opinions": "Cảm xúc và ý kiến",
    "travel-city": "Du lịch và thành phố",
    "academic-abstract": "Học thuật và trừu tượng",
    "tech-media-business": "Công nghệ, truyền thông, kinh doanh",
    "hobbies-leisure": "Giải trí và sở thích",
    "arts-culture": "Nghệ thuật và văn hóa",
    "science-environment": "Khoa học và môi trường",
    "politics-law": "Chính trị và pháp luật",
}


def slug(word: str, pos: str) -> str:
    return f"{re.sub(r'[^a-z0-9]+', '-', word.lower()).strip('-')}-{pos}"


def load_vocab() -> dict:
    return json.loads(VOCAB.read_text(encoding="utf-8"))


def save_vocab(data: dict) -> None:
    data["count"] = sum(len(d["words"]) for d in data["decks"])
    VOCAB.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_cefrj() -> list[dict]:
    rows = []
    with CEFRJ.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if not r["headword"]:
                continue
            forms = [x.strip() for x in r["headword"].split("/") if x.strip()]
            rows.append({
                "forms": forms,
                "pos": r["pos"].strip().lower(),
                "level": r["CEFR"].strip(),
                "topic": r["CoreInventory 1"] or r["Threshold"] or "",
            })
    return rows


def cmd_levels() -> None:
    data = load_vocab()
    level_of: dict[tuple[str, str], str] = {}
    for r in load_cefrj():
        for form in r["forms"]:
            level_of.setdefault((form.lower(), r["pos"]), r["level"])
    shifts = Counter()
    for deck in data["decks"]:
        for w in deck["words"]:
            new = level_of.get((w["word"].lower(), w["pos"]))
            if new in LEVELS and new != w["level"]:
                shifts[(w["level"], new)] += 1
                w["level"] = new
    save_vocab(data)
    print(f"changed={sum(shifts.values())}", dict(shifts.most_common()))


def cmd_candidates() -> None:
    data = load_vocab()
    have = {w["word"].lower() for d in data["decks"] for w in d["words"]}
    seen: set[tuple[str, str]] = set()
    todo = []
    for r in load_cefrj():
        if r["pos"] not in POS or r["level"] not in LEVELS:
            continue
        if any(f.lower() in have for f in r["forms"]):
            continue
        key = (r["forms"][0].lower(), r["pos"])
        if key in seen:
            continue
        seen.add(key)
        todo.append((r["forms"][0], r["pos"], r["level"], r["topic"]))
    todo.sort(key=lambda t: (LEVELS.index(t[2]), t[0].lower()))
    WORK.mkdir(exist_ok=True)
    for i in range(0, len(todo), CHUNK):
        path = WORK / f"todo-{i // CHUNK + 1:02d}.tsv"
        path.write_text("".join("\t".join(t) + "\n" for t in todo[i:i + CHUNK]), encoding="utf-8")
    print(f"candidates={len(todo)} files={(len(todo) + CHUNK - 1) // CHUNK}", Counter(t[2] for t in todo))


def ipa_for(phrase: str, fallback: str) -> str:
    try:
        import eng_to_ipa
    except ImportError:
        sys.exit("pip install eng_to_ipa")
    out = eng_to_ipa.convert(phrase)
    if out and "*" not in out:
        return f"/{out}/"
    return fallback


def cmd_merge() -> None:
    data = load_vocab()
    decks = {d["id"]: d for d in data["decks"]}
    ids = {w["id"] for d in data["decks"] for w in d["words"]}
    added: dict[str, list[dict]] = {}
    errors, skipped = [], 0
    for path in sorted(WORK.glob("done-*.tsv")):
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            parts = [p.strip() for p in line.split("\t")]
            if parts[0] == "SKIP":
                skipped += 1
                continue
            if len(parts) != 8:
                errors.append(f"{path.name}:{n} expected 8 fields, got {len(parts)}")
                continue
            deck, word, pos, level, ipa, meaning, example, example_vi = parts
            where = f"{path.name}:{n} {word}"
            if deck not in DECKS:
                errors.append(f"{where}: unknown deck {deck}")
            elif pos not in POS or level not in LEVELS:
                errors.append(f"{where}: bad pos/level {pos}/{level}")
            elif not all([word, meaning, example, example_vi]):
                errors.append(f"{where}: empty field")
            elif slug(word, pos) in ids:
                errors.append(f"{where}: duplicate id {slug(word, pos)}")
            else:
                wid = slug(word, pos)
                ids.add(wid)
                added.setdefault(deck, []).append({
                    "id": wid,
                    "word": word,
                    "ipa": ipa_for(word, ipa if ipa.startswith("/") else f"/{ipa.strip('/')}/" if ipa else ""),
                    "pos": pos,
                    "level": level,
                    "meaningVi": meaning,
                    "example": example,
                    "exampleVi": example_vi,
                })
    if errors:
        print("\n".join(errors[:50]))
        sys.exit(f"{len(errors)} errors, nothing merged")

    for deck_id, words in added.items():
        if deck_id not in decks:
            decks[deck_id] = {"id": deck_id, "titleVi": DECKS[deck_id], "words": []}
            data["decks"].append(decks[deck_id])
        # New words go after the hand-ordered ones, easiest first.
        words.sort(key=lambda w: LEVELS.index(w["level"]))
        decks[deck_id]["words"].extend(words)
    save_vocab(data)
    total = sum(len(v) for v in added.values())
    print(f"added={total} skipped={skipped}", {k: len(v) for k, v in added.items()})


if __name__ == "__main__":
    commands = {"levels": cmd_levels, "candidates": cmd_candidates, "merge": cmd_merge}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        sys.exit(f"usage: {sys.argv[0]} {'|'.join(commands)}")
    commands[sys.argv[1]]()
