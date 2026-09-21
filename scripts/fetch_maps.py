#!/usr/bin/env python3
"""Download Call of Duty loading screens from the Call of Duty Wiki.

Covers multiplayer maps from the mainline console games. Images are the
wiki's loading-screen files for that game.
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
    {
        "id": "cod1",
        "name": "Call of Duty",
        "short": "CoD",
        "year": 2003,
        "category": "Category:Call of Duty Multiplayer Maps",
        "tabs": {"cod", "cod1"},
        "skip": {"Stalingrad (United Offensive)"},
        "launch": {
            "Bocage",
            "Brecourt",
            "Carentan",
            "Chateau",
            "Dawnville",
            "Depot",
            "Harbor",
            "Hurtgen",
            "Neuville",
            "Pavlov",
            "POW Camp",
            "Railyard",
            "Rocket",
            "Ship",
            "Tigertown",
        },
    },
    {
        "id": "uo",
        "name": "Call of Duty: United Offensive",
        "short": "United Offensive",
        "year": 2004,
        "category": "Category:Call of Duty: United Offensive Multiplayer Maps",
        "tabs": {"uo", "unitedoffensive"},
        "launch": {
            "Arnhem",
            "Berlin",
            "Cassino",
            "Foy",
            "Italy",
            "Kharkov",
            "Kursk",
            "Peaks",
            "Ponyri",
            "Rhinevalley",
            "Sicily",
            "Stalingrad",
            "Stanjel",
            "Streets",
        },
    },
    {
        "id": "cod2",
        "name": "Call of Duty 2",
        "short": "CoD2",
        "year": 2005,
        "category": "Category:Call of Duty 2 Multiplayer Maps",
        "tabs": {"cod2"},
        "launch": {
            "Beltot",
            "Brecourt",
            "Burgundy",
            "Caen",
            "Carentan",
            "Dawnville",
            "El Alamein",
            "Leningrad",
            "Matmata",
            "Moscow",
            "Toujane",
            "Villers-Bocage",
        },
    },
    {
        "id": "cod3",
        "name": "Call of Duty 3",
        "short": "CoD3",
        "year": 2006,
        "category": "Category:Call of Duty 3 Multiplayer Maps",
        "tabs": {"cod3"},
        "launch": {
            "Aller Haut",
            "Argentan",
            "Champs",
            "Crossing",
            "Eder Dam",
            "Fuel Plant",
            "Gare Centrale",
            "Ironclad",
            "La Bourgade",
            "Les Ormes",
            "Marseilles",
            "Mayenne",
            "Merville",
            "Poisson",
            "Rimling",
            "Rouen",
            "Seine River",
            "Stalag 23",
            "Verdun",
            "Wildwood",
        },
    },
    {
        "id": "ghosts",
        "name": "Call of Duty: Ghosts",
        "short": "Ghosts",
        "year": 2013,
        "category": "Category:Call of Duty: Ghosts Multiplayer Maps",
        "tabs": {"ghosts", "ghost", "gh"},
        "launch": {
            "Chasm",
            "Flooded",
            "Free Fall",
            "Freight",
            "Octane",
            "Overlord",
            "Prison Break",
            "Siege",
            "Sovereign",
            "Stonehaven",
            "Strikezone",
            "Stormfront",
            "Tremor",
            "Warhawk",
            "Whiteout",
        },
    },
    {
        "id": "aw",
        "name": "Call of Duty: Advanced Warfare",
        "short": "AW",
        "year": 2014,
        "category": "Category:Call of Duty: Advanced Warfare Multiplayer Maps",
        "tabs": {"aw", "advancedwarfare"},
        "launch": {
            "Ascend",
            "Atlas Gorge",
            "Bio Lab",
            "Comeback",
            "Defender",
            "Detroit",
            "Greenband",
            "Horizon",
            "Instinct",
            "Recovery",
            "Retreat",
            "Riot",
            "Solar",
            "Terrace",
        },
    },
    {
        "id": "bo3",
        "name": "Call of Duty: Black Ops III",
        "short": "Black Ops III",
        "year": 2015,
        "category": "Category:Call of Duty: Black Ops III Multiplayer Maps",
        "tabs": {"bo3", "boiii", "blackops3", "blackopsiii"},
        "launch": {
            "Aquarium",
            "Breach",
            "Combine",
            "Evac",
            "Exodus",
            "Fringe",
            "Havoc",
            "Hunted",
            "Infection",
            "Metro",
            "Nuk3town",
            "Redwood",
            "Stronghold",
        },
    },
    {
        "id": "iw",
        "name": "Call of Duty: Infinite Warfare",
        "short": "IW",
        "year": 2016,
        "category": "Category:Call of Duty: Infinite Warfare Multiplayer Maps",
        "tabs": {"iw", "infinitewarfare"},
        "launch": {
            "Crusher",
            "Frontier",
            "Frost",
            "Genesis",
            "Grounded",
            "Mayday",
            "Precinct",
            "Retaliation",
            "Scorch",
            "Skydock",
            "Terminal",
            "Throwback",
        },
    },
    {
        "id": "wwii",
        "name": "Call of Duty: WWII",
        "short": "WWII",
        "year": 2017,
        "category": "Category:Call of Duty: WWII Multiplayer Maps",
        "tabs": {"wwii", "ww2"},
        "launch": {
            "Aachen",
            "Ardennes Forest",
            "Carentan",
            "Flak Tower",
            "Gibraltar",
            "Gustav Cannon",
            "London Docks",
            "Pointe du Hoc",
            "Sainte Marie du Mont",
            "USS Texas",
        },
    },
    {
        "id": "bo4",
        "name": "Call of Duty: Black Ops 4",
        "short": "Black Ops 4",
        "year": 2018,
        "category": "Category:Call of Duty: Black Ops 4 Multiplayer Maps",
        "tabs": {"bo4", "blackops4"},
        "launch": {
            "Arsenal",
            "Contraband",
            "Firing Range",
            "Frequency",
            "Gridlock",
            "Hacienda",
            "Icebreaker",
            "Jungle",
            "Militia",
            "Morocco",
            "Nuketown",
            "Payload",
            "Seaside",
            "Slums",
            "Summit",
        },
    },
    {
        "id": "mw2019",
        "name": "Call of Duty: Modern Warfare",
        "short": "MW",
        "year": 2019,
        "category": "Category:Call of Duty: Modern Warfare (2019) Multiplayer Maps",
        "tabs": {"mw2019", "mw"},
        "launch": {
            "Aniyah Palace",
            "Arklov Peak",
            "Azhir Cave",
            "Euphrates Bridge",
            "Grazna Raid",
            "Gun Runner",
            "Hackney Yard",
            "Karst River Quarry",
            "Piccadilly",
            "Rammaza",
            "St. Petrograd",
        },
    },
    {
        "id": "cw",
        "name": "Call of Duty: Black Ops Cold War",
        "short": "Cold War",
        "year": 2020,
        "category": "Category:Call of Duty: Black Ops Cold War Multiplayer Maps",
        "tabs": {"cw", "bocw", "coldwar"},
        "launch": {
            "Armada",
            "Cartel",
            "Checkmate",
            "Crossroads",
            "Garrison",
            "Miami",
            "Moscow",
            "Nuketown '84",
            "Satellite",
            "The Pines",
        },
    },
    {
        "id": "vg",
        "name": "Call of Duty: Vanguard",
        "short": "Vanguard",
        "year": 2021,
        "category": "Category:Call of Duty: Vanguard Multiplayer Maps",
        "tabs": {"vg", "vanguard"},
        "launch": {
            "Berlin",
            "Bocage",
            "Castle",
            "Das Haus",
            "Demyansk",
            "Desert Siege",
            "Dome",
            "Eagle's Nest",
            "Gavutu",
            "Hotel Royal",
            "Numa Numa",
            "Oasis",
            "Red Star",
            "Sub Pens",
            "Tuscan",
        },
    },
    {
        "id": "mwii",
        "name": "Call of Duty: Modern Warfare II",
        "short": "MWII",
        "year": 2022,
        "category": "Category:Call of Duty: Modern Warfare II Multiplayer Maps",
        "tabs": {"mwii"},
        "launch": {
            "Al Bagra Fortress",
            "Breenbergh Hotel",
            "Crown Raceway",
            "El Asilo",
            "Embassy",
            "Farm 18",
            "Mercado Las Almas",
            "Santa Seña",
            "Taraq",
            "Zarqwa Hydroelectric",
        },
    },
    {
        "id": "mwiii",
        "name": "Call of Duty: Modern Warfare III",
        "short": "MWIII",
        "year": 2023,
        "category": "Category:Call of Duty: Modern Warfare III Multiplayer Maps",
        "tabs": {"mwiii"},
        "launch": {
            "Afghan",
            "Derail",
            "Estate",
            "Favela",
            "Highrise",
            "Invasion",
            "Karachi",
            "Levin Resort",
            "Orlov Military Base",
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
        "id": "bo6",
        "name": "Call of Duty: Black Ops 6",
        "short": "Black Ops 6",
        "year": 2024,
        "category": "Category:Call of Duty: Black Ops 6 Multiplayer Maps",
        "tabs": {"bo6", "blackops6"},
        "launch": {
            "Babylon",
            "Derelict",
            "Gala",
            "Lowtown",
            "Nuketown",
            "Payback",
            "Pit",
            "Protocol",
            "Red Card",
            "Rewind",
            "SCUD",
            "Skyline",
            "Stakeout",
            "Subsonic",
            "Vault",
            "Vorkuta",
            "Warhead",
        },
    },
    {
        "id": "bo7",
        "name": "Call of Duty: Black Ops 7",
        "short": "Black Ops 7",
        "year": 2025,
        "category": "Category:Call of Duty: Black Ops 7 Multiplayer Maps",
        "tabs": {"bo7", "blackops7"},
        "launch": {
            "Blackheart",
            "Colossus",
            "Cortex",
            "Den",
            "Exposure",
            "Express",
            "Flagship",
            "Hijacked",
            "Homestead",
            "Imprint",
            "Mission: Edge",
            "Mission: Tide",
            "Nuketown 2025",
            "Paranoia",
            "Raid",
            "Retrieval",
            "Scar",
            "The Forge",
            "Toshin",
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
            "emblem",
            "logo",
            "compass",
            "promo",
            "winners",
        )
    ):
        return -10
    # Tiny HUD icons. Menu icons are the only splash some Black Ops III pages have.
    if "menu icon" in low or "menuicon" in low:
        score = 1
    elif "icon" in low and "menuscreen" not in low and "menu screen" not in low:
        return -8
    else:
        score = 0
    if "menuscreen" in low or "menu screen" in low or "menu_screen" in low:
        score += 4
    if "bare" in low and "load" in low:
        score += 6
    if any(token in low for token in ("load screen", "loadscreen", "loading screen", "loadingscreen", "loading_screen")):
        score += 4
    elif "load" in low:
        score += 2
    if "night" in low or "holiday" in low or "halloween" in low:
        score -= 1
    return score


def label_tabs(label: str) -> set[str]:
    parts = re.split(r"[&/,+]|\band\b", label, flags=re.I)
    return {norm_tab(part) for part in parts if norm_tab(part)}


def tab_matches(label: str, tabs: set[str]) -> bool:
    parts = label_tabs(label)
    return bool(parts & tabs) or norm_tab(label) in tabs


def pick_minimap(wikitext: str, tabs: set[str]) -> str | None:
    match = re.search(r"\|minimap\s*=\s*(.*?)\n\|[A-Za-z]", wikitext, re.S)
    if not match:
        match = re.search(r"\|minimap\s*=\s*(.*?)(?:\n\}\}|\n<)", wikitext, re.S)
    if not match:
        return None
    section = match.group(1)
    if "<tabber>" in section.lower() or "|-|" in section:
        for label, filename in re.findall(
            r"\|-\|\s*([^=\n]+?)\s*=\s*\[\[(?:File|file):([^\]|]+)",
            section,
        ):
            if tab_matches(label, tabs):
                return filename.strip()
    found = re.search(r"\[\[(?:File|file):([^\]|]+)", section)
    return found.group(1).strip() if found else None


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
        # No tab matched. Use the best remaining splash, preferring a daytime plate.
        loose = []
        for filename in re.findall(r"\[\[(?:File|file):([^\]|]+)", section):
            filename = filename.strip()
            score = image_score(filename)
            if score >= 0:
                loose.append((score, filename))
        if not loose:
            return None
        loose.sort(key=lambda item: item[0], reverse=True)
        return loose[0][1]
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def is_launch(page: str, name: str, launch: set[str]) -> bool:
    base = page.split(" (")[0]
    return page in launch or name in launch or base in launch


def display_name(page: str, infobox_name: str | None) -> str:
    """Prefer the page title when the infobox glues two names together."""
    page_name = page.split(" (")[0]
    name = (infobox_name or "").strip() or page_name
    compact = re.sub(r"[\s_]+", "", name).lower()
    page_compact = re.sub(r"[\s_]+", "", page_name).lower()
    if compact == page_compact:
        return page_name
    if name.startswith(page_name) and len(name) > len(page_name) and name[len(page_name)].isupper():
        return page_name
    return name


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
            if im.width < 480:
                raise ValueError(f"too small: {im.width}x{im.height}")
            im.thumbnail((1440, 1440))
            im.save(dest, "JPEG", quality=78, optimize=True)
    finally:
        tmp.unlink(missing_ok=True)


def download_minimap(url: str, dest: Path) -> None:
    sep = "&" if "?" in url else "?"
    jpeg_url = f"{url}{sep}format=original"
    req = urllib.request.Request(jpeg_url, headers={**UA, "Accept": "image/jpeg"})
    with urllib.request.urlopen(req, timeout=60) as res:
        data = res.read()
    tmp = dest.with_suffix(".part")
    tmp.write_bytes(data)
    try:
        with Image.open(tmp) as im:
            if "A" in im.getbands():
                rgba = im.convert("RGBA")
                canvas = Image.new("RGB", rgba.size, (12, 15, 11))
                canvas.paste(rgba, mask=rgba.getchannel("A"))
                im = canvas
            else:
                im = im.convert("RGB")
            if min(im.size) < 180:
                raise ValueError(f"too small: {im.width}x{im.height}")
            im.thumbnail((1024, 1024))
            im.save(dest, "JPEG", quality=82, optimize=True)
    finally:
        tmp.unlink(missing_ok=True)


def attach_minimaps() -> None:
    """Fill maps.json minimap paths from each page's infobox minimap field."""
    import urllib.parse

    minimap_dir = ROOT / "public" / "minimaps"
    minimap_dir.mkdir(parents=True, exist_ok=True)
    records = json.loads(DATA_PATH.read_text())
    tabs_for = {game["id"]: game["tabs"] for game in GAMES}

    def page_title(source: str) -> str:
        slug_part = urllib.parse.unquote(source.rsplit("/", 1)[-1])
        return slug_part.replace("_", " ")

    titles = list(dict.fromkeys(page_title(record["source"]) for record in records))
    print(f"reading {len(titles)} wiki pages", flush=True)
    texts = fetch_wikitext(titles)
    jobs: list[tuple[dict, str]] = []
    missing: list[str] = []
    for record in records:
        text = texts.get(page_title(record["source"]), "")
        filename = pick_minimap(text, tabs_for[record["gameId"]]) if text else None
        if not filename:
            record["minimap"] = None
            missing.append(record["id"])
            continue
        record["minimap"] = f"/minimaps/{record['id']}.jpg"
        jobs.append((record, filename))

    print(f"downloading {len(jobs)} minimaps, {len(missing)} without one", flush=True)
    urls = file_urls([filename for _, filename in jobs])
    failures: list[str] = []

    def fetch_one(record: dict, filename: str) -> None:
        url = urls.get(filename) or urls.get(filename.replace("_", " "))
        if not url:
            raise RuntimeError(f"no url for {filename}")
        dest = minimap_dir / f"{record['id']}.jpg"
        if dest.exists() and dest.stat().st_size > 4000:
            return
        download_minimap(url, dest)

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_one, record, filename): record for record, filename in jobs}
        for future in as_completed(futures):
            record = futures[future]
            try:
                future.result()
            except Exception as exc:
                record["minimap"] = None
                failures.append(f"{record['id']}: {exc}")
                print(f"fail {record['id']}: {exc}", flush=True)

    DATA_PATH.write_text(json.dumps(records, indent=2) + "\n")
    print(f"wrote {DATA_PATH}", flush=True)
    if missing:
        print("no minimap:", ", ".join(missing))
    if failures:
        print("failed:", "; ".join(failures))


def main(games: list[dict] | None = None, merge: bool = False) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    selected = GAMES if games is None else games
    existing = json.loads(DATA_PATH.read_text()) if merge and DATA_PATH.exists() else []
    records = []
    missing = []
    for game in selected:
        pages = [page for page in category_pages(game["category"]) if page not in game.get("skip", ())]
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
            name = display_name(page, field(text, "name"))
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
                    "standard": is_launch(page, name, game["launch"]),
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
        record["minimap"] = None
        kept.append(record)
        if dest.exists() and dest.stat().st_size > 4000:
            continue
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
            "minimap",
            "source",
        )})
    seen = {record["id"] for record in existing}
    final = [record for record in final if record["id"] not in seen]
    final = existing + final
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
    import sys

    if "--minimaps" in sys.argv:
        attach_minimaps()
    elif "--extend" in sys.argv or "--fill" in sys.argv:
        existing = json.loads(DATA_PATH.read_text())
        have = {record["gameId"] for record in existing}
        # --fill retries maps that were skipped inside games already added.
        main([game for game in GAMES if game["id"] not in have or "--fill" in sys.argv and game["id"] not in {
            "cod4", "waw", "mw2", "bo1", "mw3", "bo2"
        }], merge=True)
    else:
        main()
