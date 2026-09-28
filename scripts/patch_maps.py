#!/usr/bin/env python3
"""Fix Santa Seña, tag core/faceoff/battle, and hide image filenames."""

from __future__ import annotations

import hashlib
import json
import shutil
import urllib.request
from urllib.parse import urlencode
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "src" / "data" / "maps.json"
PUBLIC = ROOT / "public"
API = "https://callofduty.fandom.com/api.php"
UA = {"User-Agent": "CalloutQuiz/1.0 (fan-made map quiz; educational)"}

BATTLE = {
    "aniyah-palace-mw2019",
    "barakett-promenade-mw2019",
    "karst-river-quarry-mw2019",
    "krovnik-farmland-mw2019",
    "port-of-verdansk-mw2019",
    "tavorsk-district-mw2019",
    "verdansk-international-airport-mw2019",
    "verdansk-riverside-mw2019",
    "verdansk-stadium-mw2019",
    "zhokov-boneyard-mw2019",
    "ahkdar-mwii",
    "al-bagra-fortress-mwii",
    "al-malik-international-mwii",
    "mawizeh-marsh-mwii",
    "rohan-oilfields-mwii",
    "sa-id-mwii",
    "santa-sena-mwii",
    "sarrif-bay-mwii",
    "sattiq-cave-complex-mwii",
    "taraq-mwii",
    "zarqwa-hydroelectric-mwii",
    "zaya-observatory-mwii",
}

FACEOFF = {
    "aisle-9-mw2019",
    "atrium-mw2019",
    "bazaar-mw2019",
    "cargo-mw2019",
    "docks-mw2019",
    "drainage-mw2019",
    "gulag-showers-mw2019",
    "hill-mw2019",
    "king-mw2019",
    "livestock-mw2019",
    "pine-mw2019",
    "speedball-mw2019",
    "stack-mw2019",
    "station-mw2019",
    "trench-mw2019",
    "winter-docks-mw2019",
    "alley-mwii",
    "black-gold-mwii",
    "blacksite-mwii",
    "canal-mwii",
    "dome-mwii",
    "drc-zone-1-mwii",
    "exhibit-mwii",
    "fight-mwii",
    "guijarro-mwii",
    "king-mwii",
    "koro-village-mwii",
    "la-casa-mwii",
    "lounge-mwii",
    "penthouse-mwii",
    "showdown-mwii",
    "strike-mwii",
    "das-haus-vg",
    "dealership-bo6",
    "hideout-bo6",
    "racket-bo6",
    "extraction-bo6",
    "lifeline-bo6",
    "barrage-bo6",
    "blitz-bo6",
}


def api(params: dict) -> dict:
    req = urllib.request.Request(f"{API}?{urlencode(params)}&format=json", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode())


def file_url(filename: str) -> str:
    data = api({"action": "query", "titles": f"File:{filename}", "prop": "imageinfo", "iiprop": "url"})
    for page in data["query"]["pages"].values():
        info = (page.get("imageinfo") or [None])[0]
        if info:
            return info["url"]
    raise RuntimeError(f"no url for {filename}")


def save_jpeg(url: str, dest: Path, kind: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={**UA, "Accept": "image/*"})
    with urllib.request.urlopen(req, timeout=60) as res:
        raw = res.read()
    tmp = dest.with_suffix(".part")
    tmp.write_bytes(raw)
    try:
        with Image.open(tmp) as im:
            if kind == "minimap" and "A" in im.getbands():
                rgba = im.convert("RGBA")
                canvas = Image.new("RGB", rgba.size, (8, 12, 9))
                canvas.paste(rgba, mask=rgba.getchannel("A"))
                im = canvas
            else:
                im = im.convert("RGB")
            im.thumbnail((1440, 1440) if kind == "loading" else (1024, 1024))
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest, "JPEG", quality=80, optimize=True)
    finally:
        tmp.unlink(missing_ok=True)


def asset_name(map_id: str, kind: str) -> str:
    digest = hashlib.sha256(f"{map_id}:{kind}:callout-v1".encode()).hexdigest()[:16]
    return f"/i/{digest}.jpg"


def paint_covers(path: Path, boxes: list[dict] | None) -> None:
    if not boxes or not path.exists():
        return
    with Image.open(path) as im:
        im = im.convert("RGB")
        draw = ImageDraw.Draw(im)
        width, height = im.size
        for box in boxes:
            x1 = int(box["x"] * width)
            y1 = int(box["y"] * height)
            x2 = int((box["x"] + box["w"]) * width)
            y2 = int((box["y"] + box["h"]) * height)
            draw.rectangle((x1, y1, x2, y2), fill=(8, 12, 9))
        im.save(path, "JPEG", quality=82, optimize=True)


def fix_santa(records: list[dict]) -> None:
    old = next(record for record in records if record["id"] == "santa-se-a-mwii")
    old.update(
        {
            "id": "santa-sena-border-crossing-mwii",
            "name": "Santa Seña Border Crossing",
            "standard": False,
            "scale": "core",
            "blurb": "6v6 core map on the central road of Santa Seña.",
            "source": "https://callofduty.fandom.com/wiki/Santa_Se%C3%B1a",
        }
    )
    battle = {
        "id": "santa-sena-mwii",
        "name": "Santa Seña",
        "gameId": "mwii",
        "game": "Call of Duty: Modern Warfare II",
        "short": "MWII",
        "year": 2022,
        "standard": True,
        "scale": "battle",
        "blurb": "Battle map on the US-Mexico border, built for Ground War and Invasion.",
        "image": "/maps/santa-sena-mwii.jpg",
        "minimap": "/minimaps/santa-sena-mwii.jpg",
        "source": "https://callofduty.fandom.com/wiki/Santa_Se%C3%B1a",
    }
    if not any(record["id"] == battle["id"] for record in records):
        records.insert(records.index(old) + 1, battle)
    maps_dir = PUBLIC / "maps"
    mini_dir = PUBLIC / "minimaps"
    old_image = maps_dir / "santa-se-a-mwii.jpg"
    old_mini = mini_dir / "santa-se-a-mwii.jpg"
    if old_image.exists():
        shutil.copy2(old_image, maps_dir / "santa-sena-border-crossing-mwii.jpg")
    if old_mini.exists():
        shutil.copy2(old_mini, mini_dir / "santa-sena-border-crossing-mwii.jpg")
    old["image"] = "/maps/santa-sena-border-crossing-mwii.jpg"
    old["minimap"] = "/minimaps/santa-sena-border-crossing-mwii.jpg"
    print("downloading Santa Seña battle images", flush=True)
    save_jpeg(file_url("SantaSena LoadingScreen MWII.jpg"), maps_dir / "santa-sena-mwii.jpg", "loading")
    save_jpeg(file_url("SantaSena MiniMap MWII.png"), mini_dir / "santa-sena-mwii.jpg", "minimap")


def main() -> None:
    records = json.loads(DATA_PATH.read_text())
    fix_santa(records)
    for record in records:
        if "scale" not in record:
            if record["id"] in BATTLE or "battle map" in (record.get("blurb") or "").lower():
                record["scale"] = "battle"
            elif record["id"] in FACEOFF:
                record["scale"] = "faceoff"
            else:
                record["scale"] = "core"

    dest_dir = PUBLIC / "i"
    dest_dir.mkdir(parents=True, exist_ok=True)
    moved = 0
    for record in records:
        for kind, key in (("loading", "image"), ("minimap", "minimap")):
            rel = record.get(key)
            if not rel:
                continue
            src = PUBLIC / rel.lstrip("/")
            hashed = asset_name(record["id"], kind)
            dest = PUBLIC / hashed.lstrip("/")
            if src.exists() and src.resolve() != dest.resolve():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest)
                moved += 1
            boxes = record.get("minimapCover") if kind == "minimap" else record.get("cover")
            paint_covers(dest, boxes)
            record[key] = hashed
        record.pop("cover", None)
        record.pop("minimapCover", None)

    DATA_PATH.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
    for folder in (PUBLIC / "maps", PUBLIC / "minimaps"):
        if folder.exists():
            shutil.rmtree(folder)
    print(f"hashed {moved} pictures, wrote {DATA_PATH}", flush=True)


if __name__ == "__main__":
    main()
