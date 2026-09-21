#!/usr/bin/env python3
"""Cover printed map names when OCR can actually read them."""

from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path

from PIL import Image
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "src" / "data" / "maps.json"
PUBLIC = ROOT / "public"

ENGINE = RapidOCR()


def compact(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def boxes_for(path: Path, name: str) -> list[dict]:
    if not path.exists():
        return []
    image = Image.open(path).convert("RGB")
    width, height = image.size
    target = compact(name)
    if len(target) < 4:
        return []
    result, _ = ENGINE(str(path))
    if not result:
        return []
    hits = []
    for points, text, score in result:
        word = compact(text)
        if len(word) < 4 or score < 0.55:
            continue
        ratio = SequenceMatcher(None, word, target).ratio()
        if not (ratio >= 0.72 or target in word or word in target):
            continue
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        pad_x = width * 0.012
        pad_y = height * 0.012
        x1 = max(0, min(xs) - pad_x)
        y1 = max(0, min(ys) - pad_y)
        x2 = min(width, max(xs) + pad_x)
        y2 = min(height, max(ys) + pad_y)
        hits.append(
            {
                "x": round(x1 / width, 4),
                "y": round(y1 / height, 4),
                "w": round((x2 - x1) / width, 4),
                "h": round((y2 - y1) / height, 4),
            }
        )
    return hits


def job(record: dict, kind: str) -> tuple[str, str, list[dict]]:
    rel = record["minimap"] if kind == "minimap" else record["image"]
    if not rel:
        return record["id"], kind, []
    return record["id"], kind, boxes_for(PUBLIC / rel.lstrip("/"), record["name"])


def main() -> None:
    records = json.loads(DATA_PATH.read_text())
    tasks = []
    for record in records:
        tasks.append((record, "loading"))
        if record.get("minimap"):
            tasks.append((record, "minimap"))
    print(f"scanning {len(tasks)} images", flush=True)
    found = 0
    for done, (record, kind) in enumerate(tasks, start=1):
        map_id, kind, covers = job(record, kind)
        field = "minimapCover" if kind == "minimap" else "cover"
        if covers:
            record[field] = covers
            found += 1
            print(f"cover {kind} {map_id}: {covers}", flush=True)
        elif field in record:
            del record[field]
        if done % 150 == 0:
            print(f"{done}/{len(tasks)}", flush=True)
    DATA_PATH.write_text(json.dumps(records, indent=2) + "\n")
    print(f"wrote {DATA_PATH}; covered {found} images", flush=True)


if __name__ == "__main__":
    main()
