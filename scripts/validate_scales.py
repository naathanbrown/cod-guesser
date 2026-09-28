#!/usr/bin/env python3
"""Tag maps as core / faceoff / battle from official wiki playlist pages.

Playlist sources (Call of Duty Fandom):
  Face Off, Gunfight, Ground War (modern), Battle Map (playlist),
  Invasion (mode), Skirmish.

Per-map wikitext is too noisy (navboxes mention Face Off / Ground War on
almost every modern page). These playlist galleries are the lists we trust.

Classic 6v6 maps that also appear in Gunfight (Shipment, Rust, Nuketown)
stay core. Launch MWII Ground War maps missing from the current wiki
gallery (Al Bagra Fortress, Zarqwa Hydroelectric) stay battle.

Usage:
  python3 scripts/validate_scales.py          # apply hardcoded playlist lists
  python3 scripts/validate_scales.py --scrape # refresh lists from the wiki API
  python3 scripts/validate_scales.py --check  # print a report, do not write
"""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "src" / "data" / "maps.json"
API = "https://callofduty.fandom.com/api.php"
UA = {"User-Agent": "CalloutQuiz/1.0 (fan-made map quiz; educational)"}

# (gameId, display name) from Face Off + Gunfight galleries.
# Shipment / Rust / Nuketown family are listed here but kept core below.
FACEOFF_NAMES: dict[str, set[str]] = {
    "mw3": {
        "Aground",
        "Erosion",
        "Getaway",
        "Intersection",
        "Lookout",
        "U-Turn",
        "Vortex",
    },
    "mw2019": {
        "Aisle 9",
        "Atrium",
        "Bazaar",
        "Cargo",
        "Docks",
        "Drainage",
        "Gulag Showers",
        "Hill",
        "King",
        "Livestock",
        "Pine",
        "Rust",
        "Shipment",
        "Speedball",
        "Stack",
        "Station",
        "Trench",
        "Verdansk Stadium",
        "Winter Docks",
    },
    "cw": {
        "Amsterdam",
        "Diesel",
        "Game Show",
        "Gluboko",
        "ICBM",
        "KGB",
        "Mansion",
        "Nuketown '84",
        "Showroom",
        "U-Bahn",
    },
    "mwii": {
        "Alley",
        "Blacksite",
        "Canal",
        "Exhibit",
        "Fight",
        "King",
        "Lounge",
        "Mercado",
        "Penthouse",
        "Shipment",
    },
    "mwiii": {
        "Alley",
        "Blacksite",
        "Das Haus",
        "Exhibit",
        "Meat",
        "Rust",
        "Shipmas",
        "Shipment",
        "Stash House",
        "Training Facility",
    },
    "bo6": {
        "Babylon",
        "Blitz",
        "Bullet",
        "Eclipse",
        "Exchange",
        "Gala",
        "Heirloom",
        "Lifeline",
        "Mothball",
        "Nomad",
        "Pit",
        "Racket",
        "Signal",
        "Stakeout",
        "Warhead",
    },
    "bo7": {
        "Abyss",
        "Blackheart",
        "Cortex",
        "Flagship",
        "Liminal",
        "Nexus",
        "Odysseus",
        "Onsen",
        "Paranoia",
        "Torque",
        "Turbo Tilt",
        "Yakei",
        "Zenith",
    },
}

# (gameId, display name) from Ground War, Battle Map, Invasion, Skirmish.
BATTLE_NAMES: dict[str, set[str]] = {
    "mw2019": {
        "Aniyah Palace",
        "Barakett Promenade",
        "Karst River Quarry",
        "Krovnik Farmland",
        "Port of Verdansk",
        "Tavorsk District",
        "Verdansk International Airport",
        "Verdansk Riverside",
        "Zhokov Boneyard",
    },
    "mwii": {
        "Ahkdar",
        "Al Bagra Fortress",
        "Al Malik International",
        "Guijarro",
        "Mawizeh Marsh",
        "Rohan Oilfields",
        "Sa'id",
        "Santa Seña",
        "Sarrif Bay",
        "Sattiq Cave Complex",
        "Taraq",
        "Zarqwa Hydroelectric",
        "Zaya Observatory",
    },
    "mwiii": {
        "Levin Resort",
        "Orlov Military Base",
        "Popov Power",
    },
    "bo7": {
        "Mission: Edge",
        "Mission: Peak",
        "Mission: Tide",
        "Mission: Trident",
    },
}

# Classic 6v6 maps that also rotate in Gunfight / Face Off stay core.
CORE_KEEP = {
    "shipment",
    "shipmas",
    "sunnyshipment",
    "arenashipment",
    "shipment1944",
    "rust",
    "nuketown",
    "nuketown84",
    "nuketown2025",
    "nuketownholiday",
    "nuketown84halloween",
    "nuketown84holiday",
}

SECTION_TO_GAME = {
    "call of duty: modern warfare 3": "mw3",
    "call of duty: modern warfare": "mw2019",
    "call of duty: black ops cold war": "cw",
    "call of duty: modern warfare ii": "mwii",
    "call of duty: modern warfare iii": "mwiii",
    "call of duty: black ops 6": "bo6",
    "call of duty: black ops 7": "bo7",
}

LINK_RE = re.compile(r"\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]")


def norm(name: str) -> str:
    folded = unicodedata.normalize("NFKD", name)
    folded = "".join(ch for ch in folded if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "", folded.lower())


def api(params: dict) -> dict:
    query = urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(f"{API}?{query}", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode())


def wikitext(title: str) -> str:
    data = api({"action": "parse", "page": title, "prop": "wikitext", "formatversion": 2})
    return data.get("parse", {}).get("wikitext", "")


def game_from_heading(heading: str) -> str | None:
    key = heading.strip().lower().replace("''", "")
    key = re.sub(r"\[\[([^\]|]+)\|?[^\]]*\]\]", r"\1", key)
    key = re.sub(r"<[^>]+>", "", key).strip()
    if key.startswith("call of duty: modern warfare 4"):
        return None
    if key in SECTION_TO_GAME:
        return SECTION_TO_GAME[key]
    for prefix, gid in SECTION_TO_GAME.items():
        if key.startswith(prefix) and "mobile" not in key:
            return gid
    return None


def gallery_names(block: str) -> list[str]:
    names: list[str] = []
    for gallery in re.findall(r"<gallery\b[^>]*>(.*?)</gallery>", block, flags=re.I | re.S):
        for raw in LINK_RE.findall(gallery):
            title = raw.split("#", 1)[0].strip()
            if title.lower().startswith(("file:", "category:", "wikipedia:")):
                continue
            title = re.sub(r"\s*\([^)]+\)\s*$", "", title)
            if title and not re.match(r"season\s", title, flags=re.I):
                names.append(title)
    return names


def scrape_playlists() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    pages = {
        "Face Off": "faceoff",
        "Gunfight": "faceoff",
        "Ground War (modern)": "battle",
        "Battle Map (playlist)": "battle",
        "Invasion (mode)": "battle",
        "Skirmish": "battle",
    }
    faceoff: dict[str, set[str]] = defaultdict(set)
    battle: dict[str, set[str]] = defaultdict(set)
    for title, kind in pages.items():
        text = wikitext(title)
        time.sleep(0.2)
        chunks = re.split(r"\n==+\s*", text)
        current_game = None
        # Single-game pages (Battle Map, Skirmish) have no per-game heading.
        if title == "Battle Map (playlist)":
            current_game = "mwii"
        elif title == "Skirmish":
            current_game = "bo7"
        for chunk in chunks:
            heading, _, body = chunk.partition("==")
            heading = heading.strip()
            if heading:
                found = game_from_heading(heading)
                lowered = heading.lower()
                if "mobile" in lowered:
                    current_game = None
                elif found:
                    current_game = found
                elif lowered.startswith("call of duty"):
                    current_game = None
            if current_game is None:
                continue
            dest = faceoff if kind == "faceoff" else battle
            for name in gallery_names(body if body else chunk):
                dest[current_game].add(name)
    return {k: set(v) for k, v in faceoff.items()}, {k: set(v) for k, v in battle.items()}


def classify(record: dict, faceoff: dict[str, set[str]], battle: dict[str, set[str]]) -> str:
    gid = record["gameId"]
    key = norm(record["name"])
    battle_keys = {norm(name) for name in battle.get(gid, set())}
    face_keys = {norm(name) for name in faceoff.get(gid, set())}
    if key in battle_keys:
        return "battle"
    if key in CORE_KEEP:
        return "core"
    if key in face_keys:
        return "faceoff"
    return "core"


def report(records: list[dict], faceoff: dict[str, set[str]], battle: dict[str, set[str]]) -> list[tuple[dict, str, str]]:
    changes = []
    for record in records:
        nxt = classify(record, faceoff, battle)
        old = record.get("scale") or "core"
        if old != nxt:
            changes.append((record, old, nxt))
    return changes


def print_breakdown(records: list[dict], title: str) -> None:
    by_game: dict[str, dict[str, list[str]]] = defaultdict(lambda: {"core": [], "faceoff": [], "battle": []})
    totals = {"core": 0, "faceoff": 0, "battle": 0}
    order: list[tuple[str, str, int]] = []
    seen: set[str] = set()
    for record in records:
        scale = record.get("scale") or "core"
        by_game[record["gameId"]][scale].append(record["name"])
        totals[scale] += 1
        if record["gameId"] not in seen:
            seen.add(record["gameId"])
            order.append((record["gameId"], record["short"], record["year"]))
    print(title)
    print(f"  {len(records)} maps  core {totals['core']}  faceoff {totals['faceoff']}  battle {totals['battle']}")
    print(f"  {'game':<14} {'core':>5} {'face':>5} {'battle':>6} {'total':>6}")
    for gid, short, _year in order:
        bucket = by_game[gid]
        total = sum(len(bucket[k]) for k in ("core", "faceoff", "battle"))
        print(f"  {short:<14} {len(bucket['core']):>5} {len(bucket['faceoff']):>5} {len(bucket['battle']):>6} {total:>6}")


def unmatched(records: list[dict], names: dict[str, set[str]]) -> list[str]:
    have = defaultdict(set)
    for record in records:
        have[record["gameId"]].add(norm(record["name"]))
    missing = []
    for gid, group in names.items():
        for name in sorted(group):
            if norm(name) not in have[gid] and norm(name) not in CORE_KEEP:
                missing.append(f"{gid}: {name}")
    return missing


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scrape", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    faceoff = {k: set(v) for k, v in FACEOFF_NAMES.items()}
    battle = {k: set(v) for k, v in BATTLE_NAMES.items()}
    if args.scrape:
        scraped_face, scraped_battle = scrape_playlists()
        print("scraped faceoff")
        for gid, names in sorted(scraped_face.items()):
            print(f"  {gid}: {', '.join(sorted(names))}")
        print("scraped battle")
        for gid, names in sorted(scraped_battle.items()):
            print(f"  {gid}: {', '.join(sorted(names))}")
        # Keep launch MWII Ground War maps the live gallery dropped.
        scraped_battle.setdefault("mwii", set()).update({"Al Bagra Fortress", "Zarqwa Hydroelectric"})
        faceoff, battle = scraped_face, scraped_battle

    records = json.loads(DATA_PATH.read_text())
    print_breakdown(records, "before")
    changes = report(records, faceoff, battle)
    print(f"\n{len(changes)} tag changes")
    for record, old, nxt in changes:
        print(f"  {record['id']:42} {old:8} -> {nxt:8}  {record['name']}")

    missing_face = unmatched(records, faceoff)
    missing_battle = unmatched(records, battle)
    if missing_face:
        print("\nplaylist faceoff names with no catalog match")
        for line in missing_face:
            print(f"  {line}")
    if missing_battle:
        print("\nplaylist battle names with no catalog match")
        for line in missing_battle:
            print(f"  {line}")

    if args.check:
        return

    for record, _old, nxt in changes:
        record["scale"] = nxt
    for record in records:
        if "scale" not in record:
            record["scale"] = classify(record, faceoff, battle)
    DATA_PATH.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
    print_breakdown(records, "\nafter")
    print(f"wrote {DATA_PATH}")


if __name__ == "__main__":
    main()
