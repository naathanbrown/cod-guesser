#!/usr/bin/env python3
"""Download Call of Duty loading screens from the Call of Duty Wiki.

Covers multiplayer maps from Call of Duty 4: Modern Warfare through
Black Ops II. Images are the wiki's loading-screen files for that game.
"""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "maps"
DATA_PATH = ROOT / "src" / "data" / "maps.json"
API = "https://callofduty.fandom.com/api.php"
UA = {"User-Agent": "CalloutQuiz/1.0 (fan-made map quiz; educational)"}

GAMES = [
    {
        "id": "cod4",
        "name": "Call of Duty 4: Modern Warfare",
        "short": "CoD4",
        "year": 2007,
        "category": "Category:Call of Duty 4: Modern Warfare Multiplayer Maps",
        "tabs": {"cod4"},
        "launch": {
            "Ambush",
            "Backlot",
            "Bloc",
            "Bog",
            "Countdown",
            "Crash",
            "Crossfire",
            "District",
            "Downpour",
            "Overgrown",
            "Pipeline",
            "Shipment",
            "Showdown",
            "Strike",
            "Vacant",
            "Wet Work",
        },
    },
    {
        "id": "waw",
        "name": "Call of Duty: World at War",
        "short": "World at War",
        "year": 2008,
        "category": "Category:Call of Duty: World at War Multiplayer Maps",
        "tabs": {"waw", "worldatwar"},
        "launch": {
            "Airfield",
            "Asylum",
            "Castle",
            "Cliffside",
            "Courtyard",
            "Dome",
            "Downfall",
            "Hangar",
            "Makin",
            "Outskirts",
            "Roundhouse",
            "Seelow",
            "Upheaval",
        },
    },
    {
        "id": "mw2",
        "name": "Call of Duty: Modern Warfare 2",
        "short": "MW2",
        "year": 2009,
        "category": "Category:Call of Duty: Modern Warfare 2 Multiplayer Maps",
        "tabs": {"mw2"},
        "launch": {
            "Afghan",
            "Derail",
            "Estate",
            "Favela",
            "Highrise",
            "Invasion",
            "Karachi",
            "Quarry",
            "Rundown",
            "Rust",
            "Scrapyard",
            "Skidrow",
            "Sub Base",
            "Terminal",
            "Underpass",
            "Wasteland",
        },
    },
    {
        "id": "bo1",
        "name": "Call of Duty: Black Ops",
        "short": "Black Ops",
        "year": 2010,
        "category": "Category:Call of Duty: Black Ops Multiplayer Maps",
        "tabs": {"bo", "bo1", "blackops"},
        "launch": {
            "Array",
            "Crisis",
            "Cracked",
            "Firing Range",
            "Grid",
            "Hanoi",
            "Havana",
            "Jungle",
            "Launch",
            "Nuketown",
            "Radiation",
            "Summit",
            "Villa",
            "WMD",
        },
    },
    {
        "id": "mw3",
        "name": "Call of Duty: Modern Warfare 3",
        "short": "MW3",
        "year": 2011,
        "category": "Category:Call of Duty: Modern Warfare 3 Multiplayer Maps",
        "tabs": {"mw3"},
        "launch": {
            "Arkaden",
            "Bakaara",
            "Bootleg",
            "Carbon",
            "Dome",
            "Downturn",
            "Fallen",
            "Hardhat",
            "Interchange",
            "Lockdown",
            "Mission",
            "Outpost",
            "Resistance",
            "Seatown",
            "Underground",
            "Village",
        },
    },
    {
        "id": "bo2",
        "name": "Call of Duty: Black Ops II",
        "short": "Black Ops II",
        "year": 2012,
        "category": "Category:Call of Duty: Black Ops II Multiplayer Maps",
        "tabs": {"bo2", "boii", "blackopsii", "blackops2"},
        "launch": {
            "Aftermath",
            "Cargo",
            "Carrier",
            "Drone",
            "Express",
            "Hijacked",
            "Meltdown",
            "Overflow",
            "Plaza",
            "Raid",
            "Slums",
            "Standoff",
            "Turbine",
            "Yemen",
            "Nuketown 2025",
        },
    },
]


def api(params: dict) -> dict:
    query = urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(f"{API}?{query}", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def category_pages(title: str) -> list[str]:
    pages: list[str] = []
    cont: dict = {}
    while True:
        data = api(
            {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": title,
                "cmlimit": "500",
                "cmtype": "page",
                **cont,
            }
        )
        for member in data["query"]["categorymembers"]:
            if member["ns"] == 0:
                pages.append(member["title"])
        if "continue" not in data:
            return pages
        cont = data["continue"]


def fetch_wikitext(titles: list[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    for i in range(0, len(titles), 8):
        chunk = titles[i : i + 8]
        data = api(
            {
                "action": "query",
                "titles": "|".join(chunk),
                "prop": "revisions",
                "rvprop": "content",
                "rvslots": "main",
            }
        )
        for page in data["query"]["pages"].values():
            revs = page.get("revisions") or []
            if not revs:
                continue
            found[page["title"]] = revs[0]["slots"]["main"]["*"]
        time.sleep(0.15)
    return found


def norm_tab(label: str) -> str:
    return re.sub(r"[^a-z0-9]", "", label.lower())


def clean_wiki(text: str) -> str:
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"<ref[^/]*/>", "", text)
    text = re.sub(r"\{\{w\|([^}|]+)(?:\|[^}]*)?\}\}", r"\1", text)
    text = re.sub(r"\[\[(?:[^|\]]+\|)?([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("''", "")
    text = re.sub(r"\{\{[^{}]+\}\}", "", text)
    text = text.replace("&nbsp;", " ").replace("—", " - ")
    text = re.sub(r"\s+", " ", text).strip(" .")
    return text


def image_score(filename: str) -> int:
    low = filename.lower()
    if any(
        bad in low
        for bad in (
            "minimap",
            "mini map",
            "icon",
            "emblem",
            "logo",
            "compass",
            "promo",
            "winners",
            "menu",
        )
    ):
        return -10
    score = 0
    if "bare" in low and "load" in low:
        score += 6
    if any(token in low for token in ("load screen", "loadscreen", "loading screen", "loadingscreen", "loading_screen")):
        score += 4
    elif "load" in low:
        score += 2
    return score


def pick_file(wikitext: str, tabs: set[str]) -> str | None:
    # Stop at the next infobox field. Tabber rows also start with "|",
    # so require a letter after the pipe (game, teams, place, ...).
    match = re.search(r"\|image\s*=\s*(.*?)\n\|[A-Za-z]", wikitext, re.S)
    if not match:
        return None
    section = match.group(1)
    candidates: list[tuple[int, str]] = []
    if "<tabber>" in section.lower() or "|-|" in section:
        for label, filename in re.findall(
            r"\|-\|\s*([^=\n]+?)\s*=\s*\[\[(?:File|file):([^\]|]+)",
            section,
        ):
            if norm_tab(label) not in tabs:
                continue
            filename = filename.strip()
            score = image_score(filename)
            if score >= 0:
                candidates.append((score, filename))
    else:
        found = re.search(r"\[\[(?:File|file):([^\]|]+)", section)
        if found:
            filename = found.group(1).strip()
            score = image_score(filename)
            if score >= 0:
                candidates.append((score, filename))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def field(wikitext: str, name: str) -> str | None:
    match = re.search(rf"\|{name}\s*=\s*(.+)", wikitext)
    if not match:
        return None
    return clean_wiki(match.group(1))


def blurb_from(wikitext: str, map_name: str) -> str:
    del map_name  # The reveal happens after the guess, so the name may appear.
    match = re.search(r"\{\{Quote\|(.*?)\}\}", wikitext, re.S)
    if match:
        inner = match.group(1).strip()
        if "|" in inner:
            body, tail = inner.rsplit("|", 1)
            if "[[" not in tail and len(tail) < 60:
                inner = body
        text = clean_wiki(inner)
        if len(text) > 20 and "|" not in text and "[[" not in text:
            return text[:220]
    terrain = field(wikitext, "terrain") or ""
    if terrain and "|" not in terrain and len(terrain) > 12 and "file:" not in terrain.lower():
        return terrain[:180]
    return ""


# The MW2 wiki file prints the map name across the photo.
# Call of Duty Online reused the same map with a clean loading screen.
FILE_OVERRIDES = {
    ("Highrise", "mw2"): "Highrise LoadingScreen CoDO.png",
}


def slug(name: str, game_id: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{base}-{game_id}"


def file_urls(filenames: list[str]) -> dict[str, str]:
    urls: dict[str, str] = {}
    unique = list(dict.fromkeys(filenames))
    for i in range(0, len(unique), 30):
        chunk = unique[i : i + 30]
        titles = "|".join(f"File:{name}" for name in chunk)
        data = api(
            {
                "action": "query",
                "titles": titles,
                "prop": "imageinfo",
                "iiprop": "url",
            }
        )
        for page in data["query"]["pages"].values():
            info = (page.get("imageinfo") or [None])[0]
            title = page.get("title", "")
            if info and title.startswith("File:"):
                urls[title[5:]] = info["url"]
        time.sleep(0.1)
    missing = [name for name in unique if name not in urls and "_" in name]
    if missing:
        spaced = [name.replace("_", " ") for name in missing]
        for spaced_name, url in file_urls(spaced).items():
            urls[spaced_name.replace(" ", "_")] = url
    return urls


def download_jpeg(url: str, dest: Path) -> None:
    # Ask the thumbnailer for a JPEG wide enough to quiz from.
    sep = "&" if "?" in url else "?"
    jpeg_url = f"{url}{sep}format=original"
    req = urllib.request.Request(jpeg_url, headers={**UA, "Accept": "image/jpeg"})
    with urllib.request.urlopen(req, timeout=60) as res:
        data = res.read()
    tmp = dest.with_suffix(".part")
    tmp.write_bytes(data)
    try:
        with Image.open(tmp) as im:
            im = im.convert("RGB")
            if im.width < 640:
                raise ValueError(f"too small: {im.width}x{im.height}")
            im.thumbnail((1440, 1440))
            im.save(dest, "JPEG", quality=78, optimize=True)
    finally:
        tmp.unlink(missing_ok=True)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    missing = []
    for game in GAMES:
        pages = category_pages(game["category"])
        print(f"{game['id']}: {len(pages)} pages", flush=True)
        texts = fetch_wikitext(pages)
        for page in pages:
            text = texts.get(page)
            if not text:
                missing.append((game["id"], page, "no wikitext"))
                continue
            filename = FILE_OVERRIDES.get((page, game["id"])) or pick_file(text, game["tabs"])
            if not filename:
                missing.append((game["id"], page, "no image"))
                continue
            name = field(text, "name") or page.split(" (")[0]
            records.append(
                {
                    "page": page,
                    "file": filename,
                    "id": slug(name, game["id"]),
                    "name": name,
                    "gameId": game["id"],
                    "game": game["name"],
                    "short": game["short"],
                    "year": game["year"],
                    "standard": name in game["launch"],
                    "blurb": blurb_from(text, name) or f"A multiplayer map from {game['short']}.",
                    "source": "https://callofduty.fandom.com/wiki/"
                    + urllib.parse.quote(page.replace(" ", "_")),
                }
            )

    urls = file_urls([record["file"] for record in records])
    jobs = []
    kept = []
    for record in records:
        url = urls.get(record["file"])
        if not url:
            missing.append((record["gameId"], record["page"], f"no url for {record['file']}"))
            continue
        dest = OUT_DIR / f"{record['id']}.jpg"
        record["image"] = f"/maps/{record['id']}.jpg"
        kept.append(record)
        jobs.append((url, dest, record["id"]))

    print(f"downloading {len(jobs)} images", flush=True)
    failures = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(download_jpeg, url, dest): map_id for url, dest, map_id in jobs}
        done = 0
        for future in as_completed(futures):
            done += 1
            map_id = futures[future]
            try:
                future.result()
            except Exception as exc:  # noqa: BLE001
                failures.append((map_id, str(exc)))
            if done % 20 == 0 or done == len(jobs):
                print(f"  {done}/{len(jobs)}", flush=True)

    failed_ids = {map_id for map_id, _ in failures}
    final = []
    for record in kept:
        if record["id"] in failed_ids:
            continue
        final.append({key: record[key] for key in (
            "id",
            "name",
            "gameId",
            "game",
            "short",
            "year",
            "standard",
            "blurb",
            "image",
            "source",
        )})
    final.sort(key=lambda item: (item["year"], item["name"], item["id"]))
    DATA_PATH.write_text(json.dumps(final, indent=2) + "\n")
    print(f"wrote {len(final)} maps")
    if missing:
        print("MISSING")
        for row in missing:
            print(" -", row)
    if failures:
        print("FAILED")
        for row in failures:
            print(" -", row)


if __name__ == "__main__":
    main()
